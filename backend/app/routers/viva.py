from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.attempt import ExamAttempt, Submission, VivaQuestion, UnderstandingConfidence
from app.models.exam import Question, QuestionType
from app.schemas.attempt import VivaQuestionOut, VivaAnswerCreate
from app.services.auth_utils import get_current_user, require_student
from app.services import llm_service

router = APIRouter()


@router.post("/generate/{attempt_id}", response_model=List[VivaQuestionOut])
async def generate_viva(
    attempt_id: int,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    attempt = db.query(ExamAttempt).filter(
        ExamAttempt.id == attempt_id,
        ExamAttempt.student_id == current_user.id
    ).first()
    if not attempt:
        raise HTTPException(status_code=403, detail="Not authorized")

    existing = db.query(VivaQuestion).filter(VivaQuestion.attempt_id == attempt_id).all()
    if existing:
        return existing

    coding_submissions = [
        sub for sub in db.query(Submission).filter(Submission.attempt_id == attempt_id).all()
        if db.query(Question).filter(Question.id == sub.question_id, Question.type == QuestionType.coding).first()
    ]

    viva_questions = []
    for submission in coding_submissions:
        question = db.query(Question).filter(Question.id == submission.question_id).first()
        if not question:
            continue

        code_text = submission.answer_text or "No code provided."
        try:
            questions_text = await llm_service.generate_viva_questions(
                code_text,
                question.base_text,
                count=3,
            )
            for q_text in questions_text:
                vq = VivaQuestion(
                    attempt_id=attempt_id,
                    submission_id=submission.id,
                    question_text=q_text,
                )
                db.add(vq)
                viva_questions.append(vq)
        except Exception as e:
            print(f"Viva generation error: {e}")

    db.commit()
    for vq in viva_questions:
        db.refresh(vq)
    return viva_questions


@router.get("/{attempt_id}", response_model=List[VivaQuestionOut])
def get_viva_questions(
    attempt_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(VivaQuestion).filter(VivaQuestion.attempt_id == attempt_id).all()


@router.post("/answer/{viva_question_id}", response_model=VivaQuestionOut)
async def submit_viva_answer(
    viva_question_id: int,
    answer_in: VivaAnswerCreate,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    vq = db.query(VivaQuestion).filter(VivaQuestion.id == viva_question_id).first()
    if not vq:
        raise HTTPException(status_code=404, detail="Viva question not found")

    attempt = db.query(ExamAttempt).filter(
        ExamAttempt.id == vq.attempt_id,
        ExamAttempt.student_id == current_user.id
    ).first()
    if not attempt:
        raise HTTPException(status_code=403, detail="Not authorized")

    submission = db.query(Submission).filter(Submission.id == vq.submission_id).first()
    code = submission.answer_text if submission else ""

    evaluation = await llm_service.evaluate_viva_answer(
        vq.question_text,
        code,
        answer_in.answer_text,
    )

    conf_str = evaluation.get("confidence", "medium").lower()
    if conf_str not in ("low", "medium", "high"):
        conf_str = "medium"

    vq.student_answer = answer_in.answer_text
    vq.understanding_confidence = UnderstandingConfidence(conf_str)
    vq.ai_reasoning = evaluation.get("reasoning", "")
    vq.answered_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(vq)
    return vq
