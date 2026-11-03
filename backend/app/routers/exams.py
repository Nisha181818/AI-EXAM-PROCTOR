from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User, UserRole
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

    # Auto-enroll all registered students into this course so exams are immediately accessible
    try:
        students = db.query(User).filter(User.role == UserRole.student).all()
        for s in students:
            existing = db.query(Enrollment).filter(
                Enrollment.student_id == s.id,
                Enrollment.course_id == course.id
            ).first()
            if not existing:
                db.add(Enrollment(student_id=s.id, course_id=course.id))
        db.commit()
    except Exception as e:
        print(f"Auto-enrollment notice on create_exam: {e}")

    return exam


@router.get("/", response_model=List[ExamOut])
def list_exams(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role.value == "teacher":
        teacher_course_ids = [c.id for c in db.query(Course).filter(Course.teacher_id == current_user.id).all()]
        return db.query(Exam).filter(Exam.course_id.in_(teacher_course_ids)).order_by(Exam.created_at.desc()).all()
    else:
        # Every registered student automatically sees all active exams
        all_exams = db.query(Exam).order_by(Exam.created_at.desc()).all()

        # Ensure student is auto-enrolled in all courses with exams
        try:
            for exam in all_exams:
                existing = db.query(Enrollment).filter(
                    Enrollment.student_id == current_user.id,
                    Enrollment.course_id == exam.course_id
                ).first()
                if not existing:
                    db.add(Enrollment(student_id=current_user.id, course_id=exam.course_id))
            db.commit()
        except Exception:
            db.rollback()

        return all_exams


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
