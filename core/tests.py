"""
Core Feature Tests:
Tests academic structures, 1-to-many teacher sections,
schedule conflict validation, attendance session lifecycle,
dynamic late detection, and API health check.
"""
from datetime import time, timedelta
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone
from accounts.models import Teacher, Student
from core.models import Subject, Section, Schedule, AttendanceSession, AttendanceRecord, StudentSection
from core.services.schedule_service import ScheduleService
from core.services.attendance_service import AttendanceService

User = get_user_model()


class CoreFeatureTests(TestCase):
    def setUp(self):
        # Create users
        self.admin_user = User.objects.create_user(
            username='admin_boss', first_name='Admin', last_name='Boss',
            role='admin', password='StrongPassword123!'
        )
        self.teacher_user = User.objects.create_user(
            username='prof_albert', first_name='Albert', last_name='Einstein',
            role='teacher', password='StrongPassword123!'
        )
        self.teacher = Teacher.objects.create(
            user=self.teacher_user, employee_id='TCH-001', department='Physics'
        )

        self.student_user = User.objects.create_user(
            username='stud_marie', first_name='Marie', last_name='Curie',
            role='student', password='StrongPassword123!'
        )
        self.student = Student.objects.create(
            user=self.student_user, student_id='STU-2026-002', year_level=2
        )

        # Create Subject
        self.subject = Subject.objects.create(
            name='Data Structures & Algorithms',
            code='CS201',
            units=3
        )

        # Create Section
        self.section_a = Section.objects.create(
            name='BSCS-2A',
            subject=self.subject,
            teacher=self.teacher
        )

    def test_teacher_can_have_many_sections(self):
        """Verify 1 teacher to many sections relationship."""
        section_b = Section.objects.create(
            name='BSCS-2B',
            subject=self.subject,
            teacher=self.teacher
        )
        teacher_sections = self.teacher.sections.all()
        self.assertEqual(teacher_sections.count(), 2)
        self.assertIn(self.section_a, teacher_sections)
        self.assertIn(section_b, teacher_sections)

    def test_schedule_invalid_time_raises_error(self):
        """Verify end_time must be after start_time."""
        sched = Schedule(
            section=self.section_a,
            day_of_week='Mon',
            start_time=time(10, 0),
            end_time=time(9, 0),  # End time before start time
            room='Lab 1'
        )
        with self.assertRaises(ValidationError):
            sched.full_clean()

    def test_schedule_room_conflict_rejected(self):
        """Verify two sections cannot book the same room at overlapping times."""
        # Section A: Mon 08:00 - 10:00 @ Room 301
        Schedule.objects.create(
            section=self.section_a,
            day_of_week='Mon',
            start_time=time(8, 0),
            end_time=time(10, 0),
            room='Room 301'
        )

        # Section B: Mon 09:00 - 11:00 @ Room 301 (Overlaps 09:00-10:00)
        section_b = Section.objects.create(name='BSCS-2B', subject=self.subject)
        conflicting_sched = Schedule(
            section=section_b,
            day_of_week='Mon',
            start_time=time(9, 0),
            end_time=time(11, 0),
            room='Room 301'
        )

        with self.assertRaises(ValidationError) as ctx:
            conflicting_sched.full_clean()
        self.assertIn("Room conflict", str(ctx.exception))

    def test_schedule_teacher_conflict_rejected(self):
        """Verify teacher cannot be scheduled in two sections at overlapping times."""
        # Section A: Tue 13:00 - 15:00 with Teacher Einstein
        Schedule.objects.create(
            section=self.section_a,
            day_of_week='Tue',
            start_time=time(13, 0),
            end_time=time(15, 0),
            room='Room 101'
        )

        # Section B: Tue 14:00 - 16:00 with SAME Teacher Einstein in different room
        section_b = Section.objects.create(
            name='BSCS-2B', subject=self.subject, teacher=self.teacher
        )
        conflicting_sched = Schedule(
            section=section_b,
            day_of_week='Tue',
            start_time=time(14, 0),
            end_time=time(16, 0),
            room='Room 202'
        )

        with self.assertRaises(ValidationError) as ctx:
            conflicting_sched.full_clean()
        self.assertIn("Teacher conflict", str(ctx.exception))

    def test_schedule_non_overlapping_allowed(self):
        """Verify non-overlapping schedules save successfully."""
        sched1 = Schedule.objects.create(
            section=self.section_a,
            day_of_week='Wed',
            start_time=time(8, 0),
            end_time=time(10, 0),
            room='Room 101'
        )
        sched2 = Schedule.objects.create(
            section=self.section_a,
            day_of_week='Wed',
            start_time=time(10, 0),
            end_time=time(12, 0),
            room='Room 101'
        )
        self.assertIsNotNone(sched1.pk)
        self.assertIsNotNone(sched2.pk)

    def test_dynamic_late_status_calculation(self):
        """Verify dynamic late status: present within threshold, late after threshold."""
        schedule = Schedule.objects.create(
            section=self.section_a,
            day_of_week='Thu',
            start_time=time(8, 0),
            end_time=time(10, 0),
            room='Room 404'
        )
        session_date = timezone.localdate()
        session = AttendanceSession.objects.create(
            schedule=schedule,
            date=session_date,
            started_by=self.teacher
        )

        start_dt = timezone.make_aware(
            timezone.datetime.combine(session_date, time(8, 0))
        )

        # Scan at 08:10 (10 mins in, threshold is 15 mins) -> PRESENT
        on_time = start_dt + timedelta(minutes=10)
        status_on_time = AttendanceService.calculate_attendance_status(session, scan_time=on_time)
        self.assertEqual(status_on_time, 'present')

        # Scan at 08:25 (25 mins in, threshold is 15 mins) -> LATE
        late_time = start_dt + timedelta(minutes=25)
        status_late = AttendanceService.calculate_attendance_status(session, scan_time=late_time)
        self.assertEqual(status_late, 'late')

    def test_attendance_service_mark_attendance(self):
        """Verify AttendanceService creates or updates record and avoids duplicate mark."""
        schedule = Schedule.objects.create(
            section=self.section_a,
            day_of_week='Fri',
            start_time=time(9, 0),
            end_time=time(11, 0),
            room='Room 501'
        )
        session = AttendanceSession.objects.create(
            schedule=schedule,
            date=timezone.localdate(),
            started_by=self.teacher
        )
        StudentSection.objects.create(student=self.student, section=self.section_a)

        # Mark attendance first time
        record, is_new = AttendanceService.mark_attendance(session, self.student, confidence=0.95)
        self.assertTrue(is_new)
        self.assertIn(record.status, ['present', 'late'])

        # Mark second time (e.g. repeated face scan)
        record2, is_new2 = AttendanceService.mark_attendance(session, self.student, confidence=0.98)
        self.assertFalse(is_new2)
        self.assertEqual(record.pk, record2.pk)

    def test_health_check_api_endpoint(self):
        """Verify /api/health/ returns 200 and healthy status."""
        client = Client()
        response = client.get('/api/health/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get('status'), 'healthy')
        self.assertEqual(data.get('database'), 'connected')

    def test_jwt_token_and_auth_me_api(self):
        """Verify POST /api/token/ and GET /api/auth/me/ with Bearer token."""
        client = Client()
        # Request JWT tokens
        res = client.post(
            '/api/token/',
            {'username': 'prof_albert', 'password': 'StrongPassword123!'},
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn('access', data)
        self.assertIn('refresh', data)

        access_token = data['access']

        # Request protected user profile endpoint with Bearer token
        res_me = client.get(
            '/api/auth/me/',
            HTTP_AUTHORIZATION=f'Bearer {access_token}'
        )
        self.assertEqual(res_me.status_code, 200)
        user_data = res_me.json()
        self.assertEqual(user_data.get('username'), 'prof_albert')
        self.assertEqual(user_data.get('role'), 'teacher')
        self.assertIn('teacher_profile', user_data)

    def test_dynamic_schedule_display_formatting(self):
        """Verify dynamic schedule display handles M-TH grouping and individual days."""
        # Empty schedules
        self.assertEqual(self.section_a.schedule_display, "No schedule set")

        # Single day
        Schedule.objects.create(
            section=self.section_a, day_of_week='Mon',
            start_time=time(8, 0), end_time=time(9, 30), room='Room 101'
        )
        self.assertEqual(self.section_a.schedule_display, "M 8:00–9:30 AM @ Room 101")

        # Additional day (Thu) at same time and room
        Schedule.objects.create(
            section=self.section_a, day_of_week='Thu',
            start_time=time(8, 0), end_time=time(9, 30), room='Room 101'
        )
        self.assertEqual(self.section_a.schedule_display, "M 8:00–9:30 AM @ Room 101, TH 8:00–9:30 AM @ Room 101")

    def test_dynamic_student_registration_and_section_enrollment(self):
        """Verify registering a new student assigns them to section and redirects to face enrollment."""
        client = Client()
        client.force_login(self.admin_user)

        res = client.post('/accounts/students/register/', {
            'student_id': '2024-99999',
            'first_name': 'Nikola',
            'last_name': 'Tesla',
            'email': 'tesla@attendfr.edu',
            'course': 'BSIT',
            'year_level': 1,
            'section': self.section_a.pk,
            'password': 'secretpassword123',
        })

        new_student = Student.objects.get(student_id='2024-99999')
        self.assertEqual(new_student.user.first_name, 'Nikola')
        self.assertEqual(new_student.user.last_name, 'Tesla')
        self.assertEqual(new_student.user.role, 'student')

        # Check section enrollment
        self.assertTrue(
            StudentSection.objects.filter(student=new_student, section=self.section_a).exists()
        )

        # Check redirect directly to face enrollment
        expected_redirect = f"/face/enroll/?student_id={new_student.pk}"
        self.assertRedirects(res, expected_redirect)

