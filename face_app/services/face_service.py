"""
Face Service: Handles face encoding, cached section indexing,
vectorized multi-face matching, and bounding box coordinate calculation.
"""
import json
import logging
import random
import time
import numpy as np
from django.core.cache import cache
from django.conf import settings
from core.models import StudentSection
from core.services.attendance_service import AttendanceService
from face_app.utils import (
    detect_and_encode_all_faces,
    batch_compare_faces,
    draw_face_boxes,
    check_face_liveness,
    estimate_head_yaw,
    pick_face_for_next_attendance,
    _decode_image_to_rgb,
)

logger = logging.getLogger(__name__)

SECTION_CACHE_KEY_PREFIX = 'sec_face_embeddings_'
SECTION_CACHE_VERSION_PREFIX = 'sec_face_embeddings_version_'
GLOBAL_CACHE_KEY = 'global_student_face_embeddings'
GLOBAL_CACHE_VERSION_KEY = 'global_student_face_embeddings_version'
CONSENSUS_CACHE_PREFIX = 'face_consensus_'
LIVENESS_OK_PREFIX = 'face_liveness_ok_'
CACHE_TIMEOUT = getattr(settings, 'FACE_CACHE_TIMEOUT', 60)
LIVENESS_CACHE_TIMEOUT = 90


