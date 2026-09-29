"""
Courses Serializers
Handles serialization and validation for the Course module (degree courses
offered under an academic Program). Kept separate from classes.py so Course
management can evolve independently of Sections/Subjects/Schedules.
"""
from core.serializers import CourseSerializer

__all__ = ['CourseSerializer']
