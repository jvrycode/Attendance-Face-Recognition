from rest_framework import serializers
from accounts.models import CustomUser, Teacher, Student


class CustomUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'role', 'phone', 'is_active', 'profile_image']
        read_only_fields = ['id']


class TeacherSerializer(serializers.ModelSerializer):
    user = CustomUserSerializer(read_only=True)

    class Meta:
        model = Teacher
        fields = [
            'id', 'user', 'employee_id', 'department', 'specialization',
            'title', 'date_hired', 'employment_status', 'position',
            'contact_number', 'office_location', 'consultation_hours',
            'education_background', 'certifications'
        ]


class StudentSerializer(serializers.ModelSerializer):
    user = CustomUserSerializer(read_only=True)
    course_details = serializers.SerializerMethodField()
    is_face_enrolled = serializers.SerializerMethodField()
    face_image = serializers.SerializerMethodField()
    face_enrolled_at = serializers.SerializerMethodField()
    program_code = serializers.SerializerMethodField()
    program_name = serializers.SerializerMethodField()
    display_academic_program = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            'id', 'user', 'student_id', 'year_level', 'course', 'course_ref', 'course_details',
            'program_code', 'program_name', 'display_academic_program',
            'middle_name', 'gender', 'birth_date', 'birth_place',
            'civil_status', 'blood_type', 'height', 'religion',
            'citizenship', 'languages_spoken',
            'current_address', 'current_region', 'current_province', 'current_municipality',
            'permanent_address', 'permanent_region', 'permanent_province', 'permanent_municipality',
            'telephone', 'mobile_number',
            'is_face_enrolled', 'face_enrolled_at', 'face_image'
        ]

    def get_course_details(self, obj):
        if not obj.course_ref:
            return None
        return {
            'id': obj.course_ref_id,
            'program_id': obj.course_ref.program_id,
            'program_code': obj.course_ref.program.code,
            'code': obj.course_ref.code,
            'name': obj.course_ref.name,
        }

    def get_is_face_enrolled(self, obj):
        """Read face enrollment status from StudentBiometric table."""
        if hasattr(obj, 'biometric') and obj.biometric:
            return bool(obj.biometric.face_encoding)
        return False

    def get_face_image(self, obj):
        """
        Short-lived signed link to the private face photo, only for users allowed to see it
        (admin, the student, their teachers); None for everyone else.
        """
        from attendance_fr.face_photos import face_photo_link
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request is not None else None
        return face_photo_link(obj, user=user)

    def get_face_enrolled_at(self, obj):
        """Read face_enrolled_at timestamp from StudentBiometric table."""
        if hasattr(obj, 'biometric') and obj.biometric:
            return obj.biometric.face_enrolled_at
        return None

    def _get_program_info(self, obj):
        if hasattr(obj, '_cached_program_info'):
            return obj._cached_program_info

        # 1. From active section enrollment
        try:
            enr = obj.enrollments.select_related('section__program').filter(section__program__isnull=False).first()
            if enr and enr.section and enr.section.program:
                info = (enr.section.program.code, enr.section.program.name)
                obj._cached_program_info = info
                return info
        except Exception:
            pass

        # 2. From ProgramSection master definition
        clean_course = (obj.course or '').strip()
        if clean_course:
            try:
                from core.models import ProgramSection
                ps = ProgramSection.objects.filter(course__iexact=clean_course).select_related('program').first()
                if ps and ps.program:
                    info = (ps.program.code, ps.program.name)
                    obj._cached_program_info = info
                    return info
            except Exception:
                pass

        # 3. Known FSUU Mapping fallback
        COURSE_MAP = {
            'BSIT': ('CITEC', 'College of Information, Technology, Entertainment, and Computing'),
            'BSCS': ('CITEC', 'College of Information, Technology, Entertainment, and Computing'),
            'BSEMC': ('CITEC', 'College of Information, Technology, Entertainment, and Computing'),
            'BSCRIM': ('CCJE', 'College of Criminal Justice Education'),
            'BSA': ('CoA', 'College of Accountancy'),
            'BSBA': ('CORE', 'College of Operations, Resources, and Entrepreneurship'),
            'BSHM': ('CIHT', 'College of Innovative Hospitality and Tourism'),
            'BSTM': ('CIHT', 'College of Innovative Hospitality and Tourism'),
            'BSN': ('CoN', 'College of Nursing'),
            'BSED': ('CTE', 'College of Teacher Education'),
            'BEED': ('CTE', 'College of Teacher Education'),
            'BSCE': ('CEnTech', 'College of Engineering and Technology'),
        }
        upper_crs = clean_course.upper()
        if upper_crs in COURSE_MAP:
            info = COURSE_MAP[upper_crs]
            obj._cached_program_info = info
            return info

        obj._cached_program_info = ('CITEC', 'College of Information, Technology, Entertainment, and Computing')
        return obj._cached_program_info

    def get_program_code(self, obj):
        code, _ = self._get_program_info(obj)
        return code

    def get_program_name(self, obj):
        _, name = self._get_program_info(obj)
        return name

    def get_display_academic_program(self, obj):
        code, _ = self._get_program_info(obj)
        course = obj.course or 'BSIT'
        if code:
            return f"{code} • {course}"
        return course


class CurrentUserProfileSerializer(serializers.ModelSerializer):
    teacher_profile = TeacherSerializer(read_only=True)
    student_profile = StudentSerializer(read_only=True)

    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'role', 'phone', 'is_active', 'profile_image', 'teacher_profile', 'student_profile']
