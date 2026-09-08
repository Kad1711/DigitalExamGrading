import math
import itertools
import cv2
import numpy as np

class MarkerDetectionError(Exception):
    """Raised when the 4 corner alignment markers cannot be reliably detected."""
    pass

def order_corner_markers(pts: np.ndarray) -> np.ndarray:
    """
    Orders 4 points as [TOP_LEFT, TOP_RIGHT, BOTTOM_RIGHT, BOTTOM_LEFT] (clockwise).
    """
    pts = np.asarray(pts, dtype=np.float32)
    # Sort by y coordinate: top two and bottom two
    sorted_by_y = pts[np.argsort(pts[:, 1])]
    top_two = sorted_by_y[:2]
    bottom_two = sorted_by_y[2:]

    # Top two: smaller x is TL, larger x is TR
    tl = top_two[0] if top_two[0, 0] < top_two[1, 0] else top_two[1]
    tr = top_two[1] if top_two[0, 0] < top_two[1, 0] else top_two[0]

    # Bottom two: smaller x is BL, larger x is BR
    bl = bottom_two[0] if bottom_two[0, 0] < bottom_two[1, 0] else bottom_two[1]
    br = bottom_two[1] if bottom_two[0, 0] < bottom_two[1, 0] else bottom_two[0]

    return np.array([tl, tr, br, bl], dtype=np.float32)

def is_strictly_convex(pts: np.ndarray) -> bool:
    """
    Checks if 4 points in clockwise order form a strictly convex quadrilateral.
    """
    edges = [pts[(i + 1) % 4] - pts[i] for i in range(4)]
    cross_products = [
        edges[i][0] * edges[(i + 1) % 4][1] - edges[i][1] * edges[(i + 1) % 4][0]
        for i in range(4)
    ]
    return (all(cp > 1e-3 for cp in cross_products) or all(cp < -1e-3 for cp in cross_products))

