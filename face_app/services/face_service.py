"""
Face Service: Handles face encoding, cached section indexing,
vectorized multi-face matching, and bounding box coordinate calculation.
"""
import json
import logging
import numpy as np
from django.core.cache import cache
from django.conf import settings
from core.models import StudentSection
from core.services.attendance_service import AttendanceService
from face_app.utils import (
    detect_and_encode_all_faces,
    batch_compare_faces,
    encode_face_from_frame,
    compare_faces,
    base64_to_bytes,
    draw_face_boxes,
    check_face_liveness,
    _decode_image_to_rgb,
    FR_AVAILABLE,
    FACE_RECOGNITION_AVAILABLE,
    LBPH_AVAILABLE,
)

logger = logging.getLogger(__name__)

SECTION_CACHE_KEY_PREFIX = 'sec_face_embeddings_'
GLOBAL_CACHE_KEY = 'global_student_face_embeddings'
CACHE_TIMEOUT = 300  # 5 minutes


class FaceService:
    GLOBAL_CACHE_KEY = GLOBAL_CACHE_KEY

    @staticmethod
    def get_section_cache_key(section_id):
        return f"{SECTION_CACHE_KEY_PREFIX}{section_id}"

    @staticmethod
    def invalidate_cache(section_id=None):
        """Clears cached embeddings for a specific section or all sections, plus global index."""
        try:
            cache.delete(FaceService.GLOBAL_CACHE_KEY)
        except Exception:
            pass
        if section_id:
            cache.delete(FaceService.get_section_cache_key(section_id))
        else:
            try:
                cache.clear()
            except Exception:
                pass

    @staticmethod
    def get_global_student_encodings():
        """
        Retrieves all registered students across the school with their assigned sections.
        Cached in memory to rapidly detect students scanning in the WRONG section/schedule.
        """
        cached_data = cache.get(FaceService.GLOBAL_CACHE_KEY)
        if cached_data is not None:
            return cached_data

        from accounts.models import Student
        students_qs = Student.objects.select_related('user').prefetch_related(
            'enrollments__section'
        ).exclude(
            face_encoding__isnull=True
        ).exclude(
            face_encoding__exact=''
        )

        students_list = []
        encodings_list = []

        for student in students_qs:
            try:
                encoding = json.loads(student.face_encoding)
                encodings_list.append(encoding)
                sections = [e.section.name for e in student.enrollments.all()]
                sections_str = ", ".join(sections) if sections else "No Section Assigned"
                students_list.append({
                    'id': student.pk,
                    'student_number': student.student_id,
                    'name': student.user.get_full_name() or student.user.username,
                    'assigned_sections': sections_str,
                })
            except (json.JSONDecodeError, TypeError):
                continue

        matrix = np.array(encodings_list, dtype=np.float32) if encodings_list else np.empty((0, 128), dtype=np.float32)

        data = {
            'students': students_list,
            'encodings': encodings_list,
            'matrix': matrix,
        }
        cache.set(FaceService.GLOBAL_CACHE_KEY, data, timeout=CACHE_TIMEOUT)
        return data

    @staticmethod
    def get_section_student_encodings(section):
        """
        Retrieves enrolled students with face encodings for a section.
        Pre-indexes encodings into a vectorized NumPy matrix for sub-millisecond matching.
        Uses Django cache to avoid repeated DB lookups and JSON parsing per video frame.
        """
        cache_key = FaceService.get_section_cache_key(section.pk)
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return cached_data

        enrollments = StudentSection.objects.filter(
            section=section
        ).select_related('student__user').exclude(
            student__face_encoding__isnull=True
        ).exclude(
            student__face_encoding__exact=''
        )

        students_list = []
        encodings_list = []

        for enrollment in enrollments:
            student = enrollment.student
            try:
                encoding = json.loads(student.face_encoding)
                encodings_list.append(encoding)
                students_list.append({
                    'id': student.pk,
                    'student_number': student.student_id,
                    'name': student.user.get_full_name() or student.user.username,
                    'student_obj': student,
                })
            except (json.JSONDecodeError, TypeError):
                continue

        matrix = np.array(encodings_list, dtype=np.float32) if encodings_list else np.empty((0, 128), dtype=np.float32)

        data = {
            'students': students_list,
            'encodings': encodings_list,
            'matrix': matrix,
        }
        cache.set(cache_key, data, timeout=CACHE_TIMEOUT)
        return data

    @staticmethod
    def recognize_all_faces_in_frame(session, frame_bytes, tolerance=None):
        """
        Lightning-fast omni-directional recognition for ALL faces present in a single frame.
        1. Downscales frame for rapid multi-face detection (catches off-center & angled faces).
        2. Extracts encodings for every detected face.
        3. Uses vectorized NumPy matrix comparison against section students (<0.1ms).
        4. Auto-marks attendance for matched students (present or late).
        """
        if tolerance is None:
            tolerance = getattr(settings, 'FACE_RECOGNITION_TOLERANCE', 0.5)

        # Detect and encode all faces in frame (fast downscaled localization)
        detected_faces = detect_and_encode_all_faces(frame_bytes)
        if not detected_faces:
            return {
                'success': True,
                'recognized': [],
                'face_count': 0,
            }

        section = session.schedule.section
        section_data = FaceService.get_section_student_encodings(section)
        students = section_data['students']
        section_matrix = section_data.get('matrix')
        if section_matrix is None and section_data.get('encodings'):
            section_matrix = np.array(section_data['encodings'], dtype=np.float32)

        img_np = None
        try:
            img_np = _decode_image_to_rgb(frame_bytes)
        except Exception:
            pass

        recognized_results = []

        for face_item in detected_faces:
            face_encoding = face_item.get('encoding')
            box = face_item.get('box', {})

            # Biometric Liveness & Anti-Spoofing Verification
            is_live = True
            liveness_reason = "Live human"
            if img_np is not None:
                is_live, _, liveness_reason = check_face_liveness(img_np, box)

            if not is_live:
                recognized_results.append({
                    'student_id': None,
                    'student_number': None,
                    'name': '⚠️ Spoof Detected (Paper/Screen)',
                    'confidence': 0.0,
                    'status': 'spoof_detected',
                    'new_status': None,
                    'box': box,
                    'matched': False,
                    'wrong_section': False,
                    'is_live': False,
                    'liveness_reason': liveness_reason,
                })
                continue

            best_match = None
            best_confidence = 0.0

            if section_matrix is not None and len(section_matrix) > 0 and face_encoding:
                is_match, best_idx, min_dist, confidence = batch_compare_faces(
                    section_matrix, face_encoding, tolerance
                )
                if is_match and best_idx is not None and best_idx < len(students):
                    best_match = students[best_idx]
                    best_confidence = confidence

            if best_match:
                # Auto-mark attendance via AttendanceService
                student_obj = best_match['student_obj']
                record, is_new_mark = AttendanceService.mark_attendance(
                    session=session,
                    student=student_obj,
                    confidence=best_confidence
                )

                recognized_results.append({
                    'student_id': best_match['id'],
                    'student_number': best_match['student_number'],
                    'name': best_match['name'],
                    'confidence': round(best_confidence * 100, 1),
                    'status': record.status,
                    'new_status': record.status if is_new_mark else None,
                    'box': box,
                    'matched': True,
                })
            else:
                # Two-tier check: Cross-check against all registered students to catch wrong-section scans
                global_data = FaceService.get_global_student_encodings()
                global_matrix = global_data.get('matrix')
                global_students = global_data.get('students', [])
                wrong_section_match = None
                wrong_section_conf = 0.0

                if global_matrix is not None and len(global_matrix) > 0 and face_encoding:
                    is_match_g, g_idx, dist_g, conf_g = batch_compare_faces(
                        global_matrix, face_encoding, tolerance
                    )
                    if is_match_g and g_idx is not None and g_idx < len(global_students):
                        wrong_section_match = global_students[g_idx]
                        wrong_section_conf = conf_g

                if wrong_section_match:
                    recognized_results.append({
                        'student_id': wrong_section_match['id'],
                        'student_number': wrong_section_match['student_number'],
                        'name': wrong_section_match['name'],
                        'confidence': round(wrong_section_conf * 100, 1),
                        'status': 'wrong_section',
                        'new_status': None,
                        'box': box,
                        'matched': False,
                        'wrong_section': True,
                        'assigned_sections': wrong_section_match.get('assigned_sections', 'Different Section'),
                    })
                else:
                    # Truly unregistered / unknown face
                    recognized_results.append({
                        'student_id': None,
                        'student_number': None,
                        'name': 'Unknown',
                        'confidence': 0.0,
                        'status': None,
                        'new_status': None,
                        'box': box,
                        'matched': False,
                        'wrong_section': False,
                    })

        return {
            'success': True,
            'recognized': recognized_results,
            'face_count': len(detected_faces),
        }

    @staticmethod
    def draw_boxes(frame_bytes, recognized_results):
        """Draw bounding boxes and names on the frame image."""
        box_data = []
        for r in recognized_results:
            box = r.get('box', {})
            box_data.append({
                'top': box.get('top', 0),
                'right': box.get('right', 0),
                'bottom': box.get('bottom', 0),
                'left': box.get('left', 0),
                'name': r.get('name', 'Unknown'),
                'status': r.get('status', 'absent'),
            })
        return draw_face_boxes(frame_bytes, box_data)
