from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime
from app.models.attempt import AttemptStatus, EventSeverity, UnderstandingConfidence


class AttemptOut(BaseModel):
    id: int
    exam_id: int
    student_id: int
    status: AttemptStatus
    integrity_strike_count: int
    integrity_score: Optional[float] = None
    score: Optional[float] = None
    viva_score: Optional[float] = None
    total_score: Optional[float] = None
    started_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    identity_verified: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ExamEventCreate(BaseModel):
    attempt_id: int
    event_type: str
    severity: EventSeverity
    description: Optional[str] = None
    evidence_base64: Optional[str] = None


class ExamEventOut(BaseModel):
    id: int
    attempt_id: int
    event_type: str
    severity: EventSeverity
    description: Optional[str] = None
    evidence_url: Optional[str] = None
    timestamp: Optional[datetime] = None

    class Config:
        from_attributes = True


class SubmissionCreate(BaseModel):
    attempt_id: int
    question_id: int
    answer_text: str


class SubmissionOut(BaseModel):
    id: int
    attempt_id: int
    question_id: int
    answer_text: Optional[str] = None
    test_results: Optional[List[dict]] = None
    score: Optional[float] = None
    max_score: float
    ai_feedback: Optional[str] = None
    graded_at: Optional[datetime] = None
    manually_overridden: str
    override_score: Optional[float] = None
    override_feedback: Optional[str] = None

    class Config:
        from_attributes = True


class VivaQuestionOut(BaseModel):
    id: int
    attempt_id: int
    submission_id: int
    question_text: str
    student_answer: Optional[str] = None
    understanding_confidence: Optional[UnderstandingConfidence] = None
    ai_reasoning: Optional[str] = None
    score: Optional[float] = None
    answered_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class VivaAnswerCreate(BaseModel):
    answer_text: str


class GradeOverride(BaseModel):
    score: Optional[float] = None
    feedback: Optional[str] = None
