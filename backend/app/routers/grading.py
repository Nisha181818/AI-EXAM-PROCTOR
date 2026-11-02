from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.attempt import ExamAttempt, Submission, AttemptStatus
from app.models.exam import Question, QuestionType, Exam
from app.models.course import Enrollment
from app.schemas.attempt import SubmissionOut, GradeOverride
from app.services.auth_utils import get_current_user, require_teacher
from app.services import grading_service

router = APIRouter()


@router.post("/grade/{attempt_id}")
async def trigger_grading(
    attempt_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt.status not in (AttemptStatus.submitted, AttemptStatus.locked_pending_review):
        raise HTTPException(status_code=400, detail="Attempt must be submitted before grading")

    results = await grading_service.grade_all_submissions(attempt_id, db)
    return {"message": f"Graded {len(results)} submissions", "attempt_id": attempt_id}


@router.get("/results/{attempt_id}", response_model=List[SubmissionOut])
def get_results(
    attempt_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    submissions = db.query(Submission).filter(Submission.attempt_id == attempt_id).all()
    return submissions


@router.patch("/submissions/{submission_id}", response_model=SubmissionOut)
def override_grade(
    submission_id: int,
    override: GradeOverride,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    if override.score is not None:
        submission.override_score = override.score
    if override.feedback is not None:
        submission.override_feedback = override.feedback
    submission.manually_overridden = "true"
    db.commit()
    db.refresh(submission)
    return submission


@router.post("/generate-variants/{exam_id}")
async def generate_variants(
    exam_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    enrollments = db.query(Enrollment).filter(Enrollment.course_id == exam.course_id).all()
    questions = db.query(Question).filter(
        Question.exam_id == exam_id,
        Question.type == QuestionType.coding
    ).all()

    generated = 0
    for enrollment in enrollments:
        student = db.query(User).filter(User.id == enrollment.student_id).first()
        if not student:
            continue
        for question in questions:
            await grading_service.generate_and_validate_variant(question, student.id, student.name, db)
            generated += 1

    return {"message": f"Generated {generated} variants", "exam_id": exam_id}
