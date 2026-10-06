from pydantic import BaseModel
from typing import List

class WordTimestamp(BaseModel):
    word: str
    start: float
    end: float

class PhonemeTimestamp(BaseModel):
    phoneme: str
    start: float
    end: float

class Alignment(BaseModel):
    word_timestamps: List[WordTimestamp]
    phoneme_timestamps: List[PhonemeTimestamp]
    method: str
    confidence: float
