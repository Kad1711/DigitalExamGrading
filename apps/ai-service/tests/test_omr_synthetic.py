import json
import time
import cv2
import pytest
import numpy as np
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app
from app.services.omr_service import process_omr_sheet, OMRError
from app.omr.marker_detector import detect_corner_markers
from app.omr.perspective import warp_to_canonical_a4, get_canonical_marker_centers
from tests.synthetic_generator import (
    rasterize_pdf_page,
    fill_student_number,
    fill_exam_code,
    fill_answers,
    fill_bubble,
    PX_PER_MM,
    apply_perspective_distortion,
)

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures" / "generated"

@pytest.fixture(scope="module")
def layout_40():
    with open(FIXTURES_DIR / "layout_40.json", "r", encoding="utf-8") as f:
        return json.load(f)

@pytest.fixture(scope="module")
def layout_60():
    with open(FIXTURES_DIR / "layout_60.json", "r", encoding="utf-8") as f:
        return json.load(f)

@pytest.fixture(scope="module")
def base_image_40():
    pdf_path = str(FIXTURES_DIR / "template_40.pdf")
    return rasterize_pdf_page(pdf_path, page_index=0)

@pytest.fixture(scope="module")
def base_image_60_p2():
    pdf_path = str(FIXTURES_DIR / "template_60.pdf")
    return rasterize_pdf_page(pdf_path, page_index=1)

def test_ground_truth_clean(base_image_40, layout_40):
    """
    Test 1: Clean synthetic sheet with SBD 123456, Exam Code 101, and 40 answers (repeating A,B,C,D).
    Expected: 100% accuracy.
    """
    img = base_image_40.copy()
    p1 = layout_40["pages"][0]

    fill_student_number(img, p1["studentNumber"], "123456")
    fill_exam_code(img, p1["examCode"], "101")

    ground_truth = {}
    options_cycle = ["A", "B", "C", "D"]
    for q in range(1, 41):
        ground_truth[q] = options_cycle[(q - 1) % 4]

    fill_answers(img, p1["answers"], ground_truth)

    _, encoded = cv2.imencode(".png", img)
    start_time = time.perf_counter()
    result = process_omr_sheet(encoded.tobytes(), layout_40)
    elapsed = time.perf_counter() - start_time

    assert result["status"] == "OK"
    assert result["studentNumber"]["value"] == "123456"
    assert result["studentNumber"]["status"] == "OK"
    assert result["examCode"]["value"] == "101"
    assert result["examCode"]["status"] == "OK"

    correct_count = 0
    for ans in result["answers"]:
        q_num = ans["questionNumber"]
        if ans["answer"] == ground_truth[q_num] and ans["status"] == "MARKED":
            correct_count += 1

    accuracy = correct_count / 40.0
    print(f"\n[Test 1 Clean] Accuracy: {accuracy*100:.1f}% ({correct_count}/40), Time: {elapsed*1000:.1f}ms")
    assert accuracy == 1.0

def test_ground_truth_perspective(base_image_40, layout_40):
    """
    Test 2: Perspective distorted sheet.
    Applies corner shifts + slight rotation, then validates marker detection and warp recovery.
    """
    img = base_image_40.copy()
    p1 = layout_40["pages"][0]

    fill_student_number(img, p1["studentNumber"], "123456")
    fill_exam_code(img, p1["examCode"], "101")

    ground_truth = {q: ["A", "B", "C", "D"][(q - 1) % 4] for q in range(1, 41)}
    fill_answers(img, p1["answers"], ground_truth)

    distorted = apply_perspective_distortion(
        img,
        top_left_shift=(30, 40),
        top_right_shift=(-35, 20),
        bottom_right_shift=(-25, -45),
        bottom_left_shift=(35, -30),
        rotation_deg=1.0
    )

    _, encoded = cv2.imencode(".png", distorted)
    start_time = time.perf_counter()
    result = process_omr_sheet(encoded.tobytes(), layout_40)
    elapsed = time.perf_counter() - start_time

    assert result["studentNumber"]["value"] == "123456"
    assert result["examCode"]["value"] == "101"

    correct_count = sum(
        1 for ans in result["answers"] if ans["answer"] == ground_truth[ans["questionNumber"]]
    )
    accuracy = correct_count / 40.0
    print(f"\n[Test 2 Perspective] Accuracy: {accuracy*100:.1f}% ({correct_count}/40), Time: {elapsed*1000:.1f}ms")
    assert accuracy >= 0.95

