from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from app.models.user import UserRole


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.student


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: UserRole
    enrollment_photo_url: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class EnrollmentPhotoResponse(BaseModel):
    message: str
    enrollment_photo_url: str
    face_embedding_stored: bool


class IdentityVerifyRequest(BaseModel):
    attempt_id: int
    image_base64: str


class IdentityVerifyResponse(BaseModel):
    match: bool
    confidence: float
    message: str
