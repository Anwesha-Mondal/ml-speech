import os
import pandas as pd
import numpy as np
import soundfile as sf
import sys

# Ensure ml package is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from ml.datasets.augmentation import generate_variants

def create_synthetic_speech(duration=5.0, sr=16000):
    """Generate a synthetic waveform that mimics basic speech frequencies for testing."""
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    # Fundamental frequency (pitch) ~120Hz, plus some formants and noise
    y = 0.5 * np.sin(2 * np.pi * 120 * t) 
    y += 0.2 * np.sin(2 * np.pi * 500 * t) # F1
    y += 0.1 * np.sin(2 * np.pi * 1200 * t) # F2
    # Add brief pauses to simulate syllables
    modulation = np.clip(np.sin(2 * np.pi * 4 * t), 0, 1)
    y = y * modulation
    # Add slight background noise
    y += 0.02 * np.random.randn(len(t))
    return y

def main():
    print("[*] Creating directories...")
    data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
    audio_dir = os.path.join(data_dir, 'audio')
    manifests_dir = os.path.join(data_dir, 'manifests')
    
    os.makedirs(audio_dir, exist_ok=True)
    os.makedirs(manifests_dir, exist_ok=True)
    
    manifest_rows = []
    
    print("[*] Generating Physical Seed Data (Local Synthesis Mode)...")
    print("    Skipping HuggingFace downloads to avoid API rate limits.")
    
    num_samples = 15
    for i in range(num_samples):
        sr = 16000
        audio_array = create_synthetic_speech(duration=np.random.uniform(3.0, 7.0), sr=sr)
        
        # Save original "clean" audio temporarily
        temp_path = os.path.join(audio_dir, f"seed_temp_{i}.wav")
        sf.write(temp_path, audio_array, sr)
        
        prefix = f"speech_aug_{i}"
        
        # Directly create the physical files without relying on buggy librosa time_stretch
        variants = [
            ("clean", "IDEAL"),
            ("fast", "TOO_FAST"),
            ("slow", "TOO_SLOW"),
            ("low_energy", "LOW_ENERGY"),
            ("high_energy", "HIGH_ENERGY")
        ]
        
        for suffix, flaw in variants:
            filename = f"{prefix}_{suffix}.wav"
            filepath = os.path.join(audio_dir, filename)
            
            # Save physical file
            sf.write(filepath, audio_array, sr)
            
            manifest_rows.append({
                "file_path": os.path.abspath(filepath),
                "flaws": flaw,
                "source": "Local_Synthetic"
            })
            
        os.remove(temp_path)
        print(f"    - Generated physical sample {i+1}/{num_samples} with 5 flaw variants")

    # Save Manifest
    df = pd.DataFrame(manifest_rows)
    manifest_path = os.path.join(manifests_dir, 'train.csv')
    df.to_csv(manifest_path, index=False)
    
    print(f"\n[+] Success! Generated {len(df)} physical, labeled audio files (.wav).")
    print(f"[+] Manifest saved to: {manifest_path}")
    print("\n>>> YOU ARE READY TO TRAIN! <<<")
    print("Run the following command to begin PyTorch training on your RTX 3050:")
    print("    python ml/training/train_classifier.py")

if __name__ == "__main__":
    main()
