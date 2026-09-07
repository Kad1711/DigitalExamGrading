import cv2
import numpy as np

class MarkerDetectionError(Exception):
    """Raised when the 4 corner alignment markers cannot be reliably detected."""
    pass

def detect_corner_markers(image: np.ndarray) -> np.ndarray:
    """
    Detect the 4 black square corner alignment markers from Phase 3 standardized template.
    Returns:
        np.ndarray of shape (4, 2) with order [TOP_LEFT, TOP_RIGHT, BOTTOM_RIGHT, BOTTOM_LEFT] (x, y).
    Raises:
        MarkerDetectionError if 4 markers cannot be detected.
    """
    h, w = image.shape[:2]
    img_area = w * h

    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()

    # Binarize with Otsu on inverted image (black markers become white connected components)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Find contours
    contours, _ = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    candidates = []
    # Marker area is expected to be ~0.03% to 0.5% of total page area
    min_area = img_area * 0.00008
    max_area = img_area * 0.02

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area or area > max_area:
            continue

        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.05 * peri, True)

        # A square marker should have 4 vertices (allowing 4 to 6 for slight distortion)
        if len(approx) < 4 or len(approx) > 6:
            continue

        bx, by, bw, bh = cv2.boundingRect(cnt)
        aspect_ratio = bw / float(bh)
        if not (0.70 <= aspect_ratio <= 1.40):
            continue

        # Check solidity (extent inside bounding box)
        solidity = area / float(bw * bh)
        if solidity < 0.70:
            continue

        # Compute centroid using moments
        M = cv2.moments(cnt)
        if M["m00"] == 0:
            continue
        cx = float(M["m10"] / M["m00"])
        cy = float(M["m01"] / M["m00"])

        candidates.append({
            "center": (cx, cy),
            "area": area,
            "contour": cnt,
            "bbox": (bx, by, bw, bh)
        })

    if len(candidates) < 4:
        raise MarkerDetectionError("MARKERS_NOT_FOUND: Found fewer than 4 marker candidates.")

    # Partition candidates by 4 quadrants
    mid_x, mid_y = w / 2.0, h / 2.0
    quad_tl = []
    quad_tr = []
    quad_bl = []
    quad_br = []

    # Limit search zone: markers are at ~5.5% width and ~3.9% height from corners
    # Allows up to ~12-14% for rotation and skew while strictly excluding inner grids/headers
    for c in candidates:
        cx, cy = c["center"]
        if cx < mid_x and cy < mid_y:
            if cx < w * 0.14 and cy < h * 0.12:
                dist_to_corner = (cx - 0)**2 + (cy - 0)**2
                quad_tl.append((dist_to_corner, c))
        elif cx >= mid_x and cy < mid_y:
            if cx > w * 0.86 and cy < h * 0.12:
                dist_to_corner = (w - cx)**2 + (cy - 0)**2
                quad_tr.append((dist_to_corner, c))
        elif cx < mid_x and cy >= mid_y:
            if cx < w * 0.14 and cy > h * 0.88:
                dist_to_corner = (cx - 0)**2 + (h - cy)**2
                quad_bl.append((dist_to_corner, c))
        elif cx >= mid_x and cy >= mid_y:
            if cx > w * 0.86 and cy > h * 0.88:
                dist_to_corner = (w - cx)**2 + (h - cy)**2
                quad_br.append((dist_to_corner, c))

    if not (quad_tl and quad_tr and quad_br and quad_bl):
        missing = []
        if not quad_tl: missing.append("TOP_LEFT")
        if not quad_tr: missing.append("TOP_RIGHT")
        if not quad_br: missing.append("BOTTOM_RIGHT")
        if not quad_bl: missing.append("BOTTOM_LEFT")
        raise MarkerDetectionError(f"MARKERS_NOT_FOUND: Missing markers in quadrants: {', '.join(missing)}")

    # Pick the candidate closest to the respective corner in each quadrant
    best_tl = min(quad_tl, key=lambda x: x[0])[1]["center"]
    best_tr = min(quad_tr, key=lambda x: x[0])[1]["center"]
    best_br = min(quad_br, key=lambda x: x[0])[1]["center"]
    best_bl = min(quad_bl, key=lambda x: x[0])[1]["center"]

    # Return ordered array: [TOP_LEFT, TOP_RIGHT, BOTTOM_RIGHT, BOTTOM_LEFT]
    return np.array([best_tl, best_tr, best_br, best_bl], dtype=np.float32)