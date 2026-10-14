import numpy as np

def compute_clipping_ratio(waveform: np.ndarray, threshold: float = 0.99) -> float:
    """Calculates the ratio of samples that exceed the given amplitude threshold."""
    if waveform.size == 0:
        return 0.0
    # For normalized float32 audio [-1.0, 1.0]
    clipped_samples = np.sum(np.abs(waveform) >= threshold)
    return float(clipped_samples / waveform.size)

def estimate_snr(waveform: np.ndarray, noise_percentile: int = 10) -> float:
    """
    Rough SNR estimate. We assume the bottom `noise_percentile` of frame energies
    represent the noise floor, and the mean of the rest represents signal.
    """
    if waveform.size == 0:
        return 0.0
    
    # Frame the audio (e.g., 20ms frames at 16kHz)
    frame_length = 320
    if len(waveform) < frame_length:
        return 0.0
        
    num_frames = len(waveform) // frame_length
    frames = np.reshape(waveform[:num_frames * frame_length], (num_frames, frame_length))
    energies = np.sum(frames ** 2, axis=1) + 1e-10 # prevent log(0)
    
    noise_threshold = np.percentile(energies, noise_percentile)
    noise_frames = energies[energies <= noise_threshold]
    signal_frames = energies[energies > noise_threshold]
    
    if len(noise_frames) == 0 or len(signal_frames) == 0:
        return 0.0
        
    noise_power = np.mean(noise_frames)
    signal_power = np.mean(signal_frames)
    
    snr = 10 * np.log10(signal_power / noise_power)
    return float(snr)

def check_length(waveform: np.ndarray, sr: int, min_sec: float = 1.0, max_sec: float = 3600.0) -> bool:
    """Checks if audio length is within bounds."""
    duration = len(waveform) / sr
    return min_sec <= duration <= max_sec