class FaceService:
    GLOBAL_CACHE_KEY = GLOBAL_CACHE_KEY

    @staticmethod
    def _version_key(section_id):
        return f"{SECTION_CACHE_VERSION_PREFIX}{section_id}"

    @staticmethod
    def _cache_version(key):
        return cache.get_or_set(key, 1, timeout=None)

    @staticmethod
    def _bump_version(key):
        cache.add(key, 1, timeout=None)
        try:
            return cache.incr(key)
        except ValueError:
            cache.set(key, 2, timeout=None)
            return 2

    @staticmethod
    def get_section_cache_key(section_id, subject_id=None):
        version = FaceService._cache_version(FaceService._version_key(section_id))
        subject_suffix = f"_sub_{subject_id}" if subject_id else ''
        return f"{SECTION_CACHE_KEY_PREFIX}{section_id}{subject_suffix}_v{version}"

    @staticmethod
    def get_global_cache_key():
        version = FaceService._cache_version(GLOBAL_CACHE_VERSION_KEY)
        return f"{GLOBAL_CACHE_KEY}_v{version}"

    @staticmethod
    def invalidate_cache(section_id=None):
        """Invalidate only affected face indexes; never flush unrelated cache entries."""
        cache.delete(FaceService.get_global_cache_key())
        FaceService._bump_version(GLOBAL_CACHE_VERSION_KEY)
        if section_id:
            cache.delete(FaceService.get_section_cache_key(section_id))
            FaceService._bump_version(FaceService._version_key(section_id))

    @staticmethod
    def get_global_student_encodings():
        """
        Retrieves all registered students across the school with their assigned sections.
        Cached in memory to rapidly detect students scanning in the WRONG section/schedule.
        """
        cache_key = FaceService.get_global_cache_key()
        cached_data = cache.get(cache_key)
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
        cache.set(cache_key, data, timeout=CACHE_TIMEOUT)
        return data

    @staticmethod
    def get_section_student_encodings(section, subject=None):
        """
        Retrieves enrolled students with face encodings for a section and optional subject.
        Pre-indexes encodings into a vectorized NumPy matrix for sub-millisecond matching.
        Uses Django cache to avoid repeated DB lookups and JSON parsing per video frame.
        Supports FSUU irregular students: includes block section students (subject=null)
        plus irregular students enrolled specifically in this subject.
        """
        subj_id = subject.pk if (subject and hasattr(subject, 'pk')) else (subject if isinstance(subject, int) else None)
        cache_key = FaceService.get_section_cache_key(section.pk, subj_id)
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return cached_data

        from django.db.models import Q
        filter_q = Q(section=section)
        if subj_id:
            filter_q &= (Q(subject__isnull=True) | Q(subject_id=subj_id))

        enrollments = StudentSection.objects.filter(
            filter_q
        ).select_related('student__user').exclude(
            student__face_encoding__isnull=True
        ).exclude(
            student__face_encoding__exact=''
        )

        students_list = []
        encodings_list = []
        seen_student_ids = set()

        for enrollment in enrollments:
            student = enrollment.student
            if student.pk in seen_student_ids:
                continue
            seen_student_ids.add(student.pk)
            try:
                encoding = json.loads(student.face_encoding)
                encodings_list.append(encoding)
                students_list.append({
                    'id': student.pk,
                    'student_number': student.student_id,
                    'name': student.user.get_full_name() or student.user.username,
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
    def _consensus_cache_key(session_id):
        return f"{CONSENSUS_CACHE_PREFIX}{session_id}"

    @staticmethod
    def _reset_consensus(session_id):
        cache.delete(FaceService._consensus_cache_key(session_id))

    @staticmethod
    def _consensus_frames_required(match_confidence=None):
        """Every match needs the same number of consecutive, distinct frames (no instant marks)."""
        return max(1, int(getattr(settings, 'FACE_CONSENSUS_FRAMES', 3)))

    @staticmethod
    def _update_consensus(session_id, student_id, face_encoding=None):
        """
        Track consecutive matching frames for one student.
        Returns (streak, is_replay). A frame whose face vector is (near-)identical to the
        previous one is a replayed/duplicated image: it does not advance the streak.
        """
        cache_key = FaceService._consensus_cache_key(session_id)
        data = cache.get(cache_key) or {'student_id': None, 'count': 0, 'last_encoding': None}
        is_replay = False

        if data.get('student_id') == student_id:
            last = data.get('last_encoding')
            if last is not None and face_encoding is not None and len(last) == len(face_encoding):
                epsilon = getattr(settings, 'FACE_REPLAY_EPSILON', 0.002)
                diff = float(np.linalg.norm(
                    np.asarray(last, dtype=np.float32) - np.asarray(face_encoding, dtype=np.float32)
                ))
                is_replay = diff < epsilon
            if not is_replay:
                data['count'] += 1
        else:
            data = {'student_id': student_id, 'count': 1}

        data['last_encoding'] = list(face_encoding) if face_encoding is not None else None
        cache.set(cache_key, data, timeout=60)
        return data['count'], is_replay

    # ── Head-turn liveness challenge ─────────────────────────────────────────
    @staticmethod
    def _challenge_payload(challenge):
        strict = getattr(settings, 'FACE_CHALLENGE_STRICT_DIRECTION', False)
        direction = challenge['direction'] if strict else 'any'
        if challenge.get('stage') == 'return':
            return {'type': 'look_back', 'direction': direction, 'message': 'Good! Now look back at the camera'}
        message = (
            f"Turn your head slightly to your {direction.upper()}"
            if strict else 'Turn your head slightly to the left or right'
        )
        return {'type': 'turn_head', 'direction': direction, 'message': message}

    @staticmethod
    def _issue_challenge(session_id, baseline_yaw):
        """Identity confirmed: ask the student to turn their head (a photo cannot)."""
        cache_key = FaceService._consensus_cache_key(session_id)
        data = cache.get(cache_key) or {}
        challenge = {
            'direction': random.choice(['left', 'right']),
            'baseline_yaw': float(baseline_yaw),
            'issued_at': time.time(),
            'stage': 'turn',   # 'turn' -> 'return' (look back at the camera) -> marked
            'misses': 0,
        }
        data['challenge'] = challenge
        cache.set(cache_key, data, timeout=60)
        return FaceService._challenge_payload(challenge)

    @staticmethod
    def _advance_challenge(session_id, yaw):
        """
        Returns (outcome, payload): outcome is 'passed', 'pending' or 'timeout'.
        Stage 'turn': needs a head-turn of FACE_CHALLENGE_YAW_DELTA from the baseline pose
        (in the requested direction when FACE_CHALLENGE_STRICT_DIRECTION is on).
        Stage 'return': the student looks back at the camera. Enrollment is a single frontal
        selfie, so the final mark is made on this frontal frame, which must also pass the
        normal strict match (the caller only reaches here through that match).
        Replayed identical frames keep the same pose and can never pass.
        """
        cache_key = FaceService._consensus_cache_key(session_id)
        data = cache.get(cache_key) or {}
        challenge = data.get('challenge')
        if not challenge:
            return 'timeout', None
        if time.time() - challenge['issued_at'] > getattr(settings, 'FACE_CHALLENGE_TIMEOUT_SECONDS', 10):
            return 'timeout', FaceService._challenge_payload(challenge)
        if yaw is None:
            return 'pending', FaceService._challenge_payload(challenge)  # blurred frame; try the next

        delta = float(yaw) - challenge['baseline_yaw']
        needed = getattr(settings, 'FACE_CHALLENGE_YAW_DELTA', 0.18)

        if challenge.get('stage') == 'return':
            if abs(delta) <= needed / 2:
                return 'passed', None
            return 'pending', FaceService._challenge_payload(challenge)

        if getattr(settings, 'FACE_CHALLENGE_STRICT_DIRECTION', False):
            # Raw camera frame: a turn to the student's own LEFT increases yaw.
            turned = delta >= needed if challenge['direction'] == 'left' else delta <= -needed
        else:
            turned = abs(delta) >= needed
        if turned:
            challenge['stage'] = 'return'
            challenge['misses'] = 0
            data['challenge'] = challenge
            cache.set(cache_key, data, timeout=60)
        return 'pending', FaceService._challenge_payload(challenge)

    @staticmethod
    def _tolerate_challenge_miss(session_id):
        """
        A turned head may briefly fail to match a frontal-only enrollment. Allow a couple of
        such frames during the turn instead of restarting. Returns the payload, or None when
        the allowance is used up (caller resets).
        """
        cache_key = FaceService._consensus_cache_key(session_id)
        data = cache.get(cache_key) or {}
        challenge = data.get('challenge')
        if not challenge:
            return None
        allowed = getattr(settings, 'FACE_CHALLENGE_MAX_MISSES', 2)
        if challenge.get('misses', 0) >= allowed:
            return None
        if time.time() - challenge['issued_at'] > getattr(settings, 'FACE_CHALLENGE_TIMEOUT_SECONDS', 10):
            return None
        challenge['misses'] = challenge.get('misses', 0) + 1
        data['challenge'] = challenge
        cache.set(cache_key, data, timeout=60)
        return FaceService._challenge_payload(challenge)

    @staticmethod
    def recognize_all_faces_in_frame(session, frame_bytes, tolerance=None):
        """
        Accurate single-face recognition with strict matching, liveness check,
        and multi-frame consensus before marking attendance.
        1. Detect all faces, then pick one face (prefer an unmarked student, else largest / centered).
        2. Strict Euclidean match against the FULL section roster with confidence floor
           and second-best margin gate; already-marked owners are reported, never re-attributed.
        3. Liveness check (fails closed) rejects photos and screen spoofs.
        4. Requires FACE_CONSENSUS_FRAMES consecutive, non-identical frames before marking.
        """
        if tolerance is None:
            tolerance = getattr(settings, 'FACE_RECOGNITION_TOLERANCE', 0.38)

        all_detected = detect_and_encode_all_faces(
            frame_bytes, downscale=0.42, fast=True
        )
        total_face_count = len(all_detected)
        if not all_detected:
            return {
                'success': True,
                'recognized': [],
                'face_count': 0,
            }

        # Decode frame once for liveness checks. If this fails, liveness fails closed below.
        try:
            img_rgb = _decode_image_to_rgb(frame_bytes)
            frame_h, frame_w = img_rgb.shape[:2]
        except Exception:
            img_rgb = None
            frame_w, frame_h = 640, 480

        def run_liveness(face_box):
            if img_rgb is None:
                return False, 'Liveness check failed: frame could not be decoded'
            is_live, _score, reason = check_face_liveness(img_rgb, face_box)
            return is_live, reason

        section = session.schedule.section
        subject = session.schedule.subject
        section_data = FaceService.get_section_student_encodings(section, subject=subject)
        students = section_data['students']
        section_matrix = section_data.get('matrix')
        if section_matrix is None and section_data.get('encodings'):
            section_matrix = np.array(section_data['encodings'], dtype=np.float32)

        marked_student_ids = set(
            session.records.exclude(status='absent').values_list('student_id', flat=True)
        )

        # Queue mode: prioritize faces that belong to students not yet marked present/late
        detected_faces = pick_face_for_next_attendance(
            all_detected,
            section_matrix,
            students,
            marked_student_ids,
            frame_w,
            frame_h,
            tolerance,
        )

        recognized_results = []
        challenge_enabled = getattr(settings, 'FACE_LIVENESS_CHALLENGE', True)
        consensus_state = cache.get(FaceService._consensus_cache_key(session.pk)) or {}
        active_challenge = consensus_state.get('challenge') if challenge_enabled else None
        challenged_student_id = consensus_state.get('student_id') if active_challenge else None

        def head_yaw(face_box):
            return estimate_head_yaw(img_rgb, face_box) if img_rgb is not None else None

        for face_item in detected_faces:
            face_encoding = face_item.get('encoding')
            box = face_item.get('box', {})

            best_match = None
            best_confidence = 0.0

            # During a head-turn challenge the face is angled, so the strict match may fail.
            # Identity was already confirmed on frontal frames; here the challenged student
            # must still be the CLOSEST enrolled face and within FACE_CHALLENGE_TOLERANCE.
            # (Only while turning: the final "look back" frame must pass the strict match.)
            if (
                challenged_student_id is not None
                and active_challenge.get('stage') != 'return'
                and section_matrix is not None and len(section_matrix) > 0 and face_encoding
            ):
                distances = np.linalg.norm(
                    section_matrix - np.asarray(face_encoding, dtype=np.float32), axis=1
                )
                closest = int(np.argmin(distances))
                if (
                    closest < len(students)
                    and students[closest].get('id') == challenged_student_id
                    and float(distances[closest]) <= getattr(settings, 'FACE_CHALLENGE_TOLERANCE', 0.5)
                ):
                    best_match = students[closest]
                    best_confidence = round(max(0.0, 1.0 - float(distances[closest])), 3)

            # Always match against the FULL roster (marked students included) so the margin
            # gate sees every enrolled face. Only afterwards decide if the student is already marked.
            # Matching only unmarked students could mark a look-alike classmate by mistake.
            if not best_match and section_matrix is not None and len(section_matrix) > 0 and face_encoding:
                is_match, best_idx, min_dist, confidence, margin = batch_compare_faces(
                    section_matrix, face_encoding, tolerance
                )
                if is_match and best_idx is not None and best_idx < len(students):
                    candidate = students[best_idx]
                    if candidate.get('id') in marked_student_ids:
                        recognized_results.append({
                            'student_id': candidate['id'],
                            'student_number': candidate['student_number'],
                            'name': candidate['name'],
                            'confidence': round(confidence * 100, 1),
                            'status': session.records.filter(
                                student_id=candidate['id']
                            ).exclude(status='absent').values_list('status', flat=True).first(),
                            'new_status': None,
                            'box': box,
                            'matched': False,
                            'verifying': False,
                            'already_marked': True,
                        })
                        FaceService._reset_consensus(session.pk)
                        continue
                    best_match = candidate
                    best_confidence = confidence

            if best_match:
                from accounts.models import Student
                student_obj = Student.objects.get(pk=best_match['id'])

                # Liveness is required for every new attendance mark; it fails closed.
                is_live, live_reason = run_liveness(box)
                if not is_live:
                    FaceService._reset_consensus(session.pk)
                    recognized_results.append({
                        'student_id': best_match['id'],
                        'student_number': best_match['student_number'],
                        'name': best_match['name'],
                        'confidence': round(best_confidence * 100, 1),
                        'status': None,
                        'new_status': None,
                        'box': box,
                        'matched': False,
                        'wrong_section': False,
                        'liveness_failed': True,
                        'message': live_reason,
                    })
                    continue

                is_replay = False
                challenge_payload = None
                consensus_reached = False  # True only when attendance may be marked now

                if challenged_student_id is not None and best_match['id'] == challenged_student_id:
                    outcome, challenge_payload = FaceService._advance_challenge(session.pk, head_yaw(box))
                    if outcome == 'timeout':
                        FaceService._reset_consensus(session.pk)
                        recognized_results.append({
                            'student_id': best_match['id'],
                            'student_number': best_match['student_number'],
                            'name': best_match['name'],
                            'confidence': round(best_confidence * 100, 1),
                            'status': None,
                            'new_status': None,
                            'box': box,
                            'matched': False,
                            'wrong_section': False,
                            'liveness_failed': True,
                            'message': 'Head turn not detected in time. Look at the camera to try again.',
                        })
                        continue
                    consensus_reached = outcome == 'passed'
                else:
                    streak, is_replay = FaceService._update_consensus(
                        session.pk, best_match['id'], face_encoding
                    )
                    required = FaceService._consensus_frames_required(best_confidence)
                    identity_confirmed = streak >= required and not is_replay
                    if identity_confirmed and challenge_enabled:
                        baseline = head_yaw(box)
                        if baseline is None:
                            # No landmarks -> cannot run the challenge -> fail closed.
                            FaceService._reset_consensus(session.pk)
                            recognized_results.append({
                                'student_id': best_match['id'],
                                'student_number': best_match['student_number'],
                                'name': best_match['name'],
                                'confidence': round(best_confidence * 100, 1),
                                'status': None,
                                'new_status': None,
                                'box': box,
                                'matched': False,
                                'wrong_section': False,
                                'liveness_failed': True,
                                'message': 'Could not read the face clearly. Face the camera directly.',
                            })
                            continue
                        challenge_payload = FaceService._issue_challenge(session.pk, baseline)
                    else:
                        consensus_reached = identity_confirmed

                record, is_new_mark = AttendanceService.mark_attendance(
                    session=session,
                    student=student_obj,
                    confidence=best_confidence
                ) if consensus_reached else (None, False)

                if consensus_reached:
                    FaceService._reset_consensus(session.pk)
                    challenge_payload = None

                recognized_results.append({
                    'student_id': best_match['id'],
                    'student_number': best_match['student_number'],
                    'name': best_match['name'],
                    'confidence': round(best_confidence * 100, 1),
                    'status': record.status if record else 'verifying',
                    'new_status': record.status if (is_new_mark and consensus_reached) else None,
                    'box': box,
                    'matched': consensus_reached,
                    'verifying': not consensus_reached,
                    'replay_suspected': is_replay,
                    'challenge': challenge_payload,
                })
            else:
                # Mid-turn, a frontal-only enrollment may briefly not match: keep the challenge
                # alive for a couple of frames instead of restarting the student's scan.
                if challenged_student_id is not None and face_encoding:
                    payload = FaceService._tolerate_challenge_miss(session.pk)
                    if payload is not None:
                        recognized_results.append({
                            'student_id': challenged_student_id,
                            'student_number': None,
                            'name': next((s['name'] for s in students if s.get('id') == challenged_student_id), ''),
                            'confidence': 0.0,
                            'status': 'verifying',
                            'new_status': None,
                            'box': box,
                            'matched': False,
                            'verifying': True,
                            'challenge': payload,
                        })
                        continue

                FaceService._reset_consensus(session.pk)

                is_live, live_reason = run_liveness(box)
                if not is_live:
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
                        'liveness_failed': True,
                        'message': live_reason,
                    })
                    continue

                global_data = FaceService.get_global_student_encodings()
                global_matrix = global_data.get('matrix')
                global_students = global_data.get('students', [])
                wrong_section_match = None
                wrong_section_conf = 0.0

                if global_matrix is not None and len(global_matrix) > 0 and face_encoding:
                    is_match_g, g_idx, dist_g, conf_g, _margin_g = batch_compare_faces(
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
            'face_count': total_face_count,
            'scanning_primary': len(detected_faces) == 1,
            'multiple_faces_detected': total_face_count > 1,
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
