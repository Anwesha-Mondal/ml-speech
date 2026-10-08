import librosa
import soundfile as sf
import numpy as np

def stretch_audio(y, sr, rate):
    """Time-stretch audio without changing pitch"""
    return librosa.effects.time_stretch(y, rate=rate)

def alter_energy(y, factor):
    """Multiply signal amplitude by a factor"""
    return y * factor

def add_noise(y, noise_level=0.005):
    """Add white noise"""
    noise = np.random.randn(len(y))
    return y + noise_level * noise

def generate_variants(input_path, output_dir, prefix):
    """Generate controlled flaw variants for a clean audio file"""
    import os
    os.makedirs(output_dir, exist_ok=True)
    
    y, sr = librosa.load(input_path, sr=16000)
    
    manifest_entries = []
    
    # Clean copy
    sf.write(os.path.join(output_dir, f"{prefix}_clean.wav"), y, sr)
    manifest_entries.append({"file": f"{prefix}_clean.wav", "flaw": "IDEAL"})
    
    # 1. TOO_FAST (1.3x speed)
    y_fast = stretch_audio(y, sr, 1.3)
    sf.write(os.path.join(output_dir, f"{prefix}_fast.wav"), y_fast, sr)
    manifest_entries.append({"file": f"{prefix}_fast.wav", "flaw": "TOO_FAST"})
    
    # 2. TOO_SLOW (0.7x speed)
    y_slow = stretch_audio(y, sr, 0.7)
    sf.write(os.path.join(output_dir, f"{prefix}_slow.wav"), y_slow, sr)
    manifest_entries.append({"file": f"{prefix}_slow.wav", "flaw": "TOO_SLOW"})
    
    # 3. LOW_ENERGY
    y_low = alter_energy(y, 0.3)
    sf.write(os.path.join(output_dir, f"{prefix}_low_energy.wav"), y_low, sr)
    manifest_entries.append({"file": f"{prefix}_low_energy.wav", "flaw": "LOW_ENERGY"})
    
    # 4. HIGH_ENERGY
    y_high = alter_energy(y, 2.0)
    y_high = np.clip(y_high, -1.0, 1.0) # clip to prevent overflow
    sf.write(os.path.join(output_dir, f"{prefix}_high_energy.wav"), y_high, sr)
    manifest_entries.append({"file": f"{prefix}_high_energy.wav", "flaw": "HIGH_ENERGY"})
    
    return manifest_entries
