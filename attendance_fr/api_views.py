"""
Centralized REST API Views for the SPA frontend (Cloudflare Pages).
Protected with JWT Authentication and CORS.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from django.shortcuts import get_object_or_404
from django.utils import timezone

from accounts.models import CustomUser, Teacher, Student
from accounts.serializers import CurrentUserProfileSerializer, StudentSerializer
from core.models import Subject, Section, Schedule, AttendanceSession, AttendanceRecord, StudentSection
from core.serializers import (
    SubjectSerializer, SectionSerializer, ScheduleSerializer,
    AttendanceSessionSerializer, AttendanceRecordSerializer
)
from core.services.schedule_service import ScheduleService
from core.services.attendance_service import AttendanceService
from face_app.services.face_service import FaceService
from face_app.utils import (
    base64_to_bytes, encode_face_from_frame, FR_AVAILABLE
)
from attendance_fr.permissions import (
    IsAdminRole,
    IsTeacherOrAdminRole,
    IsAdminOrReadOnly,
    IsSessionManager,
)


class CurrentUserAPIView(APIView):
    """GET /api/auth/me/ - Get current authenticated user details and profile."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = CurrentUserProfileSerializer(request.user)
        return Response(serializer.data)


class SubjectListCreateAPIView(ListCreateAPIView):
    queryset = Subject.objects.all().order_by('code')
    serializer_class = SubjectSerializer
    permission_classes = [IsAdminOrReadOnly]


class SectionListCreateAPIView(ListCreateAPIView):
    serializer_class = SectionSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'teacher' and hasattr(user, 'teacher_profile'):
            return Section.objects.filter(teacher=user.teacher_profile).order_by('name')
        return Section.objects.all().order_by('name')


class ScheduleListCreateAPIView(ListCreateAPIView):
    serializer_class = ScheduleSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        section_id = self.request.query_params.get('section_id')
        if section_id:
            return Schedule.objects.filter(section_id=section_id).order_by('day_of_week', 'start_time')
        return Schedule.objects.all().order_by('day_of_week', 'start_time')

    def perform_create(self, serializer):
        schedule = serializer.save()
        conflicts = ScheduleService.check_conflicts(schedule)
        if conflicts:
            schedule.delete()
            from django.core.exceptions import ValidationError
            raise ValidationError(conflicts[0])


