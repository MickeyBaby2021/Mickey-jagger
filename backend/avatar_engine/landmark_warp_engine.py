"""
Landmark-Based Avatar Warping Engine
Uses facial landmarks and geometric transformations to animate portrait images.
This is a lightweight implementation that works on CPU and provides real-time animation.
"""

import cv2
import numpy as np
from PIL import Image
from typing import Optional, Tuple, List
import logging
from dataclasses import dataclass

from .base_engine import AvatarEngineBase, AvatarConfig, MotionData, EngineType

logger = logging.getLogger(__name__)


@dataclass
class LandmarkPoints:
    """Container for facial landmark points."""
    # Key facial landmarks (normalized 0-1)
    left_eye: Tuple[float, float]
    right_eye: Tuple[float, float]
    nose_tip: Tuple[float, float]
    mouth_left: Tuple[float, float]
    mouth_right: Tuple[float, float]
    mouth_center: Tuple[float, float]
    chin: Tuple[float, float]
    left_eyebrow: Tuple[float, float]
    right_eyebrow: Tuple[float, float]
    forehead_center: Tuple[float, float]
    
    @classmethod
    def from_mediapipe(cls, landmarks, image_shape: Tuple[int, int]) -> 'LandmarkPoints':
        """Extract landmarks from MediaPipe face mesh results."""
        h, w = image_shape[:2]
        
        def get_point(idx):
            lm = landmarks[idx]
            return (lm.x, lm.y)
        
        return cls(
            left_eye=get_point(33),       # Left eye outer corner
            right_eye=get_point(263),      # Right eye outer corner
            nose_tip=get_point(1),        # Nose tip
            mouth_left=get_point(61),     # Left mouth corner
            mouth_right=get_point(291),   # Right mouth corner
            mouth_center=get_point(13),   # Upper lip center
            chin=get_point(152),          # Chin
            left_eyebrow=get_point(70),   # Left eyebrow
            right_eyebrow=get_point(300),  # Right eyebrow
            forehead_center=get_point(10), # Forehead center
        )
    
    @classmethod
    def default(cls, scale: float = 0.5) -> 'LandmarkPoints':
        """Create default neutral landmarks at image center."""
        c = scale
        return cls(
            left_eye=(c - 0.15, c - 0.1),
            right_eye=(c + 0.15, c - 0.1),
            nose_tip=(c, c),
            mouth_left=(c - 0.1, c + 0.15),
            mouth_right=(c + 0.1, c + 0.15),
            mouth_center=(c, c + 0.12),
            chin=(c, c + 0.35),
            left_eyebrow=(c - 0.15, c - 0.2),
            right_eyebrow=(c + 0.15, c - 0.2),
            forehead_center=(c, c - 0.25),
        )


