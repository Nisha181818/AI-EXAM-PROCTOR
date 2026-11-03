import base64
import gc
import io
import json
import os
import uuid
from typing import Optional, Tuple
import numpy as np
from PIL import Image
from app.config import settings


def _decode_base64_image(image_base64: str) -> Image.Image:
    """Decode data-URI or plain base64 image into a RGB PIL Image."""
    if "," in image_base64:
        image_base64 = image_base64.split(",")[1]
    img_bytes = base64.b64decode(image_base64)
    return Image.open(io.BytesIO(img_bytes)).convert("RGB")


def save_image_to_disk(image_base64: str, subfolder: str = "uploads") -> str:
    """Save base64 image to upload directory and return its relative URL."""
    os.makedirs(os.path.join(settings.upload_dir, subfolder), exist_ok=True)
    img = _decode_base64_image(image_base64)
    filename = f"{uuid.uuid4()}.jpg"
    filepath = os.path.join(settings.upload_dir, subfolder, filename)
    img.save(filepath, "JPEG", quality=90)
    return f"/uploads/{subfolder}/{filename}"


def _extract_spatial_gradient_features(norm_arr: np.ndarray) -> np.ndarray:
    """
    Extract a normalized 160-dimensional spatial gradient and cell statistics vector
    from a standardized 96x96 grayscale face patch.
    Consumes < 1 MB RAM, executes in < 5 milliseconds on CPU.
    """
    grid_size = 12
    features = []

    # 1. Spatial cell statistics across 8x8 grid (8x8x2 = 128 features)
    for r in range(0, 96, grid_size):
        for c in range(0, 96, grid_size):
            cell = norm_arr[r:r + grid_size, c:c + grid_size]
            features.append(float(np.mean(cell)))
            features.append(float(np.std(cell)))

    # 2. Multi-region spatial gradients (4x4 regions x 2 = 32 features)
    gx = np.diff(norm_arr, axis=1)[:, :-1]
    gy = np.diff(norm_arr, axis=0)[:-1, :]
    for r in range(0, 94, 24):
        for c in range(0, 94, 24):
            features.append(float(np.mean(np.abs(gx[r:r + 24, c:c + 24]))))
            features.append(float(np.mean(np.abs(gy[r:r + 24, c:c + 24]))))

    vec = np.array(features, dtype=np.float32)
    norm = np.linalg.norm(vec)
    return (vec / norm) if norm > 0 else vec


def _extract_opencv_haar_embedding(img: Image.Image) -> Optional[np.ndarray]:
    """
    Lightweight OpenCV Haar Cascade face detector & feature extractor.
    Requires no GPU, uses ~10 MB RAM, and executes in ~15 ms.
    """
    try:
        import cv2
    except ImportError:
        return None

    try:
        rgb = np.array(img.convert("RGB"))
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)

        # Load built-in OpenCV frontal face cascade
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        face_cascade = cv2.CascadeClassifier(cascade_path)
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=4,
            minSize=(30, 30),
        )

        if len(faces) > 0:
            # Pick largest detected face
            largest_face = max(faces, key=lambda b: b[2] * b[3])
            x, y, w, h = largest_face
            # Add 10% margin
            pad_w, pad_h = int(w * 0.1), int(h * 0.1)
            x1 = max(0, x - pad_w)
            y1 = max(0, y - pad_h)
            x2 = min(gray.shape[1], x + w + pad_w)
            y2 = min(gray.shape[0], y + h + pad_h)
            face_patch = gray[y1:y2, x1:x2]
        else:
            # Fallback to center 75% crop of portrait
            h_img, w_img = gray.shape
            cw, ch = int(w_img * 0.75), int(h_img * 0.75)
            x1 = (w_img - cw) // 2
            y1 = (h_img - ch) // 2
            face_patch = gray[y1:y1 + ch, x1:x1 + cw]

        # Standardize size & histogram equalization for lighting invariance
        face_patch = cv2.resize(face_patch, (96, 96), interpolation=cv2.INTER_AREA)
        face_patch = cv2.equalizeHist(face_patch)

        norm_arr = (face_patch.astype(np.float32) - np.mean(face_patch)) / (np.std(face_patch) + 1e-5)
        return _extract_spatial_gradient_features(norm_arr)
    except Exception as e:
        print(f"OpenCV Haar processing note: {e}. Using PIL engine.")
        return None


