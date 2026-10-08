import sys
import os
# Ensure the root directory is in the Python path so 'ml' module can be found
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torch.utils.tensorboard import SummaryWriter
from ml.models.flaw_classifier import SpeechFlawClassifier
from ml.datasets.dataset import SpeechFlawDataset, collate_fn
import pandas as pd
import yaml
import os
import time

def train_epoch(model, dataloader, criterion, optimizer, device, epoch, writer):
    model.train()
    total_loss = 0
    
    if len(dataloader) == 0:
        return 0

    for step, batch in enumerate(dataloader):
        optimizer.zero_grad()
        
        input_values = batch['input_values'].to(device)
        acoustic_features = batch['acoustic_features'].to(device)
        labels = batch['labels'].to(device)
        
        logits = model(input_values, acoustic_features)
        
        loss = criterion(logits, labels)
        loss.backward()
        optimizer.step()
        
        total_loss += loss.item()
        
        # Dashboard Logging: Live update every step
        global_step = epoch * len(dataloader) + step
        writer.add_scalar('Training/Loss_Step', loss.item(), global_step)
        
    return total_loss / len(dataloader)

def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[*] Hardware Detected: {device}")
    
    # 1. SETUP TENSORBOARD DASHBOARD
    # This automatically tracks metrics so you can view them in a web interface
    log_dir = os.path.join(os.path.dirname(__file__), '..', 'runs', 'experiment_1')
    writer = SummaryWriter(log_dir=log_dir)
    print(f"[*] TensorBoard Dashboard initialized at: ml/runs/")
    
    # 2. SETUP AUTO-SAVE DIRECTORY
    checkpoint_dir = os.path.join(os.path.dirname(__file__), '..', 'checkpoints')
    os.makedirs(checkpoint_dir, exist_ok=True)
    checkpoint_path = os.path.join(checkpoint_dir, "latest_checkpoint.pt")
    
    # 3. LOAD LABELS & MODEL
    config_path = os.path.join(os.path.dirname(__file__), '..', 'configs', 'labels.yaml')
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
    labels = config['classes']
    
    model = SpeechFlawClassifier(num_classes=len(labels)).to(device)
    criterion = nn.BCEWithLogitsLoss()
    optimizer = optim.AdamW(model.fusion_layer.parameters(), lr=1e-3)
    
    start_epoch = 0
    
    # 4. PAUSE / CONTINUE FEATURE (AUTO-LOAD)
    # If a checkpoint exists from a previous run, automatically resume from where we left off
    if os.path.exists(checkpoint_path):
        print(f"\n[+] Found existing checkpoint: {checkpoint_path}")
        print("[+] Resuming training session...")
        checkpoint = torch.load(checkpoint_path, map_location=device)
        model.load_state_dict(checkpoint['model_state_dict'])
        optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
        start_epoch = checkpoint['epoch'] + 1
        print(f"[+] Successfully resumed from Epoch {start_epoch}")
    else:
        print("\n[*] No existing checkpoint found. Starting fresh training session.")
        
    num_epochs = 50
    print("\n--- TRAINING LOOP STARTED ---")
    print("TIP: You can press Ctrl+C anytime to pause/terminate. Progress is saved automatically!\n")
    
    try:
        # Check if real data exists, otherwise run a simulated loop to test the saving mechanics
        manifest_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'manifests', 'train.csv')
        has_real_data = os.path.exists(manifest_path)
        
        if has_real_data:
            df = pd.read_csv(manifest_path)
            dataset = SpeechFlawDataset(df, labels)
            dataloader = DataLoader(dataset, batch_size=4, collate_fn=collate_fn, shuffle=True)
        else:
            print("WARNING: 'ml/data/manifests/train.csv' not found.")
            print("Running a simulated training loop so you can test the Pause/Continue feature...")
            
        for epoch in range(start_epoch, num_epochs):
            print(f"Epoch {epoch+1}/{num_epochs} running...")
            
            if has_real_data:
                avg_loss = train_epoch(model, dataloader, criterion, optimizer, device, epoch, writer)
            else:
                time.sleep(2) # Fake processing time
                avg_loss = max(0.1, 1.0 - (epoch * 0.05)) # Fake loss decreasing
            
            # Dashboard Logging
            writer.add_scalar('Training/Loss_Epoch', avg_loss, epoch)
            
            # AUTO-SAVE CHECKPOINT
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'loss': avg_loss,
            }, checkpoint_path)
            
            print(f" ✓ Epoch {epoch+1} Complete | Loss: {avg_loss:.4f} | Auto-saved\n")
            
    except KeyboardInterrupt:
        print("\n\n[!] Training paused by user (Ctrl+C).")
        print("[!] Don't worry, your progress was safely checkpointed at the last epoch.")
        print("[!] Run the script again to continue exactly where you left off.\n")
    
    writer.close()
    
if __name__ == "__main__":
    main()
