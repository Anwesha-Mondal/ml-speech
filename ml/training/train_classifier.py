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
import time
from typing import Optional, Any
import warnings
warnings.filterwarnings("ignore")

import argparse
from tqdm import tqdm


def validate_manifest(manifest: pd.DataFrame, labels: list[str], split: str) -> None:
    required_columns = {"file_path", "flaws"}
    missing_columns = required_columns.difference(manifest.columns)
    if missing_columns:
        raise ValueError(f"{split} manifest is missing columns: {sorted(missing_columns)}")

    observed = {
        label.strip()
        for value in manifest["flaws"].fillna("")
        for label in str(value).split(",")
        if label.strip()
    }
    unknown = observed.difference(labels)
    if unknown:
        raise ValueError(
            f"{split} manifest contains labels not present in ml/configs/labels.yaml: "
            f"{sorted(unknown)}"
        )
    if not observed:
        raise ValueError(f"{split} manifest contains no recognized flaw labels.")


def train_epoch(
    model: nn.Module,
    dataloader: DataLoader[Any],
    criterion: nn.Module,
    optimizer: optim.Optimizer,
    device: torch.device,
    epoch: int,
    writer: SummaryWriter
) -> float:
    model.train()
    total_loss = 0.0
    
    if len(dataloader) == 0:
        return 0.0

    pbar = tqdm(enumerate(dataloader), total=len(dataloader), desc=f"Epoch {epoch+1:02d} [Train]", leave=False)
    for step, batch in pbar:
        optimizer.zero_grad()
        
        input_values = batch['input_values'].to(device)
        acoustic_features = batch['acoustic_features'].to(device)
        labels = batch['labels'].to(device)
        
        logits = model(input_values, acoustic_features)
        
        loss = criterion(logits, labels)
        loss.backward()
        optimizer.step()
        
        total_loss += loss.item()
        
        # Live progress bar stats
        current_avg = total_loss / (step + 1)
        pbar.set_postfix({"step_loss": f"{loss.item():.4f}", "avg_loss": f"{current_avg:.4f}"})
        
        # Dashboard Logging: Live update every step
        global_step = epoch * len(dataloader) + step
        writer.add_scalar('Training/Loss_Step', loss.item(), global_step)
        
    return total_loss / len(dataloader)

def evaluate_epoch(
    model: nn.Module,
    dataloader: Optional[DataLoader[Any]],
    criterion: nn.Module,
    device: torch.device
) -> float:
    model.eval()
    total_loss = 0.0
    if not dataloader or len(dataloader) == 0:
        return 0.0
    with torch.no_grad():
        pbar = tqdm(dataloader, total=len(dataloader), desc="Validation", leave=False)
        for batch in pbar:
            input_values = batch['input_values'].to(device)
            acoustic_features = batch['acoustic_features'].to(device)
            labels = batch['labels'].to(device)
            logits = model(input_values, acoustic_features)
            loss = criterion(logits, labels)
            total_loss += loss.item()
            pbar.set_postfix({"val_loss": f"{loss.item():.4f}"})
    return total_loss / len(dataloader)

