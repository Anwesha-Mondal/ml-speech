from typing import List
from packages.schemas.core import Flaw, ScoreBreakdown

def compute_score(flaws: List[Flaw]) -> ScoreBreakdown:
    # Caps per bucket
    caps = {
        'pacing': -15.0,
        'pitch': -15.0,
        'pauses': -10.0,
        'energy_clarity': -10.0
    }
    
    bucket_sums = {k: 0.0 for k in caps.keys()}
    
    for f in flaws:
        if f.bucket in bucket_sums:
            bucket_sums[f.bucket] += f.penalty
            
    # Apply caps
    final_buckets = {}
    total_penalty = 0.0
    
    for b, b_sum in bucket_sums.items():
        capped = max(b_sum, caps[b])
        final_buckets[b] = capped
        total_penalty += capped
        
    score = max(0.0, 100.0 + total_penalty)
    
    return ScoreBreakdown(
        total=score,
        buckets=final_buckets
    )
