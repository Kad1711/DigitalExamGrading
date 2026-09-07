import cv2
import numpy as np
from app.config import (
    A4_WIDTH_MM,
    A4_HEIGHT_MM,
    MARKER_CENTER_OFFSET_X_MM,
    MARKER_CENTER_OFFSET_Y_MM,
    PX_PER_MM,
    CANONICAL_WIDTH_PX,
    CANONICAL_HEIGHT_PX,
)

class PerspectiveTransformError(Exception):
    """Raised when perspective transform calculation or warping fails."""
    pass

def get_canonical_marker_centers() -> np.ndarray:
    """
    Returns exact canonical pixel positions for the 4 marker centers:
    [TOP_LEFT, TOP_RIGHT, BOTTOM_RIGHT, BOTTOM_LEFT] (x, y).
    Derived strictly from Phase 3 standardized template geometry:
      TL: (MARKER_CENTER_OFFSET_X_MM, MARKER_CENTER_OFFSET_Y_MM) = (11.5, 11.5) mm
      TR: (A4_WIDTH_MM - MARKER_CENTER_OFFSET_X_MM, MARKER_CENTER_OFFSET_Y_MM) = (198.5, 11.5) mm
      BR: (A4_WIDTH_MM - MARKER_CENTER_OFFSET_X_MM, A4_HEIGHT_MM - MARKER_CENTER_OFFSET_Y_MM) = (198.5, 285.5) mm
      BL: (MARKER_CENTER_OFFSET_X_MM, A4_HEIGHT_MM - MARKER_CENTER_OFFSET_Y_MM) = (11.5, 285.5) mm
    """
    cx_left = MARKER_CENTER_OFFSET_X_MM * PX_PER_MM
    cx_right = (A4_WIDTH_MM - MARKER_CENTER_OFFSET_X_MM) * PX_PER_MM
    cy_top = MARKER_CENTER_OFFSET_Y_MM * PX_PER_MM
    cy_bottom = (A4_HEIGHT_MM - MARKER_CENTER_OFFSET_Y_MM) * PX_PER_MM

    tl = (cx_left, cy_top)
    tr = (cx_right, cy_top)
    br = (cx_right, cy_bottom)
    bl = (cx_left, cy_bottom)
    return np.array([tl, tr, br, bl], dtype=np.float32)

def warp_to_canonical_a4(
    image: np.ndarray,
    src_pts: np.ndarray,
    dst_pts: np.ndarray | None = None
) -> tuple[np.ndarray, np.ndarray]:
    """
    Applies perspective transformation to align the document to canonical A4 dimensions.
    src_pts: Detected 4 marker centers from image [TL, TR, BR, BL]
    dst_pts: Known canonical marker centers from OMR_V1 geometry (defaults to get_canonical_marker_centers())
    Returns:
        warped: np.ndarray of shape (CANONICAL_HEIGHT_PX, CANONICAL_WIDTH_PX, 3)
        M: transformation matrix
    """
    if dst_pts is None:
        dst_pts = get_canonical_marker_centers()

    try:
        M = cv2.getPerspectiveTransform(src_pts, dst_pts)
        warped = cv2.warpPerspective(
            image,
            M,
            (CANONICAL_WIDTH_PX, CANONICAL_HEIGHT_PX),
            flags=cv2.INTER_LANCZOS4
        )
        return warped, M
    except Exception as e:
        raise PerspectiveTransformError(f"PERSPECTIVE_TRANSFORM_FAILED: {str(e)}")