def main() -> None:
    parser = argparse.ArgumentParser(description="Train Speech Flaw Classifier")
    parser.add_argument("--epochs", type=int, default=50, help="Total number of epochs to train (default: 50)")
    parser.add_argument("--reset", action="store_true", help="Start training fresh instead of resuming from previous checkpoint")
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[*] Hardware Detected: {device} ({torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'})")
    
    # 1. SETUP TENSORBOARD DASHBOARD
    log_dir = os.path.join(os.path.dirname(__file__), '..', 'runs', 'experiment_1')
    writer = SummaryWriter(log_dir=log_dir)
    print(f"[*] TensorBoard Dashboard initialized at: ml/runs/ (View live at http://localhost:6006)")
    
    # 2. SETUP AUTO-SAVE DIRECTORY
    checkpoint_dir = os.path.join(os.path.dirname(__file__), '..', 'checkpoints')
    os.makedirs(checkpoint_dir, exist_ok=True)
    checkpoint_path = os.path.join(checkpoint_dir, "latest_checkpoint.pt")
    best_checkpoint_path = os.path.join(checkpoint_dir, "best_checkpoint.pt")
    
    # 3. LOAD LABELS & MODEL
    config_path = os.path.join(os.path.dirname(__file__), '..', 'configs', 'labels.yaml')
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
    labels = config['classes']
    
    model = SpeechFlawClassifier(num_classes=len(labels)).to(device)
    criterion = nn.BCEWithLogitsLoss()
    optimizer = optim.AdamW(model.fusion_layer.parameters(), lr=1e-3)
    
    start_epoch = 0
    best_val_loss = float('inf')
    
    # 4. PAUSE / CONTINUE FEATURE (AUTO-LOAD)
    if os.path.exists(checkpoint_path) and not args.reset:
        print(f"\n[+] Found existing checkpoint: {checkpoint_path}")
        print("[+] Resuming training session...")
        checkpoint = torch.load(checkpoint_path, map_location=device)
        model.load_state_dict(checkpoint['model_state_dict'])
        optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
        start_epoch = checkpoint['epoch'] + 1
        best_val_loss = checkpoint.get('val_loss', float('inf'))
        print(f"[+] Successfully resumed from Epoch {start_epoch}")
    else:
        if args.reset and os.path.exists(checkpoint_path):
            print("\n[*] Reset flag detected. Starting fresh training session from Epoch 1.")
        else:
            print("\n[*] No existing checkpoint found. Starting fresh training session.")
        
    num_epochs = args.epochs
    if start_epoch >= num_epochs:
        print(f"\n[!] Previous training already finished {start_epoch} epochs (Target: {num_epochs}).")
        num_epochs = start_epoch + 25
        print(f"[+] Extending target to {num_epochs} epochs so you can continue training!")
    
    print("\n--- TRAINING LOOP STARTED ---")
    print("TIP: You can press Ctrl+C anytime to pause/terminate. Progress is saved automatically!\n")
    
    try:
        manifest_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'manifests', 'train.csv')
        val_manifest_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'manifests', 'val.csv')
        has_real_data = os.path.exists(manifest_path)
        has_val_data = os.path.exists(val_manifest_path)
        
        val_dataloader = None
        if has_real_data:
            df = pd.read_csv(manifest_path)
            validate_manifest(df, labels, "Training")
            dataset = SpeechFlawDataset(df, labels)
            dataloader = DataLoader(dataset, batch_size=4, collate_fn=collate_fn, shuffle=True)
            print(f"[*] Training on {len(df)} samples ({len(dataloader)} batches/epoch)")
            
            if has_val_data:
                val_df = pd.read_csv(val_manifest_path)
                validate_manifest(val_df, labels, "Validation")
                val_dataset = SpeechFlawDataset(val_df, labels)
                val_dataloader = DataLoader(val_dataset, batch_size=4, collate_fn=collate_fn, shuffle=False)
                print(f"[*] Evaluating on {len(val_df)} validation samples")
            else:
                raise FileNotFoundError(
                    "Tier 1 validation manifest is missing at "
                    "ml/data/manifests/val.csv; refusing to train without speaker-disjoint validation."
                )
        else:
            print("WARNING: 'ml/data/manifests/train.csv' not found.")
            print("Running a simulated training loop so you can test the Pause/Continue feature...")
            
        for epoch in range(start_epoch, num_epochs):
            print(f"Epoch {epoch+1}/{num_epochs} running...")
            
            if has_real_data:
                avg_loss = train_epoch(model, dataloader, criterion, optimizer, device, epoch, writer)
                val_loss = evaluate_epoch(model, val_dataloader, criterion, device) if val_dataloader else avg_loss
            else:
                time.sleep(2)
                avg_loss = max(0.1, 1.0 - (epoch * 0.05))
                val_loss = avg_loss
            
            # Dashboard Logging
            writer.add_scalar('Training/Loss_Epoch', avg_loss, epoch)
            if val_dataloader:
                writer.add_scalar('Validation/Loss_Epoch', val_loss, epoch)
            
            # Checkpoint saving
            checkpoint_state = {
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'loss': avg_loss,
                'val_loss': val_loss,
                'labels': labels,
            }
            torch.save(checkpoint_state, checkpoint_path)
            
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                torch.save(checkpoint_state, best_checkpoint_path)
                saved_status = "Auto-saved (New Best!)"
            else:
                saved_status = "Auto-saved"
            
            if val_dataloader:
                print(f" ✓ Epoch {epoch+1} Complete | Train Loss: {avg_loss:.4f} | Val Loss: {val_loss:.4f} | {saved_status}\n")
            else:
                print(f" ✓ Epoch {epoch+1} Complete | Loss: {avg_loss:.4f} | {saved_status}\n")
            
    except KeyboardInterrupt:
        print("\n\n[!] Training paused by user (Ctrl+C).")
        print("[!] Don't worry, your progress was safely checkpointed at the last epoch.")
        print("[!] Run the script again to continue exactly where you left off.\n")
    
    writer.close()
    
if __name__ == "__main__":
    main()
