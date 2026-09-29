from django.contrib import admin
from django.contrib import admin
from .models import Course, Program, ProgramSection, Subject, Section, Schedule, AttendanceSession, AttendanceRecord, StudentSection


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'program', 'is_active', 'created_at']
    list_filter = ['program', 'is_active']
    search_fields = ['code', 'name', 'program__code', 'program__name']


@admin.register(Program)
class ProgramAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'college', 'created_at']
    search_fields = ['code', 'name', 'college']


@admin.register(ProgramSection)
class ProgramSectionAdmin(admin.ModelAdmin):
    list_display = ['name', 'program', 'course', 'year_level']
    list_filter = ['program', 'course', 'year_level']
    search_fields = ['name', 'course', 'program__code']


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'program', 'units']
    list_filter = ['program']
    search_fields = ['code', 'name']


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ['name', 'program', 'course', 'year_level', 'teacher', 'school_year', 'semester']
    list_filter = ['program', 'course', 'name', 'year_level', 'school_year', 'semester']
    search_fields = ['name', 'course', 'program__code']
    raw_id_fields = ['teacher']


@admin.register(Schedule)
class ScheduleAdmin(admin.ModelAdmin):
    list_display = ['section', 'day_of_week', 'start_time', 'end_time', 'room']
    list_filter = ['day_of_week']


@admin.register(AttendanceSession)
class AttendanceSessionAdmin(admin.ModelAdmin):
    list_display = ['schedule', 'date', 'started_by', 'status', 'created_at']
    list_filter = ['status', 'date']


@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(admin.ModelAdmin):
    list_display = ['student', 'session', 'status', 'recognized_at', 'confidence_score']
    list_filter = ['status']
    search_fields = ['student__user__username', 'student__student_id']


@admin.register(StudentSection)
class StudentSectionAdmin(admin.ModelAdmin):
    list_display = ['student', 'section', 'enrolled_at']
    search_fields = ['student__user__username', 'section__name']
