"""
Mickey Jagger - Real-time AI Avatar Call Platform
FastAPI Backend with WebSocket support
"""

import asyncio
import base64
import io
import logging
import time
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import Dict, Optional, List, Any
from enum import Enum

import numpy as np
from PIL import Image
import cv2

from fastapi import FastAPI, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import avatar engine
from avatar_engine import create_engine, AvatarConfig, MotionData

# App lifespan manager
connections: Dict[str, WebSocket] = {}
avatar_sessions: Dict[str, dict] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan."""
    logger.info("Starting Mickey Jagger Backend...")
    
    # Initialize default avatar engine
    app.state.avatar_engine = create_engine(AvatarConfig(
        output_size=(512, 512),
        smoothing_factor=0.7,
        device="cpu"
    ))
    
    await app.state.avatar_engine.initialize()
    logger.info("Avatar engine initialized")
    
    yield
    
    # Cleanup
    logger.info("Shutting down...")
    await app.state.avatar_engine.cleanup()


# Create FastAPI app
app = FastAPI(
    title="Mickey Jagger - AI Avatar Platform",
    description="Real-time AI avatar animation backend",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ Request/Response Models ============

class MotionDataRequest(BaseModel):
    """Motion data from face tracking."""
    pitch: float = 0.0
    yaw: float = 0.0
    roll: float = 0.0
    eye_blink_left: float = 0.0
    eye_blink_right: float = 0.0
    eye_look_x: float = 0.5
    eye_look_y: float = 0.5
    mouth_open: float = 0.0
    mouth_smile: float = 0.0
    expression_happy: float = 0.0
    timestamp: float = 0.0


class AnimationResponse(BaseModel):
    """Animation result response."""
    success: bool
    frame: Optional[str] = None  # Base64 encoded frame
    latency_ms: float = 0.0
    timestamp: float = 0.0


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    engine_ready: bool
    engine_name: str
    version: str
    active_connections: int
    timestamp: float


class SessionInfo(BaseModel):
    """Session information."""
    session_id: str
    portrait_loaded: bool
    created_at: float


# ============ Utility Functions ============

def pil_to_base64(img: Image.Image, format: str = "JPEG") -> str:
    """Convert PIL Image to base64 string."""
    buffer = io.BytesIO()
    img.save(buffer, format=format, quality=90)
    buffer.seek(0)
    return base64.b64encode(buffer.getvalue()).decode('utf-8')


def numpy_to_base64(img: np.ndarray, format: str = "JPEG") -> str:
    """Convert numpy array to base64 string."""
    # Ensure RGB format
    if len(img.shape) == 3 and img.shape[2] == 3:
        img_rgb = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    else:
        img_rgb = img
    
    _, buffer = cv2.imencode(f'.{format}', img_rgb)
    return base64.b64encode(buffer).decode('utf-8')


# ============ API Routes ============

@app.get("/", tags=["Root"])
async def root():
    """Root endpoint."""
    return {
        "name": "Mickey Jagger - AI Avatar Platform",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Health check endpoint."""
    engine = app.state.avatar_engine
    
    return HealthResponse(
        status="healthy",
        engine_ready=engine.is_initialized,
        engine_name=engine.name,
        version=engine.version,
        active_connections=len(connections),
        timestamp=time.time()
    )


