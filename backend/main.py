"""
Mickey Jagger - Real-time AI Avatar Call Platform
FastAPI Backend with ACTUAL LivePortrait Deep Learning Models

IMPORTANT: This uses REAL LivePortrait neural network models from:
https://github.com/KwaiVGI/LivePortrait
NOT fake OpenCV landmark warping.
"""

import os
import sys
import io
import base64
import uuid
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict
from contextlib import asynccontextmanager
from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image
import torch
from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# LivePortrait paths
BACKEND_DIR = Path(__file__).parent
LIVE_PORTRAIT_DIR = BACKEND_DIR / "LivePortrait"
sys.path.insert(0, str(LIVE_PORTRAIT_DIR))

# Change to LivePortrait directory for relative imports
os.chdir(str(LIVE_PORTRAIT_DIR))

# Import LivePortrait components
from src.config.inference_config import InferenceConfig
from src.config.crop_config import CropConfig
from src.live_portrait_wrapper import LivePortraitWrapper
from src.utils.cropper import Cropper
from src.utils.camera import get_rotation_matrix
from src.utils.io import load_image_rgb, resize_to_limit
from src.utils.crop import prepare_paste_back, paste_back

# ============== MODEL STATUS ==============

class ModelStatus:
    def __init__(self):
        self.models_loaded = False
        self.load_error = None
        self.wrapper = None
        self.cropper = None
        self.inference_cfg = None
        self.crop_cfg = None
        self.loading_start_time = None
        self.loading_end_time = None
        
model_status = ModelStatus()

# ============== SESSION MANAGEMENT ==============

@dataclass
class AvatarSession:
    session_id: str
    portrait_image: np.ndarray
    portrait_cropped: any = None  # Raw cropped image (512x512)
    portrait_tensor: any = None   # Tensor for model input (1x3x256x256)
    kp_info: dict = None
    paste_back_param: dict = None  # Mask for blending
    lmk_crop: any = None  # Landmarks from cropping
    M_c2o: any = None  # Inverse transform matrix (cropped to original)
    created_at: datetime = None
    frame_count: int = 0
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()
            
sessions: Dict[str, AvatarSession] = {}

def load_liveportrait_models():
    """Load ACTUAL LivePortrait models into memory."""
    logger.info("="*70)
    logger.info("LOADING LIVE PORTRAIT MODELS")
    logger.info("="*70)
    model_status.loading_start_time = time.time()
    
    try:
        # Configure for CPU inference
        model_status.inference_cfg = InferenceConfig()
        model_status.inference_cfg.flag_force_cpu = True
        model_status.inference_cfg.flag_do_torch_compile = False
        model_status.inference_cfg.flag_use_half_precision = False
        
        model_status.crop_cfg = CropConfig()
        model_status.crop_cfg.flag_force_cpu = True
        
        device = 'cpu'
        
        logger.info(f"PyTorch version: {torch.__version__}")
        logger.info(f"CUDA available: {torch.cuda.is_available()}")
        logger.info(f"Device: {device}")
        
        # Initialize LivePortrait wrapper (loads 4 PyTorch models)
        logger.info("="*50)
        logger.info("Loading LivePortrait neural network models...")
        logger.info("="*50)
        
        model_status.wrapper = LivePortraitWrapper(model_status.inference_cfg)
        
        logger.info("="*50)
        logger.info("Loading Cropper (InsightFace for face detection)...")
        logger.info("="*50)
        
        model_status.cropper = Cropper(crop_cfg=model_status.crop_cfg, flag_force_cpu=True)
        
        model_status.loading_end_time = time.time()
        load_time = model_status.loading_end_time - model_status.loading_start_time
        
        logger.info("="*70)
        logger.info("LIVE PORTRAIT MODELS LOADED SUCCESSFULLY")
        logger.info(f"Models: appearance_feature_extractor, motion_extractor,")
        logger.info(f"        warping_module, spade_generator")
        logger.info(f"Total loading time: {load_time:.2f} seconds")
        logger.info("="*70)
        
        model_status.models_loaded = True
        return True
        
    except Exception as e:
        logger.error(f"ERROR loading LivePortrait models: {e}")
        import traceback
        traceback.print_exc()
        model_status.load_error = str(e)
        model_status.models_loaded = False
        return False

