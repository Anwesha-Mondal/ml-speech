import os
import sys
import uuid
import yaml
import numpy as np
import torch
import librosa
from transformers import Wav2Vec2Processor
from typing import Dict, List, Any, Optional

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from ml.models.flaw_classifier import SpeechFlawClassifier
from ml.features.extraction import extract_acoustic_features

# Flaw mapping: Translates ML model output classes to frontend & scoring schemas
FLAW_MAP: Dict[str, Dict[str, Any]] = {
    'TOO_FAST': {
        'type': 'PACING_TOO_FAST',
        'bucket': 'pacing',
        'metric': 'local_rate',
        'base_penalty': -2.0,
        'ref_val': 2.2,
        'fact_template': "Participant spoke {metric_val:.1f} syllables/sec ({delta_str} faster than reference baseline).",
        'explanation_template': "You spoke this segment too quickly. Delivery rate exceeded target pacing."
    },
    'TOO_SLOW': {
        'type': 'PACING_TOO_SLOW',
        'bucket': 'pacing',
        'metric': 'local_rate',
        'base_penalty': -2.0,
        'ref_val': 2.2,
        'fact_template': "Participant spoke {metric_val:.1f} syllables/sec ({delta_str} slower than reference baseline).",
        'explanation_template': "Your delivery in this segment was sluggish and dragged below target tempo."
    },
    'EXCESSIVE_PAUSE': {
        'type': 'PAUSE_EXCESSIVE',
        'bucket': 'pauses',
        'metric': 'following_pause',
        'base_penalty': -2.5,
        'ref_val': 0.2,
        'fact_template': "Added an unnatural silence gap of {metric_val:.2f}s.",
        'explanation_template': "There was an extended silence that interrupted rhetorical momentum."
    },
    'MISSING_PAUSE': {
        'type': 'PAUSE_MISSING',
        'bucket': 'pauses',
        'metric': 'following_pause',
        'base_penalty': -1.5,
        'ref_val': 0.4,
        'fact_template': "Structural pause was omitted at phrase boundary.",
        'explanation_template': "A structural breath or pause was omitted, rushing past the phrase boundary."
    },
    'MONOTONE': {
        'type': 'PITCH_MONOTONE',
        'bucket': 'pitch',
        'metric': 'st_range',
        'base_penalty': -3.0,
        'ref_val': 4.0,
        'fact_template': "Pitch variation was heavily compressed to {metric_val:.1f} semitones.",
        'explanation_template': "Your delivery on this phrase lacked dynamic pitch inflection, sounding monotone."
    },
    'HIGH_PITCH_VARIATION': {
        'type': 'PITCH_INSTABILITY',
        'bucket': 'pitch',
        'metric': 'st_range',
        'base_penalty': -2.0,
        'ref_val': 3.5,
        'fact_template': "Pitch variation fluctuated erratically ({metric_val:.1f} semitones).",
        'explanation_template': "Pitch contour showed excessive or unstable pitch jumps."
    },
    'CADENCE_INSTABILITY': {
        'type': 'PITCH_INSTABILITY',
        'bucket': 'pitch',
        'metric': 'st_range',
        'base_penalty': -2.0,
        'ref_val': 3.5,
        'fact_template': "Rhythm and intonation showed cadence irregularity.",
        'explanation_template': "Unsteady intonation cadence disrupted natural prosody."
    },
    'LOW_ENERGY': {
        'type': 'ENERGY_LOW',
        'bucket': 'energy_clarity',
        'metric': 'db_mean',
        'base_penalty': -1.5,
        'ref_val': -6.0,
        'fact_template': "Mean energy dropped to {metric_val:.1f} dB.",
        'explanation_template': "Vocal volume dropped significantly near the noise floor, risking intelligibility."
    },
    'HIGH_ENERGY': {
        'type': 'ENERGY_SPIKE',
        'bucket': 'energy_clarity',
        'metric': 'db_mean',
        'base_penalty': -1.5,
        'ref_val': -5.0,
        'fact_template': "Acoustic energy spiked abruptly to {metric_val:.1f} dB.",
        'explanation_template': "Volume abruptly spiked outside balanced vocal dynamics."
    },
    'UNCLEAR': {
        'type': 'UNCLEAR',
        'bucket': 'energy_clarity',
        'metric': 'db_mean',
        'base_penalty': -1.5,
        'ref_val': -6.0,
        'fact_template': "Spectral clarity dropped below standard phoneme threshold.",
        'explanation_template': "Articulation clarity dropped, reducing consonant definition."
    },
    'FILLER_HEAVY': {
        'type': 'PAUSE_EXCESSIVE',
        'bucket': 'pauses',
        'metric': 'following_pause',
        'base_penalty': -2.0,
        'ref_val': 0.1,
        'fact_template': "Detected hesitation or filler elongation ({metric_val:.2f}s).",
        'explanation_template': "Vocal hesitation or filler sound weakened conversational flow."
    },
    'HESITATION': {
        'type': 'PAUSE_EXCESSIVE',
        'bucket': 'pauses',
        'metric': 'following_pause',
        'base_penalty': -2.0,
        'ref_val': 0.1,
        'fact_template': "False start or hesitation pause detected ({metric_val:.2f}s).",
        'explanation_template': "Hesitation created an unexpected pause within the grammatical phrase."
    },
    'EMPHASIS_ERROR': {
        'type': 'PITCH_INSTABILITY',
        'bucket': 'pitch',
        'metric': 'st_range',
        'base_penalty': -2.0,
        'ref_val': 3.0,
        'fact_template': "Stress placed on unstressed syllable or misplaced emphasis.",
        'explanation_template': "Stress patterns deviated from standard rhetorical emphasis."
    }
}

