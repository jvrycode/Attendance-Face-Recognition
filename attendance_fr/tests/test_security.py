"""
Security quick-win tests: login throttling/lockout, password policy,
health-check error hiding, and frame/image upload validation.
"""
import base64
from io import BytesIO
from unittest.mock import patch

from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from PIL import Image

from accounts.models import CustomUser
from accounts.validators import validate_image_upload
from attendance_fr.api.services.users import validate_password_strength
from face_app.utils import InvalidImageError, decode_frame


def _image_bytes(fmt='JPEG', size=(40, 40)):
    buf = BytesIO()
    Image.new('RGB', size, (120, 100, 90)).save(buf, format=fmt)
    return buf.getvalue()


def _data_url(raw, mime='image/jpeg'):
    return f'data:{mime};base64,' + base64.b64encode(raw).decode()


class LoginProtectionTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = CustomUser.objects.create_user(
            username='sec_teacher', role='teacher', password='StrongPassword123!'
        )
        self.client = Client()

    def tearDown(self):
        cache.clear()

    def _login(self, username='sec_teacher', password='StrongPassword123!'):
        return self.client.post('/api/token/', {'username': username, 'password': password},
                                content_type='application/json')

    @override_settings(LOGIN_MAX_FAILED_ATTEMPTS=5, LOGIN_LOCKOUT_MINUTES=15)
    def test_lockout_after_repeated_failures_blocks_even_correct_password(self):
        for _ in range(4):
            self.assertEqual(self._login(password='wrong').status_code, 401)
        locked = self._login(password='wrong')
        self.assertEqual(locked.status_code, 429)
        self.assertTrue(locked.json()['locked'])
        self.assertIn('Retry-After', locked.headers)

        # Correct password is still refused while locked
        self.assertEqual(self._login().status_code, 429)

    @override_settings(LOGIN_MAX_FAILED_ATTEMPTS=5)
    def test_successful_login_resets_failure_count(self):
        for _ in range(4):
            self._login(password='wrong')
        self.assertEqual(self._login().status_code, 200)
        # Counter was reset, so 4 more failures still don't lock
        for _ in range(4):
            self.assertEqual(self._login(password='wrong').status_code, 401)

    def test_login_is_rate_limited_per_ip(self):
        # Default 'login' rate is 10/min; different usernames avoid the lockout path
        statuses = [self._login(username=f'nobody{i}', password='x').status_code for i in range(11)]
        self.assertTrue(all(code == 401 for code in statuses[:10]))
        self.assertEqual(statuses[10], 429)


class PasswordPolicyTests(TestCase):
    def test_single_policy_rejects_weak_passwords(self):
        for weak in ('Pass@1', 'password', 'Password123', 'Secure@Pass', '12345678!Aa'[:6]):
            self.assertIsNotNone(validate_password_strength(weak), weak)

    def test_common_password_rejected_even_if_complex_shape(self):
        # Django's common-password list catches this; the character rules alone would not
        self.assertIsNotNone(validate_password_strength('P@ssw0rd'))

    def test_password_similar_to_username_rejected(self):
        user = CustomUser(username='juandelacruz', first_name='Juan', last_name='Delacruz')
        self.assertIsNotNone(validate_password_strength('Juandelacruz1!', user=user))

    def test_strong_password_accepted(self):
        self.assertIsNone(validate_password_strength('Blue-Harbor-2026!'))


