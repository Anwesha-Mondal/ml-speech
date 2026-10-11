import torch
import torch.nn as nn
from transformers import Wav2Vec2Model

class SpeechFlawClassifier(nn.Module):
    def __init__(self, num_classes, num_acoustic_features=6):
        super().__init__()
        # Load frozen Wav2Vec2 encoder
        self.encoder = Wav2Vec2Model.from_pretrained("facebook/wav2vec2-base")
        
        # Freeze the encoder to save compute initially
        for param in self.encoder.parameters():
            param.requires_grad = False
            
        # Feature fusion and classification head
        # Wav2Vec2 base hidden size is 768
        hidden_size = 768
        
        self.fusion_layer = nn.Sequential(
            nn.Linear(hidden_size + num_acoustic_features, 256),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, num_classes)
        )
        
    def forward(self, input_values, acoustic_features):
        """
        input_values: (batch_size, sequence_length) - raw audio array for wav2vec2
        acoustic_features: (batch_size, num_acoustic_features)
        """
        # Get embeddings from Wav2Vec2
        outputs = self.encoder(input_values)
        
        # Mean pooling over the sequence length
        # outputs.last_hidden_state shape: (batch, seq_len, 768)
        embeddings = outputs.last_hidden_state.mean(dim=1) 
        
        # Concatenate neural embeddings with classical features
        fused = torch.cat((embeddings, acoustic_features), dim=1)
        
        # Pass through classification head
        logits = self.fusion_layer(fused)
        
        return logits
