from typing import List
from packages.schemas.alignment import WordTimestamp

def export_textgrid(words: List[WordTimestamp], total_duration: float, filepath: str):
    """
    Exports word timestamps to a Praat TextGrid format for visual sanity checking.
    """
    with open(filepath, "w", encoding="utf-8") as f:
        f.write('File type = "ooTextFile"\n')
        f.write('Object class = "TextGrid"\n\n')
        f.write('xmin = 0\n')
        f.write(f'xmax = {total_duration:.3f}\n')
        f.write('tiers? <exists>\n')
        f.write('size = 1\n')
        f.write('item []:\n')
        f.write('    item [1]:\n')
        f.write('        class = "IntervalTier"\n')
        f.write('        name = "words"\n')
        f.write('        xmin = 0\n')
        f.write(f'        xmax = {total_duration:.3f}\n')
        f.write(f'        intervals: size = {len(words)}\n')
        
        for i, w in enumerate(words):
            f.write(f'        intervals [{i+1}]:\n')
            f.write(f'            xmin = {w.start:.3f}\n')
            f.write(f'            xmax = {w.end:.3f}\n')
            f.write(f'            text = "{w.word}"\n')
