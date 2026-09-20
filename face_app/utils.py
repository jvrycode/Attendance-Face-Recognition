"""
Face recognition utility functions.
Uses OpenCV LBPH face recognizer (opencv-contrib-python).
This approach requires NO dlib, NO CMake, and NO C++ compilation.
Falls back gracefully if opencv-contrib is not available.
"""
import os
import json
import base64
import logging
import numpy as np
from io import BytesIO
from django.conf import settings
from PIL import Image

logger = logging.getLogger(__name__)

# ── Library detection ─────────────────────────────────────────────────────────

try:
    import cv2
    OPENCV_AVAILABLE = True
except ImportError:
    cv2 = None
    OPENCV_AVAILABLE = False
    logger.warning("OpenCV not available.")

# Check for LBPH face recognizer (requires opencv-contrib-python)
try:
    import cv2
    _test = cv2.face.LBPHFaceRecognizer_create()
    LBPH_AVAILABLE = True
    logger.info("OpenCV LBPH face recognizer available.")
except (AttributeError, cv2.error if cv2 else Exception):
    LBPH_AVAILABLE = False
    logger.warning("LBPH not available. Install opencv-contrib-python.")

# Also check for the dlib-based face_recognition library (optional bonus)
try:
    import face_recognition as fr
    FACE_RECOGNITION_AVAILABLE = True
    logger.info("face_recognition (dlib) library loaded – using high accuracy mode.")
except ImportError:
    FACE_RECOGNITION_AVAILABLE = False
    fr = None

# Determine overall capability
FR_AVAILABLE = FACE_RECOGNITION_AVAILABLE or LBPH_AVAILABLE

# ── Haar Cascade setup ────────────────────────────────────────────────────────

FACE_CASCADE = None
if OPENCV_AVAILABLE:
    if hasattr(cv2, 'data') and cv2.data:
        _cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        if os.path.exists(_cascade_path):
            FACE_CASCADE = cv2.CascadeClassifier(_cascade_path)
    # OpenCV 5 may have moved the data path
    if FACE_CASCADE is None:
        import cv2 as _cv2
        for _attr in dir(_cv2):
            if 'haarcascades' in _attr.lower():
                _p = getattr(_cv2, _attr, '') + 'haarcascade_frontalface_default.xml'
                if os.path.exists(_p):
                    FACE_CASCADE = _cv2.CascadeClassifier(_p)
                    break


def _decode_image_to_rgb(data: bytes) -> np.ndarray:
    """Convert raw image bytes to an RGB numpy array."""
    img = Image.open(BytesIO(data)).convert('RGB')
    return np.array(img)


def _to_gray(rgb_np: np.ndarray) -> np.ndarray:
    """Convert RGB numpy array to grayscale."""
    return cv2.cvtColor(rgb_np, cv2.COLOR_RGB2GRAY)


def _detect_faces_cv(gray_np: np.ndarray):
    """Detect faces using Haar cascade. Returns list of (x, y, w, h)."""
    if FACE_CASCADE is None:
        # Fallback: DNN-based detector or assume full frame is face
        h, w = gray_np.shape[:2]
        return [(int(w * 0.1), int(h * 0.1), int(w * 0.8), int(h * 0.8))]
    faces = FACE_CASCADE.detectMultiScale(
        gray_np,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(60, 60),
    )
    return faces if len(faces) > 0 else []


# ── Public API: Encoding ──────────────────────────────────────────────────────

def encode_face_from_image(image_data: bytes):
    """
    Encode a face from raw image bytes.
    Returns a list of floats (the face encoding) or None if no face found.

    Uses face_recognition (dlib) if available, else LBPH histogram encoding.
    """
    if FACE_RECOGNITION_AVAILABLE:
        try:
            img_np = _decode_image_to_rgb(image_data)
            encodings = fr.face_encodings(img_np)
            return encodings[0].tolist() if encodings else None
        except Exception as e:
            logger.error(f"face_recognition encode error: {e}")
            return None

    if LBPH_AVAILABLE:
        return _lbph_encode(image_data)

    logger.error("No face recognition library available.")
    return None


