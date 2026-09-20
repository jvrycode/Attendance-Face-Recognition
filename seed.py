"""
Seed script: Creates initial admin, sample teacher, and sample student.
Run with: python seed.py
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'attendance_fr.settings')
django.setup()

from accounts.models import CustomUser, Teacher, Student
from core.models import Subject, Section, Schedule

print("🌱 Seeding database...")

# ── Admin ─────────────────────────────────────────────────────────────────────
if not CustomUser.objects.filter(username='admin').exists():
    admin = CustomUser.objects.create_superuser(
        username='admin',
        email='admin@attendfr.edu',
        password='admin123',
        first_name='System',
        last_name='Administrator',
        role='admin'
    )
    print("✅ Admin created: username=admin, password=admin123")
else:
    print("ℹ️  Admin already exists.")

# ── Teacher ───────────────────────────────────────────────────────────────────
if not CustomUser.objects.filter(username='teacher1').exists():
    t_user = CustomUser.objects.create_user(
        username='teacher1',
        email='teacher1@attendfr.edu',
        password='teacher123',
        first_name='Maria',
        last_name='Santos',
        role='teacher'
    )
    teacher = Teacher.objects.create(
        user=t_user,
        employee_id='EMP-001',
        department='Computer Science',
        specialization='Software Engineering'
    )
    print("✅ Teacher created: username=teacher1, password=teacher123")
else:
    teacher = Teacher.objects.get(user__username='teacher1')
    print("ℹ️  Teacher already exists.")

# ── Student ───────────────────────────────────────────────────────────────────
if not CustomUser.objects.filter(username='student1').exists():
    s_user = CustomUser.objects.create_user(
        username='student1',
        email='student1@attendfr.edu',
        password='student123',
        first_name='Juan',
        last_name='Dela Cruz',
        role='student'
    )
    student = Student.objects.create(
        user=s_user,
        student_id='2024-00001',
        year_level=2,
        course='BSCS'
    )
    print("✅ Student created: username=student1, password=student123")
else:
    print("ℹ️  Student already exists.")

# ── Subject ───────────────────────────────────────────────────────────────────
subject, _ = Subject.objects.get_or_create(
    code='CS101',
    defaults={'name': 'Introduction to Computing', 'units': 3}
)
print(f"✅ Subject: {subject}")

# ── Section ───────────────────────────────────────────────────────────────────
section, _ = Section.objects.get_or_create(
    name='BSCS-2A',
    defaults={
        'subject': subject,
        'teacher': teacher,
        'school_year': '2025-2026',
        'semester': '1st'
    }
)
print(f"✅ Section: {section}")

# ── Schedule ──────────────────────────────────────────────────────────────────
from datetime import time
if not Schedule.objects.filter(section=section, day_of_week='Mon').exists():
    schedule = Schedule(
        section=section,
        day_of_week='Mon',
        start_time=time(8, 0),
        end_time=time(9, 30),
        room='Room 101'
    )
    schedule.save()
    print(f"✅ Schedule created: {schedule}")

# ── Enroll student into section ───────────────────────────────────────────────
from core.models import StudentSection
try:
    student_obj = Student.objects.get(user__username='student1')
    StudentSection.objects.get_or_create(student=student_obj, section=section)
    print(f"✅ Student enrolled in {section.name}")
except Student.DoesNotExist:
    pass

print("\n🎉 Seed complete!")
print("\nLogin credentials:")
print("  Admin:   username=admin    password=admin123")
print("  Teacher: username=teacher1 password=teacher123")
print("  Student: username=student1 password=student123")
print("\nStart the server with: python manage.py runserver")
