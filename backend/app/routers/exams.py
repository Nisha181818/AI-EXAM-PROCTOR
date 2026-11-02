from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.course import Course, Enrollment
from app.models.exam import Exam
from app.schemas.exam import ExamCreate, ExamOut
from app.services.auth_utils import get_current_user, require_teacher

router = APIRouter()


@router.post("/", response_model=ExamOut, status_code=status.HTTP_201_CREATED)
def create_exam(
    exam_in: ExamCreate,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    course = db.query(Course).filter(
        Course.id == exam_in.course_id,
        Course.teacher_id == current_user.id
    ).first()
    if not course:
        raise HTTPException(status_code=403, detail="Not authorized for this course")
    exam = Exam(**exam_in.model_dump())
    db.add(exam)
    db.commit()
    db.refresh(exam)
    return exam


@router.get("/", response_model=List[ExamOut])
def list_exams(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role.value == "teacher":
        teacher_course_ids = [c.id for c in db.query(Course).filter(Course.teacher_id == current_user.id).all()]
        return db.query(Exam).filter(Exam.course_id.in_(teacher_course_ids)).all()
    else:
        enrolled_course_ids = [
            e.course_id for e in db.query(Enrollment).filter(Enrollment.student_id == current_user.id).all()
        ]
        return db.query(Exam).filter(Exam.course_id.in_(enrolled_course_ids)).all()


@router.get("/{exam_id}", response_model=ExamOut)
def get_exam(
    exam_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return exam


@router.delete("/{exam_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exam(
    exam_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    db.delete(exam)
    db.commit()
