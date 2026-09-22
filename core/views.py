import datetime
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from django.db.models import Count, Q
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from .models import Program, ProgramSection, Subject, Section, Schedule, AttendanceSession, AttendanceRecord, StudentSection
from .forms import ProgramForm, ProgramSectionForm, SubjectForm, SectionForm, ScheduleForm, EnrollStudentForm, AttendanceRecordEditForm
from accounts.models import Teacher, Student
from accounts.decorators import admin_required, teacher_required


# ─── Academic Programs (Admin only) ───────────────────────────────────────────

@login_required
@admin_required
def program_list(request):
    programs = Program.objects.annotate(
        section_count=Count('sections', distinct=True),
        subject_count=Count('subjects', distinct=True)
    ).order_by('code')
    return render(request, 'core/program_list.html', {'programs': programs})


@login_required
@admin_required
def program_create(request):
    form = ProgramForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        prog = form.save()
        messages.success(request, f'Program "{prog.code}" created successfully.')
        return redirect('program_list')
    return render(request, 'core/program_form.html', {'form': form, 'title': 'Add Academic Program'})


@login_required
@admin_required
def program_edit(request, pk):
    program = get_object_or_404(Program, pk=pk)
    form = ProgramForm(request.POST or None, instance=program)
    if request.method == 'POST' and form.is_valid():
        form.save()
        messages.success(request, f'Program "{program.code}" updated successfully.')
        return redirect('program_list')
    return render(request, 'core/program_form.html', {'form': form, 'title': 'Edit Program', 'program': program})


@login_required
@admin_required
def program_delete(request, pk):
    program = get_object_or_404(Program, pk=pk)
    if request.method == 'POST':
        program.delete()
        messages.success(request, 'Program deleted.')
        return redirect('program_list')
    return render(request, 'core/confirm_delete.html', {'object': program, 'type': 'Program'})


# ─── Section Catalog (3NF Master Definitions - Admin only) ────────────────────

@login_required
@admin_required
def section_catalog_list(request):
    """Admin view to view and manage standard section definitions grouped by Program."""
    programs = Program.objects.prefetch_related('standard_sections').order_by('code')
    selected_program_id = request.GET.get('program')
    
    psections_qs = ProgramSection.objects.select_related('program').order_by('program__code', 'year_level', 'name')
    if selected_program_id:
        psections_qs = psections_qs.filter(program_id=selected_program_id)

    form = ProgramSectionForm()

    return render(request, 'core/section_catalog_list.html', {
        'programs': programs,
        'program_sections': psections_qs,
        'selected_program_id': selected_program_id,
        'form': form,
    })


@login_required
@admin_required
def section_catalog_create(request):
    """Admin creates a new ProgramSection definition in the catalog."""
    form = ProgramSectionForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        psec = form.save()
        messages.success(request, f'Section "{psec.name}" added to {psec.program.code} catalog.')
        return redirect('section_catalog_list')
    return render(request, 'core/section_catalog_form.html', {'form': form, 'title': 'Add Section to Catalog'})


@login_required
@admin_required
def section_catalog_delete(request, pk):
    psec = get_object_or_404(ProgramSection, pk=pk)
    if request.method == 'POST':
        name = psec.name
        code = psec.program.code
        psec.delete()
        messages.success(request, f'Section "{name}" deleted from {code}.')
        return redirect('section_catalog_list')
    return render(request, 'core/confirm_delete.html', {'object': psec, 'type': 'Section Definition'})


# ─── Dynamic Dropdown APIs (Program-Dependent Filtering) ──────────────────────

@login_required
def api_program_sections(request, program_id):
    """Returns JSON list of master ProgramSections belonging to a specific Program."""
    psections = ProgramSection.objects.filter(program_id=program_id).order_by('year_level', 'name')
    data = [
        {
            'id': ps.pk,
            'name': ps.name,
            'year_level': ps.year_level,
            'year_level_display': ps.get_year_level_display(),
        }
        for ps in psections
    ]
    return JsonResponse({'sections': data})


