from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from attendance_fr.api_views import (
    CurrentUserAPIView,
    DashboardStatsAPIView,
    ProgramListCreateAPIView,
    ProgramDetailAPIView,
    ProgramSectionListCreateAPIView,
    ProgramSectionDetailAPIView,
    UserListCreateAPIView,
    StudentListAPIView,
    SubjectListCreateAPIView,
    SubjectDetailAPIView,
    SectionListCreateAPIView,
    SectionDetailAPIView,
    ScheduleListCreateAPIView,
    ScheduleDetailAPIView,
    AttendanceSessionListAPIView,
    AttendanceSessionStartAPIView,
    AttendanceSessionCloseAPIView,
    AttendanceSessionDetailAPIView,
    FaceRecognizeAPIView,
    FaceEnrollAPIView,
)

urlpatterns = [
    # JWT Authentication
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', CurrentUserAPIView.as_view(), name='api_auth_me'),

    # Dashboard & Users
    path('dashboard/stats/', DashboardStatsAPIView.as_view(), name='api_dashboard_stats'),
    path('programs/', ProgramListCreateAPIView.as_view(), name='api_programs'),
    path('programs/<int:pk>/', ProgramDetailAPIView.as_view(), name='api_program_detail'),
    path('program-sections/', ProgramSectionListCreateAPIView.as_view(), name='api_program_sections'),
    path('program-sections/<int:pk>/', ProgramSectionDetailAPIView.as_view(), name='api_program_section_detail'),
    path('users/', UserListCreateAPIView.as_view(), name='api_users'),
    path('students/', StudentListAPIView.as_view(), name='api_students'),

    # Academic Structure
    path('subjects/', SubjectListCreateAPIView.as_view(), name='api_subjects'),
    path('subjects/<int:pk>/', SubjectDetailAPIView.as_view(), name='api_subject_detail'),
    path('sections/', SectionListCreateAPIView.as_view(), name='api_sections'),
    path('sections/<int:pk>/', SectionDetailAPIView.as_view(), name='api_section_detail'),
    path('schedules/', ScheduleListCreateAPIView.as_view(), name='api_schedules'),
    path('schedules/<int:pk>/', ScheduleDetailAPIView.as_view(), name='api_schedule_detail'),

    # Attendance
    path('attendance/sessions/', AttendanceSessionListAPIView.as_view(), name='api_attendance_sessions'),
    path('attendance/sessions/start/', AttendanceSessionStartAPIView.as_view(), name='api_attendance_sessions_start'),
    path('attendance/sessions/<int:pk>/close/', AttendanceSessionCloseAPIView.as_view(), name='api_attendance_sessions_close'),
    path('attendance/sessions/<int:pk>/', AttendanceSessionDetailAPIView.as_view(), name='api_attendance_sessions_detail'),

    # Face Recognition
    path('face/recognize/', FaceRecognizeAPIView.as_view(), name='api_face_recognize'),
    path('face/enroll/', FaceEnrollAPIView.as_view(), name='api_face_enroll'),
]
