from django.db import migrations


def backfill_schedule_days(apps, schema_editor):
    Schedule = apps.get_model('core', 'Schedule')
    ScheduleDay = apps.get_model('core', 'ScheduleDay')

    rows = []
    for schedule in Schedule.objects.all().only('id', 'day_of_week', 'day_2'):
        days = [schedule.day_of_week] if schedule.day_of_week else []
        if schedule.day_2 and schedule.day_2 not in days:
            days.append(schedule.day_2)
        for day in days:
            rows.append(ScheduleDay(schedule_id=schedule.id, day_of_week=day))

    if rows:
        ScheduleDay.objects.bulk_create(rows, ignore_conflicts=True)


def reverse_backfill(apps, schema_editor):
    ScheduleDay = apps.get_model('core', 'ScheduleDay')
    ScheduleDay.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0016_add_schedule_day'),
    ]

    operations = [
        migrations.RunPython(backfill_schedule_days, reverse_backfill),
    ]