def evaluate_quadrilateral(c_tuple: tuple, img_w: int, img_h: int) -> tuple[np.ndarray | None, float]:
    """
    Evaluates a candidate 4-tuple of markers and computes a geometric quality score.
    Returns (ordered_pts, score) or (None, 0.0) if invalid.
    """
    raw_pts = np.array([c["center"] for c in c_tuple], dtype=np.float32)
    ordered = order_corner_markers(raw_pts)
    tl, tr, br, bl = ordered

    # 1. Topological ordering sanity: TL is left of TR, BL is left of BR, TL is above BL, TR is above BR
    if not (tl[0] < tr[0] and bl[0] < br[0] and tl[1] < bl[1] and tr[1] < br[1]):
        return None, 0.0

    # 2. Strict convexity
    if not is_strictly_convex(ordered):
        return None, 0.0

    # 3. Minimum side lengths (must span at least 15% of min(width, height))
    w_top_vec = tr - tl
    w_bot_vec = br - bl
    h_left_vec = bl - tl
    h_right_vec = br - tr

    w_top = np.linalg.norm(w_top_vec)
    w_bot = np.linalg.norm(w_bot_vec)
    h_left = np.linalg.norm(h_left_vec)
    h_right = np.linalg.norm(h_right_vec)

    min_side = min(w_top, w_bot, h_left, h_right)
    if min_side < 0.15 * min(img_w, img_h):
        return None, 0.0

    # 4. Parallelism of opposite edges under perspective (allow up to 8.0 degrees)
    ang_top = np.degrees(np.arctan2(w_top_vec[1], w_top_vec[0]))
    ang_bot = np.degrees(np.arctan2(w_bot_vec[1], w_bot_vec[0]))
    diff_w = abs(ang_top - ang_bot)
    if diff_w > 180:
        diff_w = 360 - diff_w
    if diff_w > 8.0:
        return None, 0.0

    ang_left = np.degrees(np.arctan2(h_left_vec[1], h_left_vec[0]))
    ang_right = np.degrees(np.arctan2(h_right_vec[1], h_right_vec[0]))
    diff_h = abs(ang_left - ang_right)
    if diff_h > 180:
        diff_h = 360 - diff_h
    if diff_h > 8.0:
        return None, 0.0

    # 5. Aspect ratio (A4 height / width is ~1.414, allow 0.80 to 2.20 for camera perspective)
    w_avg = (w_top + w_bot) / 2.0
    h_avg = (h_left + h_right) / 2.0
    if w_avg < 1e-3:
        return None, 0.0
    ar = h_avg / w_avg
    if not (0.80 <= ar <= 2.20):
        return None, 0.0

    # 6. Opposing side symmetry under perspective projection
    w_sym = min(w_top, w_bot) / max(w_top, w_bot)
    h_sym = min(h_left, h_right) / max(h_left, h_right)
    if w_sym < 0.60 or h_sym < 0.60:
        return None, 0.0

    # 7. Marker size similarity (all 4 corner markers are physically 7x7 mm)
    areas = [c["area"] for c in c_tuple]
    area_sim = min(areas) / max(areas)
    if area_sim < 0.70:
        return None, 0.0

    # 8. Diagonal crossing and similarity
    d1 = np.linalg.norm(br - tl)
    d2 = np.linalg.norm(tr - bl)
    if max(d1, d2) < 1e-3:
        return None, 0.0
    diag_sim = min(d1, d2) / max(d1, d2)
    if diag_sim < 0.65:
        return None, 0.0

    # 9. Quadrilateral area (shoelace formula)
    quad_area = 0.5 * abs(
        (tl[0] * tr[1] - tr[0] * tl[1])
        + (tr[0] * br[1] - br[0] * tr[1])
        + (br[0] * bl[1] - bl[0] * br[1])
        + (bl[0] * tl[1] - tl[0] * bl[1])
    )
    if quad_area < 0.10 * (img_w * img_h):
        return None, 0.0

    # Quality score favoring large page coverage, marker size consistency, and A4-like geometry
    score = quad_area * area_sim * w_sym * h_sym * diag_sim * math.exp(-(ar - 1.414) ** 2)
    return ordered, score

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
    # Marker area is expected to be ~0.008% to 2.0% of total image area
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
            "bbox": (bx, by, bw, bh),
            "solidity": solidity,
            "ar": aspect_ratio,
        })

    if len(candidates) < 4:
        raise MarkerDetectionError("MARKERS_NOT_FOUND: Found fewer than 4 marker candidates.")

    # Intelligently prune candidate pool to keep geometric search fast and robust
    pool = []
    pool_keys = set()

    def add_to_pool(cand):
        k = (round(float(cand["center"][0]), 1), round(float(cand["center"][1]), 1))
        if k not in pool_keys:
            pool_keys.add(k)
            pool.append(cand)

    # A. Candidates lying on the convex hull of all candidate centers
    pts_arr = np.array([c["center"] for c in candidates], dtype=np.float32)
    hull = cv2.convexHull(pts_arr)
    for v in hull:
        vx, vy = float(v[0][0]), float(v[0][1])
        closest = min(candidates, key=lambda c: (c["center"][0] - vx) ** 2 + (c["center"][1] - vy) ** 2)
        add_to_pool(closest)

    # B. Candidates closest to the 4 bounding-box corners of the candidate cloud
    bbox_min_x = min(c["center"][0] for c in candidates)
    bbox_max_x = max(c["center"][0] for c in candidates)
    bbox_min_y = min(c["center"][1] for c in candidates)
    bbox_max_y = max(c["center"][1] for c in candidates)

    for corner_x, corner_y in [
        (bbox_min_x, bbox_min_y),
        (bbox_max_x, bbox_min_y),
        (bbox_max_x, bbox_max_y),
        (bbox_min_x, bbox_max_y),
    ]:
        sorted_by_corner = sorted(
            candidates,
            key=lambda c: (c["center"][0] - corner_x) ** 2 + (c["center"][1] - corner_y) ** 2,
        )
        for c in sorted_by_corner[:3]:
            add_to_pool(c)

    # C. Top candidates with largest marker area (true markers are 7x7 mm)
    sorted_by_area = sorted(candidates, key=lambda c: c["area"], reverse=True)
    for c in sorted_by_area[:8]:
        add_to_pool(c)

    if len(pool) < 4:
        raise MarkerDetectionError("MARKERS_NOT_FOUND: Insufficient marker candidates after pool pruning.")

    # Evaluate all 4-combinations from pool
    best_score = -1.0
    best_quad = None

    for c_tuple in itertools.combinations(pool, 4):
        quad, score = evaluate_quadrilateral(c_tuple, w, h)
        if quad is not None and score > best_score:
            best_score = score
            best_quad = quad

    if best_quad is None:
        raise MarkerDetectionError("MARKERS_NOT_FOUND: Could not identify a valid 4-corner marker quadrilateral.")

    return best_quad