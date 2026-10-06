import pytest
import os
import tempfile
import torch
from packages.speech_arena.align.textgrid import export_textgrid
from packages.schemas.alignment import WordTimestamp

def test_export_textgrid():
    words = [
        WordTimestamp(word="hello", start=0.1, end=0.5),
        WordTimestamp(word="world", start=0.6, end=1.0)
    ]
    
    with tempfile.NamedTemporaryFile(suffix=".TextGrid", delete=False) as tmp:
        tmp_path = tmp.name
        
    export_textgrid(words, 1.5, tmp_path)
    
    with open(tmp_path, "r") as f:
        content = f.read()
        
    assert 'File type = "ooTextFile"' in content
    assert 'text = "hello"' in content
    assert 'xmax = 1.500' in content
    
    os.remove(tmp_path)