class AttendanceSessionListAPIView(APIView):
    """GET /api/attendance/sessions/ - List attendance sessions."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        qs = AttendanceSession.objects.select_related(
            'schedule__section__subject', 'schedule__section__teacher__user'
        ).order_by('-date', '-created_at')

        if user.role == 'teacher' and hasattr(user, 'teacher_profile'):
            qs = qs.filter(schedule__section__teacher=user.teacher_profile)

        serializer = AttendanceSessionSerializer(qs[:50], many=True)
        return Response(serializer.data)


class AttendanceSessionStartAPIView(APIView):
    """POST /api/attendance/sessions/start/ - Start or resume session today."""
    permission_classes = [IsTeacherOrAdminRole]

    def post(self, request):
        schedule_id = request.data.get('schedule_id')
        if not schedule_id:
            return Response({'error': 'schedule_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        schedule = get_object_or_404(Schedule, pk=schedule_id)

        # Teacher assignment verification
        if request.user.role == 'teacher':
            teacher = getattr(request.user, 'teacher_profile', None)
            if not teacher:
                return Response({'error': 'Teacher profile not found.'}, status=status.HTTP_403_FORBIDDEN)
            is_assigned = (
                (schedule.section.teacher == teacher) or
                schedule.section.subjects.filter(teacher=teacher).exists()
            )
            if not is_assigned:
                return Response({'error': 'You are not assigned to this class section.'}, status=status.HTTP_403_FORBIDDEN)

        today = timezone.localdate()

        session = AttendanceSession.objects.filter(schedule=schedule, date=today, status='open').first()
        created = False
        if not session:
            teacher = getattr(request.user, 'teacher_profile', None)
            session = AttendanceSession.objects.create(
                schedule=schedule,
                date=today,
                started_by=teacher,
                status='open'
            )
            created = True
            # Pre-populate records as absent
            enrollments = StudentSection.objects.filter(section=schedule.section).select_related('student')
            records = [
                AttendanceRecord(session=session, student=e.student, status='absent')
                for e in enrollments
            ]
            AttendanceRecord.objects.bulk_create(records)

        serializer = AttendanceSessionSerializer(session)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class AttendanceSessionCloseAPIView(APIView):
    """POST /api/attendance/sessions/<pk>/close/ - Close session."""
    permission_classes = [IsSessionManager]

    def post(self, request, pk):
        session = get_object_or_404(AttendanceSession, pk=pk)
        self.check_object_permissions(request, session)
        session.status = 'closed'
        session.closed_at = timezone.now()
        session.save()
        return Response({'success': True, 'message': 'Session closed'})


class AttendanceSessionDetailAPIView(APIView):
    """GET /api/attendance/sessions/<pk>/ - Get session detail and records."""
    permission_classes = [IsSessionManager]

    def get(self, request, pk):
        session = get_object_or_404(AttendanceSession, pk=pk)
        self.check_object_permissions(request, session)
        records = session.records.select_related('student__user').order_by('student__user__last_name')
        session_data = AttendanceSessionSerializer(session).data
        records_data = AttendanceRecordSerializer(records, many=True).data
        return Response({
            'session': session_data,
            'records': records_data,
        })


class FaceRecognizeAPIView(APIView):
    """POST /api/face/recognize/ - Process camera frame, recognize faces, mark attendance."""
    permission_classes = [IsSessionManager]

    def post(self, request):
        session_id = request.data.get('session_id')
        frame_b64 = request.data.get('frame')

        if not session_id or not frame_b64:
            return Response({'error': 'session_id and frame are required'}, status=status.HTTP_400_BAD_REQUEST)

        if not FR_AVAILABLE:
            return Response({'error': 'Face recognition engine unavailable'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        session = get_object_or_404(AttendanceSession, pk=session_id, status='open')
        self.check_object_permissions(request, session)

        frame_bytes = base64_to_bytes(frame_b64)

        result = FaceService.recognize_all_faces_in_frame(session, frame_bytes)
        return Response(result)


class FaceEnrollAPIView(APIView):
    """POST /api/face/enroll/ - Enroll student face vector from camera frame (Admin only)."""
    permission_classes = [IsAdminRole]

    def post(self, request):
        import json
        from io import BytesIO
        from PIL import Image
        from django.core.files.base import ContentFile

        student_id = request.data.get('student_id')
        frame_b64 = request.data.get('frame')

        if not student_id or not frame_b64:
            return Response({'error': 'student_id and frame are required'}, status=status.HTTP_400_BAD_REQUEST)

        student = get_object_or_404(Student, pk=student_id)

        frame_bytes = base64_to_bytes(frame_b64)
        encoding, locations = encode_face_from_frame(frame_bytes)

        if not encoding:
            return Response({'success': False, 'message': 'No face detected in frame.'}, status=status.HTTP_400_BAD_REQUEST)

        if len(locations) > 1:
            return Response({'success': False, 'message': 'Multiple faces detected. Please ensure only one face is visible.'}, status=status.HTTP_400_BAD_REQUEST)

        # Save encoding & image
        student.face_encoding = json.dumps(encoding)
        student.face_enrolled_at = timezone.now()

        img = Image.open(BytesIO(frame_bytes)).convert('RGB')
        loc = locations[0]
        pad = 30
        left = max(0, loc['left'] - pad)
        top = max(0, loc['top'] - pad)
        right = min(img.width, loc['right'] + pad)
        bottom = min(img.height, loc['bottom'] + pad)
        img = img.crop((left, top, right, bottom))

        img_io = BytesIO()
        img.save(img_io, format='JPEG', quality=90)
        filename = f"face_{student.student_id}_{timezone.now().strftime('%Y%m%d%H%M%S')}.jpg"
        student.face_image.save(filename, ContentFile(img_io.getvalue()), save=False)
        student.save()

        FaceService.invalidate_cache()
        return Response({
            'success': True,
            'message': f'Face enrolled successfully for {student.user.get_full_name()}!',
        })

