"""
Face recognition utility functions.
Uses OpenCV for image processing and a simple face matching approach.
For full accuracy, install face_recognition (requires dlib + CMake).
Falls back to OpenCV Haar cascade if face_recognition is not available.
"""
import json
import base64
import logging
import numpy as np
from io import BytesIO
from django.conf import settings
from PIL import Image

logger = logging.getLogger(__name__)

# Try to import face_recognition (dlib-based, most accurate)
try:
    import face_recognition as fr
    FACE_RECOGNITION_AVAILABLE = True
    logger.info("face_recognition library loaded successfully.")
except ImportError:
    FACE_RECOGNITION_AVAILABLE = False
    fr = None
    logger.warning("face_recognition not available. Install it for live recognition.")

# Try OpenCV (optional - used only for drawing boxes)
try:
    import cv2
    OPENCV_AVAILABLE = True
    # Haar cascade was removed in OpenCV 5.x, so guard with hasattr
    if hasattr(cv2, 'CascadeClassifier') and hasattr(cv2, 'data'):
        _cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        FACE_CASCADE = cv2.CascadeClassifier(_cascade_path)
    else:
        FACE_CASCADE = None
except ImportError:
    OPENCV_AVAILABLE = False
    FACE_CASCADE = None
    logger.warning("OpenCV not available.")


def encode_face_from_image(image_data: bytes):
    """
    Encode a face from image bytes. Returns a list (128 floats) or None.
    Uses face_recognition if available, else returns None.
    """
    if not FACE_RECOGNITION_AVAILABLE:
        logger.warning("face_recognition not installed. Cannot encode face.")
        return None

    img = Image.open(BytesIO(image_data)).convert('RGB')
    img_np = np.array(img)
    encodings = fr.face_encodings(img_np)
    if not encodings:
        return None
    return encodings[0].tolist()


def encode_face_from_path(image_path: str):
    """Encode face from a file path."""
    if not FACE_RECOGNITION_AVAILABLE:
        return None
    try:
        img = fr.load_image_file(image_path)
        encodings = fr.face_encodings(img)
        return encodings[0].tolist() if encodings else None
    except Exception as e:
        logger.error(f"Error encoding face from path {image_path}: {e}")
        return None


def compare_faces(known_encoding: list, unknown_encoding: list, tolerance: float = None):
    """
    Compare two face encodings.
    Returns (is_match: bool, distance: float)
    Lower distance = better match. Threshold typically 0.5–0.6.
    """
    if tolerance is None:
        tolerance = getattr(settings, 'FACE_RECOGNITION_TOLERANCE', 0.5)

    if not FACE_RECOGNITION_AVAILABLE:
        return False, 1.0

    known_np = np.array(known_encoding)
    unknown_np = np.array(unknown_encoding)
    distance = fr.face_distance([known_np], unknown_np)[0]
    is_match = bool(distance <= tolerance)
    confidence = max(0.0, 1.0 - float(distance))
    return is_match, confidence


def detect_faces_in_frame(frame_bytes: bytes):
    """
    Detect face locations in a frame.
    Returns list of dicts with 'top', 'right', 'bottom', 'left'.
    """
    if not FACE_RECOGNITION_AVAILABLE:
        # Fallback: OpenCV Haar cascade
        if not OPENCV_AVAILABLE or FACE_CASCADE is None:
            return []
        img = Image.open(BytesIO(frame_bytes)).convert('RGB')
        img_np = np.array(img)
        gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
        faces = FACE_CASCADE.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
        return [{'top': y, 'right': x + w, 'bottom': y + h, 'left': x} for (x, y, w, h) in faces]

    img = Image.open(BytesIO(frame_bytes)).convert('RGB')
    img_np = np.array(img)
    locations = fr.face_locations(img_np, model='hog')
    return [{'top': t, 'right': r, 'bottom': b, 'left': l} for (t, r, b, l) in locations]


def encode_face_from_frame(frame_bytes: bytes):
    """
    Encode all faces found in a frame.
    Returns (first_encoding_or_None, list_of_face_locations)
    """
    if not FACE_RECOGNITION_AVAILABLE:
        return None, []

    img = Image.open(BytesIO(frame_bytes)).convert('RGB')
    img_np = np.array(img)
    locations = fr.face_locations(img_np, model='hog')
    encodings = fr.face_encodings(img_np, locations)
    face_locations = [{'top': t, 'right': r, 'bottom': b, 'left': l} for (t, r, b, l) in locations]

    if encodings:
        return encodings[0].tolist(), face_locations
    return None, face_locations


def base64_to_bytes(base64_str: str):
    """Convert a base64 data URL or string to bytes."""
    if ',' in base64_str:
        base64_str = base64_str.split(',', 1)[1]
    return base64.b64decode(base64_str)


def draw_face_boxes(frame_bytes: bytes, results: list):
    """
    Draw bounding boxes on detected faces.
    results: list of {top, right, bottom, left, name, status}
    Returns modified image bytes.
    """
    if not OPENCV_AVAILABLE:
        return frame_bytes

    img = Image.open(BytesIO(frame_bytes)).convert('RGB')
    img_np = np.array(img)

    for res in results:
        top, right, bottom, left = res['top'], res['right'], res['bottom'], res['left']
        name = res.get('name', 'Unknown')
        status = res.get('status', 'unknown')

        color = (0, 200, 0) if status == 'present' else (200, 0, 0) if status == 'absent' else (200, 200, 0)
        cv2.rectangle(img_np, (left, top), (right, bottom), color, 2)
        cv2.rectangle(img_np, (left, bottom - 28), (right, bottom), color, cv2.FILLED)
        font = cv2.FONT_HERSHEY_DUPLEX
        cv2.putText(img_np, name, (left + 4, bottom - 8), font, 0.5, (255, 255, 255), 1)

    output = BytesIO()
    Image.fromarray(img_np).save(output, format='JPEG', quality=85)
    return output.getvalue()