class SpeechFlawPredictor:
    """
    Inference engine that loads the trained PyTorch Wav2Vec2 + MLP checkpoint
    and performs neural flaw detection with acoustic feature evidence.
    """
    _instance = None

    @classmethod
    def get_instance(cls, checkpoint_path: Optional[str] = None):
        if cls._instance is None:
            cls._instance = cls(checkpoint_path=checkpoint_path)
        return cls._instance

    def __init__(
        self,
        checkpoint_path: Optional[str] = None,
        config_path: Optional[str] = None,
        device: Optional[str] = None
    ):
        if device is None:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)
            
        if config_path is None:
            config_path = os.path.join(PROJECT_ROOT, "ml", "configs", "labels.yaml")
        
        with open(config_path, "r") as f:
            config = yaml.safe_load(f)
        self.labels: List[str] = config.get("classes", [])
        
        if checkpoint_path is None:
            checkpoint_path = os.path.join(PROJECT_ROOT, "ml", "checkpoints", "latest_checkpoint.pt")
            
        self.checkpoint_path = checkpoint_path
        
        # Load Wav2Vec2 processor
        self.processor = Wav2Vec2Processor.from_pretrained("facebook/wav2vec2-base")
        
        # Initialize model architecture
        self.model = SpeechFlawClassifier(num_classes=len(self.labels)).to(self.device)
        
        # Load checkpoint weights if present
        if os.path.exists(self.checkpoint_path):
            checkpoint = torch.load(self.checkpoint_path, map_location=self.device)
            state_dict = checkpoint.get("model_state_dict", checkpoint)
            self.model.load_state_dict(state_dict)
            self.model.eval()
            print(f"[+] Loaded model checkpoint from {self.checkpoint_path} on {self.device}")
        else:
            print(f"[!] Warning: Checkpoint not found at {self.checkpoint_path}. Running with base initialized head.")
            self.model.eval()

    def predict_audio(
        self,
        audio_input: Any,
        sr: int = 16000,
        transcript: str = "",
        mode: str = "sandbox",
        threshold: float = 0.40
    ) -> Dict[str, Any]:
        """
        Analyze audio input (file path, bytes, or numpy array) and return:
        - score: total and per-bucket capped penalties
        - flaws: list of temporal flaws with evidence and explanations
        - words: aligned or estimated word timings
        - contours: downsampled pitch and energy curves
        """
        # 1. Load waveform
        if isinstance(audio_input, str):
            y, sr = librosa.load(audio_input, sr=sr)
        elif isinstance(audio_input, bytes):
            import io
            import soundfile as sf
            import tempfile
            import subprocess

            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp_in:
                tmp_in.write(audio_input)
                tmp_in_path = tmp_in.name
                
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_out:
                tmp_out_path = tmp_out.name

            try:
                subprocess.run([
                    "ffmpeg", "-y", "-i", tmp_in_path,
                    "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le",
                    tmp_out_path
                ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                y, sr = sf.read(tmp_out_path)
            except Exception as e:
                # Fallback to direct reading if ffmpeg fails
                try:
                    y, sr = sf.read(io.BytesIO(audio_input))
                    if y.ndim > 1:
                        y = np.mean(y, axis=1)
                    if sr != 16000:
                        y = librosa.resample(y, orig_sr=sr, target_sr=16000)
                        sr = 16000
                except Exception:
                    y, sr = librosa.load(io.BytesIO(audio_input), sr=sr)
            finally:
                if os.path.exists(tmp_in_path):
                    try: os.remove(tmp_in_path)
                    except: pass
                if os.path.exists(tmp_out_path):
                    try: os.remove(tmp_out_path)
                    except: pass
        elif isinstance(audio_input, np.ndarray):
            y = audio_input.astype(np.float32)
            if y.ndim > 1:
                y = np.mean(y, axis=1)
        else:
            raise ValueError(f"Unsupported audio input type: {type(audio_input)}")

        duration = float(len(y) / sr)
        if duration <= 0:
            return self._empty_result(mode)

        # 2. Extract global features and model prediction
        global_features = extract_acoustic_features(y, sr=sr)
        global_probs = self._run_model_inference(y, global_features, sr=sr)

        # 3. Detect silent pause gaps (> 0.4s)
        pause_flaws = self._detect_pauses(y, sr, duration)

        # 4. Temporal window evaluation (sliding window)
        window_flaws = self._detect_temporal_flaws(y, sr, duration, threshold=threshold)

        # Merge flaws
        raw_flaws = pause_flaws + window_flaws

        # 5. Align with transcript words to generate real timings
        aligned_words = self._align_words(y, sr, transcript, duration)
        raw_flaws = self._tag_flaws_with_words(raw_flaws, aligned_words)

        # 6. Apply mode weighting and calculate bucket scores
        mode_flaws = self._apply_mode_weights(raw_flaws, mode)
        score_breakdown = self._compute_scores(mode_flaws)

        # 7. Extract contours for visualization
        contours = self._extract_contours(y, sr)

        return {
            "mode": mode,
            "duration": round(duration, 2),
            "score": score_breakdown,
            "flaws": mode_flaws,
            "words": aligned_words,
            "contours": contours,
            "raw_probabilities": {lbl: round(float(global_probs[i]), 4) for i, lbl in enumerate(self.labels)}
        }

    def _run_model_inference(self, y_slice: np.ndarray, acoustic_feat: np.ndarray, sr: int = 16000) -> np.ndarray:
        with torch.no_grad():
            inputs = self.processor(y_slice, sampling_rate=sr, return_tensors="pt")
            input_values = inputs.input_values.to(self.device)
            feat_arr = np.array(acoustic_feat, dtype=np.float32).reshape(1, -1)
            feat_tensor = torch.from_numpy(feat_arr).to(self.device)
            logits = self.model(input_values, feat_tensor)
            probs = torch.sigmoid(logits).squeeze(0).cpu().numpy()
        return probs

    def _detect_pauses(self, y: np.ndarray, sr: int, duration: float) -> List[Dict[str, Any]]:
        flaws = []
        intervals = librosa.effects.split(y, top_db=28, frame_length=1024, hop_length=256)
        
        prev_end = 0.0
        for start_idx, end_idx in intervals:
            start_time = float(start_idx / sr)
            gap = start_time - prev_end
            if gap > 0.50:  # Pause longer than 500ms
                meta = FLAW_MAP['EXCESSIVE_PAUSE']
                flaws.append({
                    "flaw_id": str(uuid.uuid4())[:8],
                    "type": meta['type'],
                    "bucket": meta['bucket'],
                    "start_time": round(prev_end, 2),
                    "end_time": round(start_time, 2),
                    "penalty": meta['base_penalty'],
                    "confidence": min(0.95, round(0.70 + (gap / 2.0) * 0.25, 2)),
                    "explanation": meta['explanation_template'],
                    "evidence": {
                        "metric": meta['metric'],
                        "reference_value": meta['ref_val'],
                        "participant_value": round(gap, 2),
                        "delta_abs": round(gap - meta['ref_val'], 2),
                        "delta_rel": round(gap / max(meta['ref_val'], 0.1), 2)
                    }
                })
            prev_end = float(end_idx / sr)

        trailing_gap = duration - prev_end
        if trailing_gap > 0.8:
            meta = FLAW_MAP['EXCESSIVE_PAUSE']
            flaws.append({
                "flaw_id": str(uuid.uuid4())[:8],
                "type": meta['type'],
                "bucket": meta['bucket'],
                "start_time": round(prev_end, 2),
                "end_time": round(duration, 2),
                "penalty": meta['base_penalty'],
                "confidence": 0.88,
                "explanation": meta['explanation_template'],
                "evidence": {
                    "metric": meta['metric'],
                    "reference_value": meta['ref_val'],
                    "participant_value": round(trailing_gap, 2),
                    "delta_abs": round(trailing_gap - meta['ref_val'], 2),
                    "delta_rel": round(trailing_gap / max(meta['ref_val'], 0.1), 2)
                }
            })
            
        return flaws

    def _detect_temporal_flaws(
        self,
        y: np.ndarray,
        sr: int,
        duration: float,
        threshold: float = 0.18
    ) -> List[Dict[str, Any]]:
        flaws = []
        window_size_s = 2.0
        hop_s = 1.0
        window_len = int(window_size_s * sr)
        hop_len = int(hop_s * sr)
        
        if len(y) <= window_len:
            slices = [(0.0, duration, y)]
        else:
            slices = []
            for start_sample in range(0, len(y) - int(0.5 * sr), hop_len):
                end_sample = min(start_sample + window_len, len(y))
                start_t = float(start_sample / sr)
                end_t = float(end_sample / sr)
                slices.append((start_t, end_t, y[start_sample:end_sample]))

        label_to_idx = {lbl: i for i, lbl in enumerate(self.labels)}

        for start_t, end_t, slice_audio in slices:
            if len(slice_audio) < int(0.3 * sr):
                continue
                
            slice_features = extract_acoustic_features(slice_audio, sr=sr)
            probs = self._run_model_inference(slice_audio, slice_features, sr=sr)
            
            onset_rate = float(slice_features[5])
            rms_val = float(slice_features[0])
            db_val = float(20 * np.log10(max(rms_val, 1e-5)))
            pitch_val = float(slice_features[2])
            
            # Hybrid detection: model prob + acoustic thresholds
            # 1. TOO FAST
            fast_idx = label_to_idx.get('TOO_FAST')
            fast_prob = float(probs[fast_idx]) if fast_idx is not None else 0.0
            if (onset_rate > 2.7) or (fast_prob > threshold and onset_rate > 2.0):
                meta = FLAW_MAP['TOO_FAST']
                delta_abs = onset_rate - meta['ref_val']
                delta_rel = onset_rate / meta['ref_val']
                fact_str = meta['fact_template'].format(metric_val=onset_rate, delta_str=f"{abs(delta_abs):.1f}")
                flaws.append({
                    "flaw_id": str(uuid.uuid4())[:8],
                    "type": meta['type'],
                    "bucket": meta['bucket'],
                    "start_time": round(start_t, 2),
                    "end_time": round(end_t, 2),
                    "penalty": meta['base_penalty'],
                    "confidence": round(max(0.65, fast_prob), 2),
                    "explanation": f"{meta['explanation_template']} {fact_str}",
                    "evidence": {
                        "metric": meta['metric'],
                        "reference_value": meta['ref_val'],
                        "participant_value": round(onset_rate, 2),
                        "delta_abs": round(delta_abs, 2),
                        "delta_rel": round(delta_rel, 2)
                    }
                })

            # 2. TOO SLOW
            slow_idx = label_to_idx.get('TOO_SLOW')
            slow_prob = float(probs[slow_idx]) if slow_idx is not None else 0.0
            if (onset_rate < 1.3 and onset_rate > 0.1) or (slow_prob > threshold and onset_rate < 1.6):
                meta = FLAW_MAP['TOO_SLOW']
                delta_abs = onset_rate - meta['ref_val']
                delta_rel = onset_rate / meta['ref_val']
                fact_str = meta['fact_template'].format(metric_val=onset_rate, delta_str=f"{abs(delta_abs):.1f}")
                flaws.append({
                    "flaw_id": str(uuid.uuid4())[:8],
                    "type": meta['type'],
                    "bucket": meta['bucket'],
                    "start_time": round(start_t, 2),
                    "end_time": round(end_t, 2),
                    "penalty": meta['base_penalty'],
                    "confidence": round(max(0.65, slow_prob), 2),
                    "explanation": f"{meta['explanation_template']} {fact_str}",
                    "evidence": {
                        "metric": meta['metric'],
                        "reference_value": meta['ref_val'],
                        "participant_value": round(onset_rate, 2),
                        "delta_abs": round(delta_abs, 2),
                        "delta_rel": round(delta_rel, 2)
                    }
                })

            # 3. LOW ENERGY
            energy_idx = label_to_idx.get('LOW_ENERGY')
            energy_prob = float(probs[energy_idx]) if energy_idx is not None else 0.0
            if (db_val < -18.0) or (energy_prob > threshold and db_val < -14.0):
                meta = FLAW_MAP['LOW_ENERGY']
                delta_abs = db_val - meta['ref_val']
                delta_rel = db_val / -20.0
                fact_str = meta['fact_template'].format(metric_val=db_val, delta_str=f"{abs(delta_abs):.1f} dB")
                flaws.append({
                    "flaw_id": str(uuid.uuid4())[:8],
                    "type": meta['type'],
                    "bucket": meta['bucket'],
                    "start_time": round(start_t, 2),
                    "end_time": round(end_t, 2),
                    "penalty": meta['base_penalty'],
                    "confidence": round(max(0.65, energy_prob), 2),
                    "explanation": f"{meta['explanation_template']} {fact_str}",
                    "evidence": {
                        "metric": meta['metric'],
                        "reference_value": meta['ref_val'],
                        "participant_value": round(db_val, 1),
                        "delta_abs": round(delta_abs, 1),
                        "delta_rel": round(delta_rel, 2)
                    }
                })

            # 4. MONOTONE
            mono_idx = label_to_idx.get('MONOTONE')
            mono_prob = float(probs[mono_idx]) if mono_idx is not None else 0.0
            if (pitch_val > 0 and pitch_val < 80.0) or (mono_prob > threshold):
                meta = FLAW_MAP['MONOTONE']
                part_st = max(1.0, pitch_val / 50.0)
                delta_abs = part_st - meta['ref_val']
                delta_rel = part_st / meta['ref_val']
                fact_str = meta['fact_template'].format(metric_val=part_st, delta_str=f"{abs(delta_abs):.1f} st")
                flaws.append({
                    "flaw_id": str(uuid.uuid4())[:8],
                    "type": meta['type'],
                    "bucket": meta['bucket'],
                    "start_time": round(start_t, 2),
                    "end_time": round(end_t, 2),
                    "penalty": meta['base_penalty'],
                    "confidence": round(max(0.60, mono_prob), 2),
                    "explanation": f"{meta['explanation_template']} {fact_str}",
                    "evidence": {
                        "metric": meta['metric'],
                        "reference_value": meta['ref_val'],
                        "participant_value": round(part_st, 1),
                        "delta_abs": round(delta_abs, 1),
                        "delta_rel": round(delta_rel, 2)
                    }
                })

        return flaws

    def _align_words(self, y: np.ndarray, sr: int, transcript: str, duration: float) -> List[Dict[str, Any]]:
        # Attempt to use real ASR for precise word timestamps
        try:
            from transformers import pipeline
            if not hasattr(self, "asr_pipeline"):
                self.asr_pipeline = pipeline("automatic-speech-recognition", model="openai/whisper-tiny.en")
            
            res = self.asr_pipeline({"raw": y, "sampling_rate": sr}, return_timestamps="word")
            chunks = res.get("chunks", [])
            if chunks:
                words = []
                for chunk in chunks:
                    text = chunk.get("text", "").strip()
                    if not text: continue
                    ts = chunk.get("timestamp", (0.0, duration))
                    start = ts[0] if ts[0] is not None else 0.0
                    end = ts[1] if ts[1] is not None else duration
                    words.append({
                        "text": text,
                        "start": round(start, 2),
                        "end": round(end, 2)
                    })
                return words
        except Exception as e:
            print(f"Real word alignment failed, falling back to synthetic: {e}")

        # Fallback to synthetic alignment if ASR fails
        tokens = [t for t in transcript.strip().split() if t]
        if not tokens or duration <= 0:
            return []
            
        # Distribute tokens smoothly across spoken span
        lead = min(0.2, duration * 0.05)
        span = max(duration - lead * 2, 0.1)
        weights = [max(len(w), 1) + 1.5 for w in tokens]
        total_w = sum(weights)
        
        words = []
        cur_t = lead
        for i, word in enumerate(tokens):
            w_dur = (weights[i] / total_w) * span
            words.append({
                "text": word,
                "start": round(cur_t, 2),
                "end": round(cur_t + w_dur * 0.9, 2)
            })
            cur_t += w_dur
        return words

    def _tag_flaws_with_words(self, flaws: List[Dict[str, Any]], words: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        for f in flaws:
            matched_words = []
            f_start = f["start_time"]
            f_end = f["end_time"]
            for w in words:
                # Check overlap
                if max(f_start, w["start"]) <= min(f_end, w["end"]):
                    matched_words.append(w["text"])
            if matched_words:
                f["word"] = " ".join(matched_words[:3])
            else:
                f["word"] = ""
        return flaws

    def _apply_mode_weights(self, flaws: List[Dict[str, Any]], mode: str) -> List[Dict[str, Any]]:
        # Mode multipliers per bucket
        mode_multipliers = {
            'sandbox': {'pacing': 1.0, 'pitch': 1.0, 'pauses': 1.0, 'energy_clarity': 1.0},
            'interviewer': {'pacing': 1.0, 'pitch': 0.8, 'pauses': 1.4, 'energy_clarity': 1.2},
            'news_anchor': {'pacing': 1.3, 'pitch': 1.3, 'pauses': 1.1, 'energy_clarity': 1.0},
            'storytelling': {'pacing': 1.0, 'pitch': 1.4, 'pauses': 0.9, 'energy_clarity': 1.3},
            'public_speaking': {'pacing': 1.2, 'pitch': 1.2, 'pauses': 1.2, 'energy_clarity': 1.2},
        }
        mults = mode_multipliers.get(mode, mode_multipliers['sandbox'])
        
        adjusted = []
        for f in flaws:
            bucket = f.get('bucket', 'pacing')
            factor = mults.get(bucket, 1.0)
            f_copy = dict(f)
            f_copy['penalty'] = round(f['penalty'] * factor, 2)
            adjusted.append(f_copy)
        return adjusted

    def _compute_scores(self, flaws: List[Dict[str, Any]]) -> Dict[str, Any]:
        caps = {
            'pacing': -15.0,
            'pitch': -15.0,
            'pauses': -10.0,
            'energy_clarity': -10.0
        }
        bucket_sums = {k: 0.0 for k in caps}
        for f in flaws:
            b = f.get('bucket', 'pacing')
            if b in bucket_sums:
                bucket_sums[b] += f['penalty']
                
        final_buckets = {}
        total_deduction = 0.0
        for b, s in bucket_sums.items():
            capped = max(s, caps[b])
            final_buckets[b] = round(capped, 1)
            total_deduction += capped
            
        total_score = round(max(0.0, 100.0 + total_deduction), 1)
        return {
            "total": total_score,
            "buckets": final_buckets
        }

    def _extract_contours(self, y: np.ndarray, sr: int) -> Dict[str, Any]:
        # Compute pitch and RMS contour downsampled to ~20 points/sec (every 50ms)
        hop_length = int(sr * 0.05)  # 50ms
        frame_times = librosa.frames_to_time(np.arange(len(y) // hop_length), sr=sr, hop_length=hop_length)
        
        # RMS energy in dB
        rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
        rms_db = 20 * np.log10(np.maximum(rms, 1e-4))
        # Normalize dB between -40 and 0
        rms_norm = np.clip(rms_db, -40, 0).tolist()
        
        # Pitch F0 estimation
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr, hop_length=hop_length)
        pitch_vals = []
        for i in range(pitches.shape[1]):
            col = pitches[:, i]
            mag_col = magnitudes[:, i]
            if np.any(mag_col > 0.1):
                best_idx = mag_col.argmax()
                p0 = float(col[best_idx])
                pitch_vals.append(p0 if p0 > 40.0 else None)
            else:
                pitch_vals.append(None)
                
        # Limit points to max 200 for frontend efficiency
        step = max(1, len(frame_times) // 200)
        t_sample = [round(float(t), 2) for t in frame_times[::step]]
        energy_sample = [round(float(e), 1) for e in rms_norm[::step]]
        pitch_sample = [round(float(p), 1) if p is not None else None for p in pitch_vals[::step]]
        
        return {
            "t": t_sample,
            "energyPart": energy_sample,
            "pitchPart": pitch_sample
        }

    def _empty_result(self, mode: str) -> Dict[str, Any]:
        return {
            "mode": mode,
            "duration": 0.0,
            "score": {
                "total": 100.0,
                "buckets": {"pacing": 0.0, "pitch": 0.0, "pauses": 0.0, "energy_clarity": 0.0}
            },
            "flaws": [],
            "words": [],
            "contours": {"t": [], "energyPart": [], "pitchPart": []},
            "raw_probabilities": {}
        }
