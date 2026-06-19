# Mickey Jagger - Real-time AI Avatar Call Platform

A browser-based real-time AI avatar platform that animates user-provided portrait images using live webcam motion tracking.

![Mickey Jagger](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Python](https://img.shields.io/badge/python-3.10+-yellow.svg)
![Next.js](https://img.shields.io/badge/next.js-15-black.svg)

## Features

### 🎭 Avatar Animation
- Real-time portrait animation from webcam input
- Head pose tracking (pitch, yaw, roll)
- Eye movement and natural blinking
- Mouth movement and expression recognition
- Smooth motion interpolation

### 📱 Premium Mobile Interface
- Realistic phone frame design
- FaceTime/WhatsApp inspired call UI
- Status indicators and call timer
- Glassmorphism effects
- Smooth animations with Framer Motion

### 🔧 Face Tracking
- MediaPipe Face Mesh integration
- Face mesh landmark detection
- Blink detection
- Eye gaze tracking
- Expression recognition

### 📡 Real-time Communication
- WebSocket-based streaming
- Low-latency motion data transfer
- Automatic reconnection
- Multiple client support

### 🎬 OBS Mode & Streaming
- Browser Source compatibility
- Transparent background support
- Green screen mode ready
- Screen sharing capabilities

## Architecture

```
mickey-jagger/
├── backend/                    # Python FastAPI backend
│   ├── main.py               # FastAPI application
│   ├── avatar_engine/         # Avatar animation engine
│   │   ├── base_engine.py    # Abstract base class
│   │   └── landmark_warp_engine.py  # Landmark-based warping
│   └── requirements.txt      # Python dependencies
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
