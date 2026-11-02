import base64
import io
import json
import os
import uuid
from typing import Optional, Tuple
import numpy as np
from PIL import Image
from app.config import settings


def _decode_base64_image(image_base64: str) -> Image.Image:
    if "," in image_base64:
        image_base64 = image_base64.split(",")[1]
    img_bytes = base64.b64decode(image_base64)
    return Image.open(io.BytesIO(img_bytes)).convert("RGB")


def save_image_to_disk(image_base64: str, subfolder: str = "uploads") -> str:
    os.makedirs(os.path.join(settings.upload_dir, subfolder), exist_ok=True)
    img = _decode_base64_image(image_base64)
    filename = f"{uuid.uuid4()}.jpg"
    filepath = os.path.join(settings.upload_dir, subfolder, filename)
    img.save(filepath, "JPEG", quality=90)
    return f"/uploads/{subfolder}/{filename}"


def generate_embedding(image_source) -> Optional[np.ndarray]:
    try:
        from deepface import DeepFace
        import tempfile

        if isinstance(image_source, Image.Image):
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                image_source.save(tmp.name, "JPEG")
                tmp_path = tmp.name
            result = DeepFace.represent(
                img_path=tmp_path,
                model_name=settings.deepface_model,
                enforce_detection=False,
            )
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
        else:
            result = DeepFace.represent(
                img_path=str(image_source),
                model_name=settings.deepface_model,
                enforce_detection=False,
            )

        if result and len(result) > 0:
            embedding = np.array(result[0]["embedding"])
            return embedding
        return None
    except Exception as e:
        print(f"DeepFace not available or detection error: {e}. Generating perceptual hash fallback.")
        # Fallback deterministic pseudo-embedding based on resized grayscale image pixels
        try:
            if isinstance(image_source, str):
                img = Image.open(image_source).convert("L")
            else:
                img = image_source.convert("L")
            img = img.resize((32, 32))
            arr = np.array(img, dtype=np.float32).flatten()
            norm = np.linalg.norm(arr)
            return (arr / norm) if norm > 0 else arr
        except Exception as e2:
            print(f"Fallback embedding error: {e2}")
            return None


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def verify_faces(
    enrollment_embedding_json: str,
    live_image_base64: str,
) -> Tuple[bool, float]:
    try:
        stored_embedding = np.array(json.loads(enrollment_embedding_json))
        live_img = _decode_base64_image(live_image_base64)
        live_embedding = generate_embedding(live_img)

        if live_embedding is None:
            return False, 0.0

        sim = cosine_similarity(stored_embedding, live_embedding)
        match = sim >= settings.face_match_threshold
        return match, sim
    except Exception as e:
        print(f"Face verification error: {e}")
        return False, 0.0


def embedding_to_json(embedding: np.ndarray) -> str:
    return json.dumps(embedding.tolist())