def process_source_image(img_rgb: np.ndarray):
    """Crop source image and extract keypoint info."""
    inf_cfg = model_status.inference_cfg
    img_rgb = resize_to_limit(img_rgb, inf_cfg.source_max_dim, inf_cfg.source_division)
    
    # Crop face using LivePortrait's Cropper
    cropper = model_status.cropper
    crop_result = cropper.crop_source_image(img_rgb, model_status.crop_cfg)
    
    if crop_result is None:
        raise ValueError("No face detected in the source image")
    
    # Extract cropped image and transformation matrix
    cropped = crop_result["img_crop"]
    M_o2c = crop_result["M_o2c"]  # 3x3 transform matrix (original to cropped)
    M_c2o = crop_result["M_c2o"]  # 3x3 inverse transform (cropped to original)
    lmk_crop = crop_result["pt_crop"]
    
    # Prepare paste back params - mask for blending
    paste_back_mask = prepare_paste_back(cropped, M_c2o, model_status.crop_cfg.dsize)
    
    # Prepare for model input (256x256 for the network)
    img_crop_256 = crop_result.get("img_crop_256x256", cv2.resize(cropped, (256, 256)))
    x = img_crop_256.astype(np.float32) / 255.
    x = np.clip(x, 0, 1)
    x = torch.from_numpy(x).permute(2, 0, 1).unsqueeze(0)  # 1x3x256x256
    
    # Extract keypoint info using LivePortrait's motion extractor
    # The wrapper returns raw model output - DO NOT convert with headpose_pred_to_degree here
    # because transform_keypoint does it internally
    kp_info = model_status.wrapper.get_kp_info(x)
    
    # Reshape kp and exp to (bs, num_points, 3)
    bs = kp_info['kp'].shape[0]
    kp_info['kp'] = kp_info['kp'].reshape(bs, -1, 3)
    kp_info['exp'] = kp_info['exp'].reshape(bs, -1, 3)
    
    return cropped, x, kp_info, paste_back_mask, lmk_crop, M_c2o

def animate_with_liveportrait(source_tensor, source_kp_info, motion):
    """Run LivePortrait inference with given motion parameters."""
    wrapper = model_status.wrapper
    inf_cfg = model_status.inference_cfg
    
    with torch.no_grad():
        device = wrapper.device
        
        # Move source tensor to device
        source_tensor = source_tensor.to(device)
        
        # Move kp_info to device
        kp_source = {k: v.to(device) if isinstance(v, torch.Tensor) else v for k, v in source_kp_info.items()}
        
        # Create driving motion parameters (in degrees)
        pitch_driving = kp_source['pitch'] + torch.tensor([[motion.get('pitch', 0.0)]], device=device)
        yaw_driving = kp_source['yaw'] + torch.tensor([[motion.get('yaw', 0.0)]], device=device)
        roll_driving = kp_source['roll'] + torch.tensor([[motion.get('roll', 0.0)]], device=device)
        
        # Create driving keypoint info dict
        kp_driving = {
            'kp': kp_source['kp'],
            'scale': kp_source['scale'],
            'exp': kp_source['exp'].clone(),  # Start with source expression
            'pitch': pitch_driving,
            'yaw': yaw_driving,
            'roll': roll_driving,
            't': kp_source['t'],
        }
        
        # Add expression from motion
        eye_blink_left = motion.get('eye_blink_left', 0.0)
        eye_blink_right = motion.get('eye_blink_right', 0.0)
        mouth_open = motion.get('mouth_open', 0.0)
        
        exp_delta = torch.zeros_like(kp_driving['exp'])
        if eye_blink_left > 0.1:
            exp_delta[:, :17, 1] += eye_blink_left * 0.02
        if eye_blink_right > 0.1:
            exp_delta[:, 17:34, 1] += eye_blink_right * 0.02
        if mouth_open > 0.1:
            exp_delta[:, 48:68, 1] += mouth_open * 0.05
        
        kp_driving['exp'] = kp_driving['exp'] + exp_delta
        
        # Transform keypoints
        x_s = wrapper.transform_keypoint(source_kp_info)
        
        # Stitching - use stitching() which returns modified keypoints, not stitch() which returns delta
        if inf_cfg.flag_stitching:
            kp_s = wrapper.stitching(x_s, kp_driving['kp'])
        else:
            kp_s = kp_driving['kp']
            
        # Feature extraction
        feature = wrapper.extract_feature_3d(source_tensor)
        
        # Warp and decode
        ret_dct = wrapper.warp_decode(feature, x_s, kp_s)
        
        # Parse output - warp_decode returns dict with 'out' key
        result = wrapper.parse_output(ret_dct['out'])
        
        # Result is (1, H, W, 3), squeeze batch dimension
        result = result[0]
        
        logger.info(f"Animation result shape: {result.shape if hasattr(result, 'shape') else type(result)}")
        
        return result

