import cv2
import numpy as np
from app.config import (
    MIN_FILL_RATIO,
    MIN_UNCERTAIN_FILL_RATIO,
    MIN_SELECTION_MARGIN,
    INNER_RADIUS_RATIO,
)

def measure_bubble_fill(gray_image: np.ndarray, cx: int, cy: int, radius: int) -> float:
    """
    Measures the fill ratio of a bubble at center (cx, cy) and radius.
    Uses an inner circular mask (0.70 * radius) to eliminate the printed circle border.
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

    # In clean white paper, background is > 220. Pencil/pen is dark (< 150).
    # Count pixels darker than threshold 150
    dark_pixels = np.count_nonzero(masked_pixels < 150)
    fill_ratio = float(dark_pixels) / float(total_pixels)

    return round(min(1.0, max(0.0, fill_ratio)), 4)

def read_answer_question(gray_image: np.ndarray, q_layout: dict) -> dict:
    """
    Evaluates options A, B, C, D for a single question.
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

    for letter in ["A", "B", "C", "D"]:
        opt = q_layout["options"].get(letter)
        if opt:
            fill = measure_bubble_fill(
                gray_image,
                opt["centerX_px"],
                opt["centerY_px"],
                opt["radius_px"]
            )
            fill_ratios[letter] = fill
        else:
            fill_ratios[letter] = 0.0

    # Sort options by fill ratio descending
    sorted_opts = sorted(fill_ratios.items(), key=lambda x: x[1], reverse=True)
    top1_letter, top1_val = sorted_opts[0]
    top2_letter, top2_val = sorted_opts[1]
    margin = top1_val - top2_val

    # Identify strong candidates that exceed the strong fill threshold
    strong_candidates = [letter for letter, val in sorted_opts if val >= MIN_FILL_RATIO]

    # Decision Matrix:
    candidate = None
    if len(strong_candidates) >= 2:
        # Case A: 2 or more options exceeded strong fill threshold -> MULTIPLE
        # Regardless of top1 - top2 margin, 2 strong marks cannot be marked as a single answer.
        status = "MULTIPLE"
        answer = None
        candidate = None
        confidence = round(max(0.20, 1.0 - margin), 2)
    elif len(strong_candidates) == 1:
        # Case B: Exactly 1 option exceeded strong fill threshold
        if margin >= MIN_SELECTION_MARGIN:
            # Clear confident selection -> MARKED
            status = "MARKED"
            answer = top1_letter
            candidate = top1_letter
            confidence = round(min(1.0, 0.70 + 0.30 * min(1.0, top1_val)), 2)
        else:
            # Margin between top1 and top2 is too narrow (incomplete erasure / smudge) -> UNCERTAIN
            # CRITICAL: answer must be None to prevent Grading Engine from accidentally grading it.
            status = "UNCERTAIN"
            answer = None
            candidate = top1_letter
            confidence = round(0.50 + 0.50 * (margin / max(0.001, MIN_SELECTION_MARGIN)), 2)
    else:
        # Case C & D: No options exceeded MIN_FILL_RATIO
        if top1_val >= MIN_UNCERTAIN_FILL_RATIO:
            # Faint mark / partial fill in uncertainty band -> UNCERTAIN
            status = "UNCERTAIN"
            answer = None
            candidate = top1_letter
            confidence = round(0.30 + 0.30 * (top1_val / max(0.001, MIN_FILL_RATIO)), 2)
        else:
            # True blank: all bubbles are below uncertainty threshold -> BLANK
            status = "BLANK"
            answer = None
            candidate = None
            confidence = round(min(1.0, max(0.0, 1.0 - top1_val)), 2)

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
    """
    col_index = col_layout["columnIndex"]
    fill_ratios = {}

    for b in col_layout["bubbles"]:
        digit = b["digit"]
        fill = measure_bubble_fill(
            gray_image,
            b["centerX_px"],
            b["centerY_px"],
            b["radius_px"]
        )
        fill_ratios[digit] = fill

    sorted_digits = sorted(fill_ratios.items(), key=lambda x: x[1], reverse=True)
    top1_digit, top1_val = sorted_digits[0]
    top2_digit, top2_val = sorted_digits[1]
    margin = top1_val - top2_val

    # Identify strong candidates that exceed the strong fill threshold
    strong_candidates = [d for d, val in sorted_digits if val >= MIN_FILL_RATIO]

    candidate_digit = None
    if len(strong_candidates) >= 2:
        # 2 or more digits marked in the same column -> MULTIPLE
        status = "MULTIPLE"
        digit_str = None
        candidate_digit = None
        confidence = round(max(0.20, 1.0 - margin), 2)
    elif len(strong_candidates) == 1:
        if margin >= MIN_SELECTION_MARGIN:
            status = "OK"
            digit_str = str(top1_digit)
            candidate_digit = str(top1_digit)
            confidence = round(min(1.0, 0.70 + 0.30 * min(1.0, top1_val)), 2)
        else:
            status = "UNCERTAIN"
            digit_str = None
            candidate_digit = str(top1_digit)
            confidence = round(0.50 + 0.50 * (margin / max(0.001, MIN_SELECTION_MARGIN)), 2)
    else:
        if top1_val >= MIN_UNCERTAIN_FILL_RATIO:
            # Faint digit mark
            status = "UNCERTAIN"
            digit_str = None
            candidate_digit = str(top1_digit)
            confidence = round(0.30 + 0.30 * (top1_val / max(0.001, MIN_FILL_RATIO)), 2)
        else:
            # True blank column
            status = "BLANK"
            digit_str = None
            candidate_digit = None
            confidence = round(min(1.0, max(0.0, 1.0 - top1_val)), 2)

    return {
        "columnIndex": col_index,
        "digit": digit_str,
        "candidateDigit": candidate_digit,
        "status": status,
        "confidence": confidence,
        "fillRatios": fill_ratios,
    }