class LandmarkWarpEngine(AvatarEngineBase):
    """
    Avatar engine using landmark-based geometric warping.
    Animates portrait by warping face regions based on motion data.
    """
    
    # Face feature regions for warping
    FACE_POINTS = [
        # Jaw line
        234, 93, 323, 423, 358, 365, 397, 2, 98, 326, 454, 323,
        # Left eye region
        33, 133, 160, 159, 158, 157, 173, 246,
        # Right eye region
        263, 362, 387, 386, 385, 384, 398, 466,
        # Nose region
        1, 2, 98, 327, 4, 168, 195, 5,
        # Mouth region
        13, 14, 17, 61, 62, 63, 64, 291, 292, 293, 267, 0, 37, 38, 43, 44, 181, 185,
    ]
    
    # Key points for warping
    KEY_LANDMARKS = [
        33,   # Left eye outer
        133,  # Left eye inner
        362,  # Right eye inner
        263,  # Right eye outer
        1,    # Nose tip
        61,   # Mouth left
        291,  # Mouth right
        13,   # Upper lip center
        234,  # Left face edge
        454,  # Right face edge
        152,  # Chin
        10,   # Forehead center
    ]
    
    def __init__(self, config: AvatarConfig):
        super().__init__(config)
        self.portrait: Optional[np.ndarray] = None
        self.portrait_gray: Optional[np.ndarray] = None
        self.output_image: Optional[np.ndarray] = None
        self.face_cascade = None
        self.current_motion = MotionData()
        self._blink_state = {'left': 1.0, 'right': 1.0}
        self._prev_mouth_open = 0.0
        
    @property
    def name(self) -> str:
        return "LandmarkWarp"
    
    @property
    def version(self) -> str:
        return "1.0.0"
    
    async def initialize(self) -> bool:
        """Initialize the engine."""
        logger.info("Initializing LandmarkWarp Engine...")
        
        try:
            # Load OpenCV face cascade for face detection fallback
            cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            self.face_cascade = cv2.CascadeClassifier(cascade_path)
            
            if self.face_cascade.empty():
                logger.warning("Could not load face cascade, using simplified mode")
            
            self.is_initialized = True
            logger.info("LandmarkWarp Engine initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize LandmarkWarp Engine: {e}")
            return False
    
    async def load_portrait(self, image_path: str) -> bool:
        """Load a portrait image for animation."""
        logger.info(f"Loading portrait from: {image_path}")
        
        try:
            # Load image
            self.portrait = cv2.imread(image_path)
            if self.portrait is None:
                raise ValueError(f"Could not load image: {image_path}")
            
            # Convert to RGB
            self.portrait = cv2.cvtColor(self.portrait, cv2.COLOR_BGR2RGB)
            
            # Resize to standard size
            target_size = self.config.output_size
            self.portrait = cv2.resize(self.portrait, target_size, interpolation=cv2.INTER_LANCZOS4)
            
            # Create grayscale version
            self.portrait_gray = cv2.cvtColor(self.portrait, cv2.COLOR_RGB2GRAY)
            
            # Detect face and landmarks
            self._detect_and_store_landmarks()
            
            # Initialize output
            self.output_image = self.portrait.copy()
            
            logger.info(f"Portrait loaded successfully: {self.portrait.shape}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load portrait: {e}")
            return False
    
    def _detect_and_store_landmarks(self):
        """Detect face landmarks in the portrait."""
        if self.portrait is None:
            return
        
        h, w = self.portrait.shape[:2]
        
        # Use default landmarks positioned at center for a frontal face
        self._stored_landmarks = LandmarkPoints.default(scale=0.5)
        
        # Optional: Try MediaPipe for more accurate landmarks
        try:
            import mediapipe as mp
            mp_face_mesh = mp.solutions.face_mesh
            with mp_face_mesh.FaceMesh(
                static_image_mode=True,
                max_num_faces=1,
                refine_landmarks=True
            ) as face_mesh:
                results = face_mesh.process(self.portrait)
                if results.multi_face_landmarks:
                    landmarks = results.multi_face_landmarks[0]
                    self._stored_landmarks = LandmarkPoints.from_mediapipe(landmarks, self.portrait.shape)
                    logger.info("Detected face landmarks using MediaPipe")
        except ImportError:
            logger.debug("MediaPipe not available, using default landmarks")
        except Exception as e:
            logger.warning(f"MediaPipe landmark detection failed: {e}")
    
    async def process_frame(self, motion_data: MotionData) -> Optional[np.ndarray]:
        """Process a frame with motion data to animate the avatar."""
        if self.portrait is None:
            return None
        
        try:
            # Smooth motion data
            smoothed = self._smooth_motion_data(motion_data)
            self.current_motion = smoothed
            
            # Apply natural blinking
            smoothed = self._apply_natural_blink(smoothed, motion_data)
            
            # Warp the portrait based on motion
            self.output_image = self._warp_portrait(smoothed)
            
            return self.output_image
            
        except Exception as e:
            logger.error(f"Frame processing failed: {e}")
            return self.portrait
    
    def _apply_natural_blink(self, smoothed: MotionData, raw: MotionData) -> MotionData:
        """Apply natural blinking behavior when no blink detected."""
        if self.config.enable_blink:
            # Check if user is blinking
            if raw.eye_blink_left < 0.3 or raw.eye_blink_right < 0.3:
                # User blinking, follow closely
                self._blink_state['left'] = raw.eye_blink_left
                self._blink_state['right'] = raw.eye_blink_right
            else:
                # Natural random blinking
                if np.random.random() < 0.003:  # ~3 second intervals
                    self._blink_state = {'left': 0.0, 'right': 0.0}
                
                # Recover from blink
                self._blink_state['left'] = min(1.0, self._blink_state['left'] + 0.15)
                self._blink_state['right'] = min(1.0, self._blink_state['right'] + 0.15)
            
            smoothed.eye_blink_left = self._blink_state['left']
            smoothed.eye_blink_right = self._blink_state['right']
        
        return smoothed
    
    def _warp_portrait(self, motion: MotionData) -> np.ndarray:
        """Apply geometric warping to animate the portrait."""
        h, w = self.portrait.shape[:2]
        result = self.portrait.copy()
        
        # Scale factor for motion
        scale = self.config.motion_scale
        
        # 1. Apply head rotation via affine transformation
        result = self._apply_head_rotation(result, motion, scale)
        
        # 2. Apply eye movement
        result = self._apply_eye_movement(result, motion, scale)
        
        # 3. Apply mouth movement
        result = self._apply_mouth_movement(result, motion, scale)
        
        # 4. Apply expression
        result = self._apply_expression(result, motion)
        
        return result
    
    def _apply_head_rotation(self, img: np.ndarray, motion: MotionData, scale: float) -> np.ndarray:
        """Apply head rotation effect."""
        h, w = img.shape[:2]
        center = (w // 2, h // 2)
        
        # Calculate rotation angles (scale down for subtle effect)
        roll_deg = motion.roll * scale * 15  # degrees
        
        # Calculate perspective shift for yaw/pitch
        yaw_offset = (motion.yaw - 0.5) * scale * 30  # pixels
        pitch_offset = (motion.pitch - 0.5) * scale * 20  # pixels
        
        # Create rotation matrix
        M = cv2.getRotationMatrix2D(center, roll_deg, 1.0)
        
        # Add perspective shift
        M[0, 2] += yaw_offset
        M[1, 2] += pitch_offset
        
        # Apply rotation with border handling
        result = cv2.warpAffine(
            img, M, (w, h),
            flags=cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_REFLECT
        )
        
        return result
    
    def _apply_eye_movement(self, img: np.ndarray, motion: MotionData, scale: float) -> np.ndarray:
        """Apply eye movement effect via subtle image shift."""
        h, w = img.shape[:2]
        result = img.copy()
        
        lm = self._stored_landmarks
        
        # Eye positions in pixels
        left_eye = (int(lm.left_eye[0] * w), int(lm.left_eye[1] * h))
        right_eye = (int(lm.right_eye[0] * w), int(lm.right_eye[1] * h))
        
        # Calculate eye movement offset
        look_x = (motion.eye_look_x - 0.5) * scale * 5  # pixels
        look_y = (motion.eye_look_y - 0.5) * scale * 3  # pixels
        
        # Eye regions (crops around eyes)
        eye_size = 40
        eye_region_size = 80
        
        for eye_pos in [left_eye, right_eye]:
            x, y = eye_pos
            x1 = max(0, x - eye_region_size // 2)
            x2 = min(w, x + eye_region_size // 2)
            y1 = max(0, y - eye_region_size // 2)
            y2 = min(h, y + eye_region_size // 2)
            
            # Apply subtle warp based on blink
            blink = motion.eye_blink_left if eye_pos == left_eye else motion.eye_blink_right
            
            if blink < 0.8:
                # Extract eye region
                eye_region = img[y1:y2, x1:x2].copy()
                
                # Compress vertically based on blink amount
                new_h = int(eye_region.shape[0] * max(0.1, blink))
                if new_h > 0 and eye_region.shape[1] > 0:
                    eye_region = cv2.resize(eye_region, (eye_region.shape[1], new_h))
                    
                    # Pad to original size
                    pad_top = (eye_region.shape[0] - new_h) // 2 if new_h < (y2 - y1) else 0
                    eye_region = cv2.copyMakeBorder(
                        eye_region, pad_top, (y2 - y1) - new_h - pad_top, 0, 0,
                        cv2.BORDER_CONSTANT, value=(0, 0, 0)
                    )
                    
                    # Blend back
                    eye_resized = cv2.resize(eye_region, (x2 - x1, y2 - y1))
                    
                    # Create mask for blending
                    mask = self._create_eye_mask(eye_resized.shape[:2], eye_pos, w, h)
                    result = self._blend_region(result, eye_resized, y1, x1, mask)
        
        return result
    
    def _create_eye_mask(self, shape: Tuple[int, int], eye_pos: Tuple[int, int], 
                         img_w: int, img_h: int) -> np.ndarray:
        """Create soft mask for eye region."""
        h, w = shape
        mask = np.zeros((h, w), dtype=np.float32)
        
        # Elliptical mask
        center = (w // 2, h // 2)
        mask = cv2.ellipse(mask, center, (w // 2, h // 2), 0, 0, 360, 1.0, -1)
        
        # Soft edges
        mask = cv2.GaussianBlur(mask, (15, 15), 0)
        
        return mask
    
    def _blend_region(self, img: np.ndarray, region: np.ndarray, y1: int, x1: int,
                      mask: Optional[np.ndarray] = None) -> np.ndarray:
        """Blend a region back into the image."""
        result = img.copy()
        h, w = region.shape[:2]
        y2, x2 = y1 + h, x1 + w
        
        # Clip to image bounds
        actual_y1 = max(0, y1)
        actual_x1 = max(0, x1)
        actual_y2 = min(img.shape[0], y2)
        actual_x2 = min(img.shape[1], x2)
        
        # Adjust region if needed
        region_y1 = actual_y1 - y1
        region_x1 = actual_x1 - x1
        region_y2 = region_y1 + (actual_y2 - actual_y1)
        region_x2 = region_x1 + (actual_x2 - actual_x1)
        
        actual_region = region[region_y1:region_y2, region_x1:region_x2]
        
        if mask is not None:
            actual_mask = mask[region_y1:region_y2, region_x1:region_x2]
            # Blend
            for c in range(3):
                result[actual_y1:actual_y2, actual_x1:actual_x2, c] = (
                    actual_mask * actual_region[:, :, c] +
                    (1 - actual_mask) * img[actual_y1:actual_y2, actual_x1:actual_x2, c]
                )
        else:
            result[actual_y1:actual_y2, actual_x1:actual_x2] = actual_region
        
        return result
    
    def _apply_mouth_movement(self, img: np.ndarray, motion: MotionData, scale: float) -> np.ndarray:
        """Apply mouth movement effect."""
        h, w = img.shape[:2]
        lm = self._stored_landmarks
        
        mouth_center = (int(lm.mouth_center[0] * w), int(lm.mouth_center[1] * h))
        
        # Mouth openness affects vertical scaling
        mouth_open = motion.mouth_open
        smile = motion.mouth_smile
        
        # Region around mouth
        mouth_size = 60
        x1 = max(0, mouth_center[0] - mouth_size)
        x2 = min(w, mouth_center[0] + mouth_size)
        y1 = max(0, mouth_center[1] - mouth_size)
        y2 = min(h, mouth_center[1] + mouth_size)
        
        mouth_region = img[y1:y2, x1:x2].copy()
        
        if mouth_region.size > 0 and mouth_region.shape[0] > 0:
            # Vertical scaling based on mouth open
            new_h = int(mouth_region.shape[0] * (1 + mouth_open * 0.3 * scale))
            new_h = max(1, min(new_h, 200))
            
            mouth_scaled = cv2.resize(mouth_region, (mouth_region.shape[1], new_h))
            
            # Pad to original size
            pad_top = (y2 - y1 - mouth_scaled.shape[0]) // 2
            pad_bottom = (y2 - y1) - mouth_scaled.shape[0] - pad_top
            
            if pad_top >= 0 and pad_bottom >= 0:
                mouth_scaled = cv2.copyMakeBorder(
                    mouth_scaled, pad_top, pad_bottom, 0, 0,
                    cv2.BORDER_CONSTANT, value=(0, 0, 0)
                )
                
                # Apply slight horizontal widening for smile
                if smile > 0.1:
                    smile_factor = 1 + smile * 0.1 * scale
                    new_w = int(mouth_scaled.shape[1] * smile_factor)
                    mouth_scaled = cv2.resize(mouth_scaled, (min(new_w, w), mouth_scaled.shape[0]))
                    # Center it
                    if mouth_scaled.shape[1] < (x2 - x1):
                        pad_left = ((x2 - x1) - mouth_scaled.shape[1]) // 2
                        mouth_scaled = cv2.copyMakeBorder(
                            mouth_scaled, 0, 0, pad_left, (x2 - x1) - mouth_scaled.shape[1] - pad_left,
                            cv2.BORDER_CONSTANT, value=(0, 0, 0)
                        )
                    mouth_scaled = mouth_scaled[:, :x2 - x1]
                
                # Blend
                mask = self._create_mouth_mask(mouth_scaled.shape[:2])
                img = self._blend_region(img, mouth_scaled, y1, x1, mask)
        
        return img
    
    def _create_mouth_mask(self, shape: Tuple[int, int]) -> np.ndarray:
        """Create soft mask for mouth region."""
        h, w = shape
        mask = np.zeros((h, w), dtype=np.float32)
        
        # Oval mask
        center = (w // 2, h // 2)
        mask = cv2.ellipse(mask, center, (w // 2, h // 2), 0, 0, 360, 1.0, -1)
        
        # Soft edges
        mask = cv2.GaussianBlur(mask, (11, 11), 0)
        
        return mask
    
    def _apply_expression(self, img: np.ndarray, motion: MotionData) -> np.ndarray:
        """Apply facial expression effects."""
        if not self.config.enable_expression:
            return img
        
        h, w = img.shape[:2]
        lm = self._stored_landmarks
        
        # Mouth corners for smile
        mouth_left = (int(lm.mouth_left[0] * w), int(lm.mouth_left[1] * h))
        mouth_right = (int(lm.mouth_right[0] * w), int(lm.mouth_right[1] * h))
        
        # Apply subtle brightness/color shift based on expression
        happy = motion.expression_happy
        
        if happy > 0.1:
            # Slight warmth boost for happy expression
            warm = np.array([0, happy * 10, happy * 15], dtype=np.int16)
            img = np.clip(img.astype(np.int16) + warm, 0, 255).astype(np.uint8)
        
        return img
    
    async def get_output(self) -> Optional[np.ndarray]:
        """Get the current output frame."""
        return self.output_image
    
    async def cleanup(self):
        """Cleanup resources."""
        self.portrait = None
        self.portrait_gray = None
        self.output_image = None
        self.face_cascade = None
        logger.info("LandmarkWarp Engine cleaned up")


# Factory function
def create_engine(config: Optional[AvatarConfig] = None) -> LandmarkWarpEngine:
    """Create a LandmarkWarpEngine instance."""
    if config is None:
        config = AvatarConfig()
    return LandmarkWarpEngine(config)
