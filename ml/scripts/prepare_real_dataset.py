"""
Speech Arena: Real-World Dataset Pipeline
Implements the dataset integration strategy outlined in FUTURE_DATASETS.md:
- Downloads/ingests real human speech from OpenSLR LibriSpeech corpus.
- Standardizes audio (16kHz mono).
- Applies controlled acoustic flaw perturbations (pacing, energy, pitch, pauses).
- Partitions into speaker-disjoint train.csv (80%) and val.csv (20%) manifests.
"""

import os
import sys
import argparse
import tarfile
import urllib.request
from pathlib import Path
import soundfile as sf
import librosa
import numpy as np
import pandas as pd
from tqdm import tqdm

# Ensure ml package is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ml.datasets.augmentation import generate_variants

OPENSLR_DEV_CLEAN_URL = "https://www.openslr.org/resources/12/dev-clean.tar.gz"

def download_file_with_progress(url: str, dest_path: Path):
    """Download file with visual progress reporting."""
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    if dest_path.exists():
        print(f"[*] Archive already exists at {dest_path}, skipping download.")
        return

    print(f"[*] Downloading real speech corpus from: {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "SpeechArena/1.0"})
    
    with urllib.request.urlopen(req) as response:
        total_size = int(response.headers.get("Content-Length", 0))
        chunk_size = 1024 * 1024 # 1 MB chunks
        downloaded = 0
        
        with open(dest_path, "wb") as f:
            while True:
                chunk = response.read(chunk_size)
                if not chunk:
                    break
                f.write(chunk)
                downloaded += len(chunk)
                if total_size > 0:
                    percent = (downloaded / total_size) * 100
                    mb = downloaded / (1024 * 1024)
                    total_mb = total_size / (1024 * 1024)
                    print(f"\r    Downloading: {mb:.1f} MB / {total_mb:.1f} MB ({percent:.1f}%)", end="", flush=True)
                else:
                    mb = downloaded / (1024 * 1024)
                    print(f"\r    Downloaded: {mb:.1f} MB", end="", flush=True)
    print("\n[+] Download complete!")

def extract_tar_gz(archive_path: Path, extract_dir: Path):
    """Extract .tar.gz archive if not already extracted."""
    flag_file = extract_dir / ".extracted"
    if flag_file.exists():
        print(f"[*] Dataset already extracted at {extract_dir}.")
        return

    print(f"[*] Extracting {archive_path.name} to {extract_dir}...")
    extract_dir.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive_path, "r:gz") as tar:
        tar.extractall(path=extract_dir)
        
    with open(flag_file, "w") as f:
        f.write("OK")
    print("[+] Extraction complete!")

