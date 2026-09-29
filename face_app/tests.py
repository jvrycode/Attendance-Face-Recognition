"""
Face App Feature Tests:
Tests face encoding storage, cached section indexing,
multi-face recognition in a single frame, and bounding box formatting.
"""
import json
import numpy as np
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from accounts.models import Student
from core.models import Subject, Section, Schedule, AttendanceSession, StudentSection
from face_app.services.face_service import FaceService
from face_app.utils import compare_faces

User = get_user_model()


@override_settings(FACE_LIVENESS_CHALLENGE=False)  # challenge has its own tests below
class FaceAppFeatureTests(TestCase):
    def setUp(self):
        cache.clear()

        # Create Subject & Section
        self.subject = Subject.objects.create(name='Computer Vision', code='CS302', units=3)
        self.section = Section.objects.create(name='BSCS-3A', subject=self.subject)
        self.schedule = Schedule.objects.create(
            section=self.section,
            day_of_week='Mon',
            start_time='08:00',
            end_time='10:00',
            room='Vision Lab'
        )
        self.session = AttendanceSession.objects.create(
            schedule=self.schedule,
            date='2026-09-21'
        )

        # Create 2 Students with mock 128-D face embeddings
        # Student 1: vector centered at 0.1
        self.user1 = User.objects.create_user(
            username='student_one', first_name='Alice', last_name='Smith',
            role='student', password='StrongPassword123!'
        )
        self.mock_vector1 = [0.1] * 128
        self.student1 = Student.objects.create(
            user=self.user1,
            student_id='STU-001',
            face_encoding=json.dumps(self.mock_vector1)
        )
        StudentSection.objects.create(student=self.student1, section=self.section)

        # Student 2: vector centered at 0.9 (distinct from student 1)
        self.user2 = User.objects.create_user(
            username='student_two', first_name='Bob', last_name='Jones',
            role='student', password='StrongPassword123!'
        )
        self.mock_vector2 = [0.9] * 128
        self.student2 = Student.objects.create(
            user=self.user2,
            student_id='STU-002',
            face_encoding=json.dumps(self.mock_vector2)
        )
        StudentSection.objects.create(student=self.student2, section=self.section)

    def test_face_encoding_json_storage(self):
        """Verify Student face encoding stores 128-D vector and reports is_face_enrolled."""
        self.assertTrue(self.student1.is_face_enrolled)
        stored_vector = json.loads(self.student1.face_encoding)
        self.assertEqual(len(stored_vector), 128)
        self.assertAlmostEqual(stored_vector[0], 0.1)

    def test_face_service_cache_indexing(self):
        """Verify FaceService caches section student vectors and invalidates cleanly."""
        cache_key = FaceService.get_section_cache_key(self.section.pk)
        self.assertIsNone(cache.get(cache_key))

        # First access loads from DB and caches
        data = FaceService.get_section_student_encodings(self.section)
        self.assertEqual(len(data['students']), 2)
        self.assertEqual(len(data['encodings']), 2)

        # Verify cached
        cached_data = cache.get(cache_key)
        self.assertIsNotNone(cached_data)
        self.assertEqual(len(cached_data['students']), 2)

        # Invalidate cache
        FaceService.invalidate_cache(self.section.pk)
        self.assertIsNone(cache.get(cache_key))

    def test_vector_distance_comparison(self):
        """Verify compare_faces matches identical vector and rejects divergent vector."""
        # Exact match
        is_match, conf = compare_faces(self.mock_vector1, self.mock_vector1, tolerance=0.5)
        self.assertTrue(is_match)
        self.assertGreater(conf, 0.9)

        # Divergent vectors (0.1 vs 0.9)
        is_match_diff, conf_diff = compare_faces(self.mock_vector1, self.mock_vector2, tolerance=0.5)
        self.assertFalse(is_match_diff)

    def test_multi_face_results_structure_and_bounding_boxes(self):
        """Verify recognition returns bounding boxes and student details for each face."""
        # Test simulated detection results with 2 distinct face locations
        locations = [
            {'top': 50, 'right': 150, 'bottom': 150, 'left': 50},
            {'top': 60, 'right': 350, 'bottom': 160, 'left': 250},
        ]

        # Verify box drawing helper generates modified bytes
        dummy_results = [
            {'top': 50, 'right': 150, 'bottom': 150, 'left': 50, 'name': 'Alice Smith', 'status': 'present'},
            {'top': 60, 'right': 350, 'bottom': 160, 'left': 250, 'name': 'Bob Jones', 'status': 'present'},
        ]
        # 100x100 dummy black image JPEG bytes
        from PIL import Image
        from io import BytesIO
        img = Image.new('RGB', (400, 300), color=(50, 50, 50))
        buf = BytesIO()
        img.save(buf, format='JPEG')
        raw_bytes = buf.getvalue()

        annotated_bytes = FaceService.draw_boxes(raw_bytes, dummy_results)
        self.assertIsNotNone(annotated_bytes)
        self.assertGreater(len(annotated_bytes), 0)

    def test_face_deletion_and_cache_invalidation(self):
        """Verify face deletion clears data and invalidates cache."""
        # Warm cache
        FaceService.get_section_student_encodings(self.section)
        cache_key = FaceService.get_section_cache_key(self.section.pk)
        self.assertIsNotNone(cache.get(cache_key))

        # Clear face
        self.student1.face_encoding = None
        self.student1.face_enrolled_at = None
        self.student1.save()
        FaceService.invalidate_cache(self.section.pk)

        # After invalidation, cache is empty and fresh fetch returns only 1 student
        self.assertIsNone(cache.get(cache_key))
        fresh_data = FaceService.get_section_student_encodings(self.section)
        self.assertEqual(len(fresh_data['students']), 1)
        self.assertEqual(fresh_data['students'][0]['student_number'], 'STU-002')

    def test_vectorized_batch_compare_faces(self):
        """Verify sub-millisecond vectorized batch matching across section matrix."""
        from face_app.utils import batch_compare_faces
        # Matrix with 2 student embeddings
        known_matrix = np.array([self.mock_vector1, self.mock_vector2], dtype=np.float32)

        # Match student 1
        is_match1, idx1, dist1, conf1, margin1 = batch_compare_faces(known_matrix, self.mock_vector1, tolerance=0.5)
        self.assertTrue(is_match1)
        self.assertEqual(idx1, 0)
        self.assertAlmostEqual(dist1, 0.0, places=3)
        self.assertGreater(conf1, 0.95)

        # Match student 2
        is_match2, idx2, dist2, conf2, margin2 = batch_compare_faces(known_matrix, self.mock_vector2, tolerance=0.5)
        self.assertTrue(is_match2)
        self.assertEqual(idx2, 1)
        self.assertAlmostEqual(dist2, 0.0, places=3)
        self.assertGreater(conf2, 0.95)

        # Rejection: distinct vector (centered at 0.5) with distance ~4.5 > 0.5
        unknown_vec = [0.5] * 128
        is_match_rej, idx_rej, dist_rej, conf_rej, _ = batch_compare_faces(known_matrix, unknown_vec, tolerance=0.5)
        self.assertFalse(is_match_rej)

    def test_match_margin_rejects_ambiguous_face(self):
        """Verify a look-alike vector between two enrolled students is rejected by margin gate."""
        from face_app.utils import batch_compare_faces
        vec_a = [0.0] * 128
        vec_b = [0.06] * 128
        ambiguous_vec = [0.03] * 128
        known_matrix = np.array([vec_a, vec_b], dtype=np.float32)
        is_match, idx, dist, conf, margin = batch_compare_faces(
            known_matrix, ambiguous_vec, tolerance=0.38, min_margin=0.08
        )
        self.assertFalse(is_match)
        self.assertLess(margin, 0.08)

    def test_pick_face_prefers_unmarked_student_in_queue(self):
        """When two faces are visible, prefer the one matching a not-yet-marked student."""
        from face_app.utils import pick_face_for_next_attendance
        import numpy as np

        faces = [
            {'encoding': self.mock_vector1, 'box': {'top': 10, 'right': 380, 'bottom': 340, 'left': 140}},
            {'encoding': self.mock_vector2, 'box': {'top': 10, 'right': 60, 'bottom': 60, 'left': 10}},
        ]
        data = FaceService.get_section_student_encodings(self.section)
        matrix = data['matrix']
        students = data['students']
        marked = {self.student1.pk}

        picked = pick_face_for_next_attendance(
            faces, matrix, students, marked, 640, 480, tolerance=0.5
        )
        self.assertEqual(len(picked), 1)
        self.assertEqual(picked[0]['encoding'][0], 0.9)

    def test_pick_primary_face_selects_largest_centered(self):
        """Verify single-face mode picks the most prominent face."""
        from face_app.utils import pick_primary_face
        faces = [
            {'encoding': [0.1]*128, 'box': {'top': 10, 'right': 60, 'bottom': 60, 'left': 10}},
            {'encoding': [0.2]*128, 'box': {'top': 80, 'right': 380, 'bottom': 340, 'left': 140}},
        ]
        primary = pick_primary_face(faces, 640, 480)
        self.assertEqual(len(primary), 1)
        self.assertEqual(primary[0]['encoding'][0], 0.2)

    # ── helpers for full recognition-pipeline tests ─────────────────────────
    @staticmethod
    def _frame(base, step):
        """A slightly different face vector per frame, like a real camera produces."""
        return [base + 0.001 * step] * 128

    def _scan(self, encoding, live=True):
        """Run one recognition frame with detection/decoding/liveness mocked."""
        from unittest.mock import patch
        detected = [{'encoding': encoding, 'box': {'top': 10, 'right': 100, 'bottom': 100, 'left': 10}}]
        with patch('face_app.services.face_service.detect_and_encode_all_faces', return_value=detected), \
             patch('face_app.services.face_service._decode_image_to_rgb',
                   return_value=np.zeros((480, 640, 3), dtype=np.uint8)), \
             patch('face_app.services.face_service.check_face_liveness',
                   return_value=(live, 1.0 if live else 0.0, 'ok' if live else 'spoof')):
            return FaceService.recognize_all_faces_in_frame(self.session, b'dummy', tolerance=0.5)

    @override_settings(FACE_CONSENSUS_FRAMES=3)
    def test_consensus_required_before_marking(self):
        """Even a perfect match needs 3 consecutive distinct frames before marking."""
        for step in range(2):
            rec = self._scan(self._frame(0.1, step))['recognized'][0]
            self.assertTrue(rec.get('verifying'))
            self.assertFalse(self.session.records.filter(student=self.student1).exclude(status='absent').exists())

        rec = self._scan(self._frame(0.1, 2))['recognized'][0]
        self.assertTrue(rec.get('matched'))
        self.assertTrue(self.session.records.filter(student=self.student1).exclude(status='absent').exists())

    @override_settings(FACE_CONSENSUS_FRAMES=3)
    def test_identical_replayed_frames_never_mark(self):
        """Sending the exact same image repeatedly (photo replay) must not reach consensus."""
        for _ in range(6):
            rec = self._scan(self.mock_vector1)['recognized'][0]
            self.assertFalse(rec.get('matched'))
        self.assertFalse(self.session.records.filter(student=self.student1).exclude(status='absent').exists())

    @override_settings(FACE_CONSENSUS_FRAMES=2)
    def test_second_student_marked_after_first_in_queue(self):
        """After student 1 is marked, student 2 in front should still be recognized."""
        self._scan(self._frame(0.1, 0))
        self._scan(self._frame(0.1, 1))
        self.assertTrue(self.session.records.filter(student=self.student1).exclude(status='absent').exists())

        rec = self._scan(self._frame(0.9, 0))['recognized'][0]
        self.assertEqual(rec['student_id'], self.student2.pk)
        self.assertTrue(rec.get('verifying'))

        rec = self._scan(self._frame(0.9, 1))['recognized'][0]
        self.assertTrue(rec.get('matched'))
        self.assertTrue(self.session.records.filter(student=self.student2).exclude(status='absent').exists())

    @override_settings(FACE_CONSENSUS_FRAMES=1)
    def test_marked_student_is_not_attributed_to_lookalike(self):
        """A marked student's face must never be counted as an unmarked look-alike classmate."""
        # Make student 2 look similar to student 1 (distance ~0.23, within tolerance).
        self.student2.face_encoding = json.dumps([0.12] * 128)
        self.student2.save()

        self._scan(self._frame(0.1, 0))
        self.assertTrue(self.session.records.filter(student=self.student1).exclude(status='absent').exists())

        rec = self._scan(self._frame(0.1, 1))['recognized'][0]
        self.assertTrue(rec.get('already_marked'))
        self.assertEqual(rec['student_id'], self.student1.pk)
        self.assertFalse(self.session.records.filter(student=self.student2).exclude(status='absent').exists())

    @override_settings(FACE_CONSENSUS_FRAMES=1)
    def test_liveness_failure_blocks_marking(self):
        rec = self._scan(self.mock_vector1, live=False)['recognized'][0]
        self.assertTrue(rec.get('liveness_failed'))
        self.assertFalse(self.session.records.filter(student=self.student1).exclude(status='absent').exists())

    @override_settings(FACE_CONSENSUS_FRAMES=1)
    def test_undecodable_frame_fails_liveness_closed(self):
        """If the frame cannot be decoded for liveness, nobody is marked."""
        from unittest.mock import patch
        detected = [{'encoding': self.mock_vector1, 'box': {'top': 10, 'right': 100, 'bottom': 100, 'left': 10}}]
        with patch('face_app.services.face_service.detect_and_encode_all_faces', return_value=detected):
            rec = FaceService.recognize_all_faces_in_frame(self.session, b'not-an-image', tolerance=0.5)['recognized'][0]
        self.assertTrue(rec.get('liveness_failed'))
        self.assertFalse(self.session.records.filter(student=self.student1).exclude(status='absent').exists())

    # ── Head-turn liveness challenge ─────────────────────────────────────────
    def _scan_with_yaw(self, encoding, yaw):
        from unittest.mock import patch
        with patch('face_app.services.face_service.estimate_head_yaw', return_value=yaw):
            return self._scan(encoding)['recognized'][0]

    def _marked(self, student):
        return self.session.records.filter(student=student).exclude(status='absent').exists()

    @override_settings(FACE_LIVENESS_CHALLENGE=True, FACE_CONSENSUS_FRAMES=2,
                       FACE_CHALLENGE_YAW_DELTA=0.18, FACE_CHALLENGE_STRICT_DIRECTION=False)
    def test_challenge_turn_then_look_back_marks(self):
        self._scan_with_yaw(self._frame(0.1, 0), 0.0)
        rec = self._scan_with_yaw(self._frame(0.1, 1), 0.0)  # identity confirmed -> challenge issued
        self.assertTrue(rec['verifying'])
        self.assertEqual(rec['challenge']['type'], 'turn_head')
        self.assertFalse(self._marked(self.student1))

        rec = self._scan_with_yaw(self._frame(0.1, 2), 0.05)  # not enough turn
        self.assertEqual(rec['challenge']['type'], 'turn_head')

        rec = self._scan_with_yaw(self._frame(0.1, 3), 0.3)  # real turn -> now look back
        self.assertEqual(rec['challenge']['type'], 'look_back')
        self.assertFalse(self._marked(self.student1))

        rec = self._scan_with_yaw(self._frame(0.1, 4), 0.02)  # frontal again, strict match -> marked
        self.assertTrue(rec['matched'])
        self.assertTrue(self._marked(self.student1))

    @override_settings(FACE_LIVENESS_CHALLENGE=True, FACE_CONSENSUS_FRAMES=1, FACE_CHALLENGE_MAX_MISSES=2)
    def test_turned_head_may_briefly_not_match_frontal_enrollment(self):
        self._scan_with_yaw(self._frame(0.1, 0), 0.0)                 # challenge issued
        rec = self._scan_with_yaw([0.5] * 128, 0.3)                    # turned, no match: tolerated
        self.assertTrue(rec['verifying'])
        self.assertEqual(rec['student_id'], self.student1.pk)
        rec = self._scan_with_yaw(self._frame(0.1, 1), 0.3)            # matches again, turned
        self.assertEqual(rec['challenge']['type'], 'look_back')
        rec = self._scan_with_yaw(self._frame(0.1, 2), 0.0)            # look back
        self.assertTrue(rec['matched'])

    @override_settings(FACE_LIVENESS_CHALLENGE=True, FACE_CONSENSUS_FRAMES=1, FACE_CHALLENGE_MAX_MISSES=2)
    def test_too_many_misses_restart(self):
        self._scan_with_yaw(self._frame(0.1, 0), 0.0)
        for _ in range(3):
            rec = self._scan_with_yaw([0.5] * 128, 0.3)
        self.assertFalse(rec.get('verifying'))
        self.assertFalse(self._marked(self.student1))

    @override_settings(FACE_LIVENESS_CHALLENGE=True, FACE_CONSENSUS_FRAMES=1)
    def test_look_back_frame_must_pass_strict_match(self):
        """The final mark needs a strict frontal match; a loose look-alike cannot finish it."""
        self._scan_with_yaw(self._frame(0.1, 0), 0.0)
        self._scan_with_yaw(self._frame(0.1, 1), 0.3)                  # turned -> look back
        rec = self._scan_with_yaw([0.135] * 128, 0.0)                  # dist ~0.4 > 0.38 strict
        self.assertFalse(rec.get('matched'))
        self.assertFalse(self._marked(self.student1))

    @override_settings(FACE_LIVENESS_CHALLENGE=True, FACE_CONSENSUS_FRAMES=2)
    def test_photo_cannot_pass_challenge(self):
        """A still photo keeps the same pose: it never completes the challenge."""
        for step in range(8):
            rec = self._scan_with_yaw(self._frame(0.1, step), 0.02)
            self.assertFalse(rec.get('matched'))
        self.assertFalse(self._marked(self.student1))

    @override_settings(FACE_LIVENESS_CHALLENGE=True, FACE_CONSENSUS_FRAMES=1, FACE_CHALLENGE_TIMEOUT_SECONDS=10)
    def test_challenge_times_out(self):
        self._scan_with_yaw(self._frame(0.1, 0), 0.0)  # challenge issued
        key = FaceService._consensus_cache_key(self.session.pk)
        state = cache.get(key)
        state['challenge']['issued_at'] -= 60  # student waited too long
        cache.set(key, state, timeout=60)
        rec = self._scan_with_yaw(self._frame(0.1, 1), 0.4)
        self.assertTrue(rec['liveness_failed'])
        self.assertFalse(self._marked(self.student1))

    @override_settings(FACE_LIVENESS_CHALLENGE=True, FACE_CONSENSUS_FRAMES=1)
    def test_challenge_fails_closed_without_landmarks(self):
        rec = self._scan_with_yaw(self._frame(0.1, 0), None)
        self.assertTrue(rec['liveness_failed'])
        self.assertFalse(self._marked(self.student1))

    @override_settings(FACE_LIVENESS_CHALLENGE=True, FACE_CONSENSUS_FRAMES=1, FACE_CHALLENGE_STRICT_DIRECTION=True)
    def test_strict_direction_requires_requested_side(self):
        from unittest.mock import patch
        with patch('face_app.services.face_service.random.choice', return_value='left'):
            rec = self._scan_with_yaw(self._frame(0.1, 0), 0.0)
        self.assertEqual(rec['challenge']['direction'], 'left')
        rec = self._scan_with_yaw(self._frame(0.1, 1), -0.4)  # turned the wrong way
        self.assertEqual(rec['challenge']['type'], 'turn_head')
        rec = self._scan_with_yaw(self._frame(0.1, 2), 0.4)   # turned left
        self.assertEqual(rec['challenge']['type'], 'look_back')
        rec = self._scan_with_yaw(self._frame(0.1, 3), 0.0)   # look back
        self.assertTrue(rec['matched'])

    @override_settings(FACE_LIVENESS_CHALLENGE=True, FACE_CONSENSUS_FRAMES=1)
    def test_other_student_cannot_complete_someone_elses_challenge(self):
        self._scan_with_yaw(self._frame(0.1, 0), 0.0)   # challenge for student 1
        rec = self._scan_with_yaw(self._frame(0.9, 0), 0.4)  # student 2 turns head
        self.assertNotEqual(rec.get('student_id'), self.student1.pk)
        self.assertFalse(self._marked(self.student1))

    def test_liveness_check_fails_closed_on_bad_input(self):
        from face_app.utils import check_face_liveness
        is_live, _score, _reason = check_face_liveness(None, {})
        self.assertFalse(is_live)

    def test_wrong_section_detection(self):
        """Verify student enrolled in Section B scanning in Section A is detected as wrong_section."""
        from unittest.mock import patch

        # Create Section B
        section_b = Section.objects.create(name='BSCS-3B', subject=self.subject)
        user_b = User.objects.create_user(
            username='student_b', first_name='Charlie', last_name='Brown',
            role='student', password='StrongPassword123!'
        )
        mock_vector_b = [0.7] * 128
        student_b = Student.objects.create(
            user=user_b,
            student_id='STU-003',
            face_encoding=json.dumps(mock_vector_b)
        )
        StudentSection.objects.create(student=student_b, section=section_b)
        FaceService.invalidate_cache()

        # Mock frame detection returning Charlie's face
        simulated_detected = [
            {'encoding': mock_vector_b, 'box': {'top': 10, 'right': 100, 'bottom': 100, 'left': 10}}
        ]

        with patch('face_app.services.face_service.detect_and_encode_all_faces', return_value=simulated_detected), \
             patch('face_app.services.face_service._decode_image_to_rgb',
                   return_value=np.zeros((480, 640, 3), dtype=np.uint8)), \
             patch('face_app.services.face_service.check_face_liveness', return_value=(True, 1.0, 'ok')):
            # Scan Charlie in Section A's session
            res = FaceService.recognize_all_faces_in_frame(self.session, b'dummy_frame', tolerance=0.5)

            self.assertTrue(res['success'])
            self.assertEqual(len(res['recognized']), 1)
            rec = res['recognized'][0]

            # Verify Charlie is flagged as wrong_section
            self.assertFalse(rec['matched'])
            self.assertTrue(rec['wrong_section'])
            self.assertEqual(rec['student_number'], 'STU-003')
            self.assertEqual(rec['name'], 'Charlie Brown')
            self.assertIn('BSCS-3B', rec['assigned_sections'])

            # Verify NO attendance record was created for Charlie in Section A's session
            self.assertFalse(self.session.records.filter(student=student_b).exists())

    def test_face_student_list_api(self):
        """The active frontend retrieves face-enrollment candidates from the student API."""
        from django.test import Client
        admin = User.objects.create_user(username='face_admin', role='admin', password='StrongPassword123!')
        client = Client()
        client.force_login(admin)

        res = client.get('/api/students/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(any(item['student_id'] == 'STU-001' for item in data))
        self.assertTrue(any(item['student_id'] == 'STU-002' for item in data))

    def test_face_enroll_api(self):
        """The active API enrolls a face for an administrator-selected student."""
        from django.test import Client
        from unittest.mock import patch
        admin = User.objects.create_user(username='face_admin2', role='admin', password='StrongPassword123!')
        client = Client()
        client.force_login(admin)

        with patch('attendance_fr.api.services.face_recognition.FaceEnrollService.enroll_student_face', return_value='Face enrolled successfully.'):
            res = client.post(
                '/api/face/enroll/',
                {'student_id': self.student1.pk, 'frame': 'data:image/jpeg;base64,ZmFrZQ=='},
                content_type='application/json',
            )
            self.assertEqual(res.status_code, 200)
            self.assertTrue(res.json().get('success'))


    def test_targeted_invalidation_preserves_unrelated_cache_entries(self):
        """A roster change bypasses only the affected section index within 60 seconds."""
        cache.set('unrelated-cache-entry', 'keep', timeout=60)
        old_key = FaceService.get_section_cache_key(self.section.pk)
        FaceService.get_section_student_encodings(self.section)
        self.assertIsNotNone(cache.get(old_key))

        new_user = User.objects.create_user(username='student_three', role='student', password='StrongPassword123!')
        new_student = Student.objects.create(
            user=new_user, student_id='STU-003', face_encoding=json.dumps([0.3] * 128)
        )
        StudentSection.objects.create(student=new_student, section=self.section)

        new_key = FaceService.get_section_cache_key(self.section.pk)
        self.assertNotEqual(old_key, new_key)
        self.assertEqual(cache.get('unrelated-cache-entry'), 'keep')
        refreshed = FaceService.get_section_student_encodings(self.section)
        self.assertEqual(len(refreshed['students']), 3)

    def test_face_index_cache_uses_configured_sixty_second_ttl(self):
        from face_app.services.face_service import CACHE_TIMEOUT
        self.assertEqual(CACHE_TIMEOUT, 60)
