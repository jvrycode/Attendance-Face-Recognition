"""
Accounts Feature Tests:
Tests user roles, password validation, and profile relationships.
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.contrib.auth.password_validation import validate_password
from accounts.models import Teacher, Student

User = get_user_model()


class AccountsFeatureTests(TestCase):
    def test_custom_user_roles(self):
        """Verify role choices and role boolean helper properties."""
        admin = User.objects.create_user(username='admin_u', role='admin', password='StrongPassword123!')
        teacher = User.objects.create_user(username='teacher_u', role='teacher', password='StrongPassword123!')
        student = User.objects.create_user(username='student_u', role='student', password='StrongPassword123!')

        self.assertTrue(admin.is_admin_role)
        self.assertFalse(admin.is_teacher_role)
        self.assertFalse(admin.is_student_role)

        self.assertTrue(teacher.is_teacher_role)
        self.assertTrue(student.is_student_role)

    def test_teacher_profile_creation(self):
        """Verify Teacher profile links one-to-one with CustomUser."""
        user = User.objects.create_user(
            username='prof_smith',
            first_name='John',
            last_name='Smith',
            role='teacher',
            password='StrongPassword123!'
        )
        teacher = Teacher.objects.create(
            user=user,
            employee_id='EMP-1001',
            department='Computer Science',
            specialization='Artificial Intelligence'
        )
        self.assertEqual(teacher.employee_id, 'EMP-1001')
        self.assertIn('John Smith', str(teacher))

    def test_student_profile_creation(self):
        """Verify Student profile links one-to-one with CustomUser."""
        user = User.objects.create_user(
            username='stud_doe',
            first_name='Jane',
            last_name='Doe',
            role='student',
            password='StrongPassword123!'
        )
        student = Student.objects.create(
            user=user,
            student_id='STU-2026-001',
            year_level=3,
            course='BS Computer Science'
        )
        self.assertEqual(student.student_id, 'STU-2026-001')
        self.assertFalse(student.is_face_enrolled)

    def test_password_validators_enforcement(self):
        """Verify production password validation rules (Fix 1)."""
        # Short password (< 8 chars) should fail
        with self.assertRaises(ValidationError):
            validate_password('short7')

        # Entirely numeric password should fail
        with self.assertRaises(ValidationError):
            validate_password('1234567890')

        # Strong password should pass without error
        try:
            validate_password('SecurePass2026!#')
        except ValidationError:
            self.fail("validate_password unexpectedly raised ValidationError for a strong password")
