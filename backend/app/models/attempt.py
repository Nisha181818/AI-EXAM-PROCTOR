from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, JSON, Float
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class AttemptStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    locked_pending_review = "locked_pending_review"
    submitted = "submitted"


class EventSeverity(str, enum.Enum):
    soft = "soft"
    hard = "hard"


class UnderstandingConfidence(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class ExamAttempt(Base):
    __tablename__ = "exam_attempts"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(SAEnum(AttemptStatus), nullable=False, default=AttemptStatus.not_started)
    integrity_strike_count = Column(Integer, default=0)
    integrity_score = Column(Float, nullable=True)
    score = Column(Float, nullable=True)
    viva_score = Column(Float, nullable=True)
    total_score = Column(Float, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    identity_verified = Column(String(10), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    exam = relationship("Exam", back_populates="attempts")
    student = relationship("User", back_populates="exam_attempts")
    events = relationship("ExamEvent", back_populates="attempt")
    submissions = relationship("Submission", back_populates="attempt")
    viva_questions = relationship("VivaQuestion", back_populates="attempt")


class ExamEvent(Base):
    __tablename__ = "exam_events"

    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("exam_attempts.id"), nullable=False)
    event_type = Column(String(100), nullable=False)
    severity = Column(SAEnum(EventSeverity), nullable=False, default=EventSeverity.soft)
    description = Column(Text, nullable=True)
    evidence_url = Column(String(500), nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    attempt = relationship("ExamAttempt", back_populates="events")


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("exam_attempts.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    answer_text = Column(Text, nullable=True)
    test_results = Column(JSON, nullable=True)
    score = Column(Float, nullable=True)
    max_score = Column(Float, default=100.0)
    ai_feedback = Column(Text, nullable=True)
    graded_at = Column(DateTime(timezone=True), nullable=True)
    manually_overridden = Column(String(5), default="false")
    override_score = Column(Float, nullable=True)
    override_feedback = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    attempt = relationship("ExamAttempt", back_populates="submissions")
    question = relationship("Question", back_populates="submissions")
    viva_questions = relationship("VivaQuestion", back_populates="submission")


class VivaQuestion(Base):
    __tablename__ = "viva_questions"

    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("exam_attempts.id"), nullable=False)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    student_answer = Column(Text, nullable=True)
    understanding_confidence = Column(SAEnum(UnderstandingConfidence), nullable=True)
    ai_reasoning = Column(Text, nullable=True)
    score = Column(Float, nullable=True, default=0.0)
    answered_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    attempt = relationship("ExamAttempt", back_populates="viva_questions")
    submission = relationship("Submission", back_populates="viva_questions")
