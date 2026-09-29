from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0013_backfill_subject_courses'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='programsection',
            index=models.Index(
                fields=['program', 'course_ref', 'year_level'],
                name='progsec_filter_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='section',
            index=models.Index(
                fields=['program', 'course_ref', 'year_level'],
                name='section_filter_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='section',
            index=models.Index(
                fields=['program_section', 'school_year', 'semester'],
                name='section_term_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='studentsection',
            index=models.Index(
                fields=['section', 'subject'],
                name='enroll_section_subject_idx',
            ),
        ),
    ]
