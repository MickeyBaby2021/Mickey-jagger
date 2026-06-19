# Mickey Jagger - RunPod GPU Deployment
# Use with a GPU-enabled RunPod endpoint

FROM pytorch/pytorch:2.1.0-cuda11.8-cudnn8-runtime

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir fastapi uvicorn python-multipart websockets pillow numpy
RUN pip install --no-cache-dir torch==2.1.0 torchvision --index-url https://download.pytorch.org/whl/cu118
RUN pip install --no-cache-dir insightface opencv-python

# Clone repository
RUN git clone https://github.com/KwaiVGI/LivePortrait.git
WORKDIR /app/LivePortrait/backend

# Download models
COPY download_models.py .
RUN python download_models.py

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
