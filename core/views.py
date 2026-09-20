from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from django.db.models import Count, Q
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from .models import Subject, Section, Schedule, AttendanceSession, AttendanceRecord, StudentSection
from .forms import SubjectForm, SectionForm, ScheduleForm, EnrollStudentForm, AttendanceRecordEditForm
from accounts.models import Teacher, Student
from accounts.decorators import admin_required, teacher_required


# ─── Subjects (Admin only) ─────────────────────────────────────────────────────

@login_required
@admin_required
def subject_list(request):
    subjects = Subject.objects.annotate(section_count=Count('sections')).order_by('code')
    return render(request, 'core/subject_list.html', {'subjects': subjects})


@login_required
@admin_required
def subject_create(request):
    form = SubjectForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        form.save()
        messages.success(request, 'Subject created successfully.')
        return redirect('subject_list')
    return render(request, 'core/subject_form.html', {'form': form, 'title': 'Add Subject'})


@login_required
@admin_required
def subject_edit(request, pk):
    subject = get_object_or_404(Subject, pk=pk)
    form = SubjectForm(request.POST or None, instance=subject)
    if request.method == 'POST' and form.is_valid():
        form.save()
        messages.success(request, 'Subject updated.')
        return redirect('subject_list')
    return render(request, 'core/subject_form.html', {'form': form, 'title': 'Edit Subject', 'subject': subject})


@login_required
@admin_required
def subject_delete(request, pk):
    subject = get_object_or_404(Subject, pk=pk)
    if request.method == 'POST':
        subject.delete()
        messages.success(request, 'Subject deleted.')
        return redirect('subject_list')
    return render(request, 'core/confirm_delete.html', {'object': subject, 'type': 'Subject'})


# ─── Sections ─────────────────────────────────────────────────────────────────

@login_required
@admin_required
def section_list(request):
    sections = Section.objects.select_related('subject', 'teacher__user').annotate(
        student_count=Count('enrollments')
    ).order_by('name')
    return render(request, 'core/section_list.html', {'sections': sections})


@login_required
@admin_required
def section_create(request):
    form = SectionForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        form.save()
        messages.success(request, 'Section created.')
        return redirect('section_list')
    return render(request, 'core/section_form.html', {'form': form, 'title': 'Add Section'})


@login_required
@admin_required
def section_edit(request, pk):
    section = get_object_or_404(Section, pk=pk)
    form = SectionForm(request.POST or None, instance=section)
    if request.method == 'POST' and form.is_valid():
        form.save()
        messages.success(request, 'Section updated.')
        return redirect('section_list')
    return render(request, 'core/section_form.html', {'form': form, 'title': 'Edit Section', 'section': section})


@login_required
@admin_required
def section_delete(request, pk):
    section = get_object_or_404(Section, pk=pk)
    if request.method == 'POST':
        section.delete()
        messages.success(request, 'Section deleted.')
        return redirect('section_list')
    return render(request, 'core/confirm_delete.html', {'object': section, 'type': 'Section'})


@login_required
@admin_required
def section_detail(request, pk):
    section = get_object_or_404(
        Section.objects.select_related('subject', 'teacher__user').prefetch_related(
            'schedules', 'enrollments__student__user'
        ), pk=pk
    )
    enroll_form = EnrollStudentForm(request.POST or None)
    # Students not yet enrolled
    enrolled_ids = section.enrollments.values_list('student_id', flat=True)
    enroll_form.fields['student'].queryset = Student.objects.exclude(id__in=enrolled_ids).select_related('user')

    if request.method == 'POST' and enroll_form.is_valid():
        student = enroll_form.cleaned_data['student']
        StudentSection.objects.get_or_create(student=student, section=section)
        messages.success(request, f'{student} enrolled in {section.name}.')
        return redirect('section_detail', pk=pk)

    return render(request, 'core/section_detail.html', {
        'section': section,
        'enroll_form': enroll_form,
    })


@login_required
@admin_required
def student_unenroll(request, section_pk, student_pk):
    enrollment = get_object_or_404(StudentSection, section_id=section_pk, student_id=student_pk)
    if request.method == 'POST':
        enrollment.delete()
        messages.success(request, 'Student removed from section.')
    return redirect('section_detail', pk=section_pk)


# ─── Schedules ─────────────────────────────────────────────────────────────────

@login_required
@admin_required
def schedule_list(request):
    schedules = Schedule.objects.select_related(
        'section__subject', 'section__teacher__user'
    ).order_by('day_of_week', 'start_time')
    return render(request, 'core/schedule_list.html', {'schedules': schedules})


@login_required
@admin_required
def schedule_create(request):
    form = ScheduleForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        try:
            form.save()
            messages.success(request, 'Schedule created.')
            return redirect('schedule_list')
        except ValidationError as e:
            messages.error(request, str(e.message))
    return render(request, 'core/schedule_form.html', {'form': form, 'title': 'Add Schedule'})


@login_required
@admin_required
def schedule_edit(request, pk):
    schedule = get_object_or_404(Schedule, pk=pk)
    form = ScheduleForm(request.POST or None, instance=schedule)
    if request.method == 'POST' and form.is_valid():
        try:
            form.save()
            messages.success(request, 'Schedule updated.')
            return redirect('schedule_list')
        except ValidationError as e:
            messages.error(request, str(e.message))
    return render(request, 'core/schedule_form.html', {'form': form, 'title': 'Edit Schedule', 'schedule': schedule})


@login_required
@admin_required
def schedule_delete(request, pk):
    schedule = get_object_or_404(Schedule, pk=pk)
    if request.method == 'POST':
        schedule.delete()
        messages.success(request, 'Schedule deleted.')
        return redirect('schedule_list')
    return render(request, 'core/confirm_delete.html', {'object': schedule, 'type': 'Schedule'})


