import pytest
import numpy as np
import tempfile
import soundfile as sf
from pathlib import Path
from packages.speech_arena.audio.qc import compute_clipping_ratio, estimate_snr, check_length
from packages.speech_arena.audio.io import compute_file_hash

def test_clipping_ratio():
    # Create a 1-second sine wave
    t = np.linspace(0, 1, 16000, False)
    clean_wave = np.sin(2 * np.pi * 440 * t) # amplitude 1.0
    
    ratio = compute_clipping_ratio(clean_wave, 0.99)
    assert ratio > 0.0 # it hits the peaks
    
    quiet_wave = 0.5 * clean_wave
    ratio_quiet = compute_clipping_ratio(quiet_wave, 0.99)
    assert ratio_quiet == 0.0

def test_snr():
    # high SNR
    t = np.linspace(0, 1, 16000, False)
    signal = np.sin(2 * np.pi * 440 * t)
    # Add quiet part (noise floor)
    signal[:4000] = 0.01 * np.random.randn(4000)
    
    snr = estimate_snr(signal)
    assert snr > 20.0 # Should be high SNR

def test_check_length():
    sr = 16000
    wave = np.zeros(sr * 2) # 2 seconds
    assert check_length(wave, sr, min_sec=1.0, max_sec=3.0)
    assert not check_length(wave, sr, min_sec=3.0, max_sec=5.0)

def test_compute_hash():
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp.write(b"hello world")
        tmp_path = Path(tmp.name)
    
    hash_val = compute_file_hash(tmp_path)
    assert hash_val == "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
    tmp_path.unlink()
