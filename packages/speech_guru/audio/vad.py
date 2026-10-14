import torch
from typing import List, Dict

class SileroVAD:
    def __init__(self):
        # We use trust_repo=True to load the silero model from torch hub
        self.model, utils = torch.hub.load(
            repo_or_dir='snakers4/silero-vad',
            model='silero_vad',
            force_reload=False,
            trust_repo=True
        )
        self.get_speech_timestamps = utils[0]

    def get_segments(self, wav: torch.Tensor, sr: int = 16000) -> List[Dict[str, int]]:
        """Returns list of dicts with 'start' and 'end' in samples."""
        if len(wav.shape) > 1:
            wav = wav.squeeze()
        
        # Ensure it is float32
        wav = wav.to(torch.float32)
        timestamps = self.get_speech_timestamps(wav, self.model, sampling_rate=sr)
        return timestamps

    def chunk_at_pauses(self, wav: torch.Tensor, sr: int = 16000, max_chunk_sec: float = 30.0) -> List[tuple]:
        """
        Chunks the audio at pauses so no chunk exceeds max_chunk_sec.
        Returns a list of (start_sample, end_sample).
        """
        segments = self.get_segments(wav, sr)
        if not segments:
            return [(0, len(wav))]
            
        chunks = []
        current_start = 0
        max_samples = int(max_chunk_sec * sr)
        
        for i in range(len(segments) - 1):
            pause_start = segments[i]['end']
            pause_end = segments[i+1]['start']
            pause_mid = pause_start + (pause_end - pause_start) // 2
            
            if pause_mid - current_start > max_samples:
                chunks.append((current_start, pause_mid))
                current_start = pause_mid
                
        # add the last chunk
        chunks.append((current_start, len(wav)))
        return chunks