def test_ground_truth_blank(base_image_40, layout_40):
    """
    Test 3: Question 5 left blank.
    Expected: status == 'BLANK', answer is None.
    """
    img = base_image_40.copy()
    p1 = layout_40["pages"][0]

    fill_student_number(img, p1["studentNumber"], "123456")
    fill_exam_code(img, p1["examCode"], "101")

    # Q5 is omitted from fill
    answers = {q: "A" for q in range(1, 41) if q != 5}
    fill_answers(img, p1["answers"], answers)

    _, encoded = cv2.imencode(".png", img)
    result = process_omr_sheet(encoded.tobytes(), layout_40)

    q5 = next(a for a in result["answers"] if a["questionNumber"] == 5)
    assert q5["status"] == "BLANK"
    assert q5["answer"] is None

def test_ground_truth_multiple_close(base_image_40, layout_40):
    """
    Test 4a: Question 8 has multiple bubbles (A=0.70 and C=0.65) marked closely.
    Expected: status == 'MULTIPLE', answer is None, flagged in needsReviewQuestions.
    """
    img = base_image_40.copy()
    p1 = layout_40["pages"][0]

    fill_student_number(img, p1["studentNumber"], "123456")
    fill_exam_code(img, p1["examCode"], "101")

    answers = {q: "B" for q in range(1, 41)}
    answers[8] = ["A", "C"] # Multiple marks on Q8
    fill_answers(img, p1["answers"], answers)

    _, encoded = cv2.imencode(".png", img)
    result = process_omr_sheet(encoded.tobytes(), layout_40)

    q8 = next(a for a in result["answers"] if a["questionNumber"] == 8)
    assert q8["status"] == "MULTIPLE"
    assert q8["answer"] is None
    assert 8 in result["needsReviewQuestions"]
    assert result["status"] == "NEEDS_REVIEW"

def test_ground_truth_multiple_large_margin(base_image_40, layout_40):
    """
    Test 4b: Question 7 has multiple bubbles marked with LARGE margin:
    A = strong fill (~0.85+), C = strong fill (~0.50), where top1 - top2 > 0.12.
    Expected: Both exceed MIN_FILL_RATIO (0.35) -> MUST be MULTIPLE, answer is None,
    regardless of top1 - top2 margin.
    """
    img = base_image_40.copy()
    p1 = layout_40["pages"][0]

    fill_student_number(img, p1["studentNumber"], "123456")
    fill_exam_code(img, p1["examCode"], "101")

    answers = {q: "B" for q in range(1, 41) if q != 7}
    fill_answers(img, p1["answers"], answers)

    # Q7: A is strongly marked (~0.90), C is also strongly marked (~0.55)
    q7_opt = p1["answers"][6]["options"]
    fill_bubble(img, int(round(q7_opt["A"]["xMm"] * PX_PER_MM)), int(round(q7_opt["A"]["yMm"] * PX_PER_MM)), int(round(q7_opt["A"]["radiusMm"] * PX_PER_MM)), darkness=30, coverage=0.90)
    fill_bubble(img, int(round(q7_opt["C"]["xMm"] * PX_PER_MM)), int(round(q7_opt["C"]["yMm"] * PX_PER_MM)), int(round(q7_opt["C"]["radiusMm"] * PX_PER_MM)), darkness=80, coverage=0.55)

    _, encoded = cv2.imencode(".png", img)
    result = process_omr_sheet(encoded.tobytes(), layout_40)

    q7 = next(a for a in result["answers"] if a["questionNumber"] == 7)
    assert q7["fillRatios"]["A"] >= 0.70
    assert q7["fillRatios"]["C"] >= 0.40
    # Crucial assertion: margin is large, yet status MUST be MULTIPLE!
    assert (q7["fillRatios"]["A"] - q7["fillRatios"]["C"]) > 0.12
    assert q7["status"] == "MULTIPLE"
    assert q7["answer"] is None
    assert 7 in result["needsReviewQuestions"]

