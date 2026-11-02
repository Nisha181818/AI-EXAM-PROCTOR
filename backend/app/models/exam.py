from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, JSON
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class QuestionType(str, enum.Enum):
    coding = "coding"
    written = "written"


class Exam(Base):
    __tablename__ = "exams"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    title = Column(String(500), nullable=False)
    duration_minutes = Column(Integer, nullable=False, default=60)
    start_time = Column(DateTime(timezone=True), nullable=True)
    end_time = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    course = relationship("Course", back_populates="exams")
    questions = relationship("Question", back_populates="exam")
    attempts = relationship("ExamAttempt", back_populates="exam")


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    type = Column(SAEnum(QuestionType), nullable=False)
    base_text = Column(Text, nullable=False)
    rubric = Column(Text, nullable=True)
    base_test_cases = Column(JSON, nullable=True)
    reference_solution = Column(Text, nullable=True)
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    exam = relationship("Exam", back_populates="questions")
    variants = relationship("QuestionVariant", back_populates="question")
    submissions = relationship("Submission", back_populates="question")


class QuestionVariant(Base):
    __tablename__ = "question_variants"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    variant_text = Column(Text, nullable=False)
    variant_test_cases = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    question = relationship("Question", back_populates="variants")
    student = relationship("User", back_populates="question_variants")
