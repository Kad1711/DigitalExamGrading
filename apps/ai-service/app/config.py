import os
from pathlib import Path

# Canonical A4 Dimensions
A4_WIDTH_MM: float = 210.0
A4_HEIGHT_MM: float = 297.0

# 300 DPI gives 2480 x 3508 px, optimal for accurate OMR bubble analysis
CANONICAL_DPI: int = int(os.getenv("OMR_CANONICAL_DPI", "300"))
PX_PER_MM: float = CANONICAL_DPI / 25.4

CANONICAL_WIDTH_PX: int = int(round(A4_WIDTH_MM * PX_PER_MM))
CANONICAL_HEIGHT_PX: int = int(round(A4_HEIGHT_MM * PX_PER_MM))

# Phase 3 Corner Alignment Markers Specification
MARKER_SIZE_MM: float = 7.0
MARKER_MARGIN_MM: float = 8.0
MARKER_CENTER_OFFSET_X_MM: float = MARKER_MARGIN_MM + MARKER_SIZE_MM / 2.0  # 11.5 mm
MARKER_CENTER_OFFSET_Y_MM: float = MARKER_MARGIN_MM + MARKER_SIZE_MM / 2.0  # 11.5 mm

# Bubble Reading Thresholds
MIN_FILL_RATIO: float = float(os.getenv("OMR_MIN_FILL_RATIO", "0.35"))
MIN_UNCERTAIN_FILL_RATIO: float = float(os.getenv("OMR_MIN_UNCERTAIN_FILL_RATIO", "0.20"))
EMPTY_FILL_RATIO: float = float(os.getenv("OMR_EMPTY_FILL_RATIO", "0.15"))
MIN_SELECTION_MARGIN: float = float(os.getenv("OMR_MIN_SELECTION_MARGIN", "0.12"))
INNER_RADIUS_RATIO: float = float(os.getenv("OMR_INNER_RADIUS_RATIO", "0.70"))

# QR Code ROI Configuration by Template Version
QR_ROI_BY_TEMPLATE_VERSION: dict[str, dict] = {
    "OMR_V1": {
        "xMm": 168.0,
        "yMm": 18.0,
        "sizeMm": 24.0,
        "paddingMm": 10.0,
    }
}

# Quality Diagnostics Thresholds
BLUR_THRESHOLD: float = float(os.getenv("OMR_BLUR_THRESHOLD", "40.0"))
BRIGHTNESS_MIN: float = float(os.getenv("OMR_BRIGHTNESS_MIN", "50.0"))
BRIGHTNESS_MAX: float = float(os.getenv("OMR_BRIGHTNESS_MAX", "240.0"))

# Debug Mode
OMR_DEBUG: bool = os.getenv("OMR_DEBUG", "false").lower() in ("true", "1", "yes")
DEBUG_DIR: Path = Path(os.getenv("OMR_DEBUG_DIR", "debug"))

if OMR_DEBUG:
    DEBUG_DIR.mkdir(parents=True, exist_ok=True)