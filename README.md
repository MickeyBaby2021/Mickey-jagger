# Mickey Jagger - Real-time AI Avatar Call Platform

A browser-based real-time AI avatar platform that animates user-provided portrait images using live webcam motion tracking.

![Mickey Jagger](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Python](https://img.shields.io/badge/python-3.10+-yellow.svg)
![Next.js](https://img.shields.io/badge/next.js-15-black.svg)
![LivePortrait](https://img.shields.io/badge/AI-LivePortrait-green.svg)

## 🚀 Current Status

**Milestone 1: COMPLETE** ✅
- LivePortrait backend integration working
- Portrait upload and animation functional
- ~8 seconds per frame on CPU

**Milestone 2: COMPLETE** ✅
- WebSocket communication layer implemented
- Real-time motion streaming working

**Milestone 3: COMPLETE** ✅
- Next.js frontend with phone-frame UI
- MediaPipe face tracking integration
- WebSocket client connection

## 🔗 Quick Links

- **GitHub Repository**: (See Deployment section)
- **LivePortrait Source**: https://github.com/KwaiVGI/LivePortrait
- **Model Weights Download**: Run `python backend/download_models.py`

## 📦 Download & Installation

### Option 1: Download ZIP
Download the project from the GitHub repository.

### Option 2: Clone & Setup
```bash
git clone <repository-url>
cd mickey-jagger

# Download model weights
python backend/download_models.py

# Install backend dependencies
cd backend && pip install -r requirements.txt

# Install frontend dependencies
cd ../frontend && npm install
```

### Option 3: Google Colab / Kaggle
See `notebooks/` directory for GPU deployment notebooks.

## Features

### 🎭 Avatar Animation (LivePortrait Official)
- **Real portrait animation using official LivePortrait models**
- Head pose tracking (pitch, yaw, roll)
- Eye movement and natural blinking
- Mouth movement and expression recognition
- Smooth motion interpolation
- 512x512 animated output

### 📱 Premium Mobile Interface
- Realistic smartphone frame design (FaceTime/WhatsApp inspired)
- Glassmorphism effects
- Framer Motion animations
- Status bar with signal/battery indicators
- Call timer display
- Connection status indicators

### 🔧 Face Tracking (MediaPipe)
- Face mesh landmark detection (468 points)
- Blink detection using eye aspect ratio
- Eye gaze tracking
- Expression recognition
- Head pose estimation

### 📡 Real-time Communication
- WebSocket-based streaming
- Motion data transfer (pitch, yaw, roll, blinks, mouth)
- Automatic reconnection
- Latency tracking

## Quick Start

### 1. Start Backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### 2. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

### 3. Open Browser

Navigate to http://localhost:3000

## Architecture

```
mickey-jagger/
├── backend/                    # Python FastAPI backend
│   ├── main.py               # FastAPI application with LivePortrait
│   ├── LivePortrait/         # Official LivePortrait source code
│   │   ├── src/
│   │   │   ├── config/      # Model configurations
│   │   │   ├── modules/     # Neural network modules
│   │   │   └── utils/       # Utilities (cropper, camera)
│   │   └── pretrained_weights/  # Model weights
│   └── requirements.txt
├── frontend/                  # Next.js 15 frontend
│   ├── app/                 # App directory
│   ├── components/           # React components
│   │   ├── avatar/         # Avatar display
│   │   ├── call/           # Call screen
│   │   └── ui/             # UI components
│   └── hooks/               # Custom React hooks
└── README.md
│
├── frontend/                   # Next.js 15 frontend
│   ├── app/                   # Next.js app directory
│   │   ├── page.tsx          # Main call screen
│   │   ├── layout.tsx        # App layout
│   │   └── globals.css       # Global styles
│   ├── components/            # React components
│   │   ├── call/             # Call UI components
│   │   ├── avatar/           # Avatar display components
│   │   └── ui/               # UI components
│   ├── hooks/                 # Custom React hooks
│   │   ├── useFaceTracking.ts # MediaPipe face tracking
│   │   ├── useAvatarWebSocket.ts # WebSocket connection
│   │   └── useWebcam.ts      # Webcam management
│   └── lib/                   # Utilities
│       ├── api.ts            # API client
│       └── types.ts          # TypeScript types
│
└── README.md                  # This file
```

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Start the backend server:
```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The backend will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

### Environment Variables

Create a `.env` file in the backend directory:

```env
# Server Configuration
HOST=0.0.0.0
PORT=8000
RELOAD=true

# Avatar Engine
ENGINE_TYPE=landmark_warp
DEVICE=cpu
TARGET_FPS=30
OUTPUT_SIZE=512
SMOOTHING_FACTOR=0.7

# CORS
CORS_ORIGINS=*
```

For frontend, create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

## API Endpoints

### Health Check
```
GET /health
```
Returns backend health status and engine information.

### Upload Portrait
```
POST /upload/portrait
Content-Type: multipart/form-data

file: <image_file>

Response:
{
  "session_id": "uuid",
  "portrait_loaded": true,
  "created_at": 1234567890
}
```

### Animate Frame
```
POST /animate
Content-Type: application/json

{
  "pitch": 0.5,
  "yaw": 0.5,
  "roll": 0,
  "eye_blink_left": 1.0,
  "eye_blink_right": 1.0,
  "eye_look_x": 0.5,
  "eye_look_y": 0.5,
  "mouth_open": 0,
  "mouth_smile": 0,
  "expression_happy": 0
}

Response:
{
  "success": true,
  "frame": "base64_encoded_image",
  "latency_ms": 8.5,
  "timestamp": 1234567890
}
```

### WebSocket Streaming
```
WS /ws/avatar/{client_id}

Client sends motion data:
{
  "pitch": 0.5,
  "yaw": 0.5,
  "roll": 0,
  ...
}

Server responds with:
{
  "type": "frame",
  "frame": "base64_encoded_image",
  "latency_ms": 5.2,
  "timestamp": 1234567890
}
```

## Deployment

### Backend Deployment

The backend can be deployed to various GPU platforms:

#### Google Colab / Kaggle
```bash
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

#### RunPod
Use the provided Dockerfile:
```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### Local NVIDIA GPU
```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend Deployment

#### Vercel (Recommended)
```bash
cd frontend
vercel
```

#### GitHub Pages
Build the static site:
```bash
npm run build
```
Deploy the `.next/static` and `out/` directories.

## User Flow

1. **Open Website**: User navigates to the application URL
2. **Upload Portrait**: User uploads a portrait image
3. **Grant Permissions**: User allows webcam access
4. **Face Tracking Starts**: MediaPipe begins tracking facial landmarks
5. **Motion Captured**: Real-time motion data is extracted
6. **Animation Processing**: Backend animates the avatar
7. **Live Preview**: Animated avatar appears in the phone frame UI
8. **Controls**: User can toggle camera, mic, screen share, and access settings

## Performance Targets

| Metric | Target |
|--------|--------|
| Animation Latency | < 300ms |
| Frame Rate | 24-60 FPS |
| WebSocket Latency | < 50ms |
| Startup Time | < 3 seconds |

## Technology Stack

### Backend
- **FastAPI**: Modern Python web framework
- **PyTorch**: Deep learning framework
- **OpenCV**: Computer vision
- **MediaPipe**: Face landmark detection
- **WebSockets**: Real-time communication

### Frontend
- **Next.js 15**: React framework
- **React 19**: UI library
- **TypeScript**: Type safety
- **TailwindCSS**: Styling
- **Framer Motion**: Animations

## Browser Support

- Chrome 90+ (Recommended)
- Firefox 88+
- Safari 14+
- Edge 90+

## Known Limitations

- GPU recommended for better performance
- Portrait images work best with frontal face shots
- Some features require HTTPS for camera access

## Troubleshooting

### Camera Access Denied
- Ensure the site is served over HTTPS
- Check browser permissions
- Try a different browser

### Backend Connection Failed
- Verify backend is running on port 8000
- Check CORS settings
- Verify network connectivity

### Low Performance
- Use GPU acceleration
- Reduce output size
- Lower render quality in settings

## Contributing

Contributions are welcome! Please read the contribution guidelines first.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- [MediaPipe](https://google.github.io/mediapipe/) - Face mesh and tracking
- [LivePortrait](https://github.com/KwaiVGI/LivePortrait) - Avatar animation inspiration
- [FastAPI](https://fastapi.tiangolo.com/) - Backend framework
- [Next.js](https://nextjs.org/) - Frontend framework

---

Built with ❤️ by the Mickey Jagger Team
