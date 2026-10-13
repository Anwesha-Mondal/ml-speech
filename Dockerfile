# Speech Arena - ML Training & Inference Container
# Compatible with both CUDA GPU acceleration and CPU fallback
FROM python:3.11-slim-bookworm

# Environment configuration
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app \
    DEBIAN_FRONTEND=noninteractive

# Install core audio, compilation, and system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    git \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Install PyTorch with CUDA 12.1 support (seamless CPU fallback on non-GPU systems)
RUN pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cu121

# 2. Copy dependency manifest and install remaining ML & audio packages
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# 3. Pre-download & cache facebook/wav2vec2-base weights so container runs fully offline
RUN python -c "from transformers import Wav2Vec2Model, Wav2Vec2Processor; \
    print('[*] Caching facebook/wav2vec2-base encoder and processor...'); \
    Wav2Vec2Model.from_pretrained('facebook/wav2vec2-base'); \
    Wav2Vec2Processor.from_pretrained('facebook/wav2vec2-base'); \
    print('[+] Pre-caching complete!')"

# 4. Copy codebase
COPY . /app/

# 5. Ensure required output directories exist
RUN mkdir -p /app/ml/checkpoints /app/ml/runs /app/ml/data/audio /app/ml/data/manifests

# Default action: run the FastAPI web service with dynamic PORT support (Render compatibility)
EXPOSE 8000
CMD ["sh", "-c", "uvicorn backend.api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
