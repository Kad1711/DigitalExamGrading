import cv2
import numpy as np
from app.config import (
    MIN_FILL_RATIO,
    MIN_UNCERTAIN_FILL_RATIO,
    MIN_SELECTION_MARGIN,
    INNER_RADIUS_RATIO,
    DOMINANCE_MIN_FILL,
    DOMINANCE_MARGIN,
    MAX_GLYPH_BASELINE,
    MAX_ALIGNMENT_DRIFT_PX,
)

_CIRCLE_TEMPLATES: dict[int, np.ndarray] = {}

def get_circle_template(radius: int) -> np.ndarray:
    if radius not in _CIRCLE_TEMPLATES:
        size = 2 * radius + 5
        templ = np.full((size, size), 255, dtype=np.uint8)
        cv2.circle(templ, (size // 2, size // 2), radius, 0, 2)
        _CIRCLE_TEMPLATES[radius] = templ
    return _CIRCLE_TEMPLATES[radius]

def estimate_question_row_shift(
    gray_image: np.ndarray,
    q_layout: dict,
    max_drift: int = MAX_ALIGNMENT_DRIFT_PX
) -> tuple[int, int]:
    """
    Finds small local non-planar drift (dx, dy) for a question row.
    Matches a canonical circular template against bubble ROIs to locate the actual printed circles.
    """
    h, w = gray_image.shape[:2]
    best_dx, best_dy, max_score = 0, 0, -1.0
    pad = max_drift

    for opt in q_layout.get("options", {}).values():
        cx, cy, r = opt["centerX_px"], opt["centerY_px"], opt["radius_px"]
        templ = get_circle_template(r)
        tw, th = templ.shape[1], templ.shape[0]
        x1 = cx - r - pad
        y1 = cy - r - pad
        x2 = x1 + tw + 2 * pad
        y2 = y1 + th + 2 * pad
        if x1 < 0 or y1 < 0 or x2 > w or y2 > h:
            continue
        crop = gray_image[y1:y2, x1:x2]
        res = cv2.matchTemplate(crop, templ, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, max_loc = cv2.minMaxLoc(res)
        if max_val > max_score:
            max_score = max_val
            best_dx = max_loc[0] - pad
            best_dy = max_loc[1] - pad

    best_dx = int(np.clip(best_dx, -max_drift, max_drift))
    best_dy = int(np.clip(best_dy, -max_drift, max_drift))
    return best_dx, best_dy

def estimate_column_shift(
    gray_image: np.ndarray,
    col_layout: dict,
    max_drift: int = MAX_ALIGNMENT_DRIFT_PX
) -> tuple[int, int]:
    """
    Finds small local non-planar drift (dx, dy) for an SBD or Exam Code digit column.
    """
    h, w = gray_image.shape[:2]
    best_dx, best_dy, max_score = 0, 0, -1.0
    pad = max_drift

    for b in col_layout.get("bubbles", []):
        cx, cy, r = b["centerX_px"], b["centerY_px"], b["radius_px"]
        templ = get_circle_template(r)
        tw, th = templ.shape[1], templ.shape[0]
        x1 = cx - r - pad
        y1 = cy - r - pad
        x2 = x1 + tw + 2 * pad
        y2 = y1 + th + 2 * pad
        if x1 < 0 or y1 < 0 or x2 > w or y2 > h:
            continue
        crop = gray_image[y1:y2, x1:x2]
        res = cv2.matchTemplate(crop, templ, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, max_loc = cv2.minMaxLoc(res)
        if max_val > max_score:
            max_score = max_val
            best_dx = max_loc[0] - pad
            best_dy = max_loc[1] - pad

    best_dx = int(np.clip(best_dx, -max_drift, max_drift))
    best_dy = int(np.clip(best_dy, -max_drift, max_drift))
    return best_dx, best_dy

def measure_bubble_fill(gray_image: np.ndarray, cx: int, cy: int, radius: int) -> float:
    """
    Measures the fill ratio of a bubble at center (cx, cy) and radius.
    Uses an inner circular mask (0.70 * radius) to eliminate the printed circle border.
    Applies local background illumination compensation to adapt to uneven paper shadows.
    Returns a float between 0.0 (completely white) and 1.0 (completely black).
    """
    h, w = gray_image.shape[:2]
    inner_r = max(2, int(round(radius * INNER_RADIUS_RATIO)))

    x1 = max(0, cx - inner_r)
    x2 = min(w, cx + inner_r + 1)
    y1 = max(0, cy - inner_r)
    y2 = min(h, cy + inner_r + 1)

    if x2 <= x1 or y2 <= y1:
        return 0.0

    patch = gray_image[y1:y2, x1:x2]

    # Create inner circular mask
    pw, ph = x2 - x1, y2 - y1
    yc, xc = np.ogrid[:ph, :pw]
    dx = xc - (cx - x1)
    dy = yc - (cy - y1)
    mask = (dx**2 + dy**2) <= (inner_r**2)

    if not np.any(mask):
        return 0.0

    masked_pixels = patch[mask]
    total_pixels = len(masked_pixels)

    # Local illumination robustness:
    # Sample local background in an annulus around the bubble (from 1.25*r to 1.6*r)
    bg_r_inner = int(round(radius * 1.25))
    bg_r_outer = int(round(radius * 1.60))
    bg_x1 = max(0, cx - bg_r_outer)
    bg_x2 = min(w, cx + bg_r_outer + 1)
    bg_y1 = max(0, cy - bg_r_outer)
    bg_y2 = min(h, cy + bg_r_outer + 1)
    bg_patch = gray_image[bg_y1:bg_y2, bg_x1:bg_x2]
    bg_pw, bg_ph = bg_x2 - bg_x1, bg_y2 - bg_y1

    dark_threshold = 150
    if bg_pw > 0 and bg_ph > 0:
        bg_yc, bg_xc = np.ogrid[:bg_ph, :bg_pw]
        bg_dx = bg_xc - (cx - bg_x1)
        bg_dy = bg_yc - (cy - bg_y1)
        bg_dist_sq = bg_dx**2 + bg_dy**2
        bg_mask = (bg_dist_sq >= bg_r_inner**2) & (bg_dist_sq <= bg_r_outer**2)
        bg_pixels = bg_patch[bg_mask]
        if len(bg_pixels) > 10:
            local_bg = float(np.percentile(bg_pixels, 75))
            dark_threshold = min(150, max(80, int(local_bg * 0.82)))

    # Count pixels darker than adaptive threshold
    dark_pixels = np.count_nonzero(masked_pixels < dark_threshold)
    fill_ratio = float(dark_pixels) / float(total_pixels)

    return round(min(1.0, max(0.0, fill_ratio)), 4)

def classify_bubble_group(fill_ratios: dict, is_digit: bool = False) -> tuple[str, str | None, str | None, float]:
    """
    Classifies bubble fill ratios for a single question or digit column.
    Takes into account printed glyph baseline by checking for dominant bubble selection.

    Returns:
        (status, value, candidate_value, confidence)
    """
    sorted_items = sorted(fill_ratios.items(), key=lambda x: x[1], reverse=True)
    top1_key, top1_val = sorted_items[0]
    top2_key, top2_val = sorted_items[1]
    margin = round(float(top1_val - top2_val), 4)

    strong_candidates = [k for k, val in sorted_items if val >= MIN_FILL_RATIO]

    # Dominant Selection Rule:
    # If the top candidate is heavily filled and the second candidate is within the
    # printed glyph baseline band with a large margin, the top candidate is overwhelmingly
    # dominant over the printed glyph baseline (e.g. printed '8' or 'B' having ~0.356 baseline).
    is_dominant = (
        top1_val >= DOMINANCE_MIN_FILL
        and margin >= DOMINANCE_MARGIN
        and top2_val <= MAX_GLYPH_BASELINE
    )

    candidate_str = str(top1_key) if is_digit else top1_key

    if is_dominant:
        status = "OK" if is_digit else "MARKED"
        val_str = candidate_str
        confidence = round(min(1.0, 0.70 + 0.30 * min(1.0, top1_val)), 2)
        return status, val_str, candidate_str, confidence

    if len(strong_candidates) >= 2:
        # 2 or more strong marks without single bubble dominance -> MULTIPLE
        status = "MULTIPLE"
        val_str = None
        candidate_str = None
        confidence = round(max(0.20, 1.0 - margin), 2)
        return status, val_str, candidate_str, confidence

    if len(strong_candidates) == 1:
        if margin >= MIN_SELECTION_MARGIN:
            status = "OK" if is_digit else "MARKED"
            val_str = candidate_str
            confidence = round(min(1.0, 0.70 + 0.30 * min(1.0, top1_val)), 2)
        else:
            status = "UNCERTAIN"
            val_str = None
            confidence = round(0.50 + 0.50 * (margin / max(0.001, MIN_SELECTION_MARGIN)), 2)
        return status, val_str, candidate_str, confidence

    # len(strong_candidates) == 0
    if top1_val >= MIN_UNCERTAIN_FILL_RATIO:
        status = "UNCERTAIN"
        val_str = None
        confidence = round(0.30 + 0.30 * (top1_val / max(0.001, MIN_FILL_RATIO)), 2)
    else:
        status = "BLANK"
        val_str = None
        candidate_str = None
        confidence = round(min(1.0, max(0.0, 1.0 - top1_val)), 2)

    return status, val_str, candidate_str, confidence

def read_answer_question(gray_image: np.ndarray, q_layout: dict) -> dict:
    """
    Evaluates options A, B, C, D for a single question.
    Estimates small local row alignment drift before measuring fill ratios.
    Returns:
        {
            "questionNumber": int,
            "answer": "A" | "B" | "C" | "D" | None,
            "status": "MARKED" | "BLANK" | "MULTIPLE" | "UNCERTAIN",
            "confidence": float (0.0 to 1.0),
            "fillRatios": { "A": float, "B": float, "C": float, "D": float }
        }
    """
    q_num = q_layout["questionNumber"]
    fill_ratios = {}

    dx, dy = estimate_question_row_shift(gray_image, q_layout)

    for letter in ["A", "B", "C", "D"]:
        opt = q_layout["options"].get(letter)
        if opt:
            fill = measure_bubble_fill(
                gray_image,
                opt["centerX_px"] + dx,
                opt["centerY_px"] + dy,
                opt["radius_px"]
            )
            fill_ratios[letter] = fill
        else:
            fill_ratios[letter] = 0.0

    status, answer, candidate, confidence = classify_bubble_group(fill_ratios, is_digit=False)

    return {
        "questionNumber": q_num,
        "answer": answer,
        "candidate": candidate,
        "status": status,
        "confidence": confidence,
        "fillRatios": fill_ratios,
    }

def read_digit_column(gray_image: np.ndarray, col_layout: dict) -> dict:
    """
    Evaluates 10 bubbles (digits 0..9) for a single digit column (SBD or Exam Code).
    Estimates small local column alignment drift before measuring fill ratios.
    """
    col_index = col_layout["columnIndex"]
    fill_ratios = {}

    dx, dy = estimate_column_shift(gray_image, col_layout)

    for b in col_layout["bubbles"]:
        digit = b["digit"]
        fill = measure_bubble_fill(
            gray_image,
            b["centerX_px"] + dx,
            b["centerY_px"] + dy,
            b["radius_px"]
        )
        fill_ratios[digit] = fill

    status, digit_str, candidate_digit, confidence = classify_bubble_group(fill_ratios, is_digit=True)

    return {
        "columnIndex": col_index,
        "digit": digit_str,
        "candidateDigit": candidate_digit,
        "status": status,
        "confidence": confidence,
        "fillRatios": fill_ratios,
    }