from rest_framework import serializers
from core.models import Program, ProgramSection, Subject, Section, Schedule, AttendanceSession, AttendanceRecord
from accounts.serializers import TeacherSerializer, StudentSerializer


class ProgramSerializer(serializers.ModelSerializer):
    section_count = serializers.SerializerMethodField()
    subject_count = serializers.SerializerMethodField()

    class Meta:
        model = Program
        fields = ['id', 'code', 'name', 'college', 'description', 'section_count', 'subject_count', 'created_at']

    def get_section_count(self, obj):
        return obj.standard_sections.count()

    def get_subject_count(self, obj):
        return obj.subjects.count()


class ProgramSectionSerializer(serializers.ModelSerializer):
    program_details = ProgramSerializer(source='program', read_only=True)
    year_level_display = serializers.CharField(source='get_year_level_display', read_only=True)
    active_classes_count = serializers.SerializerMethodField()

    class Meta:
        model = ProgramSection
        fields = ['id', 'program', 'program_details', 'name', 'year_level', 'year_level_display', 'description', 'active_classes_count', 'created_at']

    def get_active_classes_count(self, obj):
        return Section.objects.filter(name=obj.name).count()


class ScheduleSerializer(serializers.ModelSerializer):
    section_name = serializers.CharField(source='section.name', read_only=True)
    day_display = serializers.CharField(source='get_day_of_week_display', read_only=True)
    days_display = serializers.CharField(read_only=True)
    time_display = serializers.CharField(read_only=True)
    full_days_display = serializers.CharField(read_only=True)
    subject_code = serializers.SerializerMethodField()
    subject_name = serializers.SerializerMethodField()
    teacher_name = serializers.SerializerMethodField()

    class Meta:
        model = Schedule
        fields = [
            'id', 'section', 'section_name', 'day_of_week', 'day_2', 'day_display',
            'days_display', 'full_days_display', 'start_time', 'end_time', 'time_display',
            'room', 'effective_from', 'effective_to', 'subject_code', 'subject_name', 'teacher_name'
        ]

    def get_subject_code(self, obj):
        if obj.section and obj.section.effective_subject:
            return obj.section.effective_subject.code
        return '—'

    def get_subject_name(self, obj):
        if obj.section and obj.section.effective_subject:
            return obj.section.effective_subject.name
        return ''

    def get_teacher_name(self, obj):
        if obj.section and obj.section.teacher and obj.section.teacher.user:
            return obj.section.teacher.user.get_full_name() or obj.section.teacher.user.username
        return '—'


class SubjectSerializer(serializers.ModelSerializer):
    program_details = ProgramSerializer(source='program', read_only=True)
    teacher_details = TeacherSerializer(source='teacher', read_only=True)
    section_name = serializers.CharField(source='section.name', read_only=True, default='')

    class Meta:
        model = Subject
        fields = [
            'id', 'name', 'code', 'description', 'units', 'program', 'program_details',
            'section', 'section_name', 'teacher', 'teacher_details', 'created_at'
        ]


class SectionSerializer(serializers.ModelSerializer):
    program_details = ProgramSerializer(source='program', read_only=True)
    subject_details = SubjectSerializer(source='subject', read_only=True)
    teacher_details = TeacherSerializer(source='teacher', read_only=True)
    year_level_display = serializers.CharField(source='get_year_level_display', read_only=True)
    schedule_display = serializers.ReadOnlyField()
    effective_subject_code = serializers.SerializerMethodField()
    effective_subject_name = serializers.SerializerMethodField()
    schedules = ScheduleSerializer(many=True, read_only=True)
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = Section
        fields = [
            'id', 'name', 'program', 'program_details', 'year_level', 'year_level_display',
            'subject', 'subject_details', 'teacher', 'teacher_details', 'school_year',
            'semester', 'schedule_display', 'effective_subject_code', 'effective_subject_name',
            'schedules', 'student_count', 'created_at'
        ]

    def get_effective_subject_code(self, obj):
        eff = obj.effective_subject
        return eff.code if eff else '—'

    def get_effective_subject_name(self, obj):
        eff = obj.effective_subject
        return eff.name if eff else ''

    def get_student_count(self, obj):
        return obj.enrollments.count()


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
