"""
Short-lived signed links for private face photos.

An <img> tag cannot send the JWT, so the API hands authorized users a link that
proves "the server allowed this user to see this photo" and expires after
FACE_PHOTO_LINK_SECONDS. The link is also bound to the current photo file, so a
re-enrollment invalidates older links immediately.
"""
from django.conf import settings
from django.core import signing
from django.urls import reverse

from attendance_fr.storage import get_legacy_public_storage

SALT = 'attendfr.face-photo'


def can_view_face_photo(user, student):
    """Admins; the student themself; teachers of the student's sections/subjects."""
    if not (user and user.is_authenticated):
        return False
    if user.role == 'admin':
        return True
    if user.role == 'student':
        return getattr(user, 'student_profile', None) == student
    if user.role == 'teacher':
        from attendance_fr.permissions import can_view_student_attendance
        return can_view_student_attendance(user, student)
    return False


def face_photo_link(student, user=None):
    """
    Relative signed URL for the student's face photo, or None when there is no photo
    or the user may not see it. With user=None the current request's user is used.
    """
    name = getattr(student.face_image, 'name', '') if student else ''
    if not name:
        return None
    if user is None:
        from attendance_fr.request_context import get_current_user
        user = get_current_user()
    if not can_view_face_photo(user, student):
        return None
    token = signing.dumps({'s': student.pk, 'n': name}, salt=SALT, compress=True)
    return f"{reverse('api_face_photo', args=[student.pk])}?t={token}"


def verify_face_photo_token(student, token):
    """True when the token is untampered, unexpired, and for this student's current photo."""
    if not token:
        return False
    try:
        data = signing.loads(token, salt=SALT, max_age=getattr(settings, 'FACE_PHOTO_LINK_SECONDS', 300))
    except signing.BadSignature:  # includes SignatureExpired
        return False
    return data.get('s') == student.pk and data.get('n') == getattr(student.face_image, 'name', None)


def read_face_photo_bytes(student):
    """
    Read the photo from private storage. Falls back to the old public storage for photos
    not yet moved by `manage.py make_face_photos_private` (they are still served only
    through this signed endpoint, but remain public at the source until migrated).
    """
    name = student.face_image.name
    for storage in (student.face_image.storage, get_legacy_public_storage()):
        try:
            with storage.open(name, 'rb') as handle:
                return handle.read()
        except Exception:
            continue
    return None
