import pytest
from packages.speech_arena.text.normalize import normalize_text

def test_normalize_text():
    text = "Hello, world! This is a test."
    res = normalize_text(text)
    
    assert res["canonical_words"] == ["Hello", "world", "This", "is", "a", "test"]
    assert res["spoken_words"] == ["hello", "world", "this", "is", "a", "test"]
    assert res["punct"] == [",", "!", "", "", "", "."]
