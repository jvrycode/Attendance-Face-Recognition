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
from accounts.serializers import CurrentUserProfileSerializer, TeacherSerializer, StudentSerializer
from core.models import Program, ProgramSection, Subject, Section, Schedule, AttendanceSession, AttendanceRecord, StudentSection
from core.serializers import (
    ProgramSerializer, ProgramSectionSerializer, SubjectSerializer, SectionSerializer, ScheduleSerializer,
    AttendanceSessionSerializer, AttendanceRecordSerializer
)
from core.services.schedule_service import ScheduleService
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
    """GET /api/auth/me/ - Get profile. PATCH /api/auth/me/ - Update profile."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = CurrentUserProfileSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        user = request.user
        data = request.data
        if 'first_name' in data: user.first_name = data['first_name']
        if 'last_name' in data: user.last_name = data['last_name']
        if 'email' in data: user.email = data['email']
        if 'phone' in data: user.phone = data['phone']
        user.save()
        return Response(CurrentUserProfileSerializer(user).data)


class DashboardStatsAPIView(APIView):
    """GET /api/dashboard/stats/ - Get role-tailored dashboard metrics."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models import Q
        user = request.user
        today = timezone.localdate()

        if user.role == 'admin':
            total_teachers = Teacher.objects.count()
            total_students = Student.objects.count()
            total_subjects = Subject.objects.count()
            total_sections = Section.objects.count()
            open_sessions = AttendanceSession.objects.filter(status='open').count()
            sessions_today = AttendanceSession.objects.filter(date=today).count()
            sessions_closed = AttendanceSession.objects.filter(date=today, status='closed').count()
            face_enrolled = Student.objects.exclude(Q(face_encoding__isnull=True) | Q(face_encoding='')).count()
            pct = round(face_enrolled / total_students * 100, 1) if total_students else 0

            return Response({
                'role': 'admin',
                'total_teachers': total_teachers,
                'total_students': total_students,
                'total_subjects': total_subjects,
                'total_sections': total_sections,
                'open_sessions_count': open_sessions,
                'sessions_today_count': sessions_today,
                'sessions_today_closed': sessions_closed,
                'face_enrolled_count': face_enrolled,
                'face_enrollment_pct': pct,
            })
        elif user.role == 'teacher':
            teacher = getattr(user, 'teacher_profile', None)
            sections_qs = Section.objects.filter(Q(teacher=teacher) | Q(subjects__teacher=teacher)).distinct()
            total_students = StudentSection.objects.filter(section__in=sections_qs).values('student_id').distinct().count()
            total_schedules = Schedule.objects.filter(section__in=sections_qs).count()
            open_sessions = AttendanceSession.objects.filter(
                Q(started_by=teacher) | Q(schedule__section__in=sections_qs),
                status='open'
            ).distinct().count()
            return Response({
                'role': 'teacher',
                'total_sections': sections_qs.count(),
                'total_students': total_students,
                'total_schedules': total_schedules,
                'open_sessions_count': open_sessions,
            })
        else:
            student = getattr(user, 'student_profile', None)
            enrolled_sections = StudentSection.objects.filter(student=student).count() if student else 0
            return Response({
                'role': 'student',
                'enrolled_sections': enrolled_sections,
                'is_face_enrolled': student.is_face_enrolled if student else False,
            })


class ProgramListCreateAPIView(ListCreateAPIView):
    """GET /api/programs/ - List programs. POST /api/programs/ - Create program (Admin only)."""
    queryset = Program.objects.all().order_by('code')
    serializer_class = ProgramSerializer
    permission_classes = [IsAdminOrReadOnly]


class ProgramDetailAPIView(RetrieveUpdateDestroyAPIView):
    queryset = Program.objects.all()
    serializer_class = ProgramSerializer
    permission_classes = [IsAdminOrReadOnly]


