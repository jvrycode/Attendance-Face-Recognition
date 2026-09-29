"""
Rename legacy faculty IDs from the EMP- prefix to FAC- (Faculty) for college usage.
Skips any row whose FAC- equivalent already exists to respect the unique constraint.
"""
from django.db import migrations


def _swap_prefix(apps, old, new):
    Teacher = apps.get_model('accounts', 'Teacher')
    for teacher in Teacher.objects.filter(employee_id__startswith=old):
        candidate = new + teacher.employee_id[len(old):]
        if not Teacher.objects.filter(employee_id=candidate).exists():
            teacher.employee_id = candidate
            teacher.save(update_fields=['employee_id'])


def forwards(apps, schema_editor):
    _swap_prefix(apps, 'EMP-', 'FAC-')


def backwards(apps, schema_editor):
    # Non-destructive no-op: FAC- IDs may have been created intentionally.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0008_expand_teacher_profile'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
