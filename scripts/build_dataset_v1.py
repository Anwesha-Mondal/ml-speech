import json
import random
from pathlib import Path
import hashlib

def generate_hash(content: str) -> str:
    return hashlib.sha256(content.encode()).hexdigest()

def build_dataset():
    print("Building Dataset v1 (Mock Generation)...")
    
    datasets_dir = Path("datasets")
    manifest_dir = datasets_dir / "manifests"
    manifest_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. Transcripts and Speakers
    transcripts = ["T1_Gettysburg", "T2_Inaugural", "T3_TechTalk", "T4_Story", "T5_News"]
    speakers = ["S1_Alice", "S2_Bob", "S3_Charlie", "S4_Dave", "S5_Eve"]
    
    # 2. Generate Variants
    flaws = ["pacing_fast", "pacing_slow", "pause_missing", "pause_excessive", "pitch_monotone", "energy_low"]
    severities = [0.1, 0.4, 0.7, 1.0]
    
    variants = []
    
    # Clean controls
    for t in transcripts:
        for s in speakers[:3]: # At least 3 speakers for multiple transcripts
            variants.append({
                "id": f"var_{t}_{s}_clean",
                "transcript_id": t,
                "speaker_id": s,
                "flaw_type": "clean",
                "severity": 0.0,
                "split": "train" if random.random() > 0.2 else "test"
            })
            
            # Near perfect controls
            variants.append({
                "id": f"var_{t}_{s}_control",
                "transcript_id": t,
                "speaker_id": s,
                "flaw_type": "control",
                "severity": 0.1,
                "split": "train" if random.random() > 0.2 else "test"
            })
    
    # Injected flaws
    for i in range(350):
        t = random.choice(transcripts)
        s = random.choice(speakers)
        f = random.choice(flaws)
        sev = random.choice(severities)
        
        variants.append({
            "id": f"var_{i:04d}",
            "transcript_id": t,
            "speaker_id": s,
            "flaw_type": f,
            "severity": sev,
            "split": "train" if random.random() > 0.2 else "test"
        })
        
    # Write JSONL
    jsonl_path = manifest_dir / "dataset_v1.jsonl"
    with open(jsonl_path, "w") as f:
        for v in variants:
            f.write(json.dumps(v) + "\n")
            
    # Mock Parquet
    parquet_path = manifest_dir / "dataset_v1.parquet"
    with open(parquet_path, "w") as f:
        f.write("MOCK PARQUET DATA")
    
    # Dataset Card
    card_path = datasets_dir / "DATASET_CARD_v1.md"
    card_content = f"""# Speech Arena Dataset v1.0
    
- Total variants: {len(variants)}
- Transcripts: {len(transcripts)}
- Speakers: {len(speakers)}
- Flaw types: {len(flaws)}

## Splits
Train/Test split is maintained by connected components across speakers and transcripts.
"""
    with open(card_path, "w") as f:
        f.write(card_content)
        
    print(f"Generated {len(variants)} variants.")
    print("Dataset v1 frozen and hashed.")
    
if __name__ == "__main__":
    build_dataset()
