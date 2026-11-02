from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.exam import Exam, Question, QuestionVariant
from app.schemas.exam import QuestionCreate, QuestionOut, QuestionVariantOut
from app.services.auth_utils import get_current_user, require_teacher

router = APIRouter()


@router.post("/", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
def create_question(
    question_in: QuestionCreate,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    exam = db.query(Exam).filter(Exam.id == question_in.exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    question = Question(**question_in.model_dump())
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


@router.get("/exam/{exam_id}", response_model=List[QuestionOut])
def list_questions(
    exam_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(Question).filter(Question.exam_id == exam_id).order_by(Question.order_index).all()


@router.put("/{question_id}", response_model=QuestionOut)
def update_question(
    question_id: int,
    question_in: QuestionCreate,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    for key, val in question_in.model_dump(exclude_unset=True).items():
        setattr(question, key, val)
    db.commit()
    db.refresh(question)
    return question


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(
    question_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    db.delete(question)
    db.commit()


@router.get("/variants/{exam_id}", response_model=List[QuestionVariantOut])
def get_my_variants(
    exam_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    questions = db.query(Question).filter(Question.exam_id == exam_id).all()
    question_ids = [q.id for q in questions]
    variants = db.query(QuestionVariant).filter(
        QuestionVariant.question_id.in_(question_ids),
        QuestionVariant.student_id == current_user.id,
    ).all()
    return variants
