import pandas as pd
from typing import List
from packages.schemas.alignment import WordTimestamp

def count_syllables(word: str) -> int:
    """Fallback heuristic syllable counter since CMUDict requires NLTK/download."""
    word = word.lower()
    count = 0
    vowels = "aeiouy"
    if len(word) == 0:
        return 0
    if word[0] in vowels:
        count += 1
    for index in range(1, len(word)):
        if word[index] in vowels and word[index - 1] not in vowels:
            count += 1
    if word.endswith("e"):
        count -= 1
    if count == 0:
        count += 1
    return count

def aggregate_word_features(words: List[WordTimestamp], frame_df: pd.DataFrame) -> pd.DataFrame:
    """Aggregates frame features into word-level metrics."""
    records = []
    
    for i, w in enumerate(words):
        duration = w.end - w.start
        syl_count = count_syllables(w.word)
        local_rate = syl_count / duration if duration > 0 else 0
        
        following_pause = 0.0
        if i < len(words) - 1:
            following_pause = words[i+1].start - w.end
            
        # Get frames within this word
        mask = (frame_df['time'] >= w.start) & (frame_df['time'] <= w.end)
        w_frames = frame_df[mask]
        
        st_mean = w_frames['f0_st'].mean() if 'f0_st' in w_frames and not w_frames['f0_st'].isna().all() else 0.0
        st_range = (w_frames['f0_st'].max() - w_frames['f0_st'].min()) if 'f0_st' in w_frames and not w_frames['f0_st'].isna().all() else 0.0
        db_mean = w_frames['rms_db_rel'].mean() if 'rms_db_rel' in w_frames else 0.0
        
        records.append({
            'word': w.word,
            'start': w.start,
            'end': w.end,
            'duration': duration,
            'syllables': syl_count,
            'local_rate': local_rate,
            'following_pause': following_pause,
            'st_mean': st_mean,
            'st_range': st_range,
            'db_mean': db_mean
        })
        
    return pd.DataFrame(records)