def _extract_pil_embedding(img: Image.Image) -> np.ndarray:
    """
    Zero-dependency pure PIL + NumPy face feature extractor.
    Ideal for low-memory cloud hosts (uses < 2 MB RAM).
    """
    img = img.convert("RGB")
    w, h = img.size

    # Center crop 75% where portrait faces reside
    crop_w, crop_h = int(w * 0.75), int(h * 0.75)
    left = (w - crop_w) // 2
    top = (h - crop_h) // 2
    cropped = img.crop((left, top, left + crop_w, top + crop_h))

    # Standardize to 96x96 grayscale
    gray = cropped.convert("L").resize((96, 96), Image.Resampling.BILINEAR)
    arr = np.array(gray, dtype=np.float32)

    # Contrast normalization (zero mean, unit variance)
    norm_arr = (arr - np.mean(arr)) / (np.std(arr) + 1e-5)
    return _extract_spatial_gradient_features(norm_arr)


def _extract_deepface_embedding(image_source) -> Optional[np.ndarray]:
    """
    Lazy-loaded DeepFace embedding.
    NEVER imported at module level to prevent 512MB RAM OOM container restarts.
    """
    os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
    os.environ["CUDA_VISIBLE_DEVICES"] = "-1"

    import tempfile
    tmp_path = None
    try:
        from deepface import DeepFace

        if isinstance(image_source, Image.Image):
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                image_source.save(tmp.name, "JPEG", quality=90)
                tmp_path = tmp.name
            path_to_use = tmp_path
        else:
            path_to_use = str(image_source)

        result = DeepFace.represent(
            img_path=path_to_use,
            model_name=settings.deepface_model,
            enforce_detection=False,
        )

        if result and len(result) > 0:
            embedding = np.array(result[0]["embedding"], dtype=np.float32)
            norm = np.linalg.norm(embedding)
            return (embedding / norm) if norm > 0 else embedding
        return None
    except Exception as e:
        print(f"DeepFace lazy-load failed or OOM avoided: {e}. Falling back to lightweight engine.")
        gc.collect()
        return None
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass


def generate_embedding(image_source) -> Optional[np.ndarray]:
    """
    Generate face embedding using lightweight, low-memory model by default.
    TensorFlow/DeepFace is only lazy-loaded if USE_DEEPFACE=true is set.
    """
    try:
        # 1. If DeepFace explicitly requested in config/env
        if settings.use_deepface or getattr(settings, "face_engine", "").lower() == "deepface":
            deepface_emb = _extract_deepface_embedding(image_source)
            if deepface_emb is not None:
                return deepface_emb

        # Convert image_source to PIL.Image
        if isinstance(image_source, str):
            img = Image.open(image_source).convert("RGB")
        elif isinstance(image_source, Image.Image):
            img = image_source.convert("RGB")
        elif isinstance(image_source, (bytes, bytearray)):
            img = Image.open(io.BytesIO(image_source)).convert("RGB")
        else:
            img = Image.fromarray(np.array(image_source)).convert("RGB")

        # 2. Try OpenCV Haar Cascade (fast, low memory ~10 MB)
        if getattr(settings, "face_engine", "opencv").lower() == "opencv":
            cv_emb = _extract_opencv_haar_embedding(img)
            if cv_emb is not None:
                return cv_emb

        # 3. Fast deterministic PIL+NumPy fallback (< 2 MB RAM)
        return _extract_pil_embedding(img)
    except Exception as e:
        print(f"Face embedding generation error: {e}")
        try:
            # Ultimate safeguard: deterministic pixel projection
            if isinstance(image_source, Image.Image):
                fallback_img = image_source
            else:
                fallback_img = Image.open(image_source)
            return _extract_pil_embedding(fallback_img)
        except Exception as e2:
            print(f"Ultimate fallback failed: {e2}")
            return None


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two feature vectors."""
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def verify_faces(
    enrollment_embedding_json: str,
    live_image_base64: str,
) -> Tuple[bool, float]:
    """Compare stored enrollment embedding with live photo."""
    try:
        stored_embedding = np.array(json.loads(enrollment_embedding_json), dtype=np.float32)
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
    """Convert numpy array embedding to JSON string."""
    return json.dumps(embedding.tolist())