# ─── Attendance Sessions (Teacher) ─────────────────────────────────────────────

@login_required
@teacher_required
def session_start(request, schedule_pk):
    schedule = get_object_or_404(Schedule, pk=schedule_pk)
    teacher = request.user.teacher_profile

    # Verify the teacher owns this section
    if schedule.section.teacher != teacher and request.user.role != 'admin':
        messages.error(request, "You are not assigned to this section.")
        return redirect('dashboard')

    today = timezone.localdate()
    # Check for existing open session today
    existing = AttendanceSession.objects.filter(
        schedule=schedule, date=today, status='open'
    ).first()
    if existing:
        messages.info(request, 'A session is already open for today.')
        return redirect('session_live', pk=existing.pk)

    if request.method == 'POST':
        session = AttendanceSession.objects.create(
            schedule=schedule,
            date=today,
            started_by=teacher,
            status='open',
        )
        # Pre-populate attendance records as "absent" for all enrolled students
        enrollments = StudentSection.objects.filter(section=schedule.section).select_related('student')
        records = [
            AttendanceRecord(session=session, student=e.student, status='absent')
            for e in enrollments
        ]
        AttendanceRecord.objects.bulk_create(records)
        messages.success(request, f'Attendance session started for {schedule.section.name}.')
        return redirect('session_live', pk=session.pk)

    return render(request, 'core/session_start.html', {'schedule': schedule})


@login_required
@teacher_required
def session_live(request, pk):
    session = get_object_or_404(
        AttendanceSession.objects.select_related(
            'schedule__section__subject', 'schedule__section__teacher__user'
        ), pk=pk
    )
    records = session.records.select_related('student__user').order_by('student__user__last_name')
    return render(request, 'core/session_live.html', {
        'session': session,
        'records': records,
    })


@login_required
@teacher_required
def session_close(request, pk):
    session = get_object_or_404(AttendanceSession, pk=pk)
    if request.method == 'POST':
        session.status = 'closed'
        session.closed_at = timezone.now()
        session.save()
        messages.success(request, 'Attendance session closed.')
        return redirect('session_report', pk=pk)
    return redirect('session_live', pk=pk)


@login_required
def session_report(request, pk):
    session = get_object_or_404(
        AttendanceSession.objects.select_related(
            'schedule__section__subject', 'schedule__section__teacher__user', 'started_by__user'
        ), pk=pk
    )
    records = session.records.select_related('student__user').order_by('student__user__last_name')

    # Manual edit (teacher/admin)
    if request.method == 'POST' and request.user.role in ['admin', 'teacher']:
        record_id = request.POST.get('record_id')
        status = request.POST.get('status')
        remarks = request.POST.get('remarks', '')
        record = get_object_or_404(AttendanceRecord, pk=record_id)
        record.status = status
        record.remarks = remarks
        record.save()
        messages.success(request, 'Record updated.')
        return redirect('session_report', pk=pk)

    present_count = records.filter(status='present').count()
    late_count = records.filter(status='late').count()
    absent_count = records.filter(status='absent').count()

    return render(request, 'core/session_report.html', {
        'session': session,
        'records': records,
        'present_count': present_count,
        'late_count': late_count,
        'absent_count': absent_count,
        'total': records.count(),
    })


@login_required
def attendance_history(request):
    """Attendance history - filtered by role."""
    user = request.user
    if user.role == 'student':
        student = get_object_or_404(Student, user=user)
        records = AttendanceRecord.objects.filter(student=student).select_related(
            'session__schedule__section__subject'
        ).order_by('-session__date')
        return render(request, 'core/attendance_history_student.html', {'records': records})
    elif user.role == 'teacher':
        teacher = get_object_or_404(Teacher, user=user)
        sessions = AttendanceSession.objects.filter(started_by=teacher).select_related(
            'schedule__section__subject'
        ).order_by('-date')
        return render(request, 'core/attendance_history_teacher.html', {'sessions': sessions})
    else:
        sessions = AttendanceSession.objects.select_related(
            'schedule__section__subject', 'started_by__user'
        ).order_by('-date')
        return render(request, 'core/attendance_history_admin.html', {'sessions': sessions})


# ─── Mark Present API (AJAX from face recognition) ────────────────────────────

@login_required
def mark_present_api(request):
    """Called by face recognition to mark a student present."""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    import json
    data = json.loads(request.body)
    session_id = data.get('session_id')
    student_id = data.get('student_id')
    confidence = data.get('confidence', 0.0)

    try:
        session = AttendanceSession.objects.get(pk=session_id, status='open')
        student = Student.objects.get(pk=student_id)
        record, created = AttendanceRecord.objects.get_or_create(
            session=session,
            student=student,
            defaults={'status': 'absent'}
        )
        if record.status == 'absent':
            now = timezone.now()
            schedule = session.schedule
            # Late if past 15 minutes from start
            late_cutoff_minutes = 15
            session_start = timezone.make_aware(
                timezone.datetime.combine(session.date, schedule.start_time)
            )
            is_late = (now - session_start).total_seconds() > (late_cutoff_minutes * 60)
            record.status = 'late' if is_late else 'present'
            record.recognized_at = now
            record.confidence_score = confidence
            record.save()
            return JsonResponse({
                'success': True,
                'status': record.status,
                'student_name': student.user.get_full_name() or student.user.username,
                'student_id': student.student_id,
            })
        else:
            return JsonResponse({
                'success': False,
                'message': f'Already marked as {record.status}',
                'student_name': student.user.get_full_name(),
            })
    except (AttendanceSession.DoesNotExist, Student.DoesNotExist) as e:
        return JsonResponse({'error': str(e)}, status=404)
