import pytest
import cv2
import numpy as np
from pathlib import Path
from app.omr.marker_detector import detect_corner_markers, MarkerDetectionError
from tests.synthetic_generator import rasterize_pdf_page, apply_perspective_distortion

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures" / "generated"

@pytest.fixture(scope="module")
def base_sheet():
    pdf_path = str(FIXTURES_DIR / "template_40.pdf")
    return rasterize_pdf_page(pdf_path, page_index=0)

def test_marker_extra_10_percent_border(base_sheet):
    """
    Test A: Extra 10% border around paper canvas.
    Markers must still be reliably and accurately detected.
    """
    h, w = base_sheet.shape[:2]
    pad_y = int(h * 0.10)
    pad_x = int(w * 0.10)
    padded = cv2.copyMakeBorder(base_sheet, pad_y, pad_y, pad_x, pad_x, cv2.BORDER_CONSTANT, value=(240, 240, 240))

    pts = detect_corner_markers(padded)
    assert pts.shape == (4, 2)

    # Base sheet markers are at ~ (135.5, 135.5), (2344, 135.5), (2344, 3371.5), (135.5, 3371.5)
    # Check that padded detected markers match expected shifted positions within 3 px tolerance
    assert abs(pts[0][0] - (135.5 + pad_x)) < 3.0
    assert abs(pts[0][1] - (135.5 + pad_y)) < 3.0
    assert abs(pts[1][0] - (2344.0 + pad_x)) < 3.0
    assert abs(pts[1][1] - (135.5 + pad_y)) < 3.0
    assert abs(pts[2][0] - (2344.0 + pad_x)) < 3.0
    assert abs(pts[2][1] - (3371.5 + pad_y)) < 3.0
    assert abs(pts[3][0] - (135.5 + pad_x)) < 3.0
    assert abs(pts[3][1] - (3371.5 + pad_y)) < 3.0

def test_marker_extra_20_percent_border(base_sheet):
    """
    Test B: Extra 20% border around paper canvas.
    """
    h, w = base_sheet.shape[:2]
    pad_y = int(h * 0.20)
    pad_x = int(w * 0.20)
    padded = cv2.copyMakeBorder(base_sheet, pad_y, pad_y, pad_x, pad_x, cv2.BORDER_CONSTANT, value=(240, 240, 240))

    pts = detect_corner_markers(padded)
    assert pts.shape == (4, 2)
    assert abs(pts[0][0] - (135.5 + pad_x)) < 3.0
    assert abs(pts[0][1] - (135.5 + pad_y)) < 3.0

def test_marker_asymmetric_margin(base_sheet):
    """
    Test C: Asymmetric margins (large left and top background).
    """
    pad_top = 350
    pad_bottom = 80
    pad_left = 400
    pad_right = 60
    padded = cv2.copyMakeBorder(base_sheet, pad_top, pad_bottom, pad_left, pad_right, cv2.BORDER_CONSTANT, value=(235, 235, 235))

    pts = detect_corner_markers(padded)
    assert pts.shape == (4, 2)
    assert abs(pts[0][0] - (135.5 + pad_left)) < 3.0
    assert abs(pts[0][1] - (135.5 + pad_top)) < 3.0

def test_marker_translated_top_marker_gt_12_percent(base_sheet):
    """
    Test E: Translated page where top marker y > 12% of total image height.
    """
    h, w = base_sheet.shape[:2]
    # To place top marker at ~15% of canvas height:
    # (135.5 + pad_top) / (h + pad_top + pad_bottom) = 0.15
    pad_top = int(h * 0.15)
    pad_bottom = 50
    padded = cv2.copyMakeBorder(base_sheet, pad_top, pad_bottom, 50, 50, cv2.BORDER_CONSTANT, value=(240, 240, 240))
    new_h = padded.shape[0]

    pts = detect_corner_markers(padded)
    top_y_percent = pts[0][1] / new_h
    assert top_y_percent > 0.12, f"Top marker is at {top_y_percent*100:.1f}% > 12%"
    assert abs(pts[0][1] - (135.5 + pad_top)) < 3.0

def test_marker_translated_right_marker_lt_86_percent(base_sheet):
    """
    Test F: Translated page where right marker x < 86% of total image width.
    """
    h, w = base_sheet.shape[:2]
    pad_left = 50
    pad_right = int(w * 0.20)
    padded = cv2.copyMakeBorder(base_sheet, 50, 50, pad_left, pad_right, cv2.BORDER_CONSTANT, value=(240, 240, 240))
    new_w = padded.shape[1]

    pts = detect_corner_markers(padded)
    right_x_percent = pts[1][0] / new_w
    assert right_x_percent < 0.86, f"Right marker is at {right_x_percent*100:.1f}% < 86%"
    assert abs(pts[1][0] - (2344.0 + pad_left)) < 3.0

def test_marker_perspective_warped(base_sheet):
    """
    Test D: Perspective warped page inside larger canvas.
    """
    distorted = apply_perspective_distortion(base_sheet)
    pts = detect_corner_markers(distorted)
    assert pts.shape == (4, 2)
    # Check that ordering is [TL, TR, BR, BL]
    tl, tr, br, bl = pts
    assert tl[0] < tr[0] and bl[0] < br[0]
    assert tl[1] < bl[1] and tr[1] < br[1]

# Negative tests
def test_negative_one_marker_missing(base_sheet):
    """
    Negative Test 1: One corner marker missing/obscured.
    Must raise MarkerDetectionError.
    """
    img = base_sheet.copy()
    img[0:300, 0:300] = 255  # obscure top-left
    with pytest.raises(MarkerDetectionError):
        detect_corner_markers(img)

def test_negative_two_markers_missing(base_sheet):
    """
    Negative Test 2: Two corner markers missing/obscured.
    Must raise MarkerDetectionError.
    """
    img = base_sheet.copy()
    img[0:300, 0:300] = 255
    img[3200:3508, 2200:2481] = 255
    with pytest.raises(MarkerDetectionError):
        detect_corner_markers(img)

def test_negative_random_dark_rectangles():
    """
    Negative Test 3: Random dark rectangles that do not form a page quadrilateral.
    Must raise MarkerDetectionError.
    """
    canvas = np.full((1000, 1000, 3), 255, dtype=np.uint8)
    # Draw 4 small random squares in an almost collinear line
    for i, x in enumerate([100, 200, 300, 400]):
        cv2.rectangle(canvas, (x, 100 + i*10), (x + 30, 130 + i*10), (0, 0, 0), -1)

    with pytest.raises(MarkerDetectionError):
        detect_corner_markers(canvas)

def test_negative_non_convex_arrangement():
    """
    Negative Test 4: 4 square markers forming an arrowhead/concave shape.
    Must raise MarkerDetectionError.
    """
    canvas = np.full((1000, 1000, 3), 255, dtype=np.uint8)
    # Concave quadrilateral
    pts = [(100, 100), (900, 100), (500, 500), (500, 900)]
    for pt in pts:
        cv2.rectangle(canvas, (pt[0] - 15, pt[1] - 15), (pt[0] + 15, pt[1] + 15), (0, 0, 0), -1)

    with pytest.raises(MarkerDetectionError):
        detect_corner_markers(canvas)