def process_and_augment(
    raw_audio_dir: Path,
    output_audio_dir: Path,
    manifests_dir: Path,
    max_seeds: int = 50,
    val_ratio: float = 0.20
):
    """
    Ingest real speaker audio, generate clean and flawed physical variants,
    and build speaker-disjoint train/val manifests.
    """
    output_audio_dir.mkdir(parents=True, exist_ok=True)
    manifests_dir.mkdir(parents=True, exist_ok=True)

    # 1. Discover all audio files (FLAC or WAV) in raw directory
    audio_files = sorted(list(raw_audio_dir.rglob("*.flac")) + list(raw_audio_dir.rglob("*.wav")))
    if not audio_files:
        raise FileNotFoundError(f"No audio files found in {raw_audio_dir}")

    print(f"[*] Discovered {len(audio_files)} real speech utterances.")

    # 2. Extract speaker IDs (LibriSpeech format: {speaker_id}-{chapter_id}-{utterance_id}.flac)
    speaker_map = {}
    for f in audio_files:
        # Speaker ID is the first token or parent folder
        speaker_id = f.name.split("-")[0] if "-" in f.name else f.parent.name
        if speaker_id not in speaker_map:
            speaker_map[speaker_id] = []
        speaker_map[speaker_id].append(f)

    speakers = sorted(list(speaker_map.keys()))
    print(f"[*] Discovered {len(speakers)} distinct real speakers.")

    # 3. Partition speakers into train vs val (prevent speaker leakage!)
    np.random.seed(42)
    shuffled_speakers = np.random.permutation(speakers)
    num_val_speakers = max(1, int(len(speakers) * val_ratio))
    val_speakers = set(shuffled_speakers[:num_val_speakers])
    train_speakers = set(shuffled_speakers[num_val_speakers:])

    print(f"[*] Speaker Split: {len(train_speakers)} train speakers, {len(val_speakers)} validation speakers.")

    train_rows = []
    val_rows = []
    processed_count = 0

    print(f"[*] Ingesting and augmenting up to {max_seeds} real speech seeds...")
    
    # Select seeds evenly across speakers
    selected_files = []
    per_speaker_limit = max(1, max_seeds // len(speakers))
    
    for spk in speakers:
        spk_files = speaker_map[spk][:per_speaker_limit]
        for sf_path in spk_files:
            selected_files.append((spk, sf_path))
            if len(selected_files) >= max_seeds:
                break
        if len(selected_files) >= max_seeds:
            break

    for spk, file_path in tqdm(selected_files, desc="Processing Audio"):
        prefix = f"real_{spk}_{file_path.stem}"
        split = "val" if spk in val_speakers else "train"
        target_rows = val_rows if split == "val" else train_rows

        try:
            # Generate clean control + all flaw variants
            variants = generate_variants(str(file_path), str(output_audio_dir), prefix)
            
            for v in variants:
                out_path = output_audio_dir / v["file"]
                target_rows.append({
                    "file_path": str(out_path.resolve()),
                    "flaws": v["flaw"],
                    "speaker_id": spk,
                    "split": split,
                    "source": "OpenSLR_LibriSpeech"
                })
            processed_count += 1
        except Exception as e:
            print(f"    [!] Error processing {file_path.name}: {e}")

    # 4. Save train.csv and val.csv
    train_df = pd.DataFrame(train_rows)
    val_df = pd.DataFrame(val_rows)

    train_csv_path = manifests_dir / "train.csv"
    val_csv_path = manifests_dir / "val.csv"

    train_df.to_csv(train_csv_path, index=False)
    val_df.to_csv(val_csv_path, index=False)

    print("\n==================================================")
    print("      REAL-WORLD DATASET PIPELINE COMPLETE        ")
    print("==================================================")
    print(f"[*] Total Seed Utterances Ingested : {processed_count}")
    print(f"[*] Total Physical Audio Variants  : {len(train_df) + len(val_df)}")
    print(f"[*] Train Samples (train.csv)     : {len(train_df)} audio files")
    print(f"[*] Validation Samples (val.csv)  : {len(val_df)} audio files")
    print(f"[*] Target Directory              : {output_audio_dir}")
    print(f"[*] Manifests Saved               : {manifests_dir}")
    print("==================================================\n")
    print("Class Distribution in Training Set:")
    print(train_df["flaws"].value_counts().to_string())
    print("\n>>> READY TO RUN MULTI-LABEL GPU TRAINING! <<<")
    print("Run: .\\.venv\\Scripts\\python.exe ml/training/train_classifier.py\n")

def main():
    parser = argparse.ArgumentParser(description="Prepare real-world speech dataset for model training")
    parser.add_argument("--max-seeds", type=int, default=40, help="Maximum number of clean seed utterances to ingest (default: 40, yielding ~280 augmented variants)")
    parser.add_argument("--skip-download", action="store_true", help="Skip downloading archive if already downloaded")
    args = parser.parse_args()

    data_dir = PROJECT_ROOT / "ml" / "data"
    raw_dir = data_dir / "raw" / "librispeech"
    archive_path = data_dir / "raw" / "dev-clean.tar.gz"
    output_audio_dir = data_dir / "audio"
    manifests_dir = data_dir / "manifests"

    if not args.skip_download:
        download_file_with_progress(OPENSLR_DEV_CLEAN_URL, archive_path)
        extract_tar_gz(archive_path, raw_dir)

    # In LibriSpeech, extracted audio is located inside raw_dir / "LibriSpeech" / "dev-clean"
    libri_root = raw_dir / "LibriSpeech" / "dev-clean"
    if not libri_root.exists():
        libri_root = raw_dir

    process_and_augment(
        raw_audio_dir=libri_root,
        output_audio_dir=output_audio_dir,
        manifests_dir=manifests_dir,
        max_seeds=args.max_seeds
    )

if __name__ == "__main__":
    main()
