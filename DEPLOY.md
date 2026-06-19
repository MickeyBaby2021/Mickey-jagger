# Mickey Jagger - Deployment Guide

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/KwaiVGI/LivePortrait-based-mickey-jagger.git
cd mickey-jagger
```

### 2. Download Model Weights

The model weights are stored in a separate submodule. Initialize and download:

```bash
cd backend/LivePortrait
git submodule update --init --recursive

# Or download manually:
cd ../../
python backend/download_models.py
```

### 3. Start Backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Deployment Options

### Option 1: Google Colab (Recommended for GPU)

1. Open Google Colab
2. Create a new notebook
3. Run the following code:

```python
# Install dependencies
!pip install fastapi uvicorn torch torchvision insightface opencv-python python-multipart websockets pillow numpy

# Clone repository
!git clone https://github.com/KwaiVGI/LivePortrait-based-mickey-jagger.git
%cd mickey-jagger/backend

# Download models
!python download_models.py

# Start server
!uvicorn main:app --host 0.0.0.0 --port 8000
```

4. Use ngrok or localtunnel to expose the server:
```python
!pip install pyngrok
!ngrok http 8000
```

### Option 2: Kaggle

1. Create a new Kaggle notebook
2. Enable GPU accelerator
3. Run the same code as Colab

### Option 3: RunPod

1. Create a new endpoint on RunPod
2. Use the Dockerfile:

```dockerfile
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
    git

# Install Python dependencies
RUN pip install fastapi uvicorn python-multipart websockets pillow numpy
RUN pip install torch==2.1.0 torchvision --index-url https://download.pytorch.org/whl/cu118
RUN pip install insightface opencv-python

# Clone repository
RUN git clone https://github.com/KwaiVGI/LivePortrait-based-mickey-jagger.git
WORKDIR /app/mickey-jagger/backend

# Download models
RUN python download_models.py

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Option 4: Local NVIDIA GPU

```bash
# Install CUDA-enabled PyTorch
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118

# Install other dependencies
pip install -r requirements.txt

# Start server
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## Frontend Deployment (Vercel)

1. Connect your GitHub repo to Vercel
2. Set environment variables:
   - `NEXT_PUBLIC_API_URL` = Your backend URL
   - `NEXT_PUBLIC_WS_URL` = Your backend WebSocket URL

3. Deploy:
```bash
cd frontend
vercel deploy --prod
```

---

## Environment Variables

### Backend (.env)
```
DEVICE=cpu  # or cuda
PORT=8000
LOG_LEVEL=INFO
```

### Frontend (.env.production)
```
NEXT_PUBLIC_API_URL=https://your-backend-url.com
NEXT_PUBLIC_WS_URL=wss://your-backend-url.com
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /health` | Health check | Returns backend status |
| `GET /model-status` | Model info | Returns loaded model details |
| `POST /upload/portrait` | Upload | Upload portrait image |
| `POST /animate` | Animate | Generate animated frame |
| `WS /ws/avatar/{session_id}` | WebSocket | Real-time streaming |

---

## Troubleshooting

### Model weights not loading
- Ensure you ran `python download_models.py`
- Check that `.pth` files exist in `backend/LivePortrait/pretrained_weights/`

### WebSocket connection fails
- Check CORS settings in `main.py`
- Ensure backend URL is correct in frontend env

### Slow inference
- Use GPU for faster processing
- Reduce output resolution if needed

---

## License

MIT License
