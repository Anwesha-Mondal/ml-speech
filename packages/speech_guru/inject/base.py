import numpy as np
from abc import ABC, abstractmethod
from typing import Tuple, Dict

class FlawOperator(ABC):
    @abstractmethod
    def apply(self, waveform: np.ndarray, sr: int, start_sec: float, end_sec: float, severity: float) -> Tuple[np.ndarray, Tuple[float, float], Dict]:
        """
        Applies the flaw to the waveform between start_sec and end_sec.
        Returns:
            - modified waveform
            - ground truth interval in the variant (start, end)
            - metadata/params used
        """
        pass
