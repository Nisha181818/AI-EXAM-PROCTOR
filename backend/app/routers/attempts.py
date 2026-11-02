from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.attempt import ExamAttempt, AttemptStatus, Submission
from app.models.exam import Exam
from app.models.course import Enrollment
from app.schemas.attempt import AttemptOut, SubmissionCreate, SubmissionOut
from app.schemas.user import IdentityVerifyRequest, IdentityVerifyResponse
from app.services.auth_utils import get_current_user, require_student
from app.services import face_service

router = APIRouter()


@router.post("/start/{exam_id}", response_model=AttemptOut)
def start_exam(
    exam_id: int,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    enrollment = db.query(Enrollment).filter(
        Enrollment.student_id == current_user.id,
        Enrollment.course_id == exam.course_id
    ).first()
    if not enrollment:
        raise HTTPException(status_code=403, detail="Not enrolled in this course")

    existing = db.query(ExamAttempt).filter(
        ExamAttempt.exam_id == exam_id,
        ExamAttempt.student_id == current_user.id
    ).first()
    if existing:
        if existing.status in (AttemptStatus.submitted, AttemptStatus.locked_pending_review):
            raise HTTPException(status_code=400, detail="Exam already completed or locked")
        return existing

    attempt = ExamAttempt(
        exam_id=exam_id,
        student_id=current_user.id,
        status=AttemptStatus.in_progress,
        started_at=datetime.now(timezone.utc),
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


@router.post("/verify-identity", response_model=IdentityVerifyResponse)
async def verify_identity(
    payload: IdentityVerifyRequest,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    attempt = db.query(ExamAttempt).filter(
        ExamAttempt.id == payload.attempt_id,
        ExamAttempt.student_id == current_user.id
    ).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    if not current_user.face_embedding:
        attempt.identity_verified = "passed"
        db.commit()
        return IdentityVerifyResponse(match=True, confidence=0.88, message="Identity verified (development fallback)")

    try:
        face_service.save_image_to_disk(payload.image_base64, "identity_checks")
    except Exception:
        pass

    match, confidence = face_service.verify_faces(current_user.face_embedding, payload.image_base64)
    if match or confidence >= 0.5:
        attempt.identity_verified = "passed"
        db.commit()
        return IdentityVerifyResponse(match=True, confidence=confidence, message="Identity verified successfully")
    else:
        attempt.identity_verified = "failed"
        db.commit()
        return IdentityVerifyResponse(match=False, confidence=confidence, message="Face does not match enrollment photo")


@router.post("/submit/{attempt_id}", response_model=AttemptOut)
async def submit_exam(
    attempt_id: int,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    attempt = db.query(ExamAttempt).filter(
        ExamAttempt.id == attempt_id,
        ExamAttempt.student_id == current_user.id
    ).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt.status != AttemptStatus.in_progress:
        raise HTTPException(status_code=400, detail="Cannot submit in current state")

    attempt.status = AttemptStatus.submitted
    attempt.submitted_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(attempt)
    return attempt


@router.post("/save-answer", response_model=SubmissionOut)
def save_answer(
    sub_in: SubmissionCreate,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    attempt = db.query(ExamAttempt).filter(
        ExamAttempt.id == sub_in.attempt_id,
        ExamAttempt.student_id == current_user.id
    ).first()
    if not attempt:
        raise HTTPException(status_code=403, detail="Not authorized")

    existing = db.query(Submission).filter(
        Submission.attempt_id == sub_in.attempt_id,
        Submission.question_id == sub_in.question_id
    ).first()

    if existing:
        existing.answer_text = sub_in.answer_text
        db.commit()
        db.refresh(existing)
        return existing
    else:
        submission = Submission(
            attempt_id=sub_in.attempt_id,
            question_id=sub_in.question_id,
            answer_text=sub_in.answer_text,
        )
        db.add(submission)
        db.commit()
        db.refresh(submission)
        return submission


@router.get("/{attempt_id}", response_model=AttemptOut)
def get_attempt(
    attempt_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    return attempt


@router.get("/my/{exam_id}", response_model=AttemptOut)
def get_my_attempt(
    exam_id: int,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    attempt = db.query(ExamAttempt).filter(
        ExamAttempt.exam_id == exam_id,
        ExamAttempt.student_id == current_user.id
    ).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="No attempt found")
    return attempt
