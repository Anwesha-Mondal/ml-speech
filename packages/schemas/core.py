from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional

class TranscriptSpan(BaseModel):
    start_word: int
    end_word: int
    text: str

class FlawEvidence(BaseModel):
    metric: str
    reference_value: float
    participant_value: float
    delta_abs: float
    delta_rel: float
    formula: str

class FlawExplanation(BaseModel):
    fact: str
    interpretation: str
    action: str
    template_id: str

class Flaw(BaseModel):
    flaw_id: str
    type: str
    bucket: str
    start_time: float
    end_time: float
    transcript_span: TranscriptSpan
    evidence: FlawEvidence
    severity: float
    confidence: float
    explanation: FlawExplanation
    penalty: float

class AnalysisInputs(BaseModel):
    reference_sha: str
    participant_sha: str
    transcript_id: str
    transcript_version: str

class AnalysisVersions(BaseModel):
    feature: str
    alignment: str
    normalization: str
    grounding: str
    scoring: str
    config_hash: str
    code_commit: str
    env: str

class ScoreBreakdown(BaseModel):
    total: float
    buckets: Dict[str, float]

class AnalysisResult(BaseModel):
    schema_version: str = "1.0"
    inputs: AnalysisInputs
    versions: AnalysisVersions
    alignment: Dict[str, Any]
    flaws: List[Flaw]
    score: ScoreBreakdown
    series_ref: str
