"""
Custom Django REST Framework permissions and authorization helpers for Attendance-FR.
"""
from django.db.models import Q
from rest_framework import permissions


def is_student_enrolled_for_schedule(student, schedule):
    """Return whether a student belongs to the schedule's eligible roster."""
    from core.models import StudentSection

    enrollment_filter = Q(section=schedule.section, student=student)
    if schedule.subject_id:
        enrollment_filter &= Q(subject__isnull=True) | Q(subject=schedule.subject)
    return StudentSection.objects.filter(enrollment_filter).exists()


def can_manage_session(user, session):
    """Return whether a user is allowed to manage an attendance session."""
    if not (user and user.is_authenticated):
        return False
    if user.role != 'teacher':
        return False

    teacher = getattr(user, 'teacher_profile', None)
    if not teacher:
        return False

    subject = session.schedule.subject
    section = session.schedule.section
    has_subject_teacher = section.subjects.filter(teacher__isnull=False).exists()
    return (
        session.started_by_id == teacher.id
        or (subject is not None and subject.teacher_id == teacher.id)
        or (subject is None and section.subjects.filter(teacher=teacher).exists())
        or (subject is None and not has_subject_teacher and section.teacher_id == teacher.id)
    )


def can_view_student_attendance(user, student, section=None):
    """Return whether a user may view a student's attendance data."""
    if not (user and user.is_authenticated):
        return False
    if user.role == 'admin':
        return True

    from core.models import StudentSection

    if user.role == 'student':
        if getattr(user, 'student_profile', None) != student:
            return False
        return section is None or StudentSection.objects.filter(
            student=student, section=section
        ).exists()

    if user.role == 'teacher':
        teacher = getattr(user, 'teacher_profile', None)
        if not teacher:
            return False
        enrollment_qs = StudentSection.objects.filter(student=student)
        if section is not None:
            enrollment_qs = enrollment_qs.filter(section=section)
        return enrollment_qs.filter(
            Q(section__teacher=teacher)
            | Q(section__subjects__teacher=teacher)
            | Q(section__schedules__subject__teacher=teacher)
        ).exists()

    return False


class IsAdminRole(permissions.BasePermission):
    """Allows access only to authenticated users with the 'admin' role."""
    message = "Administrator privileges required to perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'admin'
        )


class IsTeacherRole(permissions.BasePermission):
    """Allows attendance-taking actions only to authenticated teachers."""
    message = "Only an assigned instructor may take attendance."

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'teacher'
        )


class IsTeacherOrAdminRole(permissions.BasePermission):
    """Allows access to authenticated Teachers and Admins."""
    message = "Instructor or Administrator privileges required to perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ['admin', 'teacher']
        )


class IsAdminOrReadOnly(permissions.BasePermission):
    """Allows read-only access to authenticated users, writes to admins only."""
    message = "Only administrators are permitted to create, modify, or delete this resource."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.role == 'admin'


class IsSessionManager(permissions.BasePermission):
    """Grants session access only to the teacher assigned to that session."""
    message = "Only the assigned instructor may manage this attendance session."

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'teacher'
        )

    def has_object_permission(self, request, view, obj):
        return can_manage_session(request.user, obj)
