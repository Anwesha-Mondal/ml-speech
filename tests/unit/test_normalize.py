import pytest
import pandas as pd
import numpy as np
from packages.speech_arena.normalize.two_channel import normalize_two_channel

def test_normalize_two_channel():
    # Construct a mock dataframe
    df = pd.DataFrame({
        'time': [0.0, 0.01, 0.02, 0.03],
        'f0': [100.0, 110.0, 0.0, 200.0],
        'rms': [0.1, 0.2, 0.01, 0.5],
        'voiced': [True, True, False, True]
    })
    
    norm_df = normalize_two_channel(df)
    
    assert 'f0_st' in norm_df
    assert 'rms_db_rel' in norm_df
    assert 'f0_z' in norm_df
    assert 'rms_z' in norm_df
    
    # Check that unvoiced frames are NaN for f0_st
    assert pd.isna(norm_df.loc[2, 'f0_st'])
    
    # Check monotonic behavior in semitones
    assert norm_df.loc[3, 'f0_st'] > norm_df.loc[1, 'f0_st']
    assert norm_df.loc[1, 'f0_st'] > norm_df.loc[0, 'f0_st']
