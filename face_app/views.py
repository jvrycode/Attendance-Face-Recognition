import json
import logging
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from accounts.models import Student
from core.models import AttendanceSession, AttendanceRecord, StudentSection
from .utils import (
    encode_face_from_frame, compare_faces, base64_to_bytes,
    draw_face_boxes, FR_AVAILABLE
)

logger = logging.getLogger(__name__)


@login_required
def enroll_face(request):
    """Student face enrollment view."""
    user = request.user

    if user.role == 'admin':
        # Admin can enroll for any student
        student_id = request.GET.get('student_id')
        if student_id:
            student = get_object_or_404(Student, pk=student_id)
        else:
            students = Student.objects.select_related('user').all()
            return render(request, 'face/enroll_select.html', {'students': students})
    elif user.role == 'student':
        student = get_object_or_404(Student, user=user)
    else:
        messages.error(request, "Only students or admins can enroll faces.")
        return redirect('dashboard')

    return render(request, 'face/enroll.html', {
        'student': student,
        'fr_available': FR_AVAILABLE,
    })


@login_required
def enroll_face_capture(request):
    """AJAX endpoint: receive base64 frame, encode face, save to student."""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    try:
        data = json.loads(request.body)
        student_id = data.get('student_id')
        frame_b64 = data.get('frame')

        if not frame_b64 or not student_id:
            return JsonResponse({'error': 'Missing data'}, status=400)

        student = get_object_or_404(Student, pk=student_id)

        # Check permissions
        user = request.user
        if user.role == 'student' and student.user != user:
            return JsonResponse({'error': 'Permission denied'}, status=403)

        if not FR_AVAILABLE:
            return JsonResponse({
                'error': 'Face recognition is not available. Please install opencv-contrib-python.',
            }, status=503)

        frame_bytes = base64_to_bytes(frame_b64)
        encoding, face_locations = encode_face_from_frame(frame_bytes)

        if not encoding:
            return JsonResponse({'success': False, 'message': 'No face detected in frame. Please center your face.'})

        if len(face_locations) > 1:
            return JsonResponse({'success': False, 'message': 'Multiple faces detected. Please ensure only one face is visible.'})

        # Save encoding
        student.face_encoding = json.dumps(encoding)
        student.face_enrolled_at = timezone.now()

        # Save face image
        from io import BytesIO
        from PIL import Image
        from django.core.files.base import ContentFile

        img_bytes = base64_to_bytes(frame_b64)
        img = Image.open(BytesIO(img_bytes)).convert('RGB')
        # Crop to face region + padding
        if face_locations:
            loc = face_locations[0]
            pad = 30
            left = max(0, loc['left'] - pad)
            top = max(0, loc['top'] - pad)
            right = min(img.width, loc['right'] + pad)
            bottom = min(img.height, loc['bottom'] + pad)
            img = img.crop((left, top, right, bottom))

        img_io = BytesIO()
        img.save(img_io, format='JPEG', quality=90)
        filename = f"face_{student.student_id}_{timezone.now().strftime('%Y%m%d%H%M%S')}.jpg"
        student.face_image.save(filename, ContentFile(img_io.getvalue()), save=False)
        student.save()

        return JsonResponse({
            'success': True,
            'message': f'Face enrolled successfully for {student.user.get_full_name()}!',
            'face_count': len(face_locations),
        })

    except Exception as e:
        logger.exception("Error during face enrollment")
        return JsonResponse({'error': str(e)}, status=500)


@login_required
def recognize_faces(request):
    """AJAX endpoint: receive frame, match against enrolled students in a session."""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    try:
        data = json.loads(request.body)
        session_id = data.get('session_id')
        frame_b64 = data.get('frame')

        if not frame_b64 or not session_id:
            return JsonResponse({'error': 'Missing data'}, status=400)

        if not FR_AVAILABLE:
            return JsonResponse({
                'error': 'Face recognition is not available.',
            }, status=503)

        session = get_object_or_404(AttendanceSession, pk=session_id, status='open')
        frame_bytes = base64_to_bytes(frame_b64)

        # Get encoding from frame
        unknown_encoding, face_locations = encode_face_from_frame(frame_bytes)
        if not unknown_encoding:
            return JsonResponse({'success': True, 'recognized': [], 'face_count': 0})

        # Get all enrolled students with face encodings for this section
        section = session.schedule.section
        enrollments = StudentSection.objects.filter(
            section=section
        ).select_related('student__user').exclude(student__face_encoding__isnull=True).exclude(
            student__face_encoding__exact=''
        )

        tolerance = 0.5
        matched = []

        for enrollment in enrollments:
            student = enrollment.student
            try:
                known_encoding = json.loads(student.face_encoding)
            except (json.JSONDecodeError, TypeError):
                continue

            is_match, confidence = compare_faces(known_encoding, unknown_encoding, tolerance)
            if is_match:
                # Mark student present via the API logic
                record, _ = AttendanceRecord.objects.get_or_create(
                    session=session,
                    student=student,
                    defaults={'status': 'absent'}
                )
                new_status = None
                if record.status == 'absent':
                    now = timezone.now()
                    session_start_dt = timezone.make_aware(
                        timezone.datetime.combine(session.date, session.schedule.start_time)
                    )
                    is_late = (now - session_start_dt).total_seconds() > 900  # 15 min
                    record.status = 'late' if is_late else 'present'
                    record.recognized_at = now
                    record.confidence_score = round(confidence, 4)
                    record.save()
                    new_status = record.status

                matched.append({
                    'student_id': student.pk,
                    'student_number': student.student_id,
                    'name': student.user.get_full_name() or student.user.username,
                    'confidence': round(confidence * 100, 1),
                    'status': record.status,
                    'new_status': new_status,
                })
                break  # Only match one face per frame (one face visible at a time)

        return JsonResponse({
            'success': True,
            'recognized': matched,
            'face_count': len(face_locations),
        })

    except Exception as e:
        logger.exception("Error during face recognition")
        return JsonResponse({'error': str(e)}, status=500)


@login_required
def delete_face(request):
    """Delete a student's enrolled face data."""
    if request.method != 'POST':
        messages.error(request, 'Invalid request.')
        return redirect('enroll_face')

    user = request.user
    student_id = request.POST.get('student_id')

    # Admins can delete any student's face; students can only delete their own
    if user.role == 'admin' and student_id:
        student = get_object_or_404(Student, pk=student_id)
    elif user.role == 'student':
        student = get_object_or_404(Student, user=user)
    else:
        messages.error(request, 'Permission denied.')
        return redirect('dashboard')

    # Delete the face image file from disk
    if student.face_image:
        import os
        try:
            if os.path.isfile(student.face_image.path):
                os.remove(student.face_image.path)
        except Exception:
            pass
        student.face_image = None

    # Clear encoding + timestamp
    student.face_encoding = None
    student.face_enrolled_at = None
    student.save()

    messages.success(request, 'Face data has been deleted successfully.')

    if user.role == 'admin' and student_id:
        return redirect(f'/face/enroll/?student_id={student.pk}')
    return redirect('enroll_face')