@app.post("/upload/portrait", response_model=SessionInfo, tags=["Avatar"])
async def upload_portrait(file: UploadFile = File(...)):
    """
    Upload a portrait image for animation.
    
    The portrait will be used to animate the avatar based on face tracking data.
    """
    # Validate file type
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Generate session ID
    session_id = str(uuid.uuid4())
    
    try:
        # Read image
        contents = await file.read()
        
        # Save to temporary file
        temp_path = f"/tmp/portrait_{session_id}.jpg"
        
        # Process image
        img = Image.open(io.BytesIO(contents))
        img = img.convert('RGB')
        img.save(temp_path, "JPEG", quality=95)
        
        # Load into avatar engine
        engine = app.state.avatar_engine
        success = await engine.load_portrait(temp_path)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to process portrait image")
        
        # Store session info
        avatar_sessions[session_id] = {
            'portrait_path': temp_path,
            'created_at': time.time(),
            'portrait_loaded': True
        }
        
        # Clean up temp file path from session (engine has it loaded)
        # Actually keep it for reference
        
        logger.info(f"Portrait uploaded successfully: session={session_id}")
        
        return SessionInfo(
            session_id=session_id,
            portrait_loaded=True,
            created_at=time.time()
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Portrait upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload portrait: {str(e)}")


@app.post("/animate", response_model=AnimationResponse, tags=["Avatar"])
async def animate_frame(motion: MotionDataRequest):
    """
    Animate a single frame with motion data.
    
    Returns the animated avatar frame.
    """
    start_time = time.time()
    
    try:
        # Convert request to MotionData
        motion_data = MotionData(
            pitch=motion.pitch,
            yaw=motion.yaw,
            roll=motion.roll,
            eye_blink_left=motion.eye_blink_left,
            eye_blink_right=motion.eye_blink_right,
            eye_look_x=motion.eye_look_x,
            eye_look_y=motion.eye_look_y,
            mouth_open=motion.mouth_open,
            mouth_smile=motion.mouth_smile,
            expression_happy=motion.expression_happy,
            timestamp=motion.timestamp or time.time()
        )
        
        # Process frame
        engine = app.state.avatar_engine
        result = await engine.process_frame(motion_data)
        
        if result is None:
            return AnimationResponse(
                success=False,
                latency_ms=(time.time() - start_time) * 1000,
                timestamp=time.time()
            )
        
        # Convert to base64
        frame_b64 = numpy_to_base64(result)
        
        latency_ms = (time.time() - start_time) * 1000
        
        return AnimationResponse(
            success=True,
            frame=frame_b64,
            latency_ms=latency_ms,
            timestamp=time.time()
        )
    
    except Exception as e:
        logger.error(f"Animation failed: {e}")
        return AnimationResponse(
            success=False,
            latency_ms=(time.time() - start_time) * 1000,
            timestamp=time.time()
        )


@app.get("/preview", tags=["Avatar"])
async def get_preview():
    """
    Get current avatar preview frame.
    
    Returns the loaded portrait without animation.
    """
    engine = app.state.avatar_engine
    
    if not hasattr(engine, 'portrait') or engine.portrait is None:
        raise HTTPException(status_code=404, detail="No portrait loaded")
    
    try:
        frame_b64 = numpy_to_base64(engine.portrait)
        
        return {
            "success": True,
            "frame": frame_b64
        }
    
    except Exception as e:
        logger.error(f"Preview failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/session/{session_id}/clear", tags=["Avatar"])
async def clear_session(session_id: str):
    """Clear a session and its resources."""
    if session_id in avatar_sessions:
        session = avatar_sessions[session_id]
        # Clean up temp file
        import os
        if 'portrait_path' in session and os.path.exists(session['portrait_path']):
            os.remove(session['portrait_path'])
        del avatar_sessions[session_id]
    
    return {"success": True, "session_id": session_id}


# ============ WebSocket Endpoint ============

class ConnectionManager:
    """Manage WebSocket connections."""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.frame_buffers: Dict[str, asyncio.Queue] = {}
        self._lock = asyncio.Lock()
    
    async def connect(self, websocket: WebSocket, client_id: str):
        """Accept and register a new connection."""
        await websocket.accept()
        async with self._lock:
            self.active_connections[client_id] = websocket
            self.frame_buffers[client_id] = asyncio.Queue(maxsize=5)
        logger.info(f"WebSocket connected: {client_id}")
    
    async def disconnect(self, client_id: str):
        """Remove a connection."""
        async with self._lock:
            if client_id in self.active_connections:
                del self.active_connections[client_id]
            if client_id in self.frame_buffers:
                del self.frame_buffers[client_id]
        logger.info(f"WebSocket disconnected: {client_id}")
    
    async def send_frame(self, client_id: str, frame_data: dict):
        """Send frame data to a specific client."""
        async with self._lock:
            websocket = self.active_connections.get(client_id)
        
        if websocket:
            try:
                await websocket.send_json(frame_data)
            except Exception as e:
                logger.error(f"Failed to send frame to {client_id}: {e}")
                await self.disconnect(client_id)
    
    async def broadcast(self, frame_data: dict):
        """Broadcast frame to all connected clients."""
        for client_id in list(self.active_connections.keys()):
            await self.send_frame(client_id, frame_data)


# Global connection manager
manager = ConnectionManager()


@app.websocket("/ws/avatar/{client_id}")
async def websocket_avatar(websocket: WebSocket, client_id: str):
    """
    WebSocket endpoint for real-time avatar streaming.
    
    Protocol:
    1. Client sends motion data as JSON
    2. Server processes and returns animated frame
    3. Connection stays open for continuous streaming
    """
    await manager.connect(websocket, client_id)
    
    try:
        # Send welcome message
        await websocket.send_json({
            "type": "connected",
            "client_id": client_id,
            "engine": app.state.avatar_engine.name,
            "timestamp": time.time()
        })
        
        # Check if portrait is loaded
        engine = app.state.avatar_engine
        if not engine.is_initialized or not hasattr(engine, 'portrait') or engine.portrait is None:
            await websocket.send_json({
                "type": "error",
                "message": "No portrait loaded. Please upload a portrait first.",
                "timestamp": time.time()
            })
        
        while True:
            # Receive motion data
            data = await websocket.receive_json()
            
            start_time = time.time()
            
            # Parse motion data
            motion_data = MotionData(
                pitch=data.get('pitch', 0.0),
                yaw=data.get('yaw', 0.0),
                roll=data.get('roll', 0.0),
                eye_blink_left=data.get('eye_blink_left', 0.0),
                eye_blink_right=data.get('eye_blink_right', 0.0),
                eye_look_x=data.get('eye_look_x', 0.5),
                eye_look_y=data.get('eye_look_y', 0.5),
                mouth_open=data.get('mouth_open', 0.0),
                mouth_smile=data.get('mouth_smile', 0.0),
                expression_happy=data.get('expression_happy', 0.0),
                timestamp=data.get('timestamp', time.time())
            )
            
            # Process frame
            result = await engine.process_frame(motion_data)
            
            if result is not None:
                frame_b64 = numpy_to_base64(result)
                
                await websocket.send_json({
                    "type": "frame",
                    "frame": frame_b64,
                    "latency_ms": (time.time() - start_time) * 1000,
                    "timestamp": time.time()
                })
            else:
                await websocket.send_json({
                    "type": "error",
                    "message": "Failed to process frame",
                    "timestamp": time.time()
                })
    
    except WebSocketDisconnect:
        logger.info(f"Client disconnected: {client_id}")
    except Exception as e:
        logger.error(f"WebSocket error for {client_id}: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e),
                "timestamp": time.time()
            })
        except:
            pass
    finally:
        await manager.disconnect(client_id)


# ============ Background Processing ============

async def process_frame_task(frame_data: dict, client_id: str):
    """Background task to process frames."""
    engine = app.state.avatar_engine
    
    try:
        motion_data = MotionData.from_dict(frame_data)
        result = await engine.process_frame(motion_data)
        
        if result is not None:
            frame_b64 = numpy_to_base64(result)
            await manager.send_frame(client_id, {
                "type": "frame",
                "frame": frame_b64,
                "timestamp": time.time()
            })
    
    except Exception as e:
        logger.error(f"Frame processing error: {e}")


# ============ Run Server ============

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
