from rest_framework import serializers
from accounts.models import CustomUser, Teacher, Student


class CustomUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'role', 'phone', 'profile_image']
        read_only_fields = ['id']


class TeacherSerializer(serializers.ModelSerializer):
    user = CustomUserSerializer(read_only=True)

    class Meta:
        model = Teacher
        fields = ['id', 'user', 'employee_id', 'department', 'specialization']


class StudentSerializer(serializers.ModelSerializer):
    user = CustomUserSerializer(read_only=True)
    is_face_enrolled = serializers.BooleanField(read_only=True)

    class Meta:
        model = Student
        fields = ['id', 'user', 'student_id', 'year_level', 'course', 'is_face_enrolled', 'face_enrolled_at', 'face_image']


class CurrentUserProfileSerializer(serializers.ModelSerializer):
    teacher_profile = TeacherSerializer(read_only=True)
    student_profile = StudentSerializer(read_only=True)

    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'role', 'phone', 'profile_image', 'teacher_profile', 'student_profile']
