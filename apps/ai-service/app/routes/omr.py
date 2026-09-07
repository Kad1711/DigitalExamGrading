import json
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.schemas.omr import OMRResponse
from app.services.omr_service import process_omr_sheet, OMRError

router = APIRouter()

@router.get("/health")
async def health():
    return {
        "success": True,
        "service": "Digital Exam Grading AI Service"
    }

@router.post("/omr/analyze", response_model=OMRResponse)
async def analyze_omr(
    image: UploadFile = File(...),
    layoutJson: str = Form(...)
):
    # Validate image file extension
    filename = (image.filename or "").lower()
    if not (filename.endswith(".png") or filename.endswith(".jpg") or filename.endswith(".jpeg")):
        raise HTTPException(
            status_code=400,
            detail={"code": "IMAGE_TYPE_INVALID", "message": "Only .jpg, .jpeg, and .png are supported."}
        )

    # Parse layoutJson
    try:
        layout_dict = json.loads(layoutJson)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail={"code": "LAYOUT_INVALID", "message": f"Invalid layoutJson format: {str(e)}"}
        )

    image_bytes = await image.read()
    if len(image_bytes) > 15 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail={"code": "IMAGE_TOO_LARGE", "message": "Image exceeds 15MB limit."}
        )

    try:
        result = process_omr_sheet(image_bytes, layout_dict)
        return OMRResponse(success=True, data=result)
    except OMRError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail={"code": e.code, "message": e.message}
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": "OMR_ANALYSIS_FAILED", "message": f"Internal processing error: {str(e)}"}
        )