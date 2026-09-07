import cv2
import numpy as np
from app.config import (
    BLUR_THRESHOLD,
    BRIGHTNESS_MIN,
    BRIGHTNESS_MAX,
)

def assess_image_quality(image: np.ndarray) -> dict:
    """
    Diagnose input image resolution, brightness, and sharpness.
    Does not aggressively reject in POC, but logs warnings.
    """
    h, w = image.shape[:2]
    warnings = []

    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image

    # 1. Brightness
    brightness = float(np.mean(gray))
    if brightness < BRIGHTNESS_MIN:
        warnings.append("IMAGE_TOO_DARK")
    elif brightness > BRIGHTNESS_MAX:
        warnings.append("IMAGE_TOO_BRIGHT")

    # 2. Blur / Sharpness (variance of Laplacian)
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    if laplacian_var < BLUR_THRESHOLD:
        warnings.append("IMAGE_BLURRY")

    # 3. Resolution check
    if w < 1000 or h < 1400:
        warnings.append("LOW_RESOLUTION")

    return {
        "width": w,
        "height": h,
        "blurScore": round(laplacian_var, 2),
        "brightness": round(brightness, 2),
        "warnings": warnings,
    }