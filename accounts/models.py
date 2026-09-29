from django.db import models
from django.contrib.auth.models import AbstractUser

from accounts.validators import validate_image_upload
from attendance_fr.storage import get_face_storage


class CustomUser(AbstractUser):
    """Extended User model with role-based access."""
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('teacher', 'Teacher'),
        ('student', 'Student'),
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='student')
    profile_image = models.ImageField(
        upload_to='profiles/', blank=True, null=True, validators=[validate_image_upload]
    )
    phone = models.CharField(max_length=20, blank=True)

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"

    @property
    def is_admin_role(self):
        return self.role == 'admin'

    @property
    def is_teacher_role(self):
        return self.role == 'teacher'

    @property
    def is_student_role(self):
        return self.role == 'student'

    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        indexes = [
            models.Index(fields=['role'], name='user_role_idx'),
            models.Index(fields=['last_name', 'first_name'], name='user_name_idx'),
        ]


class Teacher(models.Model):
    """Teacher profile linked to CustomUser."""
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='teacher_profile')
    employee_id = models.CharField(max_length=20, unique=True)
    department = models.CharField(max_length=100, blank=True)
    specialization = models.CharField(max_length=150, blank=True)
    
    # Additional comprehensive fields
    title = models.CharField(max_length=50, blank=True, default='', help_text='Academic title (e.g., Prof., Dr., Engr.)')
    date_hired = models.DateField(null=True, blank=True, help_text='Date when faculty member was hired')
    employment_status = models.CharField(max_length=50, blank=True, default='Regular', help_text='Employment status (e.g., Regular, Part-time, Contractual)')
    position = models.CharField(max_length=100, blank=True, default='', help_text='Position/rank (e.g., Assistant Professor, Instructor)')
    contact_number = models.CharField(max_length=30, blank=True, default='')
    office_location = models.CharField(max_length=150, blank=True, default='')
    consultation_hours = models.TextField(blank=True, default='', help_text='Available consultation schedule')
    education_background = models.TextField(blank=True, default='', help_text='Highest educational attainment and degrees')
    certifications = models.TextField(blank=True, default='', help_text='Professional certifications and licenses')

    def __str__(self):
        return f"Teacher: {self.user.get_full_name() or self.user.username}"

    class Meta:
        db_table = 'teacher_profiles'
        verbose_name = 'Teacher'
        verbose_name_plural = 'Teachers'


