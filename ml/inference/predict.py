import os
import sys
import uuid
import yaml
import warnings
import numpy as np
import torch
import librosa
from transformers import Wav2Vec2Processor, logging as hf_logging
from typing import Dict, List, Any, Optional

# Suppress noisy framework deprecation notices
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)
hf_logging.set_verbosity_error()


# Ensure project root is in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from ml.models.flaw_classifier import SpeechFlawClassifier
from packages.speech_arena.scoring.modes import apply_mode_weights, compute_score, get_mode_config, score_analysis
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


def decode_audio_to_array(audio_input: bytes, target_sr: int = 16000) -> tuple[np.ndarray, int]:
    """
    Decode multi-format audio bytes (WAV, FLAC, WebM/Opus, OGG, MP4/AAC)
    into a mono float32 numpy waveform resampled to target_sr.
    """
    import io
    import soundfile as sf

    # 1. Fast path: in-memory decode for standard uncompressed formats (WAV/FLAC)
    try:
        y, sr = sf.read(io.BytesIO(audio_input))
        if y.ndim > 1:
            y = np.mean(y, axis=1)
        if sr != target_sr:
            y = librosa.resample(y, orig_sr=sr, target_sr=target_sr)
            sr = target_sr
        return y.astype(np.float32), sr
    except Exception:
        pass

    # 2. imageio-ffmpeg static binary or system ffmpeg
    ffmpeg_bin = None
    try:
        import imageio_ffmpeg
        ffmpeg_bin = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        import shutil
        ffmpeg_bin = shutil.which("ffmpeg")

    tmp_in_path = None
    tmp_out_path = None
    if ffmpeg_bin:
        import tempfile
        import subprocess
        try:
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp_in:
                tmp_in.write(audio_input)
                tmp_in_path = tmp_in.name
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_out:
                tmp_out_path = tmp_out.name

            subprocess.run([
                ffmpeg_bin, "-y", "-i", tmp_in_path,
                "-ar", str(target_sr), "-ac", "1", "-c:a", "pcm_s16le",
                tmp_out_path
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            y, sr = sf.read(tmp_out_path)
            return y.astype(np.float32), sr
        except Exception:
            pass
        finally:
            if tmp_in_path and os.path.exists(tmp_in_path):
                try: os.remove(tmp_in_path)
                except Exception: pass
            if tmp_out_path and os.path.exists(tmp_out_path):
                try: os.remove(tmp_out_path)
                except Exception: pass

    # 3. PyAV in-memory decode
    try:
        import av
        container = av.open(io.BytesIO(audio_input))
        resampler = av.AudioResampler(format='s16', layout='mono', rate=target_sr)
        frames = []
        for frame in container.decode(audio=0):
            for r_frame in resampler.resample(frame):
                frames.append(r_frame.to_ndarray())
        if frames:
            audio_data = np.concatenate(frames, axis=1).squeeze()
            y = (audio_data / 32768.0).astype(np.float32)
            return y, target_sr
    except Exception:
        pass

    # 4. Final fallback via librosa
    y, sr = librosa.load(io.BytesIO(audio_input), sr=target_sr)
    if y.ndim > 1:
        y = np.mean(y, axis=1)
    return y.astype(np.float32), sr


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
        
        config_labels: List[str] = []
        if os.path.exists(config_path):
            with open(config_path, "r") as f:
                config = yaml.safe_load(f)
            config_labels = config.get("classes", []) if config else []
        self.labels: List[str] = config_labels
        
        if checkpoint_path is None:
            best_path = os.path.join(PROJECT_ROOT, "ml", "checkpoints", "best_checkpoint.pt")
            head_path = os.path.join(PROJECT_ROOT, "ml", "checkpoints", "head_checkpoint.pt")
            latest_path = os.path.join(PROJECT_ROOT, "ml", "checkpoints", "latest_checkpoint.pt")

            # Auto-reassemble parts if best_checkpoint.pt was deployed as chunks
            if not os.path.exists(best_path):
                import glob
                parts = sorted(glob.glob(best_path + ".part*"))
                if parts:
                    print(f"[*] Reassembling heavy model checkpoint from {len(parts)} parts...")
                    with open(best_path, "wb") as out:
                        for p in parts:
                            with open(p, "rb") as inp:
                                out.write(inp.read())
                    print(f"[+] Reassembled {best_path} successfully!")

            if os.path.exists(best_path):
                checkpoint_path = best_path
            elif os.path.exists(head_path):
                checkpoint_path = head_path
            else:
                checkpoint_path = latest_path
            
        self.checkpoint_path = checkpoint_path
        
        if not os.path.exists(self.checkpoint_path):
            raise FileNotFoundError(
                f"Production speech model checkpoint is missing at {self.checkpoint_path}. "
                "Place ml/checkpoints/best_checkpoint.pt or head_checkpoint.pt on the backend host."
            )

        # Inspect checkpoint architecture before initializing classifier
        checkpoint = torch.load(self.checkpoint_path, map_location=self.device)
        state_dict = checkpoint.get("model_state_dict", checkpoint)
        output_layer = state_dict.get("fusion_layer.6.weight")
        if output_layer is None:
            raise RuntimeError(
                f"Invalid model checkpoint {self.checkpoint_path}: missing fusion_layer.6.weight."
            )
        num_classes = output_layer.shape[0]

        # Standard class presets
        CLASSES_15 = [
            'IDEAL', 'TOO_FAST', 'TOO_SLOW', 'EXCESSIVE_PAUSE', 'MISSING_PAUSE',
            'MONOTONE', 'HIGH_PITCH_VARIATION', 'LOW_ENERGY', 'HIGH_ENERGY',
            'EMPHASIS_ERROR', 'FILLER_HEAVY', 'HESITATION', 'UNCLEAR',
            'CADENCE_INSTABILITY', 'MIXED'
        ]
        CLASSES_7 = [
            'IDEAL', 'TOO_FAST', 'TOO_SLOW', 'LOW_ENERGY', 'HIGH_ENERGY',
            'MONOTONE', 'EXCESSIVE_PAUSE'
        ]

        if "labels" in checkpoint and len(checkpoint["labels"]) == num_classes:
            self.labels = checkpoint["labels"]
        elif "classes" in checkpoint and len(checkpoint["classes"]) == num_classes:
            self.labels = checkpoint["classes"]
        elif len(self.labels) == num_classes:
            pass
        elif num_classes == 15:
            self.labels = CLASSES_15
        elif num_classes == 7:
            self.labels = CLASSES_7
        else:
            self.labels = [f"CLASS_{i}" for i in range(num_classes)]

        # Load Wav2Vec2 processor
        self.processor = Wav2Vec2Processor.from_pretrained("facebook/wav2vec2-base")
        
        # Initialize model architecture with matching number of classes
        self.model = SpeechFlawClassifier(num_classes=num_classes).to(self.device)
        self.model.load_state_dict(state_dict, strict=False)
        self.model.eval()

        # Dynamic INT8 quantization for CPU deployment (reduces memory footprint from ~580MB to ~340MB, fitting within Render 512MB free tier)
        if self.device.type == "cpu" and os.environ.get("QUANTIZE_MODEL", "1").lower() in ("1", "true", "yes"):
            try:
                import torch.ao.quantization as quantization
                self.model = quantization.quantize_dynamic(
                    self.model, {torch.nn.Linear}, dtype=torch.qint8
                )
                print("[+] Applied dynamic INT8 quantization for low-memory CPU deployment (~340MB RAM).")
            except Exception as e:
                print(f"[!] Warning: dynamic quantization skipped ({e}). Running standard float32 model.")

        print(f"[+] Loaded model checkpoint from {self.checkpoint_path} on {self.device} with {num_classes} classes: {self.labels}")

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
            y, sr = decode_audio_to_array(audio_input, target_sr=sr)
        elif isinstance(audio_input, np.ndarray):
            y = audio_input.astype(np.float32)
            if y.ndim > 1:
                y = np.mean(y, axis=1)
        else:
            raise ValueError(f"Unsupported audio input type: {type(audio_input)}")

        duration = float(len(y) / sr)
        if duration <= 0:
            return self._empty_result(mode)

        # 2. Extract global frame features and contours in one fast pass
        contours, frame_data = self._extract_contours_and_features(y, sr)

        # Global features and model prediction
        global_features = extract_acoustic_features(y[:min(len(y), sr * 30)], sr=sr)
        global_probs = self._run_model_inference(y[:min(len(y), sr * 30)], global_features, sr=sr)

        # 3. Detect silent pause gaps (> 0.5s)
        pause_flaws = self._detect_pauses(y, sr, duration)

        # 4. Temporal window evaluation with vectorized features and batched model forward passes
        window_flaws = self._detect_temporal_flaws(y, sr, duration, frame_data, threshold=threshold)

        # Merge flaws
        raw_flaws = pause_flaws + window_flaws

        # 5. Align with transcript words to generate real timings
        aligned_words = self._align_words(y, sr, transcript, duration)
        raw_flaws = self._tag_flaws_with_words(raw_flaws, aligned_words)

        # 6. Mode scoring from configs/scoring/modes_v2.0.yaml: up-talk and filled-pause
        #    detectors, mode multipliers, bucket caps and bonus rules (megaev §10, M1-Ext).
        mode_flaws, score_breakdown, delivery_metrics = score_analysis(
            raw_flaws, aligned_words, contours, duration, mode
        )

        return {
            "mode": mode,
            "duration": round(duration, 2),
            "score": score_breakdown,
            "flaws": mode_flaws,
            "metrics": delivery_metrics,
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
        frame_data: Dict[str, Any],
        threshold: float = 0.18
    ) -> List[Dict[str, Any]]:
        flaws = []
        window_size_s = 2.0
        hop_s = 2.0 if duration > 45.0 else 1.0
        window_len = int(window_size_s * sr)
        hop_len = int(hop_s * sr)

        if len(y) <= window_len:
            slice_data = y
            if len(slice_data) < window_len:
                slice_data = np.pad(slice_data, (0, window_len - len(slice_data)))
            slices = [slice_data]
            slice_meta = [(0.0, duration)]
        else:
            slices = []
            slice_meta = []
            for start_sample in range(0, len(y) - int(0.5 * sr), hop_len):
                end_sample = min(start_sample + window_len, len(y))
                slice_data = y[start_sample:end_sample]
                if len(slice_data) < window_len:
                    slice_data = np.pad(slice_data, (0, window_len - len(slice_data)))
                start_t = float(start_sample / sr)
                end_t = float(end_sample / sr)
                slices.append(slice_data)
                slice_meta.append((start_t, end_t))

        if not slices:
            return []

        rms = frame_data["rms"]
        cent = frame_data["cent"]
        zcr = frame_data["zcr"]
        pitch_vals = frame_data["pitch_vals"]
        onsets = frame_data["onsets"]

        # Fast slice acoustic features extracted from precomputed frame arrays in microseconds
        slice_feats = []
        slice_metrics = []
        for start_t, end_t in slice_meta:
            start_f = int(start_t / 0.05)
            end_f = max(start_f + 1, int(end_t / 0.05))

            r_slice = rms[start_f:end_f] if start_f < len(rms) else np.array([0.0])
            c_slice = cent[start_f:end_f] if start_f < len(cent) else np.array([0.0])
            z_slice = zcr[start_f:end_f] if start_f < len(zcr) else np.array([0.0])
            p_slice = [p for p in pitch_vals[start_f:end_f] if p is not None]

            r_mean = float(np.mean(r_slice)) if len(r_slice) else 0.0
            r_std = float(np.std(r_slice)) if len(r_slice) else 0.0
            c_mean = float(np.mean(c_slice)) if len(c_slice) else 0.0
            z_mean = float(np.mean(z_slice)) if len(z_slice) else 0.0
            p_mean = float(np.mean(p_slice)) if len(p_slice) else 0.0

            n_onsets = np.sum((onsets >= start_t) & (onsets < end_t))
            dur_slice = max(end_t - start_t, 0.1)
            onset_rate = float(n_onsets / dur_slice)

            feat = np.nan_to_num(np.array([r_mean, r_std, p_mean, c_mean, z_mean, onset_rate], dtype=np.float32))
            slice_feats.append(feat)

            db_val = float(20 * np.log10(max(r_mean, 1e-5)))
            slice_metrics.append((onset_rate, db_val, p_mean))

        # Batched model inference
        batch_size = 16
        all_probs = []
        with torch.no_grad():
            for i in range(0, len(slices), batch_size):
                b_audio = slices[i:i + batch_size]
                b_feat = slice_feats[i:i + batch_size]
                inputs = self.processor(b_audio, sampling_rate=sr, return_tensors="pt", padding=True)
                audio_tensor = inputs.input_values.to(self.device)
                feat_tensor = torch.from_numpy(np.stack(b_feat)).to(self.device)
                logits = self.model(audio_tensor, feat_tensor)
                probs = torch.sigmoid(logits).cpu().numpy()
                all_probs.extend(probs)

        label_to_idx = {lbl: i for i, lbl in enumerate(self.labels)}

        for idx, (start_t, end_t) in enumerate(slice_meta):
            probs = all_probs[idx]
            onset_rate, db_val, pitch_val = slice_metrics[idx]

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
        # Fast path: For recordings with transcript or longer duration (>30s),
        # deterministic token-weighted distribution aligns words instantly and deterministically (ADR-002, D-004)
        tokens = [t for t in transcript.strip().split() if t]
        if duration > 30.0 or tokens:
            if not tokens or duration <= 0:
                return []
            lead = min(0.3, duration * 0.05)
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

        # Attempt to use real ASR for short recordings when no transcript is present
        try:
            from transformers import pipeline
            if not hasattr(self, "asr_pipeline"):
                self.asr_pipeline = pipeline("automatic-speech-recognition", model="openai/whisper-tiny.en", chunk_length_s=30)
                if hasattr(self.asr_pipeline, "tokenizer") and self.asr_pipeline.tokenizer is not None:
                    self.asr_pipeline.tokenizer.clean_up_tokenization_spaces = False

            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
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

        return []

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
        """Mode multipliers from configs/scoring/modes_v2.0.yaml (kept for callers and tests)."""
        return apply_mode_weights(flaws, mode)

    def _compute_scores(self, flaws: List[Dict[str, Any]], mode: str = "sandbox") -> Dict[str, Any]:
        """Capped bucket deductions from configs/scoring/modes_v2.0.yaml (kept for callers and tests)."""
        return compute_score(flaws, mode)

    def _extract_contours_and_features(self, y: np.ndarray, sr: int) -> tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Compute frame-level contours (RMS and pitch at 50ms hop) and frame features
        (RMS, centroid, ZCR, onsets) in one vectorized pass across the audio.
        """
        hop_length = int(sr * 0.05)  # 50ms (20 Hz)
        n_frames = max(1, len(y) // hop_length)
        frame_times = librosa.frames_to_time(np.arange(n_frames), sr=sr, hop_length=hop_length)

        # 1. RMS energy in dB
        rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
        rms_db = 20 * np.log10(np.maximum(rms, 1e-4))
        rms_norm = np.clip(rms_db, -40, 0).tolist()

        # 2. Pitch F0 estimation
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

        step = max(1, len(frame_times) // 200)
        contours = {
            "t": [round(float(t_val), 2) for t_val in frame_times[::step]],
            "energyPart": [round(float(e), 1) for e in rms_norm[::step]],
            "pitchPart": [round(float(p), 1) if p is not None else None for p in pitch_vals[::step]]
        }

        # 3. Spectral centroid, ZCR and onsets
        cent = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop_length)[0]
        zcr = librosa.feature.zero_crossing_rate(y=y, hop_length=hop_length)[0]
        onsets = librosa.onset.onset_detect(y=y, sr=sr, hop_length=hop_length, units='time')

        frame_data = {
            "rms": rms,
            "pitch_vals": pitch_vals,
            "cent": cent,
            "zcr": zcr,
            "onsets": onsets,
        }
        return contours, frame_data

    def _extract_contours(self, y: np.ndarray, sr: int) -> Dict[str, Any]:
        contours, _ = self._extract_contours_and_features(y, sr)
        return contours

    def _empty_result(self, mode: str) -> Dict[str, Any]:
        cfg = get_mode_config()
        return {
            "mode": mode,
            "duration": 0.0,
            "score": {
                "total": cfg["start_score"],
                "buckets": {"pacing": 0.0, "pitch": 0.0, "pauses": 0.0, "energy_clarity": 0.0},
                "bonuses": 0.0,
                "bonus_rules": [],
                "scoring_version": cfg["scoring_version"],
                "config_hash": cfg["config_hash"],
            },
            "flaws": [],
            "words": [],
            "contours": {"t": [], "energyPart": [], "pitchPart": []},
            "raw_probabilities": {}
        }
