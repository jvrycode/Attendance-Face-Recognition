from rest_framework import serializers
from core.models import Subject, Section, Schedule, AttendanceSession, AttendanceRecord
from accounts.serializers import TeacherSerializer, StudentSerializer


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ['id', 'name', 'code', 'description', 'units', 'created_at']


class SectionSerializer(serializers.ModelSerializer):
    subject_details = SubjectSerializer(source='subject', read_only=True)
    teacher_details = TeacherSerializer(source='teacher', read_only=True)
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = Section
        fields = ['id', 'name', 'subject', 'subject_details', 'teacher', 'teacher_details', 'school_year', 'semester', 'student_count', 'created_at']

    def get_student_count(self, obj):
        return obj.enrollments.count()


class ScheduleSerializer(serializers.ModelSerializer):
    section_name = serializers.CharField(source='section.name', read_only=True)
    day_display = serializers.CharField(source='get_day_of_week_display', read_only=True)

    class Meta:
        model = Schedule
        fields = ['id', 'section', 'section_name', 'day_of_week', 'day_display', 'start_time', 'end_time', 'room']


class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_details = StudentSerializer(source='student', read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = ['id', 'session', 'student', 'student_details', 'status', 'recognized_at', 'confidence_score', 'remarks']


class AttendanceSessionSerializer(serializers.ModelSerializer):
    schedule_details = ScheduleSerializer(source='schedule', read_only=True)
    summary = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceSession
        fields = ['id', 'schedule', 'schedule_details', 'date', 'started_by', 'status', 'created_at', 'closed_at', 'summary']

    def get_summary(self, obj):
        from core.services.attendance_service import AttendanceService
        return AttendanceService.get_session_summary(obj)
