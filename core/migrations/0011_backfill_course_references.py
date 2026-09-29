from django.db import migrations


COURSE_NAMES = {
    'BSIT': 'Bachelor of Science in Information Technology',
    'BSCS': 'Bachelor of Science in Computer Science',
    'BSEMC': 'Bachelor of Science in Entertainment and Multimedia Computing',
    'BSCRIM': 'Bachelor of Science in Criminology',
    'BSA': 'Bachelor of Science in Accountancy',
    'BSBA': 'Bachelor of Science in Business Administration',
    'BSHM': 'Bachelor of Science in Hospitality Management',
    'BSTM': 'Bachelor of Science in Tourism Management',
    'BSN': 'Bachelor of Science in Nursing',
    'BSED': 'Bachelor of Secondary Education',
    'BEED': 'Bachelor of Elementary Education',
    'BSCE': 'Bachelor of Science in Civil Engineering',
    'BSCPe': 'Bachelor of Science in Computer Engineering',
    'AB': 'Bachelor of Arts',
}

COURSE_PROGRAM_CODES = {
    'BSIT': 'CITEC',
    'BSCS': 'CITEC',
    'BSEMC': 'CITEC',
    'BSCRIM': 'CCJE',
    'BSA': 'CoA',
    'BSBA': 'CORE',
    'BSHM': 'CIHT',
    'BSTM': 'CIHT',
    'BSN': 'CoN',
    'BSED': 'CTE',
    'BEED': 'CTE',
    'BSCE': 'CEnTech',
    'BSCPe': 'CEnTech',
    'AB': 'CAS',
}


def normalize_code(value):
    return str(value or '').strip().upper()


def backfill_course_references(apps, schema_editor):
    Course = apps.get_model('core', 'Course')
    Program = apps.get_model('core', 'Program')
    ProgramSection = apps.get_model('core', 'ProgramSection')
    Section = apps.get_model('core', 'Section')
    Student = apps.get_model('accounts', 'Student')

    courses = {}

    def get_or_create_course(program, raw_code):
        code = normalize_code(raw_code)
        if not program or not code:
            return None
        key = (program.pk, code)
        if key not in courses:
            course, _ = Course.objects.get_or_create(
                program=program,
                code=code,
                defaults={
                    'name': COURSE_NAMES.get(code, code),
                },
            )
            courses[key] = course
        return courses[key]

    for program_section in ProgramSection.objects.select_related('program').all():
        course = get_or_create_course(program_section.program, program_section.course)
        if course and not program_section.course_ref_id:
            program_section.course_ref_id = course.pk
            program_section.save(update_fields=['course_ref'])

    for section in Section.objects.select_related('program', 'program_section').all():
        program = section.program
        code = section.course
        if section.program_section:
            program = section.program_section.program or program
            code = section.program_section.course or code
        course = get_or_create_course(program, code)
        if course and not section.course_ref_id:
            section.course_ref_id = course.pk
            section.save(update_fields=['course_ref'])

    for student in Student.objects.all():
        code = normalize_code(student.course)
        if not code or student.course_ref_id:
            continue
        program_code = COURSE_PROGRAM_CODES.get(code)
        program = Program.objects.filter(code__iexact=program_code).first() if program_code else None
        if not program:
            program = Program.objects.filter(standard_sections__course__iexact=code).distinct().first()
        course = get_or_create_course(program, code)
        if course:
            student.course_ref_id = course.pk
            student.save(update_fields=['course_ref'])


def preserve_course_references(apps, schema_editor):
    # The legacy text fields remain available, so reversing this migration does
    # not need to destroy the newly created Course records or relationships.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0010_alter_programsection_course_alter_section_course_and_more'),
        ('accounts', '0004_student_course_ref_alter_student_course'),
    ]

    operations = [
        migrations.RunPython(backfill_course_references, preserve_course_references),
    ]