# ============== FASTAPI APP ==============

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("="*70)
    logger.info("STARTING MICKEY JAGGER BACKEND")
    logger.info("Real-time AI Avatar Platform using LivePortrait")
    logger.info("="*70)
    
    success = load_liveportrait_models()
    if not success:
        logger.error("Failed to load LivePortrait models!")
    
    yield
    
    logger.info("Shutting down...")

app = FastAPI(
    title="Mickey Jagger - AI Avatar Platform",
    description="Real-time AI avatar call platform using LivePortrait deep learning",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============== ENDPOINTS ==============

@app.get("/health")
async def health_check():
    return {
        "status": "healthy" if model_status.models_loaded else "degraded",
        "timestamp": datetime.now().isoformat(),
        "models_loaded": model_status.models_loaded,
        "load_error": model_status.load_error,
        "torch_version": torch.__version__,
        "cuda_available": torch.cuda.is_available(),
        "device": "cpu",
        "active_sessions": len(sessions),
        "engine": "LivePortrait (official)"
    }

@app.get("/model-status")
async def model_status_endpoint():
    status = {
        "models_loaded": model_status.models_loaded,
        "load_error": model_status.load_error,
        "loading_time_seconds": None,
        "components": {
            "wrapper": model_status.wrapper is not None,
            "cropper": model_status.cropper is not None,
        }
    }
    
    if model_status.loading_start_time and model_status.loading_end_time:
        status["loading_time_seconds"] = round(
            model_status.loading_end_time - model_status.loading_start_time, 2
        )
    
    if model_status.models_loaded:
        status["model_info"] = {
            "engine": "LivePortrait",
            "repository": "https://github.com/KwaiVGI/LivePortrait",
            "models": [
                "appearance_feature_extractor.pth",
                "motion_extractor.pth", 
                "warping_module.pth",
                "spade_generator.pth",
                "stitching_retargeting_module.pth"
            ],
            "torch_version": torch.__version__,
            "device": "cpu"
        }
    
    return status

@app.post("/upload/portrait")
async def upload_portrait(file: UploadFile = File(...)):
    if not model_status.models_loaded:
        raise HTTPException(status_code=503, detail="LivePortrait models not loaded")
    
    try:
        contents = await file.read()
        img = Image.open(io.BytesIO(contents)).convert("RGB")
        img_rgb = np.array(img)
        
        logger.info(f"Processing portrait: size={img.size}")
        
        cropped, x, kp_info, paste_back_mask, lmk_crop, M_c2o = process_source_image(img_rgb)
        
        session_id = str(uuid.uuid4())
        
        session = AvatarSession(
            session_id=session_id,
            portrait_image=img_rgb,
            portrait_cropped=cropped,
            portrait_tensor=x,
            kp_info=kp_info,
            paste_back_param=paste_back_mask,  # Store mask for blending
            lmk_crop=lmk_crop,
            M_c2o=M_c2o  # Store inverse transform
        )
        sessions[session_id] = session
        
        logger.info(f"Portrait processed: session_id={session_id}")
        
        return {
            "session_id": session_id,
            "portrait_loaded": True,
            "image_size": list(img.size),
            "engine": "LivePortrait"
        }
        
    except Exception as e:
        logger.error(f"Error uploading portrait: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/animate")
async def animate_portrait(
    session_id: str,
    pitch: float = 0.0,
    yaw: float = 0.0,
    roll: float = 0.0,
    eye_blink_left: float = 0.0,
    eye_blink_right: float = 0.0,
    eye_look_x: float = 0.5,
    eye_look_y: float = 0.5,
    mouth_open: float = 0.0,
    mouth_smile: float = 0.0
):
    if not model_status.models_loaded:
        raise HTTPException(status_code=503, detail="LivePortrait models not loaded")
    
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[session_id]
    
    try:
        start_time = time.time()
        
        motion = {
            "pitch": pitch, "yaw": yaw, "roll": roll,
            "eye_blink_left": eye_blink_left, "eye_blink_right": eye_blink_right,
            "eye_look_x": eye_look_x, "eye_look_y": eye_look_y,
            "mouth_open": mouth_open, "mouth_smile": mouth_smile
        }
        
        result_cropped = animate_with_liveportrait(
            session.portrait_tensor, session.kp_info, motion
        )
        
        # result_cropped is 512x512 animated face (RGB)
        # For simplicity, resize to match original portrait size
        h, w = session.portrait_image.shape[:2]
        result = cv2.resize(result_cropped, (w, h))
        
        _, buffer = cv2.imencode('.jpg', cv2.cvtColor(result, cv2.COLOR_RGB2BGR))
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        
        latency_ms = (time.time() - start_time) * 1000
        session.frame_count += 1
        
        return {
            "success": True,
            "frame": img_base64,
            "latency_ms": round(latency_ms, 2),
            "timestamp": datetime.now().isoformat(),
            "frame_count": session.frame_count,
            "engine": "LivePortrait"
        }
        
    except Exception as e:
        logger.error(f"Error animating portrait: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/avatar/{client_id}")
async def websocket_avatar(websocket: WebSocket, client_id: str):
    await websocket.accept()
    session_id = None
    logger.info(f"WebSocket connected: client_id={client_id}")
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if "session_id" in data and "setup" in data:
                session_id = data["session_id"]
                if session_id not in sessions:
                    await websocket.send_json({"type": "error", "message": "Session not found"})
                    continue
                await websocket.send_json({"type": "session_established", "session_id": session_id})
                continue
            
            if session_id not in sessions:
                await websocket.send_json({"type": "error", "message": "No session established"})
                continue
            
            session = sessions[session_id]
            start_time = time.time()
            
            motion = {
                "pitch": data.get("pitch", 0.0),
                "yaw": data.get("yaw", 0.0),
                "roll": data.get("roll", 0.0),
                "eye_blink_left": data.get("eye_blink_left", 0.0),
                "eye_blink_right": data.get("eye_blink_right", 0.0),
                "eye_look_x": data.get("eye_look_x", 0.5),
                "eye_look_y": data.get("eye_look_y", 0.5),
                "mouth_open": data.get("mouth_open", 0.0),
                "mouth_smile": data.get("mouth_smile", 0.0)
            }
            
            result_cropped = animate_with_liveportrait(session.portrait_tensor, session.kp_info, motion)
            h, w = session.portrait_image.shape[:2]
            result = cv2.resize(result_cropped, (w, h))
            
            _, buffer = cv2.imencode('.jpg', cv2.cvtColor(result, cv2.COLOR_RGB2BGR))
            img_base64 = base64.b64encode(buffer).decode('utf-8')
            
            latency_ms = (time.time() - start_time) * 1000
            session.frame_count += 1
            
            await websocket.send_json({
                "type": "frame", "frame": img_base64,
                "latency_ms": round(latency_ms, 2),
                "timestamp": datetime.now().isoformat(),
                "frame_count": session.frame_count
            })
            
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: client_id={client_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")

@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    if session_id in sessions:
        del sessions[session_id]
        return {"success": True, "message": "Session deleted"}
    raise HTTPException(status_code=404, detail="Session not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