def encode_face_from_path(image_path: str):
    """Encode face from a file path."""
    try:
        with open(image_path, 'rb') as f:
            return encode_face_from_image(f.read())
    except Exception as e:
        logger.error(f"encode_face_from_path error: {e}")
        return None


def encode_face_from_frame(frame_bytes: bytes):
    """
    Encode all faces found in a webcam frame.
    Returns (first_encoding_or_None, list_of_face_location_dicts)
    """
    if FACE_RECOGNITION_AVAILABLE:
        try:
            img_np = _decode_image_to_rgb(frame_bytes)
            locations = fr.face_locations(img_np, model='hog')
            encodings = fr.face_encodings(img_np, locations)
            face_locs = [{'top': t, 'right': r, 'bottom': b, 'left': l}
                         for (t, r, b, l) in locations]
            return (encodings[0].tolist() if encodings else None), face_locs
        except Exception as e:
            logger.error(f"encode_face_from_frame (dlib) error: {e}")

    if LBPH_AVAILABLE:
        encoding = _lbph_encode(frame_bytes)
        return encoding, _detect_locations(frame_bytes)

    return None, []


def _lbph_encode(image_data: bytes):
    """
    Compute an LBPH-style face encoding (histogram over face ROI).
    Returns a flat float list or None.
    """
    try:
        img_np = _decode_image_to_rgb(image_data)
        gray = _to_gray(img_np)
        faces = _detect_faces_cv(gray)

        if len(faces) == 0:
            # Use entire frame center as fallback
            h, w = gray.shape
            face_gray = gray[int(h*0.1):int(h*0.9), int(w*0.1):int(w*0.9)]
        else:
            x, y, fw, fh = faces[0]
            face_gray = gray[y:y+fh, x:x+fw]

        # Resize to fixed size for consistent encoding
        face_resized = cv2.resize(face_gray, (128, 128))

        # Compute LBP histogram for a robust descriptor
        lbp_hist = _compute_lbp_histogram(face_resized)
        return lbp_hist.tolist()
    except Exception as e:
        logger.error(f"LBPH encode error: {e}")
        return None


def _compute_lbp_histogram(gray_face: np.ndarray, num_points: int = 8, radius: int = 1):
    """Compute Local Binary Pattern histogram over a face image."""
    h, w = gray_face.shape
    lbp = np.zeros((h, w), dtype=np.uint8)

    for i in range(num_points):
        angle = 2 * np.pi * i / num_points
        x_offset = int(round(radius * np.cos(angle)))
        y_offset = int(round(-radius * np.sin(angle)))

        shifted = np.roll(np.roll(gray_face, y_offset, axis=0), x_offset, axis=1)
        lbp += ((shifted >= gray_face).astype(np.uint8) << i)

    # Divide into a grid of cells and compute per-cell histograms
    grid = 8
    ch, cw = h // grid, w // grid
    histograms = []
    for row in range(grid):
        for col in range(grid):
            cell = lbp[row*ch:(row+1)*ch, col*cw:(col+1)*cw]
            hist, _ = np.histogram(cell, bins=256, range=(0, 256))
            hist = hist.astype(np.float32)
            norm = np.sum(hist)
            if norm > 0:
                hist /= norm
            histograms.append(hist)

    return np.concatenate(histograms)


def _detect_locations(frame_bytes: bytes):
    """Return face locations from a frame as list of dicts."""
    try:
        img_np = _decode_image_to_rgb(frame_bytes)
        gray = _to_gray(img_np)
        faces = _detect_faces_cv(gray)
        return [{'top': y, 'right': x+w, 'bottom': y+h, 'left': x}
                for (x, y, w, h) in faces]
    except Exception:
        return []


# ── Public API: Comparison ────────────────────────────────────────────────────

