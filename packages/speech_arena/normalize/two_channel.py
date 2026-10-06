import numpy as np
import pandas as pd

def normalize_two_channel(df: pd.DataFrame) -> pd.DataFrame:
    """
    Implements ADR-001 Two-Channel Normalization.
    Channel 1 (Magnitude):
    - F0 -> Semitones relative to median F0 (preserves variance)
    - RMS -> dB relative to integrated speech loudness
    
    Channel 2 (Shape):
    - F0 -> Z-scored semitones
    - RMS -> Z-scored dB
    """
    df = df.copy()
    
    # Magnitude Channel - Semitones (F0)
    if 'voiced' in df and df['voiced'].any():
        voiced_f0 = df.loc[df['voiced'], 'f0']
        median_f0 = voiced_f0.median()
        # st = 12 * log2(f0 / median_f0)
        df['f0_st'] = np.where(df['voiced'], 12 * np.log2((df['f0'] + 1e-9) / (median_f0 + 1e-9)), np.nan)
    else:
        df['f0_st'] = np.nan
        
    # Magnitude Channel - dB (RMS)
    if 'voiced' in df and df['voiced'].any():
        voiced_rms = df.loc[df['voiced'], 'rms']
        ref_rms = voiced_rms.mean()
        df['rms_db_rel'] = 20 * np.log10((df['rms'] + 1e-9) / (ref_rms + 1e-9))
    else:
        df['rms_db_rel'] = 20 * np.log10(df.get('rms', np.ones(len(df))) + 1e-9)
        
    # Shape Channel - Z-Scores
    if 'f0_st' in df and not df['f0_st'].isna().all():
        st_mean = df['f0_st'].mean()
        st_std = df['f0_st'].std() + 1e-9
        df['f0_z'] = (df['f0_st'] - st_mean) / st_std
    else:
        df['f0_z'] = np.nan
        
    if 'rms_db_rel' in df:
        db_mean = df['rms_db_rel'].mean()
        db_std = df['rms_db_rel'].std() + 1e-9
        df['rms_z'] = (df['rms_db_rel'] - db_mean) / db_std
    
    return df
