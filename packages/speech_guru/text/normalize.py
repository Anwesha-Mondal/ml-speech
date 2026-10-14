import re
from typing import List, Dict

def normalize_text(text: str) -> Dict[str, List[str]]:
    """
    Very basic text normalizer.
    Returns a dict with:
    - canonical_words: raw words keeping basic punctuation 
    - spoken_words: lowercase, stripped of punctuation, numbers spelled out (simplified)
    - punct: list of punctuation tags following each word
    """
    # Simple tokenization
    tokens = re.findall(r"[\w']+|[.,!?;]", text)
    
    canonical = []
    spoken = []
    punct = []
    
    current_word = None
    for t in tokens:
        if re.match(r"[.,!?;]", t):
            if current_word is not None:
                punct[-1] += t
        else:
            current_word = t
            canonical.append(t)
            spoken.append(t.lower())
            punct.append("")
            
    return {
        "canonical_words": canonical,
        "spoken_words": spoken,
        "punct": punct
    }
