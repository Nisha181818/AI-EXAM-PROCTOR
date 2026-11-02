from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CourseCreate(BaseModel):
    name: str


class CourseOut(BaseModel):
    id: int
    name: str
    teacher_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EnrollmentCreate(BaseModel):
    student_id: int
    course_id: int


class EnrollmentOut(BaseModel):
    id: int
    student_id: int
    course_id: int
    enrolled_at: Optional[datetime] = None

    class Config:
        from_attributes = True