class Student(models.Model):
    """Student profile linked to CustomUser."""
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='student_profile')
    student_id = models.CharField(max_length=20, unique=True)
    year_level = models.PositiveSmallIntegerField(default=1)
    course = models.CharField(max_length=100, blank=True, help_text='Legacy course code retained during migration')
    course_ref = models.ForeignKey(
        'core.Course', on_delete=models.SET_NULL, null=True, blank=True, related_name='students'
    )
    # FSUU Comprehensive Personal Profile
    middle_name = models.CharField(max_length=100, blank=True, default='')
    gender = models.CharField(max_length=10, blank=True, default='Male')
    birth_date = models.DateField(null=True, blank=True)
    birth_place = models.CharField(max_length=150, blank=True, default='')
    civil_status = models.CharField(max_length=30, blank=True, default='Single')
    blood_type = models.CharField(max_length=10, blank=True, default='')
    height = models.CharField(max_length=20, blank=True, default='')
    religion = models.CharField(max_length=100, blank=True, default='Roman Catholic')
    citizenship = models.CharField(max_length=50, blank=True, default='Filipino')
    languages_spoken = models.CharField(max_length=255, blank=True, default='English, Filipino, Cebuano')

    # FSUU Address Information
    current_address = models.CharField(max_length=255, blank=True, default='')
    current_region = models.CharField(max_length=100, blank=True, default='REGION XIII (Caraga)')
    current_province = models.CharField(max_length=100, blank=True, default='Agusan del Norte')
    current_municipality = models.CharField(max_length=100, blank=True, default='Butuan City')

    permanent_address = models.CharField(max_length=255, blank=True, default='')
    permanent_region = models.CharField(max_length=100, blank=True, default='REGION XIII (Caraga)')
    permanent_province = models.CharField(max_length=100, blank=True, default='Agusan del Norte')
    permanent_municipality = models.CharField(max_length=100, blank=True, default='Butuan City')

    # FSUU Contact Details
    telephone = models.CharField(max_length=30, blank=True, default='')
    mobile_number = models.CharField(max_length=30, blank=True, default='')

    # Face encoding stored as JSON string (list of 128 floats per face)
    # NOTE: retained here for backward compatibility. The normalized copy of
    # this data now also lives in StudentBiometric (student_biometrics table);
    # see Student.save() and StudentBiometric below.
    face_encoding = models.TextField(blank=True, null=True)
    face_enrolled_at = models.DateTimeField(blank=True, null=True)
    # Biometric photo: private storage, never a public URL (see attendance_fr/storage.py)
    face_image = models.ImageField(
        upload_to='face_images/', blank=True, null=True, validators=[validate_image_upload],
        storage=get_face_storage,
    )

    def __str__(self):
        return f"Student: {self.user.get_full_name() or self.user.username} ({self.student_id})"

    @property
    def is_face_enrolled(self):
        return bool(self.face_encoding)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self._sync_biometric()

    def _sync_biometric(self):
        """Keeps StudentBiometric in sync with the legacy face_* fields on Student."""
        has_data = bool(self.face_encoding) or bool(self.face_image) or bool(self.face_enrolled_at)
        if not has_data:
            StudentBiometric.objects.filter(student=self).delete()
            return
        StudentBiometric.objects.update_or_create(
            student=self,
            defaults={
                'face_encoding': self.face_encoding,
                'face_image': self.face_image,
                'face_enrolled_at': self.face_enrolled_at,
            },
        )

    class Meta:
        db_table = 'student_profiles'
        verbose_name = 'Student'
        verbose_name_plural = 'Students'
        indexes = [
            models.Index(fields=['course', 'year_level'], name='student_crs_yr_idx'),
        ]


class StudentBiometric(models.Model):
    """
    Normalized biometric data for a Student (3NF).
    Separated from student_profiles because face data has a distinct
    lifecycle (re-enrolled/cleared independently) and sensitivity level
    from general profile information.
    Mirrors Student.face_encoding/face_image/face_enrolled_at; kept in sync
    by Student.save(). Legacy fields remain the authoritative write path
    until all read sites are migrated to this table.
    """
    student = models.OneToOneField(Student, on_delete=models.CASCADE, related_name='biometric')
    face_encoding = models.TextField(blank=True, null=True)
    # Biometric photo: private storage, never a public URL (see attendance_fr/storage.py)
    face_image = models.ImageField(
        upload_to='face_images/', blank=True, null=True, validators=[validate_image_upload],
        storage=get_face_storage,
    )
    face_enrolled_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Biometric: {self.student}"

    class Meta:
        db_table = 'student_biometrics'
        verbose_name = 'Student Biometric'
        verbose_name_plural = 'Student Biometrics'


class RevokedToken(models.Model):
    """
    JWT ids (jti) that must no longer be accepted: tokens from a logout,
    and refresh tokens already exchanged during rotation.
    Uses only plain string/datetime columns, so it works on databases where
    simplejwt's token_blacklist app (UUID columns) cannot be migrated.
    Rows are useless once expires_at passes and can be purged.
    """
    jti = models.CharField(max_length=255, unique=True)
    token_type = models.CharField(max_length=10)  # 'access' | 'refresh'
    expires_at = models.DateTimeField(db_index=True)
    revoked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'revoked_tokens'

    def __str__(self):
        return f"{self.token_type}:{self.jti}"
