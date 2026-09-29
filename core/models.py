from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from accounts.models import Teacher, Student


class Program(models.Model):
    """Academic Program (e.g. BSCS, BSIT, BSA at FSUU)."""
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=150)
    college = models.CharField(max_length=150, blank=True, default='')
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, help_text='Inactive records are temporarily closed and hidden from new activity.')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.code} - {self.name}"

    class Meta:
        db_table = 'academic_programs'
        ordering = ['code']
        verbose_name = 'Program'
        verbose_name_plural = 'Programs'


class Course(models.Model):
    """Degree course offered under an academic Program, e.g. BSIT or BSCS."""
    program = models.ForeignKey(Program, on_delete=models.PROTECT, related_name='courses')
    code = models.CharField(max_length=20)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.code} - {self.name}"

    class Meta:
        db_table = 'academic_courses'
        ordering = ['program__code', 'code']
        constraints = [
            models.UniqueConstraint(fields=['program', 'code'], name='unique_course_per_program'),
        ]
        verbose_name = 'Course'
        verbose_name_plural = 'Courses'


class ProgramSection(models.Model):
    """
    Master Section Definition (3NF Entity).
    Represents an official academic class section belonging to a Program/College
    (e.g., 'BSCS-2A' or 'IT 43' under CITEC).
    """
    YEAR_LEVEL_CHOICES = [
        (1, '1st Year'),
        (2, '2nd Year'),
        (3, '3rd Year'),
        (4, '4th Year'),
    ]

    program = models.ForeignKey(Program, on_delete=models.CASCADE, related_name='standard_sections')
    course = models.CharField(
        max_length=50, blank=True, default='',
        help_text='Legacy course code retained during migration (e.g., BSIT, BSCS, BSEMC, BSA, BSCrim)'
    )
    course_ref = models.ForeignKey(
        Course, on_delete=models.SET_NULL, null=True, blank=True, related_name='program_sections'
    )
    name = models.CharField(max_length=50)
    year_level = models.PositiveSmallIntegerField(choices=YEAR_LEVEL_CHOICES, default=1)
    description = models.CharField(max_length=150, blank=True, default='')
    is_active = models.BooleanField(default=True, help_text='Inactive records are temporarily closed and hidden from new activity.')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'academic_section_definitions'
        verbose_name = 'Program Section'
        verbose_name_plural = 'Program Sections'
        unique_together = ['program', 'name']
        indexes = [
            models.Index(fields=['program', 'course_ref', 'year_level'], name='progsec_filter_idx'),
        ]
        ordering = ['program__code', 'course', 'year_level', 'name']

    def __str__(self):
        course_part = f" • {self.course}" if self.course else ""
        return f"{self.program.code} - {self.name} ({self.get_year_level_display()}{course_part})"


class Subject(models.Model):
    """Academic subject linked to a Course, Program, and Section."""
    program = models.ForeignKey(Program, on_delete=models.CASCADE, related_name='subjects', null=True, blank=True)
    course_ref = models.ForeignKey(
        Course, on_delete=models.SET_NULL, null=True, blank=True, related_name='subjects'
    )
    section = models.ForeignKey('Section', on_delete=models.SET_NULL, null=True, blank=True, related_name='subjects')
    teacher = models.ForeignKey(
        Teacher, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_subjects'
    )
    code = models.CharField(max_length=20)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    units = models.PositiveSmallIntegerField(default=3)
    is_active = models.BooleanField(default=True, help_text='Inactive records are temporarily closed and hidden from new activity.')
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.course_ref:
            self.program = self.course_ref.program
        elif self.section_id and self.section and self.section.course_ref_id:
            self.course_ref = self.section.course_ref
            self.program = self.section.program
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.code} - {self.name}"

    class Meta:
        db_table = 'academic_subjects'
        ordering = ['code']
        verbose_name = 'Subject'
        verbose_name_plural = 'Subjects'


