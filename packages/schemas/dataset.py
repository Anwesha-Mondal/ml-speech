from pydantic import BaseModel
from typing import List, Optional

class DatasetRecord(BaseModel):
    sample_id: str
    parent_id: Optional[str]
    speaker_hash: str
    transcript_id: str
    version: str
    is_reference: bool
    flaw_type: Optional[str]
    severity: Optional[float]
    injected_interval: Optional[List[float]]
    time_map_path: Optional[str]
    resynth_chain: Optional[str]
    severity_params: Optional[dict]
    inserted_tokens: Optional[List[dict]]
    source_kind: str # 'injected', 'acted', 'clean'
    consent_id: Optional[str]
    split_component_id: Optional[str]

class RightsManifest(BaseModel):
    asset_id: str
    canonical_url: str
    download_url: Optional[str]
    provider: str
    title: Optional[str]
    speaker: str
    performance_date: str
    recording_date: Optional[str]
    digitization_date: Optional[str]
    license: str
    jurisdiction: Optional[str]
    rights_statement: Optional[str]
    attribution: Optional[str]
    redistribution_allowed: bool
    derivative_allowed: Optional[bool]
    commercial_allowed: Optional[bool]
    restrictions: Optional[List[str]]
    verification_date: Optional[str]
    verifier: Optional[str]
    checksum: str
    notes: Optional[str]
