import torch
from torch.utils.data import Dataset
import librosa
import numpy as np
import pandas as pd
from transformers import Wav2Vec2Processor
from ml.features.extraction import extract_acoustic_features

class SpeechFlawDataset(Dataset):
    def __init__(self, manifest_df, label_list, max_length_s=10.0, sr=16000):
        """
        manifest_df: DataFrame with 'file_path' and 'flaws' (comma-separated string)
        label_list: list of all possible classes
        """
        self.df = manifest_df
        self.label_list = label_list
        self.max_length = int(max_length_s * sr)
        self.sr = sr
        self.processor = Wav2Vec2Processor.from_pretrained("facebook/wav2vec2-base")
        
    def __len__(self):
        return len(self.df)
        
    def __getitem__(self, idx):
        row = self.df.iloc[idx]
        audio_path = row['file_path']
        
        # Load audio
        y, _ = librosa.load(audio_path, sr=self.sr)
        
        # Truncate or pad
        if len(y) > self.max_length:
            y = y[:self.max_length]
        
        # Process for Wav2Vec2
        input_values = self.processor(y, sampling_rate=self.sr, return_tensors="pt").input_values[0]
        
        # Extract acoustic features
        acoustic_features = extract_acoustic_features(y, sr=self.sr)
        
        # Create multi-hot label vector
        labels = row['flaws'].split(',')
        label_vector = np.zeros(len(self.label_list), dtype=np.float32)
        for label in labels:
            label = label.strip()
            if label in self.label_list:
                label_vector[self.label_list.index(label)] = 1.0
                
        return {
            "input_values": input_values,
            "acoustic_features": torch.tensor(acoustic_features, dtype=torch.float32),
            "labels": torch.tensor(label_vector, dtype=torch.float32)
        }

def collate_fn(batch):
    # Dynamic padding for audio sequences
    input_values = [item["input_values"] for item in batch]
    # Find max length in this batch
    max_len = max([iv.shape[0] for iv in input_values])
    
    padded_inputs = torch.zeros(len(batch), max_len)
    for i, iv in enumerate(input_values):
        padded_inputs[i, :iv.shape[0]] = iv
        
    acoustic_features = torch.stack([item["acoustic_features"] for item in batch])
    labels = torch.stack([item["labels"] for item in batch])
    
    return {
        "input_values": padded_inputs,
        "acoustic_features": acoustic_features,
        "labels": labels
    }
