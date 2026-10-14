import os
import hashlib
import subprocess
import tempfile
import soundfile as sf
import numpy as np
from pathlib import Path
from typing import Tuple

def compute_file_hash(filepath: Path) -> str:
    """Computes SHA-256 hash of a file."""
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            sha256.update(chunk)
    return sha256.hexdigest()

def normalize_audio(input_path: Path, output_dir: Path) -> Tuple[Path, str, str]:
    """
    Converts any audio file to 16kHz mono WAV using ffmpeg.
    Returns (normalized_path, raw_hash, normalized_hash).
    """
    raw_hash = compute_file_hash(input_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # We use a temporary file first, then rename it based on its hash.
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_path = Path(tmp.name)
        
    cmd = [
        "ffmpeg", "-y", "-i", str(input_path),
        "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le",
        str(tmp_path)
    ]
    
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except subprocess.CalledProcessError as e:
        tmp_path.unlink(missing_ok=True)
        raise RuntimeError(f"ffmpeg failed: {e.stderr.decode()}")
        
    norm_hash = compute_file_hash(tmp_path)
    final_path = output_dir / f"{norm_hash}.wav"
    
    # Move tmp to final path
    import shutil
    shutil.move(str(tmp_path), str(final_path))
    
    return final_path, raw_hash, norm_hash

def load_audio(filepath: Path) -> Tuple[np.ndarray, int]:
    """Loads audio file returning waveform and sample rate."""
    y, sr = sf.read(filepath)
    return y, sr