def test_ground_truth_uncertain(base_image_40, layout_40):
    """
    Test 5: Question 12 has an uncertain / light pencil mark or incomplete erasure.
    Expected: status == 'UNCERTAIN', flagged in needsReviewQuestions.
    """
    img = base_image_40.copy()
    p1 = layout_40["pages"][0]

    fill_student_number(img, p1["studentNumber"], "123456")
    fill_exam_code(img, p1["examCode"], "101")

    answers = {q: "A" for q in range(1, 41) if q != 12}
    fill_answers(img, p1["answers"], answers)

    # For Q12: light mark on A, smudge/erasure on B so margin < MIN_SELECTION_MARGIN
    q12_opt = p1["answers"][11]["options"]
    fill_bubble(img, int(round(q12_opt["A"]["xMm"] * PX_PER_MM)), int(round(q12_opt["A"]["yMm"] * PX_PER_MM)), int(round(q12_opt["A"]["radiusMm"] * PX_PER_MM)), darkness=90, coverage=0.42)
    fill_bubble(img, int(round(q12_opt["B"]["xMm"] * PX_PER_MM)), int(round(q12_opt["B"]["yMm"] * PX_PER_MM)), int(round(q12_opt["B"]["radiusMm"] * PX_PER_MM)), darkness=90, coverage=0.38)

    _, encoded = cv2.imencode(".png", img)
    result = process_omr_sheet(encoded.tobytes(), layout_40)

    q12 = next(a for a in result["answers"] if a["questionNumber"] == 12)
    assert q12["status"] == "UNCERTAIN"
    assert q12["answer"] is None  # CRITICAL: UNCERTAIN MUST NOT BE FINAL ANSWER
    assert q12["candidate"] == "A"  # Candidate suggested for teacher review
    assert 12 in result["needsReviewQuestions"]
    assert q12["confidence"] < 0.85
    assert result["status"] == "NEEDS_REVIEW"

def test_ground_truth_faint_uncertain(base_image_40, layout_40):
    """
    Test 5b: Question 15 has a faint pencil mark in the uncertainty band:
    fill < MIN_FILL_RATIO (0.35) but >= MIN_UNCERTAIN_FILL_RATIO (0.20).
    Expected: status == 'UNCERTAIN' (NOT BLANK), answer is None, candidate == 'A', flagged in needsReviewQuestions.
    """
    img = base_image_40.copy()
    p1 = layout_40["pages"][0]

    fill_student_number(img, p1["studentNumber"], "123456")
    fill_exam_code(img, p1["examCode"], "101")

    answers = {q: "B" for q in range(1, 41) if q != 15}
    fill_answers(img, p1["answers"], answers)

    # Faint pencil fill on Q15 option A
    q15_opt = p1["answers"][14]["options"]
    fill_bubble(img, int(round(q15_opt["A"]["xMm"] * PX_PER_MM)), int(round(q15_opt["A"]["yMm"] * PX_PER_MM)), int(round(q15_opt["A"]["radiusMm"] * PX_PER_MM)), darkness=110, coverage=0.35)

    _, encoded = cv2.imencode(".png", img)
    result = process_omr_sheet(encoded.tobytes(), layout_40)

    q15 = next(a for a in result["answers"] if a["questionNumber"] == 15)
    assert q15["fillRatios"]["A"] < 0.35
    assert q15["fillRatios"]["A"] >= 0.20
    assert q15["status"] == "UNCERTAIN"
    assert q15["answer"] is None  # CRITICAL: UNCERTAIN MUST NOT BE FINAL ANSWER
    assert q15["candidate"] == "A"
    assert 15 in result["needsReviewQuestions"]

def test_ground_truth_true_blank(base_image_40, layout_40):
    """
    Test 5c: Question 20 has no marks at all (all fill ratios < MIN_UNCERTAIN_FILL_RATIO).
    Expected: status == 'BLANK', answer is None, not in needsReviewQuestions.
    """
    img = base_image_40.copy()
    p1 = layout_40["pages"][0]

    fill_student_number(img, p1["studentNumber"], "123456")
    fill_exam_code(img, p1["examCode"], "101")

    # Q20 is omitted from fill
    answers = {q: "B" for q in range(1, 41) if q != 20}
    fill_answers(img, p1["answers"], answers)

    _, encoded = cv2.imencode(".png", img)
    result = process_omr_sheet(encoded.tobytes(), layout_40)

    q20 = next(a for a in result["answers"] if a["questionNumber"] == 20)
    assert all(val < 0.20 for val in q20["fillRatios"].values())
    assert q20["status"] == "BLANK"
    assert q20["answer"] is None

