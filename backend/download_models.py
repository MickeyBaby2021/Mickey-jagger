#!/usr/bin/env python3
"""
Download LivePortrait model weights.
Run this script after cloning the repository to download the required models.
"""

import os
import urllib.request
from pathlib import Path

# Model URLs from LivePortrait official repository
MODEL_URLS = {
    # Base models v1.1
    "liveportrait/base_models_v1.1/appearance_feature_extractor.pth": 
        "https://huggingface.co/KwaiVGI/LivePortrait/resolve/main/pretrained_weights/liveportrait/base_models_v1.1/appearance_feature_extractor.pth",
    "liveportrait/base_models_v1.1/motion_extractor.pth": 
        "https://huggingface.co/KwaiVGI/LivePortrait/resolve/main/pretrained_weights/liveportrait/base_models_v1.1/motion_extractor.pth",
    "liveportrait/base_models_v1.1/warping_module.pth": 
        "https://huggingface.co/KwaiVGI/LivePortrait/resolve/main/pretrained_weights/liveportrait/base_models_v1.1/warping_module.pth",
    "liveportrait/base_models_v1.1/spade_generator.pth": 
        "https://huggingface.co/KwaiVGI/LivePortrait/resolve/main/pretrained_weights/liveportrait/base_models_v1.1/spade_generator.pth",
    
    # Retargeting models
    "liveportrait/retargeting_models/stitching_retargeting_module.pth": 
        "https://huggingface.co/KwaiVGI/LivePortrait/resolve/main/pretrained_weights/liveportrait/retargeting_models/stitching_retargeting_module.pth",
}

def download_models(base_dir=None):
    """Download all required model weights."""
    if base_dir is None:
        base_dir = Path(__file__).parent / "LivePortrait" / "pretrained_weights"
    else:
        base_dir = Path(base_dir)
    
    base_dir.mkdir(parents=True, exist_ok=True)
    
    print("=" * 60)
    print("Downloading LivePortrait Model Weights")
    print("=" * 60)
    print(f"Target directory: {base_dir}")
    print()
    
    total_size = 0
    
    for relative_path, url in MODEL_URLS.items():
        target_path = base_dir / relative_path
        target_path.parent.mkdir(parents=True, exist_ok=True)
        
        if target_path.exists():
            size = target_path.stat().st_size / (1024 * 1024)
            print(f"✓ {relative_path} already exists ({size:.1f} MB)")
            total_size += target_path.stat().st_size
            continue
        
        print(f"Downloading {relative_path}...")
        print(f"  From: {url}")
        
        try:
            urllib.request.urlretrieve(url, target_path)
            size = target_path.stat().st_size / (1024 * 1024)
            total_size += target_path.stat().st_size
            print(f"  ✓ Downloaded ({size:.1f} MB)")
        except Exception as e:
            print(f"  ✗ Error: {e}")
            if target_path.exists():
                target_path.unlink()
    
    print()
    print("=" * 60)
    print(f"Total downloaded: {total_size / (1024 * 1024):.1f} MB")
    print("=" * 60)
    print()
    print("You can now start the backend server:")
    print("  cd backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000")

if __name__ == "__main__":
    download_models()
