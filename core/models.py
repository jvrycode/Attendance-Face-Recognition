from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from accounts.models import Teacher, Student


class Subject(models.Model):
    """Academic subject."""
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True)
    units = models.PositiveSmallIntegerField(default=3)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.code} - {self.name}"

    class Meta:
        ordering = ['code']
        verbose_name = 'Subject'
        verbose_name_plural = 'Subjects'


class Section(models.Model):
    """A class section for a subject, assigned to a teacher."""
    name = models.CharField(max_length=50)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='sections')
    # One teacher can handle many sections
    teacher = models.ForeignKey(
        Teacher, on_delete=models.SET_NULL, null=True, blank=True, related_name='sections'
    )
    school_year = models.CharField(max_length=20, default='2025-2026')
    semester = models.CharField(
        max_length=10,
        choices=[('1st', '1st Semester'), ('2nd', '2nd Semester'), ('summer', 'Summer')],
        default='1st'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} - {self.subject.code} ({self.school_year} {self.semester})"

    class Meta:
        ordering = ['name']
        verbose_name = 'Section'
        verbose_name_plural = 'Sections'


class StudentSection(models.Model):
    """Enrollment: which student belongs to which section."""
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='enrollments')
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='enrollments')
    enrolled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['student', 'section']
        verbose_name = 'Student Enrollment'

    def __str__(self):
        return f"{self.student} → {self.section}"


class Schedule(models.Model):
    """Class schedule with conflict detection."""
    DAY_CHOICES = [
        ('Mon', 'Monday'),
        ('Tue', 'Tuesday'),
        ('Wed', 'Wednesday'),
        ('Thu', 'Thursday'),
        ('Fri', 'Friday'),
        ('Sat', 'Saturday'),
    ]

    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='schedules')
    day_of_week = models.CharField(max_length=3, choices=DAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    room = models.CharField(max_length=50)

    def __str__(self):
        return f"{self.section.name} | {self.get_day_of_week_display()} {self.start_time:%H:%M}–{self.end_time:%H:%M} @ {self.room}"

    def clean(self):
        """Validate no schedule conflicts (room or teacher)."""
        if self.start_time and self.end_time:
            if self.start_time >= self.end_time:
                raise ValidationError("End time must be after start time.")

        if not self.section_id:
            return

        # Get overlapping schedules (exclude self)
        qs = Schedule.objects.filter(day_of_week=self.day_of_week)
        if self.pk:
            qs = qs.exclude(pk=self.pk)

        for sched in qs:
            overlaps = (self.start_time < sched.end_time and self.end_time > sched.start_time)
            if not overlaps:
                continue

            # Room conflict
            if sched.room.strip().lower() == self.room.strip().lower():
                raise ValidationError(
                    f"Room conflict: '{self.room}' is already booked on "
                    f"{self.get_day_of_week_display()} from {sched.start_time:%H:%M} to {sched.end_time:%H:%M} "
                    f"by section '{sched.section.name}'."
                )

            # Teacher conflict
            if (
                self.section.teacher and
                sched.section.teacher and
                self.section.teacher == sched.section.teacher
            ):
                raise ValidationError(
                    f"Teacher conflict: {self.section.teacher} is already scheduled on "
                    f"{self.get_day_of_week_display()} from {sched.start_time:%H:%M} to {sched.end_time:%H:%M} "
                    f"for section '{sched.section.name}'."
                )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    class Meta:
        ordering = ['day_of_week', 'start_time']
        verbose_name = 'Schedule'
        verbose_name_plural = 'Schedules'


class AttendanceSession(models.Model):
    """A single attendance-taking event for a schedule on a given date."""
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('closed', 'Closed'),
    ]
    schedule = models.ForeignKey(Schedule, on_delete=models.CASCADE, related_name='sessions')
    date = models.DateField(default=timezone.localdate)
    started_by = models.ForeignKey(Teacher, on_delete=models.SET_NULL, null=True, related_name='sessions_started')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='open')
    created_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"{self.schedule.section.name} | {self.date} [{self.status}]"

    class Meta:
        ordering = ['-date', '-created_at']
        verbose_name = 'Attendance Session'
        verbose_name_plural = 'Attendance Sessions'


class AttendanceRecord(models.Model):
    """Individual student attendance record for a session."""
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('late', 'Late'),
        ('excused', 'Excused'),
    ]
    session = models.ForeignKey(AttendanceSession, on_delete=models.CASCADE, related_name='records')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='attendance_records')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='absent')
    recognized_at = models.DateTimeField(blank=True, null=True)
    confidence_score = models.FloatField(blank=True, null=True)
    remarks = models.CharField(max_length=200, blank=True)

    def __str__(self):
        return f"{self.student} | {self.session.date} - {self.status}"

    class Meta:
        unique_together = ['session', 'student']
        ordering = ['student__user__last_name']
        verbose_name = 'Attendance Record'
        verbose_name_plural = 'Attendance Records'
