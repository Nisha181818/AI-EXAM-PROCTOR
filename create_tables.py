"""
Standalone script: Creates all SQLAlchemy tables directly in Neon PostgreSQL.
"""
import os, sys, enum, io

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

os.environ["DATABASE_URL"] = "postgresql://neondb_owner:npg_D29AXZiJwuPs@ep-weathered-recipe-aoxadrlv-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Text, JSON,
    ForeignKey, DateTime, UniqueConstraint, text,
    Enum as SAEnum,
)
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func

NEON_URL = os.environ["DATABASE_URL"]

print("Connecting to Neon PostgreSQL ...")
engine = create_engine(NEON_URL, pool_pre_ping=True, pool_recycle=300)

with engine.connect() as conn:
    ver = conn.execute(text("SELECT version()")).scalar()
    print(f"  [OK] Connected - {ver[:60]}")

Base = declarative_base()

# -- Enums --
class UserRole(str, enum.Enum):
    student = "student"
    teacher = "teacher"

class QuestionType(str, enum.Enum):
    coding = "coding"
    written = "written"

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

# -- Models --
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole, name="userrole", create_constraint=True), nullable=False, default=UserRole.student)
    enrollment_photo_url = Column(String(500), nullable=True)
    face_embedding = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Course(Base):
    __tablename__ = "courses"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Enrollment(Base):
    __tablename__ = "enrollments"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    enrolled_at = Column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint("student_id", "course_id", name="uq_student_course"),)

class Exam(Base):
    __tablename__ = "exams"
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    title = Column(String(500), nullable=False)
    duration_minutes = Column(Integer, nullable=False, default=60)
    start_time = Column(DateTime(timezone=True), nullable=True)
    end_time = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    type = Column(SAEnum(QuestionType, name="questiontype", create_constraint=True), nullable=False)
    base_text = Column(Text, nullable=False)
    rubric = Column(Text, nullable=True)
    base_test_cases = Column(JSON, nullable=True)
    reference_solution = Column(Text, nullable=True)
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class QuestionVariant(Base):
    __tablename__ = "question_variants"
    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    variant_text = Column(Text, nullable=False)
    variant_test_cases = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ExamAttempt(Base):
    __tablename__ = "exam_attempts"
    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(SAEnum(AttemptStatus, name="attemptstatus", create_constraint=True), nullable=False, default=AttemptStatus.not_started)
    integrity_strike_count = Column(Integer, default=0)
    integrity_score = Column(Float, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    identity_verified = Column(String(10), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ExamEvent(Base):
    __tablename__ = "exam_events"
    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("exam_attempts.id"), nullable=False)
    event_type = Column(String(100), nullable=False)
    severity = Column(SAEnum(EventSeverity, name="eventseverity", create_constraint=True), nullable=False, default=EventSeverity.soft)
    description = Column(Text, nullable=True)
    evidence_url = Column(String(500), nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

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

class VivaQuestion(Base):
    __tablename__ = "viva_questions"
    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("exam_attempts.id"), nullable=False)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    student_answer = Column(Text, nullable=True)
    understanding_confidence = Column(SAEnum(UnderstandingConfidence, name="understandingconfidence", create_constraint=True), nullable=True)
    ai_reasoning = Column(Text, nullable=True)
    answered_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# -- Create Tables --
tables = list(Base.metadata.tables.keys())
print(f"\nTables to create ({len(tables)}):")
for t in tables:
    print(f"  -> {t}")

print("\nRunning CREATE TABLE IF NOT EXISTS ...")
Base.metadata.create_all(bind=engine, checkfirst=True)
print("  [OK] All tables created!\n")

# -- Verify --
print("Verifying tables in Neon DB:")
with engine.connect() as conn:
    result = conn.execute(text(
        "SELECT tablename FROM pg_catalog.pg_tables "
        "WHERE schemaname = 'public' ORDER BY tablename"
    ))
    found = [row[0] for row in result]
    for t in found:
        print(f"  [OK] {t}")
    print(f"\n{len(found)} table(s) confirmed in neondb.")
    print("Your deployed app should work now!")
