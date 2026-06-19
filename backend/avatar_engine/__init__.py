"""
Avatar Engine Package
Provides modular architecture for different portrait animation backends.
"""

from .base_engine import (
    AvatarEngineBase,
    AvatarConfig,
    MotionData,
    EngineType,
)

from .landmark_warp_engine import (
    LandmarkWarpEngine,
    create_engine,
)

__all__ = [
    'AvatarEngineBase',
    'AvatarConfig',
    'MotionData',
    'EngineType',
    'LandmarkWarpEngine',
    'create_engine',
]
