"""
Private storage for biometric face photos.

Face photos are never given a public URL:
- Cloudinary configured -> uploaded as type="authenticated" (plain delivery URLs return 401).
  Only Django, holding the API secret, can build a signed URL to read them; that URL never
  leaves the server.
- Local development -> a directory outside MEDIA_ROOT that Django never serves.
Browsers get short-lived signed Django links instead (see attendance_fr/face_photos.py).
"""
from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible


def cloudinary_enabled():
    return bool(
        getattr(settings, 'CLOUDINARY_CLOUD_NAME', '')
        and getattr(settings, 'CLOUDINARY_API_KEY', '')
        and getattr(settings, 'CLOUDINARY_API_SECRET', '')
    )


@deconstructible
class PrivateFileSystemStorage(FileSystemStorage):
    """Local private files: stored under PRIVATE_MEDIA_ROOT and never exposed by URL."""

    def __init__(self, **kwargs):
        kwargs.setdefault('location', str(settings.PRIVATE_MEDIA_ROOT))
        kwargs.setdefault('base_url', '/private-media-is-not-served/')
        super().__init__(**kwargs)

    def url(self, name):
        return ''  # deliberately no public URL; use face_photo_link()


def _authenticated_cloudinary_storage_class():
    from cloudinary_storage.storage import MediaCloudinaryStorage

    @deconstructible
    class AuthenticatedCloudinaryStorage(MediaCloudinaryStorage):
        """Cloudinary storage whose uploads are private (type="authenticated")."""

        DELIVERY_TYPE = 'authenticated'

        def _upload(self, name, content):
            import os
            import cloudinary.uploader
            options = {
                'use_filename': True,
                'resource_type': self._get_resource_type(name),
                'tags': self.TAG,
                'type': self.DELIVERY_TYPE,
            }
            folder = os.path.dirname(name)
            if folder:
                options['folder'] = folder
            return cloudinary.uploader.upload(content, **options)

        def _get_url(self, name):
            """Signed delivery URL for server-side reads only (never sent to browsers)."""
            import cloudinary.utils
            name = self._prepend_prefix(name)
            url, _options = cloudinary.utils.cloudinary_url(
                name,
                resource_type=self._get_resource_type(name),
                type=self.DELIVERY_TYPE,
                sign_url=True,
                secure=True,
            )
            return url

        def url(self, name):
            return ''  # deliberately no public URL; use face_photo_link()

        def delete(self, name):
            import cloudinary.uploader
            response = cloudinary.uploader.destroy(
                name, invalidate=True, resource_type=self._get_resource_type(name), type=self.DELIVERY_TYPE,
            )
            return response.get('result') == 'ok'

    return AuthenticatedCloudinaryStorage


_private_storage = None


def get_face_storage():
    """Storage callable for face_image fields (Django re-evaluates it per process)."""
    global _private_storage
    if _private_storage is None:
        if cloudinary_enabled():
            _private_storage = _authenticated_cloudinary_storage_class()()
        else:
            _private_storage = PrivateFileSystemStorage()
    return _private_storage


def get_legacy_public_storage():
    """Where face photos lived before they were made private (default media storage)."""
    from django.core.files.storage import storages
    return storages['default']