def compare_faces(known_encoding: list, unknown_encoding: list, tolerance: float = None):
    """
    Compare two face encodings.
    Returns (is_match: bool, confidence: float)
    confidence is between 0.0 and 1.0, higher = better match.
    """
    if tolerance is None:
        tolerance = getattr(settings, 'FACE_RECOGNITION_TOLERANCE', 0.5)

    if known_encoding is None or unknown_encoding is None:
        return False, 0.0

    known_np = np.array(known_encoding, dtype=np.float32)
    unknown_np = np.array(unknown_encoding, dtype=np.float32)

    if FACE_RECOGNITION_AVAILABLE and len(known_np) == 128:
        # dlib encoding: use Euclidean distance
        distance = float(np.linalg.norm(known_np - unknown_np))
        is_match = distance <= tolerance
        confidence = max(0.0, 1.0 - distance)
        return is_match, round(confidence, 3)

    # LBPH encoding: use Chi-squared distance on histograms
    chi_sq = _chi_squared_distance(known_np, unknown_np)
    # Chi-sq ranges from 0 (identical) upward; threshold empirically ~20–80
    lbph_threshold = getattr(settings, 'LBPH_THRESHOLD', 40.0)
    is_match = chi_sq <= lbph_threshold
    confidence = max(0.0, 1.0 - chi_sq / lbph_threshold)
    return is_match, round(confidence, 3)


def _chi_squared_distance(h1: np.ndarray, h2: np.ndarray) -> float:
    """Chi-squared histogram distance. Lower = more similar."""
    if len(h1) != len(h2):
        return 9999.0
    eps = 1e-10
    return float(np.sum(((h1 - h2) ** 2) / (h1 + h2 + eps)))


# ── Public API: Detection ─────────────────────────────────────────────────────

def detect_faces_in_frame(frame_bytes: bytes):
    """
    Detect face locations in a frame.
    Returns list of dicts: {top, right, bottom, left}
    """
    if FACE_RECOGNITION_AVAILABLE:
        try:
            img_np = _decode_image_to_rgb(frame_bytes)
            locations = fr.face_locations(img_np, model='hog')
            return [{'top': t, 'right': r, 'bottom': b, 'left': l}
                    for (t, r, b, l) in locations]
        except Exception as e:
            logger.error(f"detect_faces dlib error: {e}")

    return _detect_locations(frame_bytes)


# ── Utility ───────────────────────────────────────────────────────────────────

def base64_to_bytes(base64_str: str) -> bytes:
    """Convert a base64 data URL or plain base64 string to bytes."""
    if ',' in base64_str:
        base64_str = base64_str.split(',', 1)[1]
    return base64.b64decode(base64_str)


def draw_face_boxes(frame_bytes: bytes, results: list) -> bytes:
    """
    Draw colored bounding boxes + name labels on faces.
    results: list of {top, right, bottom, left, name, status}
    Returns modified JPEG bytes.
    """
    if not OPENCV_AVAILABLE:
        return frame_bytes
    try:
        img_np = _decode_image_to_rgb(frame_bytes)
        for res in results:
            top, right, bottom, left = res['top'], res['right'], res['bottom'], res['left']
            name = res.get('name', 'Unknown')
            status = res.get('status', 'unknown')
            color = (0, 200, 0) if status == 'present' else (200, 0, 0)
            cv2.rectangle(img_np, (left, top), (right, bottom), color, 2)
            cv2.rectangle(img_np, (left, bottom - 28), (right, bottom), color, cv2.FILLED)
            cv2.putText(img_np, name, (left + 4, bottom - 8),
                        cv2.FONT_HERSHEY_DUPLEX, 0.5, (255, 255, 255), 1)
        output = BytesIO()
        Image.fromarray(img_np).save(output, format='JPEG', quality=85)
        return output.getvalue()
    except Exception as e:
        logger.error(f"draw_face_boxes error: {e}")
        return frame_bytes
