import json
import cv2
import numpy as np
from app.config import PX_PER_MM, QR_ROI_BY_TEMPLATE_VERSION

class QRNotFoundError(Exception):
    """Raised when QR code cannot be detected on the sheet."""
    pass

class QRInvalidError(Exception):
    """Raised when QR code payload is invalid JSON or missing metadata fields."""
    pass

def decode_qr_metadata(
    canonical_image: np.ndarray,
    template_version: str = "OMR_V1",
    qr_roi_override: dict | None = None
) -> dict:
    """
    Decodes the QR code from the canonical page.
    Uses template-based ROI or layout geometry override first for speed and accuracy,
    then falls back to full page if needed.
    """
    detector = cv2.QRCodeDetector()

    # Determine QR bounding box in mm
    if qr_roi_override and "xMm" in qr_roi_override and "yMm" in qr_roi_override and "sizeMm" in qr_roi_override:
        roi_cfg = {
            "xMm": float(qr_roi_override["xMm"]),
            "yMm": float(qr_roi_override["yMm"]),
            "sizeMm": float(qr_roi_override["sizeMm"]),
            "paddingMm": 10.0,
        }
    else:
        roi_cfg = QR_ROI_BY_TEMPLATE_VERSION.get(template_version, QR_ROI_BY_TEMPLATE_VERSION["OMR_V1"])

    x_mm = roi_cfg["xMm"]
    y_mm = roi_cfg["yMm"]
    size_mm = roi_cfg["sizeMm"]
    pad_mm = roi_cfg.get("paddingMm", 10.0)

    x1 = max(0, int((x_mm - pad_mm) * PX_PER_MM))
    x2 = min(canonical_image.shape[1], int((x_mm + size_mm + pad_mm) * PX_PER_MM))
    y1 = max(0, int((y_mm - pad_mm) * PX_PER_MM))
    y2 = min(canonical_image.shape[0], int((y_mm + size_mm + pad_mm) * PX_PER_MM))

    roi = canonical_image[y1:y2, x1:x2]

    decoded_text = ""
    # Pass 1: Direct ROI
    decoded_text, _, _ = detector.detectAndDecode(roi)

    # Pass 2: Downsampled ROI (OpenCV QRCodeDetector excels on ~250px QR rather than 500+px)
    if not decoded_text:
        roi_half = cv2.resize(roi, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
        decoded_text, _, _ = detector.detectAndDecode(roi_half)

    # Pass 3: Binarized ROI
    if not decoded_text:
        gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY) if len(roi.shape) == 3 else roi
        for thresh_val in (128, 160):
            _, binarized = cv2.threshold(gray_roi, thresh_val, 255, cv2.THRESH_BINARY)
            decoded_text, _, _ = detector.detectAndDecode(binarized)
            if decoded_text:
                break

    # Pass 4: Fallback to full image
    if not decoded_text:
        decoded_text, _, _ = detector.detectAndDecode(canonical_image)

    # Pass 5: Downsampled full image
    if not decoded_text:
        full_half = cv2.resize(canonical_image, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
        decoded_text, _, _ = detector.detectAndDecode(full_half)

    if not decoded_text:
        raise QRNotFoundError("QR_NOT_FOUND: Could not detect or decode QR code on answer sheet.")

    try:
        payload = json.loads(decoded_text)
    except Exception as e:
        raise QRInvalidError(f"QR_INVALID: QR content is not valid JSON: {decoded_text}")

    # Validate required fields as per Phase 3 contract:
    # { "v": 1, "templateVersion": "OMR_V1", "templateId": "...", "examId": "...", "page": 1, "pages": 1 }
    required_fields = ["v", "templateVersion", "templateId", "examId", "page", "pages"]
    missing = [f for f in required_fields if f not in payload]
    if missing:
        raise QRInvalidError(f"QR_INVALID: Missing required metadata fields: {', '.join(missing)}")

    return {
        "v": int(payload["v"]),
        "templateVersion": str(payload["templateVersion"]),
        "templateId": str(payload["templateId"]),
        "examId": str(payload["examId"]),
        "page": int(payload["page"]),
        "pages": int(payload["pages"]),
    }