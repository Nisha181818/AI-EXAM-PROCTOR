from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime
from app.models.exam import QuestionType


class ExamCreate(BaseModel):
    course_id: int
    title: str
    duration_minutes: int = 60
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class ExamOut(BaseModel):
    id: int
    course_id: int
    title: str
    duration_minutes: int
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class QuestionCreate(BaseModel):
    exam_id: int
    type: QuestionType
    base_text: str
    rubric: Optional[str] = None
    base_test_cases: Optional[List[dict]] = None
    reference_solution: Optional[str] = None
    order_index: int = 0


class QuestionOut(BaseModel):
    id: int
    exam_id: int
    type: QuestionType
    base_text: str
    rubric: Optional[str] = None
    base_test_cases: Optional[List[dict]] = None
    order_index: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class QuestionVariantOut(BaseModel):
    id: int
    question_id: int
    student_id: int
    variant_text: str
    variant_test_cases: Optional[List[dict]] = None

    class Config:
        from_attributes = True
