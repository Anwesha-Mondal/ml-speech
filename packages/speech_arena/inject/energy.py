import numpy as np
from packages.speech_arena.inject.base import FlawOperator

class EnergyOperator(FlawOperator):
    def __init__(self, gain_map: dict):
        self.gain_map = gain_map
        
    def apply(self, waveform, sr, start_sec, end_sec, severity):
        start_idx = int(start_sec * sr)
        end_idx = int(end_sec * sr)
        
        pre = waveform[:start_idx]
        target = waveform[start_idx:end_idx]
        post = waveform[end_idx:]
        
        keys = sorted(list(self.gain_map.keys()))
        vals = [self.gain_map[k] for k in keys]
        db_shift = float(np.interp(severity, keys, vals))
        
        multiplier = 10 ** (db_shift / 20)
        
        # 10ms crossfade to prevent clicks
        fade_len = min(int(0.01 * sr), len(target) // 2)
        if fade_len > 0:
            fade_in = np.linspace(1.0, multiplier, fade_len)
            fade_out = np.linspace(multiplier, 1.0, fade_len)
            envelope = np.ones(len(target)) * multiplier
            envelope[:fade_len] = fade_in
            envelope[-fade_len:] = fade_out
            target_mod = target * envelope
        else:
            target_mod = target * multiplier
            
        modified = np.concatenate([pre, target_mod, post])
        
        return modified, (start_sec, end_sec), {"db_shift": db_shift}
