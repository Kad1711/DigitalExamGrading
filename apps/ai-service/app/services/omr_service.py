import cv2
import numpy as np
from pathlib import Path
from app.config import (
    OMR_DEBUG,
    DEBUG_DIR,
    CANONICAL_WIDTH_PX,
    CANONICAL_HEIGHT_PX,
)
from app.omr.quality import assess_image_quality
from app.omr.marker_detector import detect_corner_markers, MarkerDetectionError
from app.omr.perspective import warp_to_canonical_a4, PerspectiveTransformError
from app.omr.qr_reader import decode_qr_metadata, QRNotFoundError, QRInvalidError
from app.omr.layout_mapper import (
    get_page_layout,
    map_student_number_bubbles,
    map_exam_code_bubbles,
    map_answer_bubbles,
    PageLayoutNotFoundError,
)
from app.omr.bubble_reader import read_answer_question, read_digit_column

class OMRError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code

def annotate_debug_image(
    canonical_bgr: np.ndarray,
    sn_cols: list[dict],
    ec_cols: list[dict],
    answers: list[dict],
    page_number: int,
    template_id: str
):
    """
    Renders visual bounding annotations onto a copy of the canonical image for debugging and inspection.
    """
    vis = canonical_bgr.copy()

    # Annotate SBD
    for col in sn_cols:
        for b in col["bubbles"]:
            cx, cy, r = b["centerX_px"], b["centerY_px"], b["radius_px"]
            cv2.circle(vis, (cx, cy), r, (200, 200, 200), 1)

    # Annotate Exam Code
    for col in ec_cols:
        for b in col["bubbles"]:
            cx, cy, r = b["centerX_px"], b["centerY_px"], b["radius_px"]
            cv2.circle(vis, (cx, cy), r, (200, 200, 200), 1)

    # Annotate Answers
    for ans in answers:
        status = ans["status"]
        selected = ans["answer"]

        # Choose color
        if status == "MARKED":
            color = (0, 200, 0) # Green
        elif status == "MULTIPLE":
            color = (0, 0, 255) # Red
        elif status == "UNCERTAIN":
            color = (0, 165, 255) # Orange
        else:
            color = (180, 180, 180) # Gray for blank

        fill_ratios = ans["fillRatios"]
        # Draw status text near question
        # (Just visual confirmation)

    out_path = DEBUG_DIR / f"debug_{template_id}_p{page_number}.png"
    cv2.imwrite(str(out_path), vis)

