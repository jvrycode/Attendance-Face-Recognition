"""
Classes & Academic Structure Serializers
Handles serialization and validation for Programs, Sections, Subjects, Schedules, and Enrollments.
Course serialization lives in its own module: attendance_fr/api/serializers/courses.py.
"""
from rest_framework import serializers
from core.models import Program, ProgramSection, Subject, Section, Schedule, StudentSection
from core.serializers import (
    ProgramSerializer,
    ProgramSectionSerializer,
    SubjectSerializer,
    SectionSerializer,
    ScheduleSerializer,
    StudentSectionSerializer,
)


class SectionEnrollmentCreateSerializer(serializers.Serializer):
    """Validates student enrollment into a section."""
    student_id = serializers.IntegerField(required=False)
    student = serializers.IntegerField(required=False)
    subject_id = serializers.IntegerField(required=False, allow_null=True)
    subject = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, attrs):
        sid = attrs.get('student_id') or attrs.get('student')
        if not sid:
            raise serializers.ValidationError({'student_id': 'Student is required.'})
        attrs['student_id'] = sid
        sub = attrs.get('subject_id') or attrs.get('subject') or None
        attrs['subject_id'] = sub
        return attrs