def test_ground_truth_sbd_leading_zero(base_image_40, layout_40):
    """
    Test 6: SBD with leading zeros '001234'.
    Expected: Preserved exactly as '001234', not truncated to '1234'.
    """
    img = base_image_40.copy()
    p1 = layout_40["pages"][0]

    fill_student_number(img, p1["studentNumber"], "001234")
    fill_exam_code(img, p1["examCode"], "101")
    fill_answers(img, p1["answers"], {q: "A" for q in range(1, 41)})

    _, encoded = cv2.imencode(".png", img)
    result = process_omr_sheet(encoded.tobytes(), layout_40)

    assert result["studentNumber"]["value"] == "001234"
    assert result["studentNumber"]["candidateValue"] == "001234"
    assert result["studentNumber"]["status"] == "OK"

def test_sbd_exam_code_uncertain_safety(base_image_40, layout_40):
    """
    Test 6b: Safety check for SBD and ExamCode when digits are uncertain/multiple.
    Expected: value MUST be None (never a faulty final answer), candidateValue holds the draft.
    """
    img = base_image_40.copy()
    p1 = layout_40["pages"][0]

    # Fill SBD: col 0,1,3,4,5 normal ('1','2','4','5','6'), col 2 faint digit 3
    sn_cols = p1["studentNumber"]["columns"]
    fill_bubble(img, int(round(sn_cols[0]["bubbles"][1]["centerX"] * PX_PER_MM)), int(round(sn_cols[0]["bubbles"][1]["centerY"] * PX_PER_MM)), int(round(sn_cols[0]["bubbles"][1]["radiusMm"] * PX_PER_MM)))
    fill_bubble(img, int(round(sn_cols[1]["bubbles"][2]["centerX"] * PX_PER_MM)), int(round(sn_cols[1]["bubbles"][2]["centerY"] * PX_PER_MM)), int(round(sn_cols[1]["bubbles"][2]["radiusMm"] * PX_PER_MM)))
    # Col 2 faint 3
    fill_bubble(img, int(round(sn_cols[2]["bubbles"][3]["centerX"] * PX_PER_MM)), int(round(sn_cols[2]["bubbles"][3]["centerY"] * PX_PER_MM)), int(round(sn_cols[2]["bubbles"][3]["radiusMm"] * PX_PER_MM)), darkness=110, coverage=0.35)
    fill_bubble(img, int(round(sn_cols[3]["bubbles"][4]["centerX"] * PX_PER_MM)), int(round(sn_cols[3]["bubbles"][4]["centerY"] * PX_PER_MM)), int(round(sn_cols[3]["bubbles"][4]["radiusMm"] * PX_PER_MM)))
    fill_bubble(img, int(round(sn_cols[4]["bubbles"][5]["centerX"] * PX_PER_MM)), int(round(sn_cols[4]["bubbles"][5]["centerY"] * PX_PER_MM)), int(round(sn_cols[4]["bubbles"][5]["radiusMm"] * PX_PER_MM)))
    fill_bubble(img, int(round(sn_cols[5]["bubbles"][6]["centerX"] * PX_PER_MM)), int(round(sn_cols[5]["bubbles"][6]["centerY"] * PX_PER_MM)), int(round(sn_cols[5]["bubbles"][6]["radiusMm"] * PX_PER_MM)))

    # Fill ExamCode: col 0 normal 1, col 1 MULTIPLE (0 and 2), col 2 normal 1
    ec_cols = p1["examCode"]["columns"]
    fill_bubble(img, int(round(ec_cols[0]["bubbles"][1]["centerX"] * PX_PER_MM)), int(round(ec_cols[0]["bubbles"][1]["centerY"] * PX_PER_MM)), int(round(ec_cols[0]["bubbles"][1]["radiusMm"] * PX_PER_MM)))
    fill_bubble(img, int(round(ec_cols[1]["bubbles"][0]["centerX"] * PX_PER_MM)), int(round(ec_cols[1]["bubbles"][0]["centerY"] * PX_PER_MM)), int(round(ec_cols[1]["bubbles"][0]["radiusMm"] * PX_PER_MM)))
    fill_bubble(img, int(round(ec_cols[1]["bubbles"][2]["centerX"] * PX_PER_MM)), int(round(ec_cols[1]["bubbles"][2]["centerY"] * PX_PER_MM)), int(round(ec_cols[1]["bubbles"][2]["radiusMm"] * PX_PER_MM)))
    fill_bubble(img, int(round(ec_cols[2]["bubbles"][1]["centerX"] * PX_PER_MM)), int(round(ec_cols[2]["bubbles"][1]["centerY"] * PX_PER_MM)), int(round(ec_cols[2]["bubbles"][1]["radiusMm"] * PX_PER_MM)))

    fill_answers(img, p1["answers"], {q: "A" for q in range(1, 41)})

    _, encoded = cv2.imencode(".png", img)
    result = process_omr_sheet(encoded.tobytes(), layout_40)

    # Verify SBD safety:
    assert result["studentNumber"]["status"] == "UNCERTAIN"
    assert result["studentNumber"]["value"] is None
    assert result["studentNumber"]["candidateValue"] == "123456"

    # Verify ExamCode safety:
    assert result["examCode"]["status"] == "UNCERTAIN"
    assert result["examCode"]["value"] is None
    assert result["examCode"]["candidateValue"] == "1?1"

    assert result["status"] == "NEEDS_REVIEW"

