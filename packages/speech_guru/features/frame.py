import numpy as np
import librosa
import parselmouth
from parselmouth.praat import call
import pandas as pd

def extract_frame_features(audio_path: str, hop_ms: int = 10) -> pd.DataFrame:
    """
    Extracts frame-level features at a fixed hop size.
    Features: F0, RMS, MFCC-13, HNR, CPP.
    """
    y, sr = librosa.load(audio_path, sr=16000)
    snd = parselmouth.Sound(audio_path)
    
    hop_length = int(sr * (hop_ms / 1000.0))
    
    # F0 via Parselmouth
    pitch = snd.to_pitch(time_step=hop_ms/1000.0, pitch_floor=75.0, pitch_ceiling=500.0)
    f0_values = pitch.selected_array['frequency']
    times = pitch.xs()
    
    # RMS Energy
    rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=hop_length)[0]
    
    # MFCCs
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13, hop_length=hop_length)
    
    # Harmonicity (HNR)
    try:
        harmonicity = snd.to_harmonicity_cc(time_step=hop_ms/1000.0)
        hnr_values = harmonicity.values[0]
    except:
        hnr_values = np.zeros(len(times))
    
    # Cepstral Peak Prominence (CPP)
    try:
        power_cepstrum = call(snd, "To PowerCepstrum", pitch.pitch_floor, 0.002, 0.05, 50.0)
        cpp_values = []
        for t in times:
            try:
                cpp = call(power_cepstrum, "Get peak prominence", t, "Interpolation")
                cpp_values.append(cpp)
            except:
                cpp_values.append(np.nan)
    except:
        cpp_values = [np.nan] * len(times)
            
    # Align lengths
    min_len = min(len(f0_values), len(rms), len(mfcc[0]), len(hnr_values), len(cpp_values))
    
    df = pd.DataFrame({
        'time': times[:min_len],
        'f0': f0_values[:min_len],
        'rms': rms[:min_len],
        'hnr': hnr_values[:min_len],
        'cpp': cpp_values[:min_len],
        'voiced': f0_values[:min_len] > 0
    })
    
    for i in range(13):
        df[f'mfcc_{i+1}'] = mfcc[i][:min_len]
        
    return df
