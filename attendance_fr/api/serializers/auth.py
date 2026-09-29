"""
Authentication & Profile Serializers
Handles validation and serialization for auth and user profile endpoints.
"""
from rest_framework import serializers
from accounts.models import CustomUser
from accounts.serializers import TeacherSerializer, StudentSerializer


class CurrentUserProfileSerializer(serializers.ModelSerializer):
    """Serializes the currently authenticated user including role-specific profile."""
    teacher_profile = TeacherSerializer(read_only=True)
    student_profile = StudentSerializer(read_only=True)

    class Meta:
        model = CustomUser
        fields = [
            'id', 'username', 'first_name', 'last_name', 'email', 'role',
            'phone', 'is_active', 'profile_image', 'teacher_profile', 'student_profile'
        ]
        read_only_fields = ['id', 'username', 'role', 'is_active']


class UserProfileUpdateSerializer(serializers.Serializer):
    """Validates the explicitly permitted self-service profile fields."""
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=20)

    # Teacher-maintained professional/contact details. HR identity fields stay read-only.
    specialization = serializers.CharField(required=False, allow_blank=True, max_length=150)
    title = serializers.CharField(required=False, allow_blank=True, max_length=50)
    contact_number = serializers.CharField(required=False, allow_blank=True, max_length=30)
    office_location = serializers.CharField(required=False, allow_blank=True, max_length=150)
    consultation_hours = serializers.CharField(required=False, allow_blank=True)
    education_background = serializers.CharField(required=False, allow_blank=True)
    certifications = serializers.CharField(required=False, allow_blank=True)

    # Student-maintained personal and contact details. Academic identity stays read-only.
    middle_name = serializers.CharField(required=False, allow_blank=True, max_length=100)
    gender = serializers.CharField(required=False, allow_blank=True, max_length=10)
    birth_date = serializers.DateField(required=False, allow_null=True)
    birth_place = serializers.CharField(required=False, allow_blank=True, max_length=150)
    civil_status = serializers.CharField(required=False, allow_blank=True, max_length=30)
    blood_type = serializers.CharField(required=False, allow_blank=True, max_length=10)
    height = serializers.CharField(required=False, allow_blank=True, max_length=20)
    religion = serializers.CharField(required=False, allow_blank=True, max_length=100)
    citizenship = serializers.CharField(required=False, allow_blank=True, max_length=50)
    languages_spoken = serializers.CharField(required=False, allow_blank=True, max_length=255)
    current_address = serializers.CharField(required=False, allow_blank=True, max_length=255)
    current_region = serializers.CharField(required=False, allow_blank=True, max_length=100)
    current_province = serializers.CharField(required=False, allow_blank=True, max_length=100)
    current_municipality = serializers.CharField(required=False, allow_blank=True, max_length=100)
    permanent_address = serializers.CharField(required=False, allow_blank=True, max_length=255)
    permanent_region = serializers.CharField(required=False, allow_blank=True, max_length=100)
    permanent_province = serializers.CharField(required=False, allow_blank=True, max_length=100)
    permanent_municipality = serializers.CharField(required=False, allow_blank=True, max_length=100)
    telephone = serializers.CharField(required=False, allow_blank=True, max_length=30)
    mobile_number = serializers.CharField(required=False, allow_blank=True, max_length=30)
