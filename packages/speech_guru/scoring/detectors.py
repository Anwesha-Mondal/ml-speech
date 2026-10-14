import pandas as pd
import uuid
from typing import List
from packages.schemas.core import Flaw, FlawEvidence, TranscriptSpan, FlawExplanation

def run_detectors(deltas_df: pd.DataFrame) -> List[Flaw]:
    """
    Scans the deltas and emits Flaws when thresholds are exceeded.
    """
    flaws = []
    
    for i, row in deltas_df.iterrows():
        # Pacing too fast
        if row['rate_rel'] > 1.3:
            flaws.append(_create_flaw(row, i, 'PACING_TOO_FAST', 'pacing', 'local_rate', 
                                      1.0, row['rate_rel'], row['rate_rel'], row['rate_rel'], 
                                      "Participant spoke 30%+ faster than reference", -2.0))
        # Pitch Monotone
        if row['st_range_rel'] < 0.5:
            flaws.append(_create_flaw(row, i, 'PITCH_MONOTONE', 'pitch', 'st_range', 
                                      1.0, row['st_range_rel'], row['st_range_rel'], row['st_range_rel'], 
                                      "Pitch variance was heavily compressed", -3.0))
        # Pause Excessive
        if row['pause_delta'] > 0.5:
            flaws.append(_create_flaw(row, i, 'PAUSE_EXCESSIVE', 'pauses', 'following_pause', 
                                      0.0, row['pause_delta'], row['pause_delta'], row['pause_delta'], 
                                      "Added an unnatural gap > 0.5s", -2.5))
                                      
        # Energy Low
        if row['db_delta'] < -5.0:
            flaws.append(_create_flaw(row, i, 'ENERGY_LOW', 'energy_clarity', 'db_mean', 
                                      0.0, row['db_delta'], row['db_delta'], row['db_delta'], 
                                      "Drop in energy > 5dB compared to reference", -1.5))
    return flaws

def _create_flaw(row, idx, type_name, bucket, metric, ref_val, part_val, delta_abs, delta_rel, fact, base_penalty) -> Flaw:
    evidence = FlawEvidence(
        metric=metric, reference_value=ref_val, participant_value=part_val, 
        delta_abs=delta_abs, delta_rel=delta_rel, formula="delta"
    )
    explanation = FlawExplanation(
        fact=fact, interpretation="Affects engagement.", action="Try to match the reference.", template_id=type_name
    )
    span = TranscriptSpan(start_word=idx, end_word=idx, text=row['word'])
    
    return Flaw(
        flaw_id=str(uuid.uuid4())[:8],
        type=type_name,
        bucket=bucket,
        start_time=row['start_part'],
        end_time=row['end_part'],
        transcript_span=span,
        evidence=evidence,
        severity=abs(delta_rel),
        confidence=0.9,
        explanation=explanation,
        penalty=base_penalty
    )