def test_ground_truth_marker_failure(base_image_40, layout_40):
    """
    Test 8: Marker failure when a corner marker is obscured.
    Expected: Raises OMRError with code MARKERS_NOT_FOUND.
    """
    img = base_image_40.copy()
    # Paint white over top-left corner marker region
    img[0:450, 0:450] = 255

    _, encoded = cv2.imencode(".png", img)
    with pytest.raises(OMRError) as exc_info:
        process_omr_sheet(encoded.tobytes(), layout_40)

    assert exc_info.value.code == "MARKERS_NOT_FOUND"

def test_homography_marker_accuracy(base_image_40):
    """
    Test 8b: Homography accuracy test.
    Distorts the page, detects markers, warps to canonical A4, and verifies that
    the marker centers on the warped image match canonical coordinates with sub-pixel precision.
    """
    distorted = apply_perspective_distortion(
        base_image_40,
        top_left_shift=(30, 40),
        top_right_shift=(-35, 20),
        bottom_right_shift=(-25, -45),
        bottom_left_shift=(35, -30),
        rotation_deg=1.0
    )
    src_markers = detect_corner_markers(distorted)
    warped, _ = warp_to_canonical_a4(distorted, src_markers)

    # Detect markers on the warped image
    warped_markers = detect_corner_markers(warped)
    expected_markers = get_canonical_marker_centers()

    # Calculate Euclidean distance in pixels for all 4 corners
    errors = np.linalg.norm(warped_markers - expected_markers, axis=1)
    mean_error = float(np.mean(errors))
    max_error = float(np.max(errors))

    print(f"\n[Homography Accuracy] Mean Error: {mean_error:.3f} px, Max Error: {max_error:.3f} px")
    assert mean_error < 2.0, f"Mean marker error too high: {mean_error:.2f}px"
    assert max_error < 3.0, f"Max marker error too high: {max_error:.2f}px"

