import cv2
import numpy as np
import pymupdf
from app.config import CANONICAL_DPI, PX_PER_MM

def rasterize_pdf_page(pdf_path: str, page_index: int = 0, dpi: int = CANONICAL_DPI) -> np.ndarray:
    """
    Rasterizes a vector PDF page into a NumPy BGR image at specified DPI.
    """
    doc = pymupdf.open(pdf_path)
    page = doc[page_index]
    pix = page.get_pixmap(dpi=dpi)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)

    if pix.n == 4:
        img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
    elif pix.n == 1:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

    return img.copy()

def fill_bubble(
    image: np.ndarray,
    cx: int,
    cy: int,
    radius: int,
    darkness: int = 35,
    coverage: float = 0.85
):
    """
    Simulates a 2B pencil fill inside a bubble.
    darkness: 0 (pure black) to 120 (light pencil)
    coverage: fraction of radius filled
    """
    r_fill = max(2, int(round(radius * coverage)))
    # Draw filled circle
    cv2.circle(image, (cx, cy), r_fill, (darkness, darkness, darkness), -1)

def fill_student_number(image: np.ndarray, sn_layout: dict, sbd: str):
    """
    Fills SBD bubbles for the given string (e.g. '123456' or '001234').
    """
    columns = sn_layout.get("columns", [])
    for i, char in enumerate(sbd):
        if i >= len(columns):
            break
        digit = int(char)
        col = columns[i]
        for b in col.get("bubbles", []):
            if int(b["digit"]) == digit:
                cx = int(round(float(b["centerX"]) * PX_PER_MM))
                cy = int(round(float(b["centerY"]) * PX_PER_MM))
                r = int(round(float(b["radiusMm"]) * PX_PER_MM))
                fill_bubble(image, cx, cy, r)
                break

def fill_exam_code(image: np.ndarray, ec_layout: dict, code: str):
    """
    Fills Exam Code bubbles for the given string (e.g. '101').
    """
    columns = ec_layout.get("columns", [])
    for i, char in enumerate(code):
        if i >= len(columns):
            break
        digit = int(char)
        col = columns[i]
        for b in col.get("bubbles", []):
            if int(b["digit"]) == digit:
                cx = int(round(float(b["centerX"]) * PX_PER_MM))
                cy = int(round(float(b["centerY"]) * PX_PER_MM))
                r = int(round(float(b["radiusMm"]) * PX_PER_MM))
                fill_bubble(image, cx, cy, r)
                break

def fill_answers(image: np.ndarray, answers_layout: list, answers_dict: dict):
    """
    answers_dict: { 1: 'A', 2: 'B', ... } or { 8: ['A', 'C'] } or { 12: ('A', 0.28) }
    """
    for q in answers_layout:
        q_num = q["questionNumber"]
        if q_num not in answers_dict:
            continue

        target = answers_dict[q_num]
        options = q.get("options", {})

        if isinstance(target, list):
            # Multiple selections
            for letter in target:
                if letter in options:
                    opt = options[letter]
                    cx = int(round(float(opt["xMm"]) * PX_PER_MM))
                    cy = int(round(float(opt["yMm"]) * PX_PER_MM))
                    r = int(round(float(opt["radiusMm"]) * PX_PER_MM))
                    fill_bubble(image, cx, cy, r)
        elif isinstance(target, tuple):
            # Uncertain / faint selection (letter, coverage)
            letter, cov = target
            if letter in options:
                opt = options[letter]
                cx = int(round(float(opt["xMm"]) * PX_PER_MM))
                cy = int(round(float(opt["yMm"]) * PX_PER_MM))
                r = int(round(float(opt["radiusMm"]) * PX_PER_MM))
                fill_bubble(image, cx, cy, r, darkness=100, coverage=cov)
        elif isinstance(target, str):
            # Single normal selection
            if target in options:
                opt = options[target]
                cx = int(round(float(opt["xMm"]) * PX_PER_MM))
                cy = int(round(float(opt["yMm"]) * PX_PER_MM))
                r = int(round(float(opt["radiusMm"]) * PX_PER_MM))
                fill_bubble(image, cx, cy, r)

def apply_perspective_distortion(
    image: np.ndarray,
    top_left_shift=(35, 45),
    top_right_shift=(-40, 25),
    bottom_right_shift=(-30, -50),
    bottom_left_shift=(40, -35),
    rotation_deg=1.2
) -> np.ndarray:
    """
    Simulates handheld photo distortion: moves corners and rotates slightly on a larger canvas.
    """
    h, w = image.shape[:2]
    pad = 120
    padded = cv2.copyMakeBorder(image, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=(235, 235, 235))

    # Original corner positions in padded image
    src = np.float32([
        [pad, pad],
        [pad + w, pad],
        [pad + w, pad + h],
        [pad, pad + h]
    ])

    # Shifted corners
    dst = np.float32([
        [pad + top_left_shift[0], pad + top_left_shift[1]],
        [pad + w + top_right_shift[0], pad + top_right_shift[1]],
        [pad + w + bottom_right_shift[0], pad + h + bottom_right_shift[1]],
        [pad + bottom_left_shift[0], pad + h + bottom_left_shift[1]]
    ])

    M = cv2.getPerspectiveTransform(src, dst)
    ph, pw = padded.shape[:2]
    warped = cv2.warpPerspective(padded, M, (pw, ph), borderValue=(230, 230, 230))

    # Apply slight rotation
    center = (pw / 2.0, ph / 2.0)
    rot_mat = cv2.getRotationMatrix2D(center, rotation_deg, 1.0)
    rotated = cv2.warpAffine(warped, rot_mat, (pw, ph), borderValue=(230, 230, 230))

    return rotated