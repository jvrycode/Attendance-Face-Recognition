import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _


class ComplexPasswordValidator:
    r"""
    Validates that a password meets complexity rules:
    - Minimum length (8 by default)
    - At least one uppercase letter (A-Z)
    - At least one lowercase letter (a-z)
    - At least one number (0-9)
    - At least one special character (!@#$%^&*(),.?":{}|<>_+-=[]\/~)
    """

    def __init__(self, min_length=8):
        self.min_length = min_length

    def validate(self, password, user=None):
        errors = []

        if len(password) < self.min_length:
            errors.append(f"Password must be at least {self.min_length} characters long.")

        if not re.search(r'[A-Z]', password):
            errors.append("Password must contain at least one uppercase letter (A-Z).")

        if not re.search(r'[a-z]', password):
            errors.append("Password must contain at least one lowercase letter (a-z).")

        if not re.search(r'\d', password):
            errors.append("Password must contain at least one number (0-9).")

        if not re.search(r'[!@#$%^&*(),.?":{}|<>_+\-=\[\]\\/~`]', password):
            errors.append("Password must contain at least one special character (e.g. !@#$%^&*).")

        if errors:
            raise ValidationError(errors)

    def get_help_text(self):
        return _(
            f"Your password must be at least {self.min_length} characters long and include "
            "at least one uppercase letter, one lowercase letter, one number, and one special character."
        )


def validate_image_upload(file):
    """Model-field validator: uploaded images must be small JPEG/PNG/WEBP files that really are images."""
    from django.conf import settings
    from PIL import Image, UnidentifiedImageError

    max_bytes = getattr(settings, 'MAX_IMAGE_UPLOAD_BYTES', 2 * 1024 * 1024)
    size = getattr(file, 'size', None)
    if size is not None and size > max_bytes:
        raise ValidationError(f"Image is too large (max {max_bytes // (1024 * 1024)} MB).")

    try:
        position = file.tell() if hasattr(file, 'tell') else None
        with Image.open(file) as img:
            img_format = img.format
            img.verify()
        if position is not None:
            file.seek(position)
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise ValidationError("Uploaded file is not a valid image.")

    if img_format not in ('JPEG', 'PNG', 'WEBP'):
        raise ValidationError("Only JPEG, PNG, or WEBP images are allowed.")