def test_warp_bubble_geometry_consistency(base_image_40, layout_40):
    """
    Test 8c: Bubble geometry consistency after warp.
    Validates that known bubble centers across the layout (Q1 A, Q10 D, Q40 C, SBD, ExamCode)
    fall precisely on the rendered circular stroke in the canonical warped image.
    """
    distorted = apply_perspective_distortion(base_image_40)
    src_markers = detect_corner_markers(distorted)
    warped, _ = warp_to_canonical_a4(distorted, src_markers)
    gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)

    p0 = layout_40["pages"][0]
    bubbles_to_check = [
        ("Q1_A", p0["answers"][0]["options"]["A"]["xMm"], p0["answers"][0]["options"]["A"]["yMm"], p0["answers"][0]["options"]["A"]["radiusMm"]),
        ("Q10_D", p0["answers"][9]["options"]["D"]["xMm"], p0["answers"][9]["options"]["D"]["yMm"], p0["answers"][9]["options"]["D"]["radiusMm"]),
        ("Q40_C", p0["answers"][39]["options"]["C"]["xMm"], p0["answers"][39]["options"]["C"]["yMm"], p0["answers"][39]["options"]["C"]["radiusMm"]),
        ("SBD_0_0", p0["studentNumber"]["columns"][0]["bubbles"][0]["centerX"], p0["studentNumber"]["columns"][0]["bubbles"][0]["centerY"], p0["studentNumber"]["columns"][0]["bubbles"][0]["radiusMm"]),
        ("EC_0_1", p0["examCode"]["columns"][0]["bubbles"][1]["centerX"], p0["examCode"]["columns"][0]["bubbles"][1]["centerY"], p0["examCode"]["columns"][0]["bubbles"][1]["radiusMm"]),
    ]

    for name, x_mm, y_mm, r_mm in bubbles_to_check:
        cx = int(round(float(x_mm) * PX_PER_MM))
        cy = int(round(float(y_mm) * PX_PER_MM))
        r = int(round(float(r_mm) * PX_PER_MM))

        # Sample points on the circle circumference
        angles = np.linspace(0, 2 * np.pi, 16, endpoint=False)
        circ_x = np.round(cx + r * np.cos(angles)).astype(int)
        circ_y = np.round(cy + r * np.sin(angles)).astype(int)
        circ_pixels = gray[circ_y, circ_x]

        # The circumference of the bubble must contain dark boundary pixels from the vector circle
        assert np.min(circ_pixels) < 50, f"Bubble outline missing for {name} at ({cx}, {cy})"
        assert np.mean(circ_pixels) < 120, f"Bubble circumference too light for {name}"

def test_multi_page_60_p2(base_image_60_p2, layout_60):
    """
    Test 9: Multi-page exam (Page 2 of 60-question exam).
    Expected: QR decode indicates page 2 / 2, questions are 51..60.
    """
    img = base_image_60_p2.copy()
    p2 = layout_60["pages"][1]

    fill_student_number(img, p2["studentNumber"], "654321")
    fill_exam_code(img, p2["examCode"], "202")

    p2_answers = {q: "C" for q in range(51, 61)}
    fill_answers(img, p2["answers"], p2_answers)

    _, encoded = cv2.imencode(".png", img)
    result = process_omr_sheet(encoded.tobytes(), layout_60)

    assert result["template"]["page"] == 2
    assert result["template"]["pages"] == 2
    assert result["studentNumber"]["value"] == "654321"
    assert result["examCode"]["value"] == "202"
    assert len(result["answers"]) == 10
    assert result["answers"][0]["questionNumber"] == 51
    assert result["answers"][-1]["questionNumber"] == 60
    assert all(a["answer"] == "C" for a in result["answers"])

def test_fastapi_analyze_endpoint(base_image_40, layout_40):
    """
    Test 10: FastAPI POST /omr/analyze endpoint with multipart/form-data.
    """
    img = base_image_40.copy()
    p1 = layout_40["pages"][0]

    fill_student_number(img, p1["studentNumber"], "123456")
    fill_exam_code(img, p1["examCode"], "101")
    fill_answers(img, p1["answers"], {q: "D" for q in range(1, 41)})

    _, encoded = cv2.imencode(".png", img)

    client = TestClient(app)
    response = client.post(
        "/omr/analyze",
        files={"image": ("sheet.png", encoded.tobytes(), "image/png")},
        data={"layoutJson": json.dumps(layout_40)}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["status"] == "OK"
    assert data["data"]["studentNumber"]["value"] == "123456"
    assert data["data"]["examCode"]["value"] == "101"
    assert len(data["data"]["answers"]) == 40
    assert all(a["answer"] == "D" for a in data["data"]["answers"])

def test_health_endpoint():
    """
    Test 10: FastAPI GET /health endpoint.
    """
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "service" in data