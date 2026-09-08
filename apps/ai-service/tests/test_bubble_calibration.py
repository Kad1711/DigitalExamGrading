import pytest
import numpy as np
from app.omr.bubble_reader import (
    classify_bubble_group,
    measure_bubble_fill,
    read_answer_question,
    read_digit_column,
)
from app.config import (
    MIN_FILL_RATIO,
    MIN_UNCERTAIN_FILL_RATIO,
    DOMINANCE_MIN_FILL,
    DOMINANCE_MARGIN,
    MAX_GLYPH_BASELINE,
)

def test_scenario_a_dominant_digit_over_glyph_eight():
    """
    Scenario A: Unfilled digit bubble with dark printed '8' baseline (fill ratio ~0.3568,
    just crossing legacy MIN_FILL 0.35), competing against a truly filled digit '1' (fill 1.000).
    Expected: Confident single selection digit '1', status 'OK', candidateDigit '1'.
    """
    fill_ratios = {
        0: 0.28,
        1: 1.000,   # Deliberately filled pencil mark
        2: 0.26,
        3: 0.27,
        4: 0.25,
        5: 0.31,
        6: 0.3554, # Printed font 6 baseline
        7: 0.22,
        8: 0.3568, # Printed font 8 baseline (exceeds 0.35)
        9: 0.34,
    }
    status, val, cand, conf = classify_bubble_group(fill_ratios, is_digit=True)
    assert status == "OK"
    assert val == "1"
    assert cand == "1"
    assert conf >= 0.95

def test_scenario_b_true_multiple_digits():
    """
    Scenario B: Two truly filled digit bubbles close in strength (0.94 vs 0.91).
    Expected: MULTIPLE, value is None.
    """
    fill_ratios = {
        0: 0.94,  # First filled digit
        1: 0.91,  # Second filled digit
        2: 0.15,
        3: 0.12,
        4: 0.14,
        5: 0.18,
        6: 0.20,
        7: 0.11,
        8: 0.22,
        9: 0.19,
    }
    status, val, cand, conf = classify_bubble_group(fill_ratios, is_digit=True)
    assert status == "MULTIPLE"
    assert val is None
    assert cand is None

def test_scenario_b_erased_digit_insufficient_margin():
    """
    Scenario B2: Two dark bubbles with insufficient separation (0.75 vs 0.58).
    Both exceed MIN_FILL_RATIO and second candidate exceeds MAX_GLYPH_BASELINE (0.45).
    Expected: MULTIPLE, value is None.
    """
    fill_ratios = {
        0: 0.15,
        1: 0.75,
        2: 0.58,  # Incompletely erased mark
        3: 0.12,
        4: 0.14,
        5: 0.18,
        6: 0.20,
        7: 0.11,
        8: 0.22,
        9: 0.19,
    }
    status, val, cand, conf = classify_bubble_group(fill_ratios, is_digit=True)
    assert status == "MULTIPLE"
    assert val is None

def test_scenario_c_blank_digit_group_with_printed_glyphs():
    """
    Scenario C: Blank digit group where only printed numerals contribute baseline.
    All 10 digits are in the range 0.17 to 0.29 with negligible margins (~0.01).
    Expected: UNCERTAIN or BLANK, value MUST BE None (no invented identity).
    """
    fill_ratios = {
        0: 0.2934,
        1: 0.1735,
        2: 0.2680,
        3: 0.2779,
        4: 0.2567,
        5: 0.3103,
        6: 0.2666,
        7: 0.2595,
        8: 0.2849,
        9: 0.2849,
    }
    status, val, cand, conf = classify_bubble_group(fill_ratios, is_digit=True)
    assert status in ("UNCERTAIN", "BLANK")
    assert val is None  # CRITICAL: never invent a digit for blank columns

def test_scenario_d_dominant_answer_over_glyph_b():
    """
    Scenario D: Answer group with printed letter 'B' baseline (~0.3618)
    and one strongly filled bubble 'A' (0.9434).
    Expected: MARKED, answer = 'A'.
    """
    fill_ratios = {
        "A": 0.9434,  # Strong mark
        "B": 0.3618,  # Printed 'B' baseline
        "C": 0.3219,
        "D": 0.3418,
    }
    status, val, cand, conf = classify_bubble_group(fill_ratios, is_digit=False)
    assert status == "MARKED"
    assert val == "A"
    assert cand == "A"
    assert conf >= 0.95

def test_scenario_e_two_answers_strongly_filled():
    """
    Scenario E: Two answer bubbles strongly filled (0.92 vs 0.88).
    Expected: MULTIPLE, answer is None.
    """
    fill_ratios = {
        "A": 0.92,
        "B": 0.88,
        "C": 0.15,
        "D": 0.18,
    }
    status, val, cand, conf = classify_bubble_group(fill_ratios, is_digit=False)
    assert status == "MULTIPLE"
    assert val is None
    assert cand is None

def test_scenario_f_faint_single_mark():
    """
    Scenario F: Faint single mark near threshold (0.26 vs 0.12).
    Does not cross MIN_FILL_RATIO (0.35) but falls in uncertainty band (0.20-0.35).
    Expected: UNCERTAIN, answer is None (candidate retained for review).
    """
    fill_ratios = {
        "A": 0.26,  # Faint pencil stroke
        "B": 0.12,
        "C": 0.10,
        "D": 0.11,
    }
    status, val, cand, conf = classify_bubble_group(fill_ratios, is_digit=False)
    assert status == "UNCERTAIN"
    assert val is None
    assert cand == "A"

def test_completely_blank_question():
    """
    All options are below MIN_UNCERTAIN_FILL_RATIO (0.20).
    Expected: BLANK, answer is None, candidate is None.
    """
    fill_ratios = {
        "A": 0.08,
        "B": 0.12,
        "C": 0.07,
        "D": 0.09,
    }
    status, val, cand, conf = classify_bubble_group(fill_ratios, is_digit=False)
    assert status == "BLANK"
    assert val is None
    assert cand is None

def test_local_illumination_invariance():
    """
    Simulates a bubble group rendered under darker local illumination (shadow, bg ~125)
    versus bright illumination (bg ~210).
    Expected: Both yield the same MARKED selection without false positive on unfilled options.
    """
    import cv2
    # 1. Dark background image (shadow)
    dark_img = np.full((100, 300), 125, dtype=np.uint8)
    # 2. Bright background image
    bright_img = np.full((100, 300), 215, dtype=np.uint8)

    # Draw printed circles at x=50, 110, 170, 230
    for img in (dark_img, bright_img):
        for cx in [50, 110, 170, 230]:
            cv2.circle(img, (cx, 50), 24, 40, 2)
        # Fill option D (cx=230) solidly
        cv2.circle(img, (230, 50), 20, 30, -1)

    q_layout = {
        "questionNumber": 39,
        "options": {
            "A": {"centerX_px": 50, "centerY_px": 50, "radius_px": 24},
            "B": {"centerX_px": 110, "centerY_px": 50, "radius_px": 24},
            "C": {"centerX_px": 170, "centerY_px": 50, "radius_px": 24},
            "D": {"centerX_px": 230, "centerY_px": 50, "radius_px": 24},
        }
    }

    res_dark = read_answer_question(dark_img, q_layout)
    res_bright = read_answer_question(bright_img, q_layout)

    assert res_dark["status"] == "MARKED"
    assert res_dark["answer"] == "D"
    assert res_bright["status"] == "MARKED"
    assert res_bright["answer"] == "D"

def test_stray_pencil_mark_between_bubbles():
    """
    Simulates a stray pencil line passing between option A and option B on a blank question.
    Expected: Remains BLANK or safe UNCERTAIN, NEVER a confident false answer (answer is None).
    """
    import cv2
    img = np.full((100, 300), 185, dtype=np.uint8)
    for cx in [50, 110, 170, 230]:
        cv2.circle(img, (cx, 50), 24, 40, 2)

    # Draw a stray dark pencil stroke between A (50) and B (110) at x=80
    cv2.line(img, (76, 35), (84, 65), 35, 3)

    q_layout = {
        "questionNumber": 8,
        "options": {
            "A": {"centerX_px": 50, "centerY_px": 50, "radius_px": 24},
            "B": {"centerX_px": 110, "centerY_px": 50, "radius_px": 24},
            "C": {"centerX_px": 170, "centerY_px": 50, "radius_px": 24},
            "D": {"centerX_px": 230, "centerY_px": 50, "radius_px": 24},
        }
    }

    res = read_answer_question(img, q_layout)
    # The stray stroke between bubbles must not produce a false confirmed answer
    assert res["status"] in ("BLANK", "UNCERTAIN")
    assert res["answer"] is None

def test_local_alignment_drift_recovery():
    """
    Simulates a bubble row that has drifted by (dx=-5, dy=-9) due to non-planar paper curvature.
    Canonical centers are at cy=50, but actual printed circles are at cy=41, cx=cx-5.
    Expected: Alignment estimator discovers the drift and correctly classifies MARKED A.
    """
    import cv2
    img = np.full((120, 300), 180, dtype=np.uint8)
    # Actual printed circles shifted by dx=-5, dy=-9
    actual_shift_x, actual_shift_y = -5, -9
    for cx in [50, 110, 170, 230]:
        cv2.circle(img, (cx + actual_shift_x, 50 + actual_shift_y), 24, 40, 2)
    # Fill option A at its actual shifted position
    cv2.circle(img, (50 + actual_shift_x, 50 + actual_shift_y), 20, 30, -1)

    # Canonical layout pointing to unshifted coordinates (50, 50), etc.
    q_layout = {
        "questionNumber": 40,
        "options": {
            "A": {"centerX_px": 50, "centerY_px": 50, "radius_px": 24},
            "B": {"centerX_px": 110, "centerY_px": 50, "radius_px": 24},
            "C": {"centerX_px": 170, "centerY_px": 50, "radius_px": 24},
            "D": {"centerX_px": 230, "centerY_px": 50, "radius_px": 24},
        }
    }

    res = read_answer_question(img, q_layout)
    assert res["status"] == "MARKED"
    assert res["answer"] == "A"
