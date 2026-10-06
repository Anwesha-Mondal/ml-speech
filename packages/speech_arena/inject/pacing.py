import numpy as np
import librosa
from packages.speech_arena.inject.base import FlawOperator

class PacingOperator(FlawOperator):
    def __init__(self, speed_map: dict):
        """speed_map maps severity [0.1..1.0] to stretch factors"""
        self.speed_map = speed_map
        
    def _get_factor(self, severity: float) -> float:
        keys = sorted(list(self.speed_map.keys()))
        vals = [self.speed_map[k] for k in keys]
        return float(np.interp(severity, keys, vals))

    def apply(self, waveform, sr, start_sec, end_sec, severity):
        start_idx = int(start_sec * sr)
        end_idx = int(end_sec * sr)
        
        pre = waveform[:start_idx]
        target = waveform[start_idx:end_idx]
        post = waveform[end_idx:]
        
        factor = self._get_factor(severity)
        
        # Identity resynthesis placeholder (use PSOLA/WORLD in full version)
        # Using librosa's phase vocoder for the MVP
        if len(target) > 0:
            target_mod = librosa.effects.time_stretch(y=target, rate=factor)
        else:
            target_mod = target
            
        modified = np.concatenate([pre, target_mod, post])
        
        gt_start = start_sec
        gt_end = start_sec + (len(target_mod) / sr)
        
        return modified, (gt_start, gt_end), {"factor": factor, "method": "librosa_time_stretch"}