class Section(models.Model):
    """
    A class section offering for an academic term (School Year + Semester).
    3NF Compliant: Links directly to ProgramSection master definition,
    while maintaining 'name', 'program', and 'year_level' for full backward compatibility.
    """
    YEAR_LEVEL_CHOICES = [
        (1, '1st Year'),
        (2, '2nd Year'),
        (3, '3rd Year'),
        (4, '4th Year'),
    ]

    program = models.ForeignKey(Program, on_delete=models.CASCADE, related_name='sections', null=True, blank=True)
    program_section = models.ForeignKey(
        ProgramSection, on_delete=models.SET_NULL, null=True, blank=True, related_name='offerings'
    )
    course = models.CharField(max_length=50, blank=True, default='', help_text='Legacy course code retained during migration')
    course_ref = models.ForeignKey(
        Course, on_delete=models.SET_NULL, null=True, blank=True, related_name='sections'
    )
    name = models.CharField(max_length=50)
    year_level = models.PositiveSmallIntegerField(choices=YEAR_LEVEL_CHOICES, default=1)
    subject = models.ForeignKey(
        Subject, on_delete=models.SET_NULL, null=True, blank=True, related_name='sections'
    )
    # Teacher handling this section
    teacher = models.ForeignKey(
        Teacher, on_delete=models.SET_NULL, null=True, blank=True, related_name='sections'
    )
    school_year = models.CharField(max_length=20, default='2025-2026')
    semester = models.CharField(
        max_length=10,
        choices=[('1st', '1st Semester'), ('2nd', '2nd Semester'), ('summer', 'Summer')],
        default='1st'
    )
    is_active = models.BooleanField(default=True, help_text='Inactive records are temporarily closed and hidden from new activity.')
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.program_section:
            self.name = self.program_section.name
            self.program = self.program_section.program
            self.year_level = self.program_section.year_level
            if self.program_section.course_ref_id:
                self.course_ref = self.program_section.course_ref
            if self.program_section.course:
                self.course = self.program_section.course
        if self.course_ref:
            self.course = self.course_ref.code
            self.program = self.course_ref.program
        super().save(*args, **kwargs)

    @property
    def effective_subject(self):
        """Returns the primary subject for this section."""
        return self.subject or self.subjects.first()

    def __str__(self):
        sub_code = self.effective_subject.code if self.effective_subject else "No Subject"
        prog_code = f" [{self.program.code}]" if self.program else ""
        return f"{self.name}{prog_code} - {sub_code} ({self.school_year} {self.semester})"

    @property
    def schedule_display(self):
        """Returns concise summary of schedules, e.g. 'T–TH 18:00–20:30 @ Room 226 (LAB-7)'."""
        schedules = list(self.schedules.all())
        if not schedules:
            return "No schedule set"

        day_order = {'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 7}
        schedules.sort(key=lambda s: (day_order.get(s.day_of_week, 99), s.start_time))

        parts = []
        for s in schedules:
            parts.append(f"{s.days_display} {s.time_display} @ {s.room}")

        return ", ".join(parts)

    class Meta:
        db_table = 'academic_class_sections'
        ordering = ['name']
        verbose_name = 'Section'
        verbose_name_plural = 'Sections'
        indexes = [
            models.Index(fields=['program', 'course_ref', 'year_level'], name='section_filter_idx'),
            models.Index(fields=['program_section', 'school_year', 'semester'], name='section_term_idx'),
        ]


class StudentSection(models.Model):
    """Enrollment: which student belongs to which section (Regular Block or Irregular Subject)."""
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='enrollments')
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='enrollments')
    subject = models.ForeignKey(
        'Subject', on_delete=models.CASCADE, null=True, blank=True, related_name='student_enrollments',
        help_text='Leave blank for regular block section; select subject for irregular student.'
    )
    enrolled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'academic_enrollments'
        unique_together = ['student', 'section', 'subject']
        indexes = [
            models.Index(fields=['section', 'subject'], name='enroll_section_subject_idx'),
        ]
        verbose_name = 'Student Enrollment'

    def __str__(self):
        subj = f" [{self.subject.code}]" if self.subject else ""
        return f"{self.student} → {self.section}{subj}"


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
    subject = models.ForeignKey(
        'Subject', on_delete=models.CASCADE, null=True, blank=True, related_name='schedules',
        help_text='The specific academic course subject this schedule meeting belongs to.'
    )
    day_of_week = models.CharField(max_length=3, choices=DAY_CHOICES, verbose_name='Day 1')
    day_2 = models.CharField(
        max_length=3, choices=DAY_CHOICES, null=True, blank=True,
        verbose_name='Day 2',
        help_text='Second meeting day (e.g. Thu for a Tue–Thu pattern). Leave blank for single-day classes.'
    )
    start_time = models.TimeField()
    end_time = models.TimeField()
    room = models.CharField(max_length=50)
    # Validity window — allows admin to adjust schedule dates due to
    # suspensions, climate events, semester changes, etc.
    effective_from = models.DateField(null=True, blank=True, help_text='First date this schedule is active (leave blank = no start restriction)')
    effective_to = models.DateField(null=True, blank=True, help_text='Last date this schedule is active (leave blank = no end restriction)')

    DAY_SHORT = {'Mon': 'M', 'Tue': 'T', 'Wed': 'W', 'Thu': 'TH', 'Fri': 'F', 'Sat': 'S', 'Sun': 'SU'}

    @property
    def days_display(self):
        """Returns e.g. 'T/TH', 'M/W', or 'S' for display."""
        d1 = self.DAY_SHORT.get(self.day_of_week, self.day_of_week)
        if self.day_2:
            d2 = self.DAY_SHORT.get(self.day_2, self.day_2)
            return f"{d1}/{d2}"
        return d1

    @property
    def full_days_display(self):
        """Returns e.g. 'Tuesday & Thursday' or 'Monday' for human-readable display."""
        d1 = self.get_day_of_week_display()
        if self.day_2:
            d2 = self.get_day_2_display()
            return f"{d1} & {d2}"
        return d1

    @property
    def meeting_days(self):
        """Returns list of all days this schedule meets on."""
        days = [self.day_of_week]
        if self.day_2:
            days.append(self.day_2)
        return days

    @property
    def time_display(self):
        """Returns e.g. '06:00PM-07:30PM/06:00PM-07:30PM' or '09:00AM-10:30AM'."""
        def fmt(t):
            h = t.hour % 12 or 12
            period = 'PM' if t.hour >= 12 else 'AM'
            return f"{h:02d}:{t.minute:02d}{period}"
        slot = f"{fmt(self.start_time)}-{fmt(self.end_time)}"
        if self.day_2:
            return f"{slot}/{slot}"
        return slot

    def __str__(self):
        return f"{self.section.name} | {self.days_display} {self.time_display} @ {self.room}"

    def clean(self):
        """Validate no schedule conflicts (room or teacher) via ScheduleService."""
        from core.services.schedule_service import ScheduleService
        conflicts = ScheduleService.check_conflicts(self)
        if conflicts:
            raise ValidationError(conflicts[0])

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
        self._sync_schedule_days()

    def _sync_schedule_days(self):
        """Keeps ScheduleDay rows consistent with the legacy day_of_week/day_2 fields."""
        target_days = set(self.meeting_days)
        existing = set(self.meeting_day_rows.values_list('day_of_week', flat=True))
        for day in target_days - existing:
            ScheduleDay.objects.create(schedule=self, day_of_week=day)
        for day in existing - target_days:
            self.meeting_day_rows.filter(day_of_week=day).delete()

    class Meta:
        db_table = 'academic_schedules'
        ordering = ['day_of_week', 'start_time']
        verbose_name = 'Schedule'
        verbose_name_plural = 'Schedules'


