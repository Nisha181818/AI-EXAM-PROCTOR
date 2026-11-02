import os
import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserLogin, UserOut, TokenResponse, EnrollmentPhotoResponse
from app.services.auth_utils import hash_password, verify_password, create_access_token, get_current_user
from app.config import settings

router = APIRouter()


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        name=user_in.name,
        email=user_in.email,
        password_hash=hash_password(user_in.password),
        role=user_in.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/upload-enrollment-photo", response_model=EnrollmentPhotoResponse)
async def upload_enrollment_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.services.face_service import generate_embedding, embedding_to_json
    from PIL import Image
    import io

    subfolder = "enrollment"
    os.makedirs(os.path.join(settings.upload_dir, subfolder), exist_ok=True)
    ext = file.filename.split(".")[-1] if file.filename else "jpg"
    filename = f"user_{current_user.id}_enrollment.{ext}"
    filepath = os.path.join(settings.upload_dir, subfolder, filename)

    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    photo_url = f"/uploads/{subfolder}/{filename}"

    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
        embedding = generate_embedding(img)
    except Exception:
        embedding = None

    embedding_stored = False
    if embedding is not None:
        current_user.face_embedding = embedding_to_json(embedding)
        embedding_stored = True

    current_user.enrollment_photo_url = photo_url
    db.commit()

    return {
        "message": "Enrollment photo uploaded successfully",
        "enrollment_photo_url": photo_url,
        "face_embedding_stored": embedding_stored,
    }
