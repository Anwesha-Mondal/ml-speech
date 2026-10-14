import json
import hashlib
from typing import Any

def to_canonical_json(data: Any) -> str:
    """
    Serializes a dictionary to canonical JSON string, ensuring exact string match
    for identical contents regardless of key insertion order or float quirks.
    """
    def round_floats(obj: Any) -> Any:
        if isinstance(obj, float):
            return round(obj, 4)
        elif isinstance(obj, dict):
            return {k: round_floats(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [round_floats(i) for i in obj]
        return obj

    rounded_data = round_floats(data)
    return json.dumps(rounded_data, sort_keys=True, separators=(',', ':'), ensure_ascii=False)

def compute_hash(data: Any) -> str:
    """Computes SHA-256 hash of the canonical JSON representation."""
    canonical_str = to_canonical_json(data)
    return hashlib.sha256(canonical_str.encode('utf-8')).hexdigest()
