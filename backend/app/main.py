from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.config import settings
from app.routers import auth, courses, exams, questions, attempts, monitoring, grading, viva, dashboard

app = FastAPI(
    title="AI Exam Proctor API",
    description="AI-powered online exam platform with proctoring",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files (enrollment photos, evidence snapshots)
os.makedirs(settings.upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

# Routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(courses.router, prefix="/courses", tags=["courses"])
app.include_router(exams.router, prefix="/exams", tags=["exams"])
app.include_router(questions.router, prefix="/questions", tags=["questions"])
app.include_router(attempts.router, prefix="/attempts", tags=["attempts"])
app.include_router(monitoring.router, prefix="/monitoring", tags=["monitoring"])
app.include_router(grading.router, prefix="/grading", tags=["grading"])
app.include_router(viva.router, prefix="/viva", tags=["viva"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])


@app.on_event("startup")
def run_startup_migrations():
    from app.database import engine
    from sqlalchemy import text
    # Safely ensure new score columns exist in PostgreSQL Neon DB or SQLite
    statements = [
        "ALTER TABLE viva_questions ADD COLUMN IF NOT EXISTS score FLOAT;",
        "ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS score FLOAT;",
        "ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS viva_score FLOAT;",
        "ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS total_score FLOAT;",
    ]
    with engine.begin() as conn:
        for stmt in statements:
            try:
                conn.execute(text(stmt))
            except Exception as e:
                # May fail on SQLite without syntax support or if column already exists
                pass


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "AI Exam Proctor API"}