class ScheduleDay(models.Model):
    """
    Normalized meeting day for a Schedule (1NF).
    Replaces the day_of_week/day_2 repeating-group columns on Schedule with one
    row per meeting day. Schedule.day_of_week/day_2 are kept in sync for
    backward compatibility until all call sites are migrated to use this table.
    """
    schedule = models.ForeignKey(Schedule, on_delete=models.CASCADE, related_name='meeting_day_rows')
    day_of_week = models.CharField(max_length=3, choices=Schedule.DAY_CHOICES)

    class Meta:
        db_table = 'academic_schedule_days'
        unique_together = ['schedule', 'day_of_week']
        ordering = ['schedule_id', 'day_of_week']
        verbose_name = 'Schedule Day'
        verbose_name_plural = 'Schedule Days'

    def __str__(self):
        return f"{self.schedule} - {self.get_day_of_week_display()}"


class AttendanceSession(models.Model):
    """A single attendance-taking event for a schedule on a given date."""
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('closed', 'Closed'),
    ]
    schedule = models.ForeignKey(Schedule, on_delete=models.CASCADE, related_name='sessions')
    date = models.DateField(default=timezone.localdate)
    started_by = models.ForeignKey(Teacher, on_delete=models.SET_NULL, null=True, blank=True, related_name='sessions_started')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='open')
    created_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(blank=True, null=True)

    def clean(self):
        super().clean()
        if self.schedule_id and self.date:
            existing = AttendanceSession.objects.filter(
                schedule_id=self.schedule_id,
                date=self.date
            ).exclude(pk=self.pk)
            if existing.exists():
                raise ValidationError(
                    f"An attendance session already exists for this class schedule on {self.date}. "
                    "1 subject, 1 meeting, 1 attendance session only — no duplication allowed."
                )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.schedule.section.name} | {self.date} [{self.status}]"

    class Meta:
        db_table = 'attendance_sessions'
        ordering = ['-date', '-created_at']
        verbose_name = 'Attendance Session'
        verbose_name_plural = 'Attendance Sessions'
        unique_together = ['schedule', 'date']


class AttendanceSessionReopenAudit(models.Model):
    """Immutable audit record for a teacher reopening a closed attendance session."""
    session = models.ForeignKey(
        AttendanceSession, on_delete=models.CASCADE, related_name='reopen_history'
    )
    reopened_by = models.ForeignKey(
        Teacher, on_delete=models.PROTECT, related_name='attendance_reopens'
    )
    reason = models.CharField(max_length=300)
    reopened_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'attendance_session_reopen_audits'
        ordering = ['-reopened_at']
        verbose_name = 'Attendance Session Reopen Audit'
        verbose_name_plural = 'Attendance Session Reopen Audits'

    def __str__(self):
        return f"Session #{self.session_id} reopened by {self.reopened_by_id}: {self.reason}"


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

    def clean(self):
        super().clean()
        if self.session_id and self.student_id:
            existing = AttendanceRecord.objects.filter(
                session__schedule=self.session.schedule,
                session__date=self.session.date,
                student=self.student
            ).exclude(pk=self.pk)
            if existing.exists():
                raise ValidationError(
                    f"Student {self.student} already has an attendance record for this meeting on {self.session.date}. "
                    "1 subject, 1 meeting, 1 attendance only — no duplication allowed."
                )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.student} | {self.session.date} - {self.status}"

    class Meta:
        db_table = 'attendance_records'
        unique_together = ['session', 'student']
        ordering = ['student__user__last_name']
        verbose_name = 'Attendance Record'
        verbose_name_plural = 'Attendance Records'
