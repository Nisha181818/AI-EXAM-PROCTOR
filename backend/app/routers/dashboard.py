from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.database import get_db
from app.models.user import User
from app.models.attempt import ExamAttempt, ExamEvent, Submission, VivaQuestion, AttemptStatus
from app.models.exam import Exam, Question
from app.models.course import Course
from app.services.auth_utils import require_teacher

router = APIRouter()


@router.get("/exams/{exam_id}/overview")
def exam_overview(
    exam_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    attempts = db.query(ExamAttempt).filter(ExamAttempt.exam_id == exam_id).all()
    result = []
    for attempt in attempts:
        student = db.query(User).filter(User.id == attempt.student_id).first()
        submissions = db.query(Submission).filter(Submission.attempt_id == attempt.id).all()
        scores = [
            (s.override_score if s.manually_overridden == "true" and s.override_score is not None else s.score)
            for s in submissions if s.score is not None
        ]
        avg_score = round(sum(scores) / len(scores), 1) if scores else None
        result.append({
            "attempt_id": attempt.id,
            "student_id": attempt.student_id,
            "student_name": student.name if student else "Unknown",
            "student_email": student.email if student else "",
            "status": attempt.status.value,
            "integrity_strike_count": attempt.integrity_strike_count,
            "integrity_score": attempt.integrity_score,
            "average_score": avg_score,
            "started_at": attempt.started_at.isoformat() if attempt.started_at else None,
            "submitted_at": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
            "identity_verified": attempt.identity_verified,
        })
    return result


@router.get("/students/{attempt_id}/detail")
def student_detail(
    attempt_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    student = db.query(User).filter(User.id == attempt.student_id).first()
    events = db.query(ExamEvent).filter(ExamEvent.attempt_id == attempt_id).order_by(ExamEvent.timestamp).all()
    submissions = db.query(Submission).filter(Submission.attempt_id == attempt_id).all()
    viva_qs = db.query(VivaQuestion).filter(VivaQuestion.attempt_id == attempt_id).all()

    return {
        "attempt": {
            "id": attempt.id,
            "status": attempt.status.value,
            "integrity_strike_count": attempt.integrity_strike_count,
            "identity_verified": attempt.identity_verified,
            "started_at": attempt.started_at.isoformat() if attempt.started_at else None,
            "submitted_at": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
        },
        "student": {
            "id": student.id,
            "name": student.name,
            "email": student.email,
            "enrollment_photo_url": student.enrollment_photo_url,
        } if student else None,
        "events": [
            {
                "id": e.id,
                "event_type": e.event_type,
                "severity": e.severity.value,
                "description": e.description,
                "evidence_url": e.evidence_url,
                "timestamp": e.timestamp.isoformat() if e.timestamp else None,
            } for e in events
        ],
        "submissions": [
            {
                "id": s.id,
                "question_id": s.question_id,
                "answer_text": s.answer_text,
                "score": s.override_score if s.manually_overridden == "true" else s.score,
                "max_score": s.max_score,
                "ai_feedback": s.override_feedback if s.manually_overridden == "true" else s.ai_feedback,
                "test_results": s.test_results,
                "manually_overridden": s.manually_overridden,
            } for s in submissions
        ],
        "viva_questions": [
            {
                "id": vq.id,
                "question_text": vq.question_text,
                "student_answer": vq.student_answer,
                "understanding_confidence": vq.understanding_confidence.value if vq.understanding_confidence else None,
                "ai_reasoning": vq.ai_reasoning,
            } for vq in viva_qs
        ],
    }


@router.get("/exams/{exam_id}/analytics")
def exam_analytics(
    exam_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    questions = db.query(Question).filter(Question.exam_id == exam_id).all()
    question_stats = []
    for q in questions:
        submissions = db.query(Submission).filter(Submission.question_id == q.id).all()
        scores = [
            (s.override_score if s.manually_overridden == "true" and s.override_score is not None else s.score)
            for s in submissions if s.score is not None
        ]
        avg = round(sum(scores) / len(scores), 1) if scores else 0
        pass_rate = round(sum(1 for sc in scores if sc >= 50) / len(scores) * 100, 1) if scores else 0
        question_stats.append({
            "question_id": q.id,
            "question_type": q.type.value,
            "question_preview": q.base_text[:80] + ("..." if len(q.base_text) > 80 else ""),
            "submission_count": len(submissions),
            "average_score": avg,
            "pass_rate": pass_rate,
        })

    attempts = db.query(ExamAttempt).filter(ExamAttempt.exam_id == exam_id).all()
    status_counts = {}
    for a in attempts:
        status_counts[a.status.value] = status_counts.get(a.status.value, 0) + 1

    return {
        "exam_id": exam_id,
        "exam_title": exam.title,
        "total_students": len(attempts),
        "status_distribution": status_counts,
        "question_stats": question_stats,
    }


@router.patch("/attempts/{attempt_id}/unlock")
def unlock_attempt(
    attempt_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    attempt.status = AttemptStatus.in_progress
    db.commit()
    return {"message": "Attempt unlocked", "attempt_id": attempt_id}
