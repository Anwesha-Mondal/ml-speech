import pytest
import pandas as pd
from packages.speech_arena.features.units import count_syllables, aggregate_word_features
from packages.schemas.alignment import WordTimestamp

def test_count_syllables():
    assert count_syllables("hello") == 2
    assert count_syllables("world") == 1
    assert count_syllables("consecrate") == 3

def test_aggregate_word_features():
    words = [
        WordTimestamp(word="hello", start=0.0, end=0.5),
        WordTimestamp(word="world", start=1.0, end=1.5)
    ]
    
    frame_df = pd.DataFrame({
        'time': [0.1, 0.2, 0.3, 1.1, 1.2],
        'f0_st': [0.0, 1.0, 2.0, 5.0, 6.0],
        'rms_db_rel': [-5.0, -4.0, -3.0, 0.0, 1.0]
    })
    
    agg_df = aggregate_word_features(words, frame_df)
    assert len(agg_df) == 2
    
    # Check 'hello'
    assert agg_df.loc[0, 'word'] == 'hello'
    assert agg_df.loc[0, 'syllables'] == 2
    assert agg_df.loc[0, 'local_rate'] == 4.0 # 2 / 0.5
    assert agg_df.loc[0, 'following_pause'] == 0.5 # 1.0 - 0.5
    assert agg_df.loc[0, 'st_mean'] == 1.0 # mean(0, 1, 2)
    assert agg_df.loc[0, 'st_range'] == 2.0 # max(2) - min(0)
    
    # Check 'world'
    assert agg_df.loc[1, 'word'] == 'world'
    assert agg_df.loc[1, 'following_pause'] == 0.0
