import pandas as pd

def compute_word_deltas(ref_df: pd.DataFrame, part_df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes absolute and relative deltas for word-level features.
    Both DataFrames should have the same words aligned (index matched).
    """
    deltas = []
    for i in range(len(ref_df)):
        ref_row = ref_df.iloc[i]
        part_row = part_df.iloc[i]
        
        # Pacing (local rate)
        rate_ref = ref_row['local_rate']
        rate_part = part_row['local_rate']
        rate_delta = rate_part - rate_ref
        rate_rel = rate_part / rate_ref if rate_ref > 0 else 1.0
        
        # Following Pause
        pause_ref = ref_row['following_pause']
        pause_part = part_row['following_pause']
        pause_delta = pause_part - pause_ref
        
        # Pitch Range
        st_range_ref = ref_row['st_range']
        st_range_part = part_row['st_range']
        st_range_rel = st_range_part / st_range_ref if st_range_ref > 0 else 1.0
        
        # Energy Mean
        db_ref = ref_row['db_mean']
        db_part = part_row['db_mean']
        db_delta = db_part - db_ref
        
        deltas.append({
            'word': ref_row['word'],
            'start_ref': ref_row['start'],
            'end_ref': ref_row['end'],
            'start_part': part_row['start'],
            'end_part': part_row['end'],
            'rate_delta': rate_delta,
            'rate_rel': rate_rel,
            'pause_delta': pause_delta,
            'st_range_rel': st_range_rel,
            'db_delta': db_delta
        })
    return pd.DataFrame(deltas)
