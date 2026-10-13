#!/usr/bin/env bash
# Render Build Script for Speech Guru Backend
# Optimized for cloud CPU instances (lightweight PyTorch wheel, fast build)
set -o errexit

echo "[*] Installing CPU-only PyTorch and Torchaudio..."
pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu

echo "[*] Installing application dependencies from requirements.txt..."
pip install --no-cache-dir -r requirements.txt

echo "[+] Build complete!"
