import librosa
import numpy as np

def extract_acoustic_features(y, sr=16000):
    """
    Extract classical acoustic features:
    - RMS Energy (mean, std)
    - Zero Crossing Rate (mean)
    - Spectral Centroid (mean)
    - Speaking Rate proxy (onset detection)
    Returns a numpy array of features.
    """
    # Energy
    rms = librosa.feature.rms(y=y)[0]
    rms_mean = np.mean(rms)
    rms_std = np.std(rms)
    
    # Pitch (using librosa piptrack as simple proxy)
    pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
    pitch_mean = np.mean(pitches[pitches > 0]) if np.any(pitches > 0) else 0.0
    
    # Spectral
    cent = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    cent_mean = np.mean(cent)
    
    # ZCR
    zcr = librosa.feature.zero_crossing_rate(y)[0]
    zcr_mean = np.mean(zcr)
    
    # Onsets (proxy for speaking rate/events)
    onset_frames = librosa.onset.onset_detect(y=y, sr=sr)
    onset_rate = len(onset_frames) / (len(y) / sr) if len(y) > 0 else 0
    
    features = np.array([
        rms_mean, rms_std, pitch_mean, cent_mean, zcr_mean, onset_rate
    ], dtype=np.float32)
    
    # Replace NaNs
    features = np.nan_to_num(features)
    return features