def process_omr_sheet(image_bytes: bytes, layout_json: dict) -> dict:
    """
    End-to-end OMR processing pipeline.
    """
    if not image_bytes:
        raise OMRError("IMAGE_REQUIRED", "No image bytes provided.", 400)

    # 1. Decode Image
    np_arr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if image is None:
        raise OMRError("IMAGE_DECODE_FAILED", "Could not decode uploaded image bytes.", 422)

    # 2. Assess Quality
    quality = assess_image_quality(image)

    # 3. Detect 4 Corner Alignment Markers
    try:
        marker_pts = detect_corner_markers(image)
    except MarkerDetectionError as e:
        raise OMRError("MARKERS_NOT_FOUND", str(e), 422)

    # 4. Perspective Transform to Canonical A4
    try:
        canonical_bgr, _ = warp_to_canonical_a4(image, marker_pts)
    except PerspectiveTransformError as e:
        raise OMRError("PERSPECTIVE_TRANSFORM_FAILED", str(e), 422)

    # 5. Decode QR Code for Metadata
    qr_override = None
    if layout_json and "pages" in layout_json and len(layout_json["pages"]) > 0:
        first_page = layout_json["pages"][0]
        if "qr" in first_page:
            qr_override = first_page["qr"]

    tpl_version = layout_json.get("templateVersion", "OMR_V1") if layout_json else "OMR_V1"

    try:
        qr_metadata = decode_qr_metadata(canonical_bgr, template_version=tpl_version, qr_roi_override=qr_override)
    except (QRNotFoundError, QRInvalidError) as e:
        raise OMRError("QR_NOT_FOUND" if isinstance(e, QRNotFoundError) else "QR_INVALID", str(e), 422)

    page_number = qr_metadata["page"]

    # 6. Extract matching Page Geometry from layoutJson
    try:
        page_layout = get_page_layout(layout_json, page_number)
    except PageLayoutNotFoundError as e:
        raise OMRError("PAGE_LAYOUT_NOT_FOUND", str(e), 422)

    # 7. Convert Canonical BGR to Grayscale for measurement
    canonical_gray = cv2.cvtColor(canonical_bgr, cv2.COLOR_BGR2GRAY)

    # 8. Read SBD (Student Number)
    sn_layout = page_layout.get("studentNumber", {})
    sn_mapped = map_student_number_bubbles(sn_layout)

    sn_digits = []
    sn_candidate_digits = []
    sn_confidences = []
    sn_has_error = False

    for col in sn_mapped:
        col_res = read_digit_column(canonical_gray, col)
        sn_confidences.append(col_res["confidence"])
        if col_res["status"] != "OK" or col_res["digit"] is None:
            sn_has_error = True
            sn_digits.append("?")
            sn_candidate_digits.append(col_res.get("candidateDigit") or "?")
        else:
            sn_digits.append(col_res["digit"])
            sn_candidate_digits.append(col_res["digit"])

    student_number_value = "".join(sn_digits) if not sn_has_error else None
    student_number_candidate = "".join(sn_candidate_digits)
    student_number_status = "OK" if not sn_has_error else "UNCERTAIN"
    student_number_conf = round(float(np.mean(sn_confidences)), 2) if sn_confidences else 0.0

    # 9. Read Exam Code (Mã đề)
    ec_layout = page_layout.get("examCode", {})
    ec_mapped = map_exam_code_bubbles(ec_layout)

    ec_digits = []
    ec_candidate_digits = []
    ec_confidences = []
    ec_has_error = False

    for col in ec_mapped:
        col_res = read_digit_column(canonical_gray, col)
        ec_confidences.append(col_res["confidence"])
        if col_res["status"] != "OK" or col_res["digit"] is None:
            ec_has_error = True
            ec_digits.append("?")
            ec_candidate_digits.append(col_res.get("candidateDigit") or "?")
        else:
            ec_digits.append(col_res["digit"])
            ec_candidate_digits.append(col_res["digit"])

    exam_code_value = "".join(ec_digits) if not ec_has_error else None
    exam_code_candidate = "".join(ec_candidate_digits)
    exam_code_status = "OK" if not ec_has_error else "UNCERTAIN"
    exam_code_conf = round(float(np.mean(ec_confidences)), 2) if ec_confidences else 0.0

    # 10. Read Answers
    answers_layout = page_layout.get("answers", [])
    answers_mapped = map_answer_bubbles(answers_layout)

    answers_results = []
    needs_review_questions = []

    for q in answers_mapped:
        ans_res = read_answer_question(canonical_gray, q)
        answers_results.append(ans_res)

        if ans_res["status"] in ("MULTIPLE", "UNCERTAIN"):
            needs_review_questions.append(ans_res["questionNumber"])

    # 11. Determine Overall Page Status
    if needs_review_questions or student_number_status != "OK" or exam_code_status != "OK":
        overall_status = "NEEDS_REVIEW"
    else:
        overall_status = "OK"

    # 12. Optional Debug Annotation Output
    if OMR_DEBUG:
        annotate_debug_image(
            canonical_bgr,
            sn_mapped,
            ec_mapped,
            answers_results,
            page_number,
            qr_metadata["templateId"]
        )

    return {
        "status": overall_status,
        "template": {
            "version": qr_metadata["templateVersion"],
            "templateId": qr_metadata["templateId"],
            "examId": qr_metadata["examId"],
            "page": qr_metadata["page"],
            "pages": qr_metadata["pages"],
        },
        "quality": quality,
        "studentNumber": {
            "value": student_number_value,
            "candidateValue": student_number_candidate,
            "status": student_number_status,
            "confidence": student_number_conf,
        },
        "examCode": {
            "value": exam_code_value,
            "candidateValue": exam_code_candidate,
            "status": exam_code_status,
            "confidence": exam_code_conf,
        },
        "answers": answers_results,
        "needsReviewQuestions": needs_review_questions,
    }