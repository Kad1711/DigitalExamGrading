from typing import Optional, List, Dict
from pydantic import BaseModel

class TemplateMetadata(BaseModel):
    version: str
    templateId: str
    examId: str
    page: int
    pages: int

class QualityReport(BaseModel):
    width: int
    height: int
    blurScore: float
    brightness: float
    warnings: List[str] = []

class StudentNumberResult(BaseModel):
    value: Optional[str] = None
    candidateValue: Optional[str] = None
    status: str
    confidence: float

class ExamCodeResult(BaseModel):
    value: Optional[str] = None
    candidateValue: Optional[str] = None
    status: str
    confidence: float

class AnswerResult(BaseModel):
    questionNumber: int
    answer: Optional[str] = None
    candidate: Optional[str] = None
    status: str
    confidence: float
    fillRatios: Dict[str, float]
    reviewCropDataUrl: Optional[str] = None

class OMRAnalysisData(BaseModel):
    status: str  # "OK" | "NEEDS_REVIEW" | "FAILED"
    template: TemplateMetadata
    quality: QualityReport
    studentNumber: StudentNumberResult
    examCode: ExamCodeResult
    answers: List[AnswerResult]
    needsReviewQuestions: List[int] = []

class OMRResponse(BaseModel):
    success: bool
    data: Optional[OMRAnalysisData] = None
    error: Optional[dict] = None