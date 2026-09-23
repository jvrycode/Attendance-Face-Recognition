"""
Schedule Service: Handles business logic for class schedules and conflict detection.
Ensures teachers are not double-booked across sections and rooms are not double-booked.
"""
from django.core.exceptions import ValidationError


class ScheduleService:
    @staticmethod
    def validate_schedule_times(start_time, end_time):
        """Validate that start_time is before end_time."""
        if not start_time or not end_time:
            raise ValidationError("Both start time and end time are required.")
        if start_time >= end_time:
            raise ValidationError("End time must be after start time.")

    @staticmethod
    def check_conflicts(schedule, exclude_pk=None):
        """
        Check for room and teacher conflicts for a given schedule.
        Returns a list of conflict error messages if any exist.
        """
        from core.models import Schedule

        conflicts = []
        ScheduleService.validate_schedule_times(schedule.start_time, schedule.end_time)

        # Base query for same day
        qs = Schedule.objects.filter(day_of_week=schedule.day_of_week)
        if exclude_pk:
            qs = qs.exclude(pk=exclude_pk)
        elif schedule.pk:
            qs = qs.exclude(pk=schedule.pk)

        # Filter overlapping times:
        # Overlap condition: (start < existing_end) AND (end > existing_start)
        overlapping = qs.filter(
            start_time__lt=schedule.end_time,
            end_time__gt=schedule.start_time
        ).select_related('section', 'section__teacher', 'section__subject')

        for existing in overlapping:
            # 1. Room conflict
            if existing.room.strip().lower() == schedule.room.strip().lower():
                conflicts.append(
                    f"Room conflict: '{schedule.room}' is already booked on "
                    f"{schedule.get_day_of_week_display()} from {existing.start_time.strftime('%H:%M')} "
                    f"to {existing.end_time.strftime('%H:%M')} by section '{existing.section.name}'."
                )

            # 2. Teacher conflict (if both sections have an assigned teacher)
            current_teacher = getattr(schedule.section, 'teacher', None)
            existing_teacher = getattr(existing.section, 'teacher', None)

            if current_teacher and existing_teacher and current_teacher.pk == existing_teacher.pk:
                conflicts.append(
                    f"Teacher conflict: {current_teacher} is already teaching on "
                    f"{schedule.get_day_of_week_display()} from {existing.start_time.strftime('%H:%M')} "
                    f"to {existing.end_time.strftime('%H:%M')} for section '{existing.section.name}'."
                )

        return conflicts

    @staticmethod
    def create_or_update_schedule(section, day_of_week, start_time, end_time, room, schedule_id=None):
        """Creates or updates a schedule after validating conflicts."""
        from core.models import Schedule

        if schedule_id:
            schedule = Schedule.objects.get(pk=schedule_id)
            schedule.section = section
            schedule.day_of_week = day_of_week
            schedule.start_time = start_time
            schedule.end_time = end_time
            schedule.room = room
        else:
            schedule = Schedule(
                section=section,
                day_of_week=day_of_week,
                start_time=start_time,
                end_time=end_time,
                room=room
            )

        conflicts = ScheduleService.check_conflicts(schedule, exclude_pk=schedule_id)
        if conflicts:
            raise ValidationError(conflicts[0])

        schedule.save()
        return schedule