class UserListCreateAPIView(APIView):
    """GET /api/users/ - List users with profiles. POST /api/users/ - Create user (Admin only)."""
    permission_classes = [IsAdminOrReadOnly]

    def get(self, request):
        role = request.query_params.get('role')
        search = request.query_params.get('search')

        qs = CustomUser.objects.select_related('teacher_profile', 'student_profile').order_by('last_name', 'first_name')
        if role:
            qs = qs.filter(role=role)
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(username__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(email__icontains=search) |
                Q(teacher_profile__employee_id__icontains=search) |
                Q(student_profile__student_id__icontains=search)
            )

        serializer = CurrentUserProfileSerializer(qs[:100], many=True)
        return Response(serializer.data)

    def post(self, request):
        if request.user.role != 'admin':
            return Response({'error': 'Admin permissions required'}, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        username = data.get('username')
        password = data.get('password')
        first_name = data.get('first_name', '')
        last_name = data.get('last_name', '')
        email = data.get('email', '')
        role = data.get('role', 'teacher')
        phone = data.get('phone', '')

        if not username or not password:
            return Response({'error': 'Username and password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if CustomUser.objects.filter(username=username).exists():
            return Response({'error': 'Username already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        from django.db import transaction
        with transaction.atomic():
            user = CustomUser.objects.create_user(
                username=username,
                password=password,
                first_name=first_name,
                last_name=last_name,
                email=email,
                role=role,
                phone=phone
            )
            if role == 'teacher':
                Teacher.objects.create(
                    user=user,
                    employee_id=data.get('employee_id', f'EMP-{user.id:04d}'),
                    department=data.get('department', ''),
                    specialization=data.get('specialization', '')
                )
            elif role == 'student':
                Student.objects.create(
                    user=user,
                    student_id=data.get('student_id', f'STU-{user.id:04d}'),
                    year_level=int(data.get('year_level', 1)),
                    course=data.get('course', '')
                )

        serializer = CurrentUserProfileSerializer(user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class UserDetailAPIView(APIView):
    """GET/PATCH/DELETE /api/users/<id>/ - Manage single user (Admin only)."""
    permission_classes = [IsAdminRole]

    def get(self, request, pk):
        try:
            user = CustomUser.objects.select_related('teacher_profile', 'student_profile').get(pk=pk)
        except CustomUser.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(CurrentUserProfileSerializer(user).data)

    def put(self, request, pk):
        return self.patch(request, pk)

    def patch(self, request, pk):
        try:
            user = CustomUser.objects.select_related('teacher_profile', 'student_profile').get(pk=pk)
        except CustomUser.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        if 'first_name' in data:
            user.first_name = data['first_name']
        if 'last_name' in data:
            user.last_name = data['last_name']
        if 'email' in data:
            user.email = data['email']
        if 'phone' in data:
            user.phone = data['phone']
        if 'is_active' in data:
            user.is_active = bool(data['is_active'])
        if data.get('password'):
            user.set_password(data['password'])
        user.save()

        if hasattr(user, 'teacher_profile') and user.teacher_profile:
            tp = user.teacher_profile
            if 'department' in data:
                tp.department = data['department']
            if 'specialization' in data:
                tp.specialization = data['specialization']
            if 'employee_id' in data:
                tp.employee_id = data['employee_id']
            tp.save()

        if hasattr(user, 'student_profile') and user.student_profile:
            sp = user.student_profile
            if 'course' in data:
                sp.course = data['course']
            if 'year_level' in data:
                sp.year_level = int(data['year_level'])
            if 'student_id' in data:
                sp.student_id = data['student_id']
            sp.save()

        return Response(CurrentUserProfileSerializer(user).data)

    def delete(self, request, pk):
        try:
            user = CustomUser.objects.get(pk=pk)
        except CustomUser.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        if request.user.pk == user.pk:
            return Response({'error': 'You cannot delete your own account.'}, status=status.HTTP_400_BAD_REQUEST)

        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProgramSectionListCreateAPIView(ListCreateAPIView):
    """GET /api/program-sections/ - List master catalog sections. POST /api/program-sections/ - Create section definition."""
    serializer_class = ProgramSectionSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        program_id = self.request.query_params.get('program')
        if program_id:
            return ProgramSection.objects.filter(program_id=program_id).select_related('program').order_by('program__code', 'year_level', 'name')
        return ProgramSection.objects.select_related('program').order_by('program__code', 'year_level', 'name')


class ProgramSectionDetailAPIView(RetrieveUpdateDestroyAPIView):
    queryset = ProgramSection.objects.all()
    serializer_class = ProgramSectionSerializer
    permission_classes = [IsAdminOrReadOnly]


class StudentListAPIView(APIView):
    """GET /api/students/ - List all registered students with face enrollment status."""
    permission_classes = [IsAdminRole]

    def get(self, request):
        search = request.query_params.get('search')
        qs = Student.objects.select_related('user').order_by('user__last_name', 'user__first_name')
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(student_id__icontains=search) |
                Q(user__first_name__icontains=search) |
                Q(user__last_name__icontains=search) |
                Q(user__email__icontains=search)
            )
        serializer = StudentSerializer(qs[:100], many=True)
        return Response(serializer.data)


class SubjectListCreateAPIView(ListCreateAPIView):
    queryset = Subject.objects.select_related('program', 'teacher__user', 'section').order_by('code')
    serializer_class = SubjectSerializer
    permission_classes = [IsAdminOrReadOnly]


class SubjectDetailAPIView(RetrieveUpdateDestroyAPIView):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [IsAdminOrReadOnly]


class SectionListCreateAPIView(ListCreateAPIView):
    serializer_class = SectionSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        qs = Section.objects.select_related('program', 'teacher__user', 'subject').prefetch_related('schedules', 'enrollments')
        if user.role == 'teacher' and hasattr(user, 'teacher_profile'):
            return qs.filter(teacher=user.teacher_profile).order_by('name')
        elif user.role == 'student' and hasattr(user, 'student_profile'):
            return qs.filter(enrollments__student=user.student_profile).order_by('name')
        return qs.order_by('name')


class SectionDetailAPIView(RetrieveUpdateDestroyAPIView):
    queryset = Section.objects.all()
    serializer_class = SectionSerializer
    permission_classes = [IsAdminOrReadOnly]


class ScheduleListCreateAPIView(ListCreateAPIView):
    serializer_class = ScheduleSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        section_id = self.request.query_params.get('section_id')
        qs = Schedule.objects.select_related('section__program', 'section__teacher__user', 'section__subject')
        if section_id:
            qs = qs.filter(section_id=section_id)
        return qs.order_by('day_of_week', 'start_time')

    def perform_create(self, serializer):
        schedule = serializer.save()
        conflicts = ScheduleService.check_conflicts(schedule)
        if conflicts:
            schedule.delete()
            from django.core.exceptions import ValidationError
            raise ValidationError(conflicts[0])


class ScheduleDetailAPIView(RetrieveUpdateDestroyAPIView):
    queryset = Schedule.objects.all()
    serializer_class = ScheduleSerializer
    permission_classes = [IsAdminOrReadOnly]

    def perform_update(self, serializer):
        schedule = serializer.save()
        conflicts = ScheduleService.check_conflicts(schedule)
        if conflicts:
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

