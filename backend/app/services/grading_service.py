from typing import List, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.models.attempt import Submission, ExamAttempt
from app.models.exam import Question, QuestionType, QuestionVariant
from app.services import judge0_service, llm_service


async def grade_submission(submission: Submission, db: Session) -> Submission:
    question = db.query(Question).filter(Question.id == submission.question_id).first()
    if not question:
        return submission

    if question.type == QuestionType.coding:
        await _grade_coding(submission, question, db)
    else:
        await _grade_written(submission, question, db)

    submission.graded_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(submission)
    return submission


async def _grade_coding(submission: Submission, question: Question, db: Session):
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == submission.attempt_id).first()
    variant = None
    if attempt:
        variant = db.query(QuestionVariant).filter(
            QuestionVariant.question_id == question.id,
            QuestionVariant.student_id == attempt.student_id
        ).first()

    test_cases = (variant.variant_test_cases if variant and variant.variant_test_cases
                  else question.base_test_cases) or []

    if not test_cases:
        submission.score = 0.0
        submission.ai_feedback = "No test cases configured for this question."
        return

    code = submission.answer_text or ""
    results = await judge0_service.run_test_cases(code, test_cases)
    submission.test_results = results
    submission.score = judge0_service.compute_coding_score(results)
    passed = sum(1 for r in results if r["passed"])
    submission.ai_feedback = f"Passed {passed}/{len(results)} test cases."


async def _grade_written(submission: Submission, question: Question, db: Session):
    rubric = question.rubric or "Grade based on accuracy, clarity, and completeness."
    result = await llm_service.grade_written_answer(
        question.base_text,
        rubric,
        submission.answer_text or "",
    )
    submission.score = float(result.get("score", 0))
    submission.ai_feedback = result.get("feedback", "")


async def grade_all_submissions(attempt_id: int, db: Session) -> List[Submission]:
    submissions = db.query(Submission).filter(Submission.attempt_id == attempt_id).all()
    graded = []
    for sub in submissions:
        graded_sub = await grade_submission(sub, db)
        graded.append(graded_sub)
    return graded


async def generate_and_validate_variant(
    question: Question,
    student_id: int,
    student_name: str,
    db: Session,
    max_retries: int = 3,
) -> QuestionVariant:
    existing = db.query(QuestionVariant).filter(
        QuestionVariant.question_id == question.id,
        QuestionVariant.student_id == student_id,
    ).first()
    if existing:
        return existing

    for attempt in range(max_retries):
        try:
            variant_data = await llm_service.generate_question_variant(
                question.base_text,
                question.base_test_cases or [],
                student_name,
            )
            variant_test_cases = variant_data.get("variant_test_cases", [])

            if question.reference_solution and variant_test_cases:
                results = await judge0_service.run_test_cases(
                    question.reference_solution,
                    variant_test_cases,
                )
                if not all(r["passed"] for r in results):
                    continue

            variant = QuestionVariant(
                question_id=question.id,
                student_id=student_id,
                variant_text=variant_data.get("variant_text", question.base_text),
                variant_test_cases=variant_test_cases or question.base_test_cases,
            )
            db.add(variant)
            db.commit()
            db.refresh(variant)
            return variant

        except Exception as e:
            print(f"Variant generation attempt {attempt+1} error: {e}")

    variant = QuestionVariant(
        question_id=question.id,
        student_id=student_id,
        variant_text=question.base_text,
        variant_test_cases=question.base_test_cases,
    )
    db.add(variant)
    db.commit()
    db.refresh(variant)
    return variant
