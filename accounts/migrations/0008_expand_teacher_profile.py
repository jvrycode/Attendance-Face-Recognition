"""
Expand Teacher profile with comprehensive fields following education system standards.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_backfill_student_biometrics'),
    ]

    operations = [
        migrations.AddField(
            model_name='teacher',
            name='title',
            field=models.CharField(max_length=50, blank=True, default='', help_text='Academic title (e.g., Prof., Dr., Engr.)'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='date_hired',
            field=models.DateField(null=True, blank=True, help_text='Date when faculty member was hired'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='employment_status',
            field=models.CharField(max_length=50, blank=True, default='Regular', help_text='Employment status (e.g., Regular, Part-time, Contractual)'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='position',
            field=models.CharField(max_length=100, blank=True, default='', help_text='Position/rank (e.g., Assistant Professor, Instructor)'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='contact_number',
            field=models.CharField(max_length=30, blank=True, default=''),
        ),
        migrations.AddField(
            model_name='teacher',
            name='office_location',
            field=models.CharField(max_length=150, blank=True, default=''),
        ),
        migrations.AddField(
            model_name='teacher',
            name='consultation_hours',
            field=models.TextField(blank=True, default='', help_text='Available consultation schedule'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='education_background',
            field=models.TextField(blank=True, default='', help_text='Highest educational attainment and degrees'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='certifications',
            field=models.TextField(blank=True, default='', help_text='Professional certifications and licenses'),
        ),
    ]
