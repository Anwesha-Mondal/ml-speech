import pytest
import pandas as pd
from packages.speech_arena.scoring.contrastive import compute_word_deltas
from packages.speech_arena.scoring.detectors import run_detectors
from packages.speech_arena.scoring.engine import compute_score
from packages.speech_arena.scoring.explain import render_explanation

def test_scoring_pipeline():
    ref_df = pd.DataFrame([{'word': 'hello', 'start': 0.0, 'end': 0.5, 'local_rate': 2.0, 'following_pause': 0.0, 'st_range': 4.0, 'db_mean': -5.0}])
    part_df = pd.DataFrame([{'word': 'hello', 'start': 0.0, 'end': 0.3, 'local_rate': 3.0, 'following_pause': 0.0, 'st_range': 1.0, 'db_mean': -15.0}])
    
    deltas = compute_word_deltas(ref_df, part_df)
    assert len(deltas) == 1
    
    flaws = run_detectors(deltas)
    assert len(flaws) > 0
    
    score = compute_score(flaws)
    assert score.total < 100.0
    
    text = render_explanation(flaws[0])
    assert "hello" in text
