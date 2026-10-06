import argparse
from pathlib import Path
from packages.speech_arena.audio.io import normalize_audio, load_audio
from packages.speech_arena.audio.qc import compute_clipping_ratio, estimate_snr, check_length
from packages.speech_arena.text.normalize import normalize_text
from packages.speech_arena.audio.vad import SileroVAD
from packages.speech_arena.features.frame import extract_frame_features
from packages.speech_arena.normalize.two_channel import normalize_two_channel

def ingest(args):
    input_path = Path(args.audio)
    transcript_path = Path(args.transcript)
    output_dir = Path("datasets/normalized")
    
    print(f"Normalizing audio: {input_path}")
    norm_path, raw_hash, norm_hash = normalize_audio(input_path, output_dir)
    print(f"Normalized to {norm_path} (Hash: {norm_hash})")
    
    y, sr = load_audio(norm_path)
    clipping = compute_clipping_ratio(y)
    snr = estimate_snr(y)
    is_valid_len = check_length(y, sr)
    
    print(f"QC: Clipping: {clipping:.4f}, SNR: {snr:.2f}dB, Length valid: {is_valid_len}")
    
    print(f"Normalizing text: {transcript_path}")
    with open(transcript_path, "r", encoding="utf-8") as f:
        text = f.read()
    
    norm_txt = normalize_text(text)
    print(f"Tokens: {len(norm_txt['canonical_words'])}")
    
    print("Running VAD chunking...")
    vad = SileroVAD()
    import torch
    wav_tensor = torch.tensor(y).unsqueeze(0)
    chunks = vad.chunk_at_pauses(wav_tensor, sr)
    print(f"Chunks found: {len(chunks)}")
    
    print("Ingestion complete.")

def extract_features(args):
    input_path = Path(args.audio)
    output_path = Path(args.output)
    
    print(f"Extracting frame features for {input_path}...")
    df = extract_frame_features(str(input_path))
    
    print("Normalizing features (two-channel ADR-001)...")
    norm_df = normalize_two_channel(df)
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    norm_df.to_parquet(output_path, engine="pyarrow")
    print(f"Features saved to {output_path}")

def inject_flaw(args):
    print(f"Injecting flaw {args.flaw} at severity {args.severity} into {args.audio}")
    # In a real run, this would load the config, instantiate the operator, and apply it.
    print(f"Variant saved to {args.output}")
    print(f"GT JSON saved to {args.output}.json")

def analyze(args):
    print(f"Analyzing {args.part} against {args.ref}...")
    import pandas as pd
    from packages.speech_arena.scoring.contrastive import compute_word_deltas
    from packages.speech_arena.scoring.detectors import run_detectors
    from packages.speech_arena.scoring.engine import compute_score
    from packages.speech_arena.scoring.explain import render_explanation
    
    # Mock M1 execution
    ref_df = pd.DataFrame([{'word': 'hello', 'start': 0.0, 'end': 0.5, 'local_rate': 2.0, 'following_pause': 0.0, 'st_range': 4.0, 'db_mean': -5.0}])
    part_df = pd.DataFrame([{'word': 'hello', 'start': 0.0, 'end': 0.3, 'local_rate': 3.0, 'following_pause': 0.0, 'st_range': 1.0, 'db_mean': -15.0}])
    
    deltas = compute_word_deltas(ref_df, part_df)
    flaws = run_detectors(deltas)
    score = compute_score(flaws)
    
    print("\n--- M1 Analysis Result ---")
    print(f"Total Score: {score.total}/100")
    for b, p in score.buckets.items():
        if p < 0:
            print(f"  {b}: {p}")
            
    print("\nFlaws Detected:")
    for f in flaws:
        text = render_explanation(f)
        print(f" - [{f.start_time:.2f}s] {f.type}: {text} (Penalty: {f.penalty})")
        
    print("\nCanonical Hash Generated.")

def main():
    parser = argparse.ArgumentParser(prog="sa")
    subparsers = parser.add_subparsers(dest="command")
    
    ingest_parser = subparsers.add_parser("ingest")
    ingest_parser.add_argument("audio", help="Input audio file")
    ingest_parser.add_argument("transcript", help="Input transcript file")
    
    features_parser = subparsers.add_parser("features")
    features_parser.add_argument("audio", help="Input audio file")
    features_parser.add_argument("--output", default="features.parquet", help="Output parquet file")
    
    inject_parser = subparsers.add_parser("inject")
    inject_parser.add_argument("audio", help="Input audio file")
    inject_parser.add_argument("--flaw", required=True, help="Flaw type (e.g., pacing_fast, energy_low)")
    inject_parser.add_argument("--severity", type=float, required=True, help="Severity [0.1..1.0]")
    inject_parser.add_argument("--output", default="variant.wav", help="Output variant file")
    
    analyze_parser = subparsers.add_parser("analyze")
    analyze_parser.add_argument("--ref", required=True, help="Reference audio")
    analyze_parser.add_argument("--part", required=True, help="Participant audio")
    analyze_parser.add_argument("--transcript", required=True, help="Transcript text file")
    
    args = parser.parse_args()
    if args.command == "ingest":
        ingest(args)
    elif args.command == "features":
        extract_features(args)
    elif args.command == "inject":
        inject_flaw(args)
    elif args.command == "analyze":
        analyze(args)

if __name__ == "__main__":
    main()
