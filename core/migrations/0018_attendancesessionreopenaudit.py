from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
        ('core', '0017_backfill_schedule_days'),
    ]

    operations = [
        migrations.CreateModel(
            name='AttendanceSessionReopenAudit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('reason', models.CharField(max_length=300)),
                ('reopened_at', models.DateTimeField(auto_now_add=True)),
                ('reopened_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='attendance_reopens', to='accounts.teacher')),
                ('session', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reopen_history', to='core.attendancesession')),
            ],
            options={
                'verbose_name': 'Attendance Session Reopen Audit',
                'verbose_name_plural': 'Attendance Session Reopen Audits',
                'db_table': 'attendance_session_reopen_audits',
                'ordering': ['-reopened_at'],
            },
        ),
    ]