@login_required
@admin_required
def api_create_program_section(request):
    """Creates a new ProgramSection master record via AJAX quick-add modal."""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    
    import json
    try:
        if request.content_type == 'application/json':
            payload = json.loads(request.body)
        else:
            payload = request.POST

        program_id = payload.get('program_id')
        name = (payload.get('name') or '').strip()
        year_level = int(payload.get('year_level', 1))

        if not program_id or not name:
            return JsonResponse({'error': 'Program and Section Name are required.'}, status=400)

        program = get_object_or_404(Program, pk=program_id)
        psec, created = ProgramSection.objects.get_or_create(
            program=program,
            name=name,
            defaults={'year_level': year_level}
        )

        return JsonResponse({
            'success': True,
            'created': created,
            'section': {
                'id': psec.pk,
                'name': psec.name,
                'year_level': psec.year_level,
                'year_level_display': psec.get_year_level_display(),
                'program_code': program.code,
            }
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
def api_sections_by_program(request, program_id):
    """Returns JSON list of active class sections belonging to a specific Program."""
    sections = Section.objects.filter(program_id=program_id).order_by('name')
    data = [
        {'id': s.pk, 'name': s.name, 'year_level': s.get_year_level_display()}
        for s in sections
    ]
    return JsonResponse({'sections': data})


# ─── Subjects (Admin only) ─────────────────────────────────────────────────────

@login_required
@admin_required
def subject_list(request):
    subjects = Subject.objects.select_related('program', 'section', 'teacher__user').order_by('code')
    return render(request, 'core/subject_list.html', {'subjects': subjects})


@login_required
@admin_required
def subject_create(request):
    form = SubjectForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        subject = form.save()
        # Automatically connect section's primary subject if currently empty
        if subject.section and not subject.section.subject:
            subject.section.subject = subject
            subject.section.save()
        messages.success(request, f'Subject "{subject.code} - {subject.name}" linked successfully.')
        return redirect('subject_list')
    return render(request, 'core/subject_form.html', {'form': form, 'title': 'Add Subject'})


@login_required
@admin_required
def subject_edit(request, pk):
    subject = get_object_or_404(Subject, pk=pk)
    form = SubjectForm(request.POST or None, instance=subject)
    if request.method == 'POST' and form.is_valid():
        subj = form.save()
        if subj.section and not subj.section.subject:
            subj.section.subject = subj
            subj.section.save()
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
def section_list(request):
    base_qs = Section.objects.select_related(
        'program', 'subject', 'teacher__user'
    ).prefetch_related('schedules', 'subjects').annotate(
        student_count=Count('enrollments', distinct=True)
    ).order_by('program__code', 'name')

    if request.user.role == 'admin':
        sections = base_qs
    elif request.user.role == 'teacher':
        teacher = getattr(request.user, 'teacher_profile', None)
        if teacher:
            from django.db.models import Q
            sections = base_qs.filter(Q(teacher=teacher) | Q(subjects__teacher=teacher)).distinct()
        else:
            sections = Section.objects.none()
    elif request.user.role == 'student':
        student = getattr(request.user, 'student_profile', None)
        if student:
            sections = base_qs.filter(enrollments__student=student).distinct()
        else:
            sections = Section.objects.none()
    else:
        messages.error(request, "Permission denied.")
        return redirect('dashboard')

    from core.services import TimetableService
    timetable_data = TimetableService.build_timetable_data(sections)

    return render(request, 'core/section_list.html', {
        'sections': sections,
        'timetable': timetable_data,
    })


@login_required
@admin_required
def section_create(request):
    form = SectionForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        section = form.save()
        messages.success(request, f'Section "{section.name}" created under {section.program.code if section.program else "general program"}.')
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
def section_detail(request, pk):
    section = get_object_or_404(
        Section.objects.select_related('program', 'subject', 'teacher__user').prefetch_related(
            'schedules', 'enrollments__student__user', 'subjects'
        ), pk=pk
    )

    if request.user.role == 'teacher':
        teacher = getattr(request.user, 'teacher_profile', None)
        is_assigned = (section.teacher == teacher) or section.subjects.filter(teacher=teacher).exists()
        if not is_assigned and request.user.role != 'admin':
            messages.error(request, "Permission denied: You are not assigned to this section.")
            return redirect('dashboard')
    elif request.user.role != 'admin':
        messages.error(request, "Permission denied.")
        return redirect('dashboard')

    enroll_form = None
    if request.user.role == 'admin':
        enroll_form = EnrollStudentForm(request.POST or None)
        # Students not yet enrolled
        enrolled_ids = section.enrollments.values_list('student_id', flat=True)
        enroll_form.fields['student'].queryset = Student.objects.exclude(id__in=enrolled_ids).select_related('user')

        if request.method == 'POST' and enroll_form.is_valid():
            student = enroll_form.cleaned_data['student']
            StudentSection.objects.get_or_create(student=student, section=section)
            from face_app.services.face_service import FaceService
            FaceService.invalidate_cache(section.pk)
            messages.success(request, f'{student} enrolled in {section.name}.')
            return redirect('section_detail', pk=pk)

    return render(request, 'core/section_detail.html', {
        'section': section,
        'enroll_form': enroll_form,
    })


@login_required
def student_unenroll(request, section_pk, student_pk):
    enrollment = get_object_or_404(StudentSection, section_id=section_pk, student_id=student_pk)
    if request.user.role == 'teacher':
        teacher = getattr(request.user, 'teacher_profile', None)
        if enrollment.section.teacher != teacher and request.user.role != 'admin':
            messages.error(request, "Permission denied.")
            return redirect('dashboard')
    elif request.user.role != 'admin':
        messages.error(request, "Permission denied.")
        return redirect('dashboard')

    if request.method == 'POST':
        enrollment.delete()
        from face_app.services.face_service import FaceService
        FaceService.invalidate_cache(section_pk)
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
        cd = form.cleaned_data
        sched = Schedule(
            section=cd['section'],
            day_of_week=cd['day_1'],
            day_2=cd.get('day_2') or None,
            start_time=cd['start_time'],
            end_time=cd['end_time'],
            room=cd['room'],
            effective_from=cd.get('effective_from'),
            effective_to=cd.get('effective_to'),
        )
        try:
            sched.full_clean()
            sched.save()
            messages.success(request, f'Schedule created: {sched}')
            return redirect('schedule_list')
        except ValidationError as e:
            messages.error(request, str(e.message))
    return render(request, 'core/schedule_form.html', {'form': form, 'title': 'Add Schedule'})


@login_required
@admin_required
def schedule_edit(request, pk):
    schedule = get_object_or_404(Schedule, pk=pk)
    initial = {
        'section': schedule.section,
        'day_1': schedule.day_of_week,
        'day_2': schedule.day_2 or '',
        'start_time': schedule.start_time,
        'end_time': schedule.end_time,
        'room': schedule.room,
        'effective_from': schedule.effective_from,
        'effective_to': schedule.effective_to,
    }
    form = ScheduleForm(request.POST or None, initial=initial)
    if request.method == 'POST' and form.is_valid():
        cd = form.cleaned_data
        schedule.section = cd['section']
        schedule.day_of_week = cd['day_1']
        schedule.day_2 = cd.get('day_2') or None
        schedule.start_time = cd['start_time']
        schedule.end_time = cd['end_time']
        schedule.room = cd['room']
        schedule.effective_from = cd.get('effective_from')
        schedule.effective_to = cd.get('effective_to')
        try:
            schedule.full_clean()
            schedule.save()
            messages.success(request, f'Schedule updated: {schedule}')
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

    # Verify the teacher owns this section or subject
    is_assigned = (schedule.section.teacher == teacher) or schedule.section.subjects.filter(teacher=teacher).exists()
    if not is_assigned and request.user.role != 'admin':
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
    if session.status == 'closed':
        messages.warning(request, f"Attendance session #{pk} is currently closed. You can re-open it below if needed.")
        return redirect('session_report', pk=pk)

    # Dynamically sync any newly enrolled section students into this session as absent
    section_students = Student.objects.filter(enrollments__section=session.schedule.section)
    existing_ids = set(session.records.values_list('student_id', flat=True))
    missing_students = [s for s in section_students if s.id not in existing_ids]
    if missing_students:
        AttendanceRecord.objects.bulk_create([
            AttendanceRecord(session=session, student=s, status='absent')
            for s in missing_students
        ])

    records = session.records.select_related('student__user').order_by('student__user__last_name')
    enrolled_face_count = records.filter(
        student__face_encoding__isnull=False
    ).exclude(student__face_encoding='').count()
    return render(request, 'core/session_live.html', {
        'session': session,
        'records': records,
        'enrolled_face_count': enrolled_face_count,
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
@teacher_required
def session_reopen(request, pk):
    session = get_object_or_404(AttendanceSession, pk=pk)
    if request.method == 'POST':
        session.status = 'open'
        session.closed_at = None
        session.save()
        messages.success(request, f'Attendance session #{pk} re-opened.')
        return redirect('session_live', pk=pk)
    return redirect('session_report', pk=pk)


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
def section_attendance_report(request):
    """Direct daily or weekly attendance report for a specific section assigned to the teacher (or any section for admin)."""
    user = request.user
    teacher = getattr(user, 'teacher_profile', None)

    # 1. Determine available sections
    if user.role == 'admin':
        available_sections = Section.objects.select_related(
            'program', 'subject', 'teacher__user'
        ).prefetch_related('subjects').order_by('program__code', 'name')
    elif user.role == 'teacher':
        if not teacher:
            messages.error(request, "No teacher profile found.")
            return redirect('dashboard')
        available_sections = Section.objects.filter(
            Q(teacher=teacher) | Q(subjects__teacher=teacher)
        ).select_related('program', 'subject', 'teacher__user').prefetch_related('subjects').distinct().order_by('program__code', 'name')
    else:
        messages.error(request, "Permission denied.")
        return redirect('dashboard')

    if not available_sections.exists():
        return render(request, 'core/section_attendance_report.html', {
            'available_sections': available_sections,
            'selected_section': None,
            'error_message': 'No sections assigned yet.',
        })

    # 2. Selected Section
    section_id = request.GET.get('section_id')
    selected_section = None
    if section_id:
        try:
            selected_section = available_sections.filter(pk=int(section_id)).first()
        except (ValueError, TypeError):
            selected_section = None

    if not selected_section:
        selected_section = available_sections.first()

    # 3. Report type: 'daily' or 'weekly'
    report_type = request.GET.get('report_type', 'daily').lower()
    if report_type not in ['daily', 'weekly']:
        report_type = 'daily'

    # 4. Target Date
    date_str = request.GET.get('date')
    today = timezone.localdate()
    if date_str:
        try:
            target_date = datetime.date.fromisoformat(date_str)
        except ValueError:
            target_date = today
    else:
        target_date = today

    # Enrolled students for this section
    enrolled_students = Student.objects.filter(
        enrollments__section=selected_section
    ).select_related('user').order_by('user__last_name', 'user__first_name')

    context = {
        'available_sections': available_sections,
        'selected_section': selected_section,
        'report_type': report_type,
        'target_date': target_date,
        'target_date_str': target_date.strftime('%Y-%m-%d'),
        'today': today,
        'enrolled_students_count': enrolled_students.count(),
    }

    if report_type == 'daily':
        # Sessions conducted on target_date for this section
        sessions = AttendanceSession.objects.filter(
            schedule__section=selected_section,
            date=target_date
        ).select_related('schedule', 'started_by__user').order_by('schedule__start_time')

        has_sessions = sessions.exists()
        records_by_student = {}
        if has_sessions:
            records_qs = AttendanceRecord.objects.filter(
                session__in=sessions
            ).select_related('student__user', 'session').order_by('-recognized_at')
            for r in records_qs:
                if r.student_id not in records_by_student:
                    records_by_student[r.student_id] = r

        student_rows = []
        present_cnt = 0
        late_cnt = 0
        absent_cnt = 0

        for s in enrolled_students:
            rec = records_by_student.get(s.id)
            status = rec.status if rec else ('absent' if has_sessions else 'none')
            if status == 'present':
                present_cnt += 1
            elif status == 'late':
                late_cnt += 1
            elif status == 'absent':
                absent_cnt += 1

            student_rows.append({
                'student': s,
                'status': status,
                'time_marked': rec.recognized_at if rec else None,
                'confidence': (rec.confidence_score * 100) if (rec and rec.confidence_score is not None) else None,
                'remarks': rec.remarks if rec else '',
            })

        total_marked = present_cnt + late_cnt + absent_cnt
        attendance_rate = round((present_cnt + late_cnt) / total_marked * 100, 1) if total_marked > 0 else 0

        prev_date = target_date - datetime.timedelta(days=1)
        next_date = target_date + datetime.timedelta(days=1)

        context.update({
            'sessions': sessions,
            'has_sessions': has_sessions,
            'student_rows': student_rows,
            'present_cnt': present_cnt,
            'late_cnt': late_cnt,
            'absent_cnt': absent_cnt,
            'attendance_rate': attendance_rate,
            'prev_date_str': prev_date.strftime('%Y-%m-%d'),
            'next_date_str': next_date.strftime('%Y-%m-%d'),
        })

    else:
        # Weekly Report: Monday to Saturday of the week containing target_date
        monday = target_date - datetime.timedelta(days=target_date.weekday())
        sunday = monday + datetime.timedelta(days=6)

        # Sessions conducted in that week for this section
        sessions = AttendanceSession.objects.filter(
            schedule__section=selected_section,
            date__range=[monday, sunday]
        ).select_related('schedule').order_by('date', 'schedule__start_time')

        days_config = [
            ('Mon', 0), ('Tue', 1), ('Wed', 2), ('Thu', 3), ('Fri', 4), ('Sat', 5)
        ]
        week_days = []
        active_session_dates = {s.date for s in sessions}

        for d_name, offset in days_config:
            curr_day = monday + datetime.timedelta(days=offset)
            day_sessions = [s for s in sessions if s.date == curr_day]
            week_days.append({
                'day_name': d_name,
                'date': curr_day,
                'date_str': curr_day.strftime('%b %d'),
                'has_session': curr_day in active_session_dates,
                'sessions': day_sessions,
            })

        records_qs = AttendanceRecord.objects.filter(
            session__in=sessions
        ).select_related('student', 'session')
        status_map = {}
        for r in records_qs:
            status_map[(r.student_id, r.session.date)] = r.status

        student_rows = []
        total_present_all = 0
        total_late_all = 0
        total_absent_all = 0

        for s in enrolled_students:
            p_cnt = 0
            l_cnt = 0
            a_cnt = 0
            day_statuses = []

            for wday in week_days:
                if wday['has_session']:
                    st = status_map.get((s.id, wday['date']), 'absent')
                    day_statuses.append(st)
                    if st == 'present':
                        p_cnt += 1
                    elif st == 'late':
                        l_cnt += 1
                    else:
                        a_cnt += 1
                else:
                    day_statuses.append('no_class')

            student_sessions_count = len(active_session_dates)
            attended_count = p_cnt + l_cnt
            rate = round(attended_count / student_sessions_count * 100, 1) if student_sessions_count > 0 else 0

            total_present_all += p_cnt
            total_late_all += l_cnt
            total_absent_all += a_cnt

            student_rows.append({
                'student': s,
                'day_statuses': day_statuses,
                'present_count': p_cnt,
                'late_count': l_cnt,
                'absent_count': a_cnt,
                'attendance_rate': rate,
            })

        prev_week = target_date - datetime.timedelta(days=7)
        next_week = target_date + datetime.timedelta(days=7)
        total_possible = len(enrolled_students) * len(active_session_dates) if active_session_dates else 0
        overall_weekly_rate = round((total_present_all + total_late_all) / total_possible * 100, 1) if total_possible > 0 else 0

        context.update({
            'monday': monday,
            'sunday': sunday,
            'week_label': f"{monday.strftime('%b %d')} – {sunday.strftime('%b %d, %Y')}",
            'week_days': week_days,
            'student_rows': student_rows,
            'total_sessions_count': sessions.count(),
            'active_session_dates_count': len(active_session_dates),
            'overall_weekly_rate': overall_weekly_rate,
            'total_present_all': total_present_all,
            'total_late_all': total_late_all,
            'total_absent_all': total_absent_all,
            'prev_date_str': prev_week.strftime('%Y-%m-%d'),
            'next_date_str': next_week.strftime('%Y-%m-%d'),
        })

    return render(request, 'core/section_attendance_report.html', context)


@login_required
def attendance_history(request):
    """Attendance history - filtered by role. Directs teachers directly to their Section Attendance Report."""
    user = request.user
    if user.role == 'student':
        student = get_object_or_404(Student, user=user)
        records = AttendanceRecord.objects.filter(student=student).select_related(
            'session__schedule__section__subject'
        ).order_by('-session__date')
        return render(request, 'core/attendance_history_student.html', {'records': records})
    elif user.role == 'teacher':
        return redirect('section_attendance_report')
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
    from core.services.attendance_service import AttendanceService

    data = json.loads(request.body)
    session_id = data.get('session_id')
    student_id = data.get('student_id')
    confidence = float(data.get('confidence', 1.0))

    try:
        session = AttendanceSession.objects.get(pk=session_id, status='open')
        student = Student.objects.get(pk=student_id)

        record, is_new = AttendanceService.mark_attendance(
            session=session,
            student=student,
            confidence=confidence
        )

        if is_new:
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
                'status': record.status,
                'student_name': student.user.get_full_name() or student.user.username,
            })
    except (AttendanceSession.DoesNotExist, Student.DoesNotExist) as e:
        return JsonResponse({'error': str(e)}, status=404)
