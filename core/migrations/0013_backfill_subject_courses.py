from django.db import migrations


COURSE_PROGRAM_CODES = {
    'BSIT': 'CITEC', 'BSCS': 'CITEC', 'BSEMC': 'CITEC',
    'BSCRIM': 'CCJE', 'BSA': 'CoA', 'BSBA': 'CORE',
    'BSHM': 'CIHT', 'BSTM': 'CIHT', 'BSN': 'CoN',
    'BSED': 'CTE', 'BEED': 'CTE', 'BSCE': 'CEnTech',
    'BSCPE': 'CEnTech', 'AB': 'CAS',
}


def backfill_subject_courses(apps, schema_editor):
    Subject = apps.get_model('core', 'Subject')
    Course = apps.get_model('core', 'Course')
    Program = apps.get_model('core', 'Program')

    for subject in Subject.objects.select_related('section', 'section__course_ref', 'program').filter(course_ref__isnull=True):
        course = None
        if subject.section and subject.section.course_ref_id:
            course = subject.section.course_ref
        elif subject.program:
            # Subjects without a Section cannot always be assigned safely. Use
            # the only Course under the Program when there is exactly one.
            program_courses = list(Course.objects.filter(program=subject.program))
            if len(program_courses) == 1:
                course = program_courses[0]

        if course:
            subject.course_ref_id = course.pk
            subject.save(update_fields=['course_ref'])


def preserve_subject_courses(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0012_subject_course_ref'),
    ]

    operations = [
        migrations.RunPython(backfill_subject_courses, preserve_subject_courses),
    ]
