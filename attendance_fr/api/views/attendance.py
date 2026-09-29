"""
Attendance Views
Handles session lifecycle and manual attendance marking.
"""
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.utils import timezone

from accounts.models import Student
from core.models import Schedule, AttendanceSession
from attendance_fr.api.serializers.attendance import (
    AttendanceSessionSerializer,
    AttendanceRecordSerializer,
    AttendanceSessionStartSerializer,
    AttendanceSessionReopenSerializer,
    AttendanceSessionReopenAuditSerializer,
    ManualAttendanceMarkSerializer,
)
from attendance_fr.permissions import (
    IsTeacherRole,
    IsSessionManager,
    is_student_enrolled_for_schedule,
)
from attendance_fr.api.services.attendance import AttendanceService
from attendance_fr.api.services.response_cache import ResponseCache, request_scope
from attendance_fr.api.views.reports import (
    StudentAttendanceOverviewAPIView,
    StudentSectionCalendarAPIView,
)


# ── Session List ──────────────────────────────────────────────────────────────

class AttendanceSessionListAPIView(APIView):
    """GET /api/attendance/sessions/ - List attendance sessions."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models import Q
        user = request.user
        qs = AttendanceSession.objects.select_related(
            'schedule__section__subject', 'schedule__section__teacher__user',
            'schedule__subject__teacher__user', 'started_by__user',
        ).order_by('-date', '-created_at')

        if user.role == 'teacher' and hasattr(user, 'teacher_profile'):
            teacher = user.teacher_profile
            qs = qs.filter(
                Q(schedule__subject__teacher=teacher) |
                Q(schedule__section__teacher=teacher) |
                Q(started_by=teacher)
            )
        elif user.role == 'student' and hasattr(user, 'student_profile'):
            qs = qs.filter(schedule__section__enrollments__student=user.student_profile).distinct()
        elif user.role != 'admin':
            qs = qs.none()

        data = ResponseCache.get_or_set(
            'attendance', request_scope(request, endpoint='session-list'),
            lambda: AttendanceSessionSerializer(qs[:50], many=True).data,
        )
        return Response(data)


# ── Session Lifecycle ─────────────────────────────────────────────────────────

class AttendanceSessionStartAPIView(APIView):
    """POST /api/attendance/sessions/start/ - Start or resume session today."""
    permission_classes = [IsTeacherRole]

    def post(self, request):
        serializer = AttendanceSessionStartSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        schedule_id = serializer.validated_data['schedule_id']
        schedule = get_object_or_404(Schedule, pk=schedule_id)

        # Teacher assignment check
        if request.user.role == 'teacher':
            teacher = getattr(request.user, 'teacher_profile', None)
            if not teacher:
                return Response({'error': 'Teacher profile not found.'}, status=status.HTTP_403_FORBIDDEN)
            if not AttendanceService.verify_teacher_assignment(teacher, schedule):
                return Response(
                    {'error': 'You are not assigned to this class section or subject.'},
                    status=status.HTTP_403_FORBIDDEN,
                )

        inactive_error = AttendanceService.inactive_offering_error(schedule)
        if inactive_error:
            return Response({'error': inactive_error}, status=status.HTTP_403_FORBIDDEN)

        today = timezone.localdate()
        existing_open = AttendanceSession.objects.filter(schedule=schedule, date=today, status='open').first()

        # The time window applies to every start/resume request, not only new sessions.
        error = AttendanceService.validate_schedule_time_window(schedule)
        if error:
            return Response({'error': error}, status=status.HTTP_403_FORBIDDEN)

        created = False
        session = existing_open
        if not session:
            teacher = getattr(request.user, 'teacher_profile', None)
            session = AttendanceService.start_session(schedule, teacher=teacher)
            created = True

        return Response(
            AttendanceSessionSerializer(session).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class AttendanceSessionCloseAPIView(APIView):
    """POST /api/attendance/sessions/<pk>/close/ - Close session."""
    permission_classes = [IsSessionManager]

    def post(self, request, pk):
        session = get_object_or_404(AttendanceSession, pk=pk)
        self.check_object_permissions(request, session)
        AttendanceService.close_session(session)
        return Response({'success': True, 'message': 'Session closed'})


class AttendanceSessionReopenAPIView(APIView):
    """POST /api/attendance/sessions/<pk>/reopen/ - Reopen closed attendance session."""
    permission_classes = [IsSessionManager]

    def post(self, request, pk):
        session = get_object_or_404(AttendanceSession, pk=pk)
        self.check_object_permissions(request, session)
        serializer = AttendanceSessionReopenSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        if session.status != 'closed':
            return Response({'error': 'Only a closed attendance session can be reopened.'}, status=status.HTTP_409_CONFLICT)

        error = AttendanceService.validate_session_time_window(session)
        if error:
            return Response({'error': error}, status=status.HTTP_403_FORBIDDEN)
        teacher = request.user.teacher_profile
        session, audit = AttendanceService.reopen_session(
            session, teacher, serializer.validated_data['reason']
        )
        return Response({
            'success': True,
            'message': f'Attendance session #{pk} re-opened successfully.',
            'session': AttendanceSessionSerializer(session).data,
            'reopen_audit': AttendanceSessionReopenAuditSerializer(audit).data,
        })


class AttendanceSessionDetailAPIView(APIView):
    """GET /api/attendance/sessions/<pk>/ - Get session detail and records."""
    permission_classes = [IsSessionManager]

    def get(self, request, pk):
        session = get_object_or_404(AttendanceSession, pk=pk)
        self.check_object_permissions(request, session)
        records = session.records.select_related('student__user').order_by('student__user__last_name')
        data = ResponseCache.get_or_set(
            'attendance', request_scope(request, endpoint='session-detail', session_id=session.pk),
            lambda: {
                'session': AttendanceSessionSerializer(session).data,
                'records': AttendanceRecordSerializer(records, many=True).data,
                'reopen_history': AttendanceSessionReopenAuditSerializer(
                    session.reopen_history.select_related('reopened_by__user'), many=True
                ).data,
            },
        )
        return Response(data)


# ── Manual Marking ────────────────────────────────────────────────────────────

class ManualAttendanceMarkAPIView(APIView):
    """POST /api/attendance/records/mark/ - Manually mark student present/late/absent."""
    permission_classes = [IsSessionManager]

    def post(self, request):
        serializer = ManualAttendanceMarkSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        session_id = serializer.validated_data['session_id']
        student_id = serializer.validated_data['student_id']
        status_val = serializer.validated_data.get('status', 'present')

        session = get_object_or_404(AttendanceSession, pk=session_id)
        self.check_object_permissions(request, session)
        if session.status != 'open':
            return Response(
                {'error': 'Attendance session is closed. Reopen it explicitly before making changes.'},
                status=status.HTTP_409_CONFLICT,
            )
        error = AttendanceService.validate_session_time_window(session)
        if error:
            return Response({'error': error}, status=status.HTTP_403_FORBIDDEN)

        student = get_object_or_404(Student, pk=student_id)
        if not is_student_enrolled_for_schedule(student, session.schedule):
            return Response(
                {'error': 'Student is not enrolled in this session\'s section or subject.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        record = AttendanceService.mark_manual(session, student, status_val)

        return Response({
            'success': True,
            'status': record.status,
            'student_name': student.user.get_full_name() or student.user.username,
            'student_id': student.student_id,
            'record': AttendanceRecordSerializer(record).data,
        })


__all__ = [
    'AttendanceSessionListAPIView',
    'AttendanceSessionStartAPIView',
    'AttendanceSessionCloseAPIView',
    'AttendanceSessionReopenAPIView',
    'AttendanceSessionDetailAPIView',
    'ManualAttendanceMarkAPIView',
    'StudentAttendanceOverviewAPIView',
    'StudentSectionCalendarAPIView',
]
