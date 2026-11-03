import os
from typing import Optional, List
from pathlib import Path

# Load .env file from root or backend directory if present
try:
    from dotenv import load_dotenv
    # Look for .env in current directory, parent directory, or backend directory
    for env_path in [Path(".env"), Path("../.env"), Path(__file__).resolve().parent.parent / ".env"]:
        if env_path.exists():
            load_dotenv(dotenv_path=env_path)
            break
except ImportError:
    pass

try:
    from pydantic_settings import BaseSettings

    class Settings(BaseSettings):
        database_url: str = os.getenv("DATABASE_URL", "sqlite:///./exam.db")
        jwt_secret: str = os.getenv("JWT_SECRET", "super-secret-jwt-key-for-ai-exam-proctor-2026-production-ready")
        jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
        jwt_expiry_minutes: int = int(os.getenv("JWT_EXPIRY_MINUTES", "120"))
        
        # LLM Providers (gemini, groq, openai, anthropic)
        llm_provider: str = os.getenv("LLM_PROVIDER", "gemini").lower()
        
        # Free provider: Google Gemini
        gemini_api_key: Optional[str] = os.getenv("GEMINI_API_KEY")
        gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
        
        # Free provider: Groq
        groq_api_key: Optional[str] = os.getenv("GROQ_API_KEY")
        groq_model: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        
        # Commercial providers
        openai_api_key: Optional[str] = os.getenv("OPENAI_API_KEY")
        openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o")
        anthropic_api_key: Optional[str] = os.getenv("ANTHROPIC_API_KEY")
        anthropic_model: str = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")
        
        # Judge0 RapidAPI
        judge0_url: str = os.getenv("JUDGE0_URL", "https://judge0-ce.p.rapidapi.com")
        judge0_api_key: Optional[str] = os.getenv("JUDGE0_API_KEY", os.getenv("JUDGE0_AUTH_TOKEN"))
        judge0_api_host: str = os.getenv("JUDGE0_API_HOST", "judge0-ce.p.rapidapi.com")
        
        # Face recognition (low-memory friendly by default)
        face_match_threshold: float = float(os.getenv("FACE_MATCH_THRESHOLD", "0.6"))
        deepface_model: str = os.getenv("DEEPFACE_MODEL", "ArcFace")
        face_engine: str = os.getenv("FACE_ENGINE", "opencv")  # 'opencv', 'lightweight', or 'deepface'
        use_deepface: bool = os.getenv("USE_DEEPFACE", "false").lower() in ("true", "1", "yes")
        upload_dir: str = os.getenv("UPLOAD_DIR", str(Path(__file__).resolve().parent.parent / "uploads"))
        
        # CORS
        cors_origins: str = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,http://localhost:80")

        @property
        def cors_origins_list(self) -> List[str]:
            return [o.strip() for o in self.cors_origins.split(",")]

        class Config:
            env_file = ".env"
            env_file_encoding = "utf-8"
            extra = "ignore"

    settings = Settings()

except ImportError:
    class FallbackSettings:
        def __init__(self):
            self.database_url = os.getenv("DATABASE_URL", "sqlite:///./exam.db")
            self.jwt_secret = os.getenv("JWT_SECRET", "super-secret-jwt-key-for-ai-exam-proctor-2026-production-ready")
            self.jwt_algorithm = os.getenv("JWT_ALGORITHM", "HS256")
            self.jwt_expiry_minutes = int(os.getenv("JWT_EXPIRY_MINUTES", "120"))
            
            self.llm_provider = os.getenv("LLM_PROVIDER", "gemini").lower()
            self.gemini_api_key = os.getenv("GEMINI_API_KEY")
            self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
            self.groq_api_key = os.getenv("GROQ_API_KEY")
            self.groq_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
            
            self.openai_api_key = os.getenv("OPENAI_API_KEY")
            self.openai_model = os.getenv("OPENAI_MODEL", "gpt-4o")
            self.anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
            self.anthropic_model = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")
            
            self.judge0_url = os.getenv("JUDGE0_URL", "https://judge0-ce.p.rapidapi.com")
            self.judge0_api_key = os.getenv("JUDGE0_API_KEY", os.getenv("JUDGE0_AUTH_TOKEN"))
            self.judge0_api_host = os.getenv("JUDGE0_API_HOST", "judge0-ce.p.rapidapi.com")
            
            self.face_match_threshold = float(os.getenv("FACE_MATCH_THRESHOLD", "0.6"))
            self.deepface_model = os.getenv("DEEPFACE_MODEL", "ArcFace")
            self.face_engine = os.getenv("FACE_ENGINE", "opencv")
            self.use_deepface = os.getenv("USE_DEEPFACE", "false").lower() in ("true", "1", "yes")
            self.upload_dir = os.getenv("UPLOAD_DIR", str(Path(__file__).resolve().parent.parent / "uploads"))
            self.cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,http://localhost:80")

        @property
        def cors_origins_list(self) -> List[str]:
            return [o.strip() for o in self.cors_origins.split(",")]

    settings = FallbackSettings()
