"""
Avatar Engine Base Interface
Provides abstract interface for different avatar animation backends.
Supports: LivePortrait, FOMM, face landmark-based animation, etc.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Tuple
from enum import Enum
import numpy as np
from PIL import Image


class EngineType(Enum):
    LIVE_PORTRAIT = "liveportrait"
    LANDMARK_WARP = "landmark_warp"
    FOMM = "fomm"
    HOLLO = "hollo"


@dataclass
class MotionData:
    """Motion data captured from face tracking."""
    # Head pose (radians)
    pitch: float = 0.0  # Up/down rotation
    yaw: float = 0.0    # Left/right rotation
    roll: float = 0.0   # Side tilt
    
    # Eye tracking (normalized 0-1)
    eye_blink_left: float = 0.0
    eye_blink_right: float = 0.0
    eye_look_x: float = 0.5  # 0=left, 0.5=center, 1=right
    eye_look_y: float = 0.5  # 0=up, 0.5=center, 1=down
    
    # Mouth (normalized 0-1)
    mouth_open: float = 0.0
    mouth_smile: float = 0.0
    
    # Expression weights
    expression_neutral: float = 1.0
    expression_happy: float = 0.0
    expression_sad: float = 0.0
    expression_surprised: float = 0.0
    expression_angry: float = 0.0
    
    # Timestamp
    timestamp: float = 0.0
    
    @classmethod
    def from_dict(cls, data: dict) -> 'MotionData':
        """Create MotionData from dictionary."""
        return cls(
            pitch=data.get('pitch', 0.0),
            yaw=data.get('yaw', 0.0),
            roll=data.get('roll', 0.0),
            eye_blink_left=data.get('eye_blink_left', 0.0),
            eye_blink_right=data.get('eye_blink_right', 0.0),
            eye_look_x=data.get('eye_look_x', 0.5),
            eye_look_y=data.get('eye_look_y', 0.5),
            mouth_open=data.get('mouth_open', 0.0),
            mouth_smile=data.get('mouth_smile', 0.0),
            expression_neutral=data.get('expression_neutral', 1.0),
            expression_happy=data.get('expression_happy', 0.0),
            expression_sad=data.get('expression_sad', 0.0),
            expression_surprised=data.get('expression_surprised', 0.0),
            expression_angry=data.get('expression_angry', 0.0),
            timestamp=data.get('timestamp', 0.0),
        )
    
    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            'pitch': self.pitch,
            'yaw': self.yaw,
            'roll': self.roll,
            'eye_blink_left': self.eye_blink_left,
            'eye_blink_right': self.eye_blink_right,
            'eye_look_x': self.eye_look_x,
            'eye_look_y': self.eye_look_y,
            'mouth_open': self.mouth_open,
            'mouth_smile': self.mouth_smile,
            'expression_neutral': self.expression_neutral,
            'expression_happy': self.expression_happy,
            'expression_sad': self.expression_sad,
            'expression_surprised': self.expression_surprised,
            'expression_angry': self.expression_angry,
            'timestamp': self.timestamp,
        }


@dataclass
class AvatarConfig:
    """Configuration for avatar engine."""
    engine_type: EngineType = EngineType.LANDMARK_WARP
    target_fps: int = 30
    output_size: Tuple[int, int] = (512, 512)
    smoothing_factor: float = 0.7
    enable_blink: float = True
    enable_expression: float = True
    enable_eye_tracking: float = True
    motion_scale: float = 1.0
    device: str = "cpu"  # cpu, cuda, mps


class AvatarEngineBase(ABC):
    """Abstract base class for avatar animation engines."""
    
    def __init__(self, config: AvatarConfig):
        self.config = config
        self.is_initialized = False
        self._smoothing_buffer = {}
        
    @abstractmethod
    async def initialize(self) -> bool:
        """Initialize the engine and load models."""
        pass
    
    @abstractmethod
    async def load_portrait(self, image_path: str) -> bool:
        """Load a portrait image for animation."""
        pass
    
    @abstractmethod
    async def process_frame(self, motion_data: MotionData) -> Optional[np.ndarray]:
        """Process a single frame with motion data."""
        pass
    
    @abstractmethod
    async def get_output(self) -> Optional[np.ndarray]:
        """Get the current output frame."""
        pass
    
    @abstractmethod
    async def cleanup(self):
        """Cleanup resources."""
        pass
    
    def _smooth_value(self, key: str, new_value: float, factor: float = None) -> float:
        """Apply exponential smoothing to a value."""
        if factor is None:
            factor = self.config.smoothing_factor
            
        if key not in self._smoothing_buffer:
            self._smoothing_buffer[key] = new_value
            return new_value
            
        smoothed = factor * self._smoothing_buffer[key] + (1 - factor) * new_value
        self._smoothing_buffer[key] = smoothed
        return smoothed
    
    def _smooth_motion_data(self, motion: MotionData) -> MotionData:
        """Apply smoothing to motion data."""
        smoothed = MotionData()
        smoothed.timestamp = motion.timestamp
        
        # Smooth head pose
        smoothed.pitch = self._smooth_value('pitch', motion.pitch)
        smoothed.yaw = self._smooth_value('yaw', motion.yaw)
        smoothed.roll = self._smooth_value('roll', motion.roll)
        
        # Smooth eye tracking
        smoothed.eye_blink_left = self._smooth_value('eye_blink_left', motion.eye_blink_left)
        smoothed.eye_blink_right = self._smooth_value('eye_blink_right', motion.eye_blink_right)
        smoothed.eye_look_x = self._smooth_value('eye_look_x', motion.eye_look_x)
        smoothed.eye_look_y = self._smooth_value('eye_look_y', motion.eye_look_y)
        
        # Smooth mouth
        smoothed.mouth_open = self._smooth_value('mouth_open', motion.mouth_open)
        smoothed.mouth_smile = self._smooth_value('mouth_smile', motion.mouth_smile)
        
        # Copy expression (no smoothing needed)
        smoothed.expression_neutral = motion.expression_neutral
        smoothed.expression_happy = motion.expression_happy
        smoothed.expression_sad = motion.expression_sad
        smoothed.expression_surprised = motion.expression_surprised
        smoothed.expression_angry = motion.expression_angry
        
        return smoothed
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Return engine name."""
        pass
    
    @property
    @abstractmethod
    def version(self) -> str:
        """Return engine version."""
        pass
    
    @property
    def latency_ms(self) -> float:
        """Return estimated latency in milliseconds."""
        return 50.0  # Default estimate
