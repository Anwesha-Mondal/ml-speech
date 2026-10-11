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

def insert_excessive_pause(y, sr, pause_sec=1.5):
    """Insert an unnatural silence gap in speech."""
    midpoint = len(y) // 2
    silence = np.random.normal(0, 1e-5, int(sr * pause_sec)).astype(y.dtype)
    return np.concatenate([y[:midpoint], silence, y[midpoint:]])

def remove_pauses(y, sr, top_db=25):
    """Trim silence intervals to simulate rushed, pause-omitted delivery."""
    intervals = librosa.effects.split(y, top_db=top_db)
    if len(intervals) > 1:
        pieces = [y[start:end] for start, end in intervals]
        return np.concatenate(pieces)
    return stretch_audio(y, sr, 1.30)

def flatten_pitch_monotone(y, sr):
    """Compress pitch dynamic range to simulate monotone delivery."""
    try:
        y_low = librosa.effects.pitch_shift(y, sr=sr, n_steps=-1)
        y_high = librosa.effects.pitch_shift(y, sr=sr, n_steps=1)
        return (0.5 * y + 0.25 * y_low + 0.25 * y_high).astype(y.dtype)
    except Exception:
        return y

def generate_variants(input_path, output_dir, prefix):
    """Generate controlled flaw variants for a clean audio file"""
    import os
    os.makedirs(output_dir, exist_ok=True)
    
    y, sr = librosa.load(input_path, sr=16000)
    
    manifest_entries = []
    
    # 0. Clean copy -> IDEAL
    sf.write(os.path.join(output_dir, f"{prefix}_clean.wav"), y, sr)
    manifest_entries.append({"file": f"{prefix}_clean.wav", "flaw": "IDEAL"})
    
    # 1. TOO_FAST (1.35x speed)
    y_fast = stretch_audio(y, sr, 1.35)
    sf.write(os.path.join(output_dir, f"{prefix}_fast.wav"), y_fast, sr)
    manifest_entries.append({"file": f"{prefix}_fast.wav", "flaw": "TOO_FAST"})
    
    # 2. TOO_SLOW (0.70x speed)
    y_slow = stretch_audio(y, sr, 0.70)
    sf.write(os.path.join(output_dir, f"{prefix}_slow.wav"), y_slow, sr)
    manifest_entries.append({"file": f"{prefix}_slow.wav", "flaw": "TOO_SLOW"})
    
    # 3. LOW_ENERGY (0.30 amplitude)
    y_low = alter_energy(y, 0.30)
    sf.write(os.path.join(output_dir, f"{prefix}_low_energy.wav"), y_low, sr)
    manifest_entries.append({"file": f"{prefix}_low_energy.wav", "flaw": "LOW_ENERGY"})
    
    # 4. HIGH_ENERGY (2.0 amplitude, clipped)
    y_high = alter_energy(y, 2.0)
    y_high = np.clip(y_high, -1.0, 1.0)
    sf.write(os.path.join(output_dir, f"{prefix}_high_energy.wav"), y_high, sr)
    manifest_entries.append({"file": f"{prefix}_high_energy.wav", "flaw": "HIGH_ENERGY"})

    # 5. MONOTONE (flattened pitch dynamics)
    y_mono = flatten_pitch_monotone(y, sr)
    sf.write(os.path.join(output_dir, f"{prefix}_monotone.wav"), y_mono, sr)
    manifest_entries.append({"file": f"{prefix}_monotone.wav", "flaw": "MONOTONE"})

    # 6. EXCESSIVE_PAUSE (unnatural silence insertion)
    y_pause = insert_excessive_pause(y, sr, pause_sec=1.2)
    sf.write(os.path.join(output_dir, f"{prefix}_pause.wav"), y_pause, sr)
    manifest_entries.append({"file": f"{prefix}_pause.wav", "flaw": "EXCESSIVE_PAUSE"})
    
    return manifest_entries