class HealthCheckTests(TestCase):
    def test_health_ok(self):
        res = Client().get('/api/health/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['database'], 'connected')

    def test_health_failure_hides_error_details(self):
        with patch('attendance_fr.urls.connection.cursor',
                   side_effect=Exception('Access denied for user root@db.internal')):
            res = Client().get('/api/health/')
        self.assertEqual(res.status_code, 503)
        self.assertEqual(res.json()['database'], 'unavailable')
        self.assertNotIn('db.internal', res.content.decode())


class FrameValidationTests(TestCase):
    def test_valid_jpeg_png_webp_frames_accepted(self):
        for fmt, mime in (('JPEG', 'image/jpeg'), ('PNG', 'image/png'), ('WEBP', 'image/webp')):
            self.assertTrue(decode_frame(_data_url(_image_bytes(fmt), mime)))

    def test_invalid_base64_rejected(self):
        with self.assertRaises(InvalidImageError):
            decode_frame('data:image/jpeg;base64,not_base64!!')

    def test_non_image_rejected(self):
        with self.assertRaises(InvalidImageError):
            decode_frame(_data_url(b'hello, not an image'))

    def test_disallowed_format_rejected(self):
        with self.assertRaises(InvalidImageError):
            decode_frame(_data_url(_image_bytes('GIF'), 'image/gif'))

    @override_settings(FACE_MAX_FRAME_BYTES=1024)
    def test_oversized_frame_rejected(self):
        with self.assertRaises(InvalidImageError):
            decode_frame(_data_url(b'\xff' * 4096))

    @override_settings(FACE_MAX_FRAME_DIMENSION=100)
    def test_oversized_dimensions_rejected(self):
        with self.assertRaises(InvalidImageError):
            decode_frame(_data_url(_image_bytes('PNG', size=(200, 50)), 'image/png'))

    def test_recognize_endpoint_returns_400_for_bad_frame(self):
        from datetime import time
        from django.utils import timezone
        from accounts.models import Teacher
        from core.models import AttendanceSession, Schedule, Section

        cache.clear()
        teacher_u = CustomUser.objects.create_user(username='sec_t2', role='teacher', password='StrongPassword123!')
        teacher = Teacher.objects.create(user=teacher_u, employee_id='FAC-SEC-2')
        section = Section.objects.create(name='SEC-1', teacher=teacher)
        schedule = Schedule.objects.create(section=section, day_of_week='Mon',
                                           start_time=time(8, 0), end_time=time(9, 0), room='R1')
        session = AttendanceSession.objects.create(schedule=schedule, date=timezone.localdate(),
                                                   started_by=teacher, status='open')
        client = Client()
        client.force_login(teacher_u)
        with patch('attendance_fr.api.views.face_recognition.AttendanceService.validate_session_time_window',
                   return_value=None):
            res = client.post('/api/face/recognize/', {'session_id': session.pk, 'frame': 'not-a-frame'},
                              content_type='application/json')
        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.json()['success'])


class ImageUploadValidatorTests(TestCase):
    def test_valid_image_passes(self):
        validate_image_upload(SimpleUploadedFile('a.png', _image_bytes('PNG'), content_type='image/png'))

    def test_fake_image_rejected(self):
        with self.assertRaises(ValidationError):
            validate_image_upload(SimpleUploadedFile('a.jpg', b'<script>alert(1)</script>'))

    @override_settings(MAX_IMAGE_UPLOAD_BYTES=100)
    def test_large_image_rejected(self):
        with self.assertRaises(ValidationError):
            validate_image_upload(SimpleUploadedFile('a.jpg', _image_bytes('JPEG', (200, 200))))


class TokenRevocationTests(TestCase):
    """Logout really ends the session; refresh tokens are single-use."""

    def setUp(self):
        cache.clear()
        CustomUser.objects.create_user(username='rev_user', role='teacher', password='StrongPassword123!')
        self.client = Client()
        res = self.client.post('/api/token/', {'username': 'rev_user', 'password': 'StrongPassword123!'},
                               content_type='application/json')
        self.access, self.refresh = res.json()['access'], res.json()['refresh']

    def tearDown(self):
        cache.clear()

    def _me(self, access):
        return self.client.get('/api/auth/me/', HTTP_AUTHORIZATION=f'Bearer {access}')

    def _refresh(self, refresh):
        return self.client.post('/api/token/refresh/', {'refresh': refresh}, content_type='application/json')

    def test_logout_revokes_access_and_refresh(self):
        self.assertEqual(self._me(self.access).status_code, 200)
        res = self.client.post('/api/auth/logout/', {'refresh': self.refresh}, content_type='application/json',
                               HTTP_AUTHORIZATION=f'Bearer {self.access}')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['revoked'], 2)

        self.assertEqual(self._me(self.access).status_code, 401)
        self.assertEqual(self._refresh(self.refresh).status_code, 401)

    def test_revocation_survives_cache_loss(self):
        self.client.post('/api/auth/logout/', {'refresh': self.refresh}, content_type='application/json',
                         HTTP_AUTHORIZATION=f'Bearer {self.access}')
        cache.clear()  # e.g. another worker / restart: the database is the source of truth
        self.assertEqual(self._me(self.access).status_code, 401)

    def test_refresh_token_is_single_use(self):
        first = self._refresh(self.refresh)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(self._refresh(self.refresh).status_code, 401)  # replay rejected
        self.assertEqual(self._refresh(first.json()['refresh']).status_code, 200)  # rotated one works

    def test_logout_with_garbage_is_harmless(self):
        res = self.client.post('/api/auth/logout/', {'refresh': 'garbage'}, content_type='application/json',
                               HTTP_AUTHORIZATION='Bearer garbage')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['revoked'], 0)
        self.assertEqual(self._me(self.access).status_code, 200)
