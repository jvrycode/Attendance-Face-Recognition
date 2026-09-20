from django import forms
from .models import Subject, Section, Schedule, AttendanceRecord, StudentSection
from accounts.models import Teacher, Student


class SubjectForm(forms.ModelForm):
    class Meta:
        model = Subject
        fields = ['code', 'name', 'description', 'units']
        widgets = {
            'code': forms.TextInput(attrs={'class': 'form-control'}),
            'name': forms.TextInput(attrs={'class': 'form-control'}),
            'description': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
            'units': forms.NumberInput(attrs={'class': 'form-control'}),
        }


class SectionForm(forms.ModelForm):
    teacher = forms.ModelChoiceField(
        queryset=Teacher.objects.select_related('user').all(),
        required=False,
        empty_label='-- Select Teacher --',
        widget=forms.Select(attrs={'class': 'form-select'}),
        label='Assigned Teacher'
    )

    class Meta:
        model = Section
        fields = ['name', 'subject', 'teacher', 'school_year', 'semester']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control'}),
            'subject': forms.Select(attrs={'class': 'form-select'}),
            'school_year': forms.TextInput(attrs={'class': 'form-control'}),
            'semester': forms.Select(attrs={'class': 'form-select'}),
        }


class ScheduleForm(forms.ModelForm):
    class Meta:
        model = Schedule
        fields = ['section', 'day_of_week', 'start_time', 'end_time', 'room']
        widgets = {
            'section': forms.Select(attrs={'class': 'form-select'}),
            'day_of_week': forms.Select(attrs={'class': 'form-select'}),
            'start_time': forms.TimeInput(attrs={'class': 'form-control', 'type': 'time'}),
            'end_time': forms.TimeInput(attrs={'class': 'form-control', 'type': 'time'}),
            'room': forms.TextInput(attrs={'class': 'form-control'}),
        }


class TeacherScheduleForm(forms.ModelForm):
    """Schedule form limited to teacher's own sections."""
    class Meta:
        model = Schedule
        fields = ['day_of_week', 'start_time', 'end_time', 'room']
        widgets = {
            'day_of_week': forms.Select(attrs={'class': 'form-select'}),
            'start_time': forms.TimeInput(attrs={'class': 'form-control', 'type': 'time'}),
            'end_time': forms.TimeInput(attrs={'class': 'form-control', 'type': 'time'}),
            'room': forms.TextInput(attrs={'class': 'form-control'}),
        }


class EnrollStudentForm(forms.Form):
    """Enroll a student into a section."""
    student = forms.ModelChoiceField(
        queryset=Student.objects.select_related('user').all(),
        widget=forms.Select(attrs={'class': 'form-select'}),
        label='Student'
    )


class AttendanceRecordEditForm(forms.ModelForm):
    class Meta:
        model = AttendanceRecord
        fields = ['status', 'remarks']
        widgets = {
            'status': forms.Select(attrs={'class': 'form-select'}),
            'remarks': forms.TextInput(attrs={'class': 'form-control'}),
        }
