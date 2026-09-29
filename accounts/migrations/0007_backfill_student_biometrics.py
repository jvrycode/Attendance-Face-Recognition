from django.db import migrations


def backfill_biometrics(apps, schema_editor):
    Student = apps.get_model('accounts', 'Student')
    StudentBiometric = apps.get_model('accounts', 'StudentBiometric')

    rows = []
    for student in Student.objects.all().only('id', 'face_encoding', 'face_image', 'face_enrolled_at'):
        has_data = bool(student.face_encoding) or bool(student.face_image) or bool(student.face_enrolled_at)
        if not has_data:
            continue
        rows.append(StudentBiometric(
            student_id=student.id,
            face_encoding=student.face_encoding,
            face_image=student.face_image,
            face_enrolled_at=student.face_enrolled_at,
        ))

    if rows:
        StudentBiometric.objects.bulk_create(rows, ignore_conflicts=True)


def reverse_backfill(apps, schema_editor):
    StudentBiometric = apps.get_model('accounts', 'StudentBiometric')
    StudentBiometric.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_add_student_biometric'),
    ]

    operations = [
        migrations.RunPython(backfill_biometrics, reverse_backfill),
    ]
