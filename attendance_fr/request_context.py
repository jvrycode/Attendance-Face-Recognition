"""
Per-request access to the signed-in user for code that has no request argument
(e.g. nested serializers deciding whether to include a face-photo link).
DRF copies the JWT-authenticated user onto the underlying Django request, so
request.user here is the API user once authentication has run.
"""
from contextvars import ContextVar

_current_request = ContextVar('attendfr_current_request', default=None)


class CurrentRequestMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = _current_request.set(request)
        try:
            return self.get_response(request)
        finally:
            _current_request.reset(token)


def get_current_user():
    request = _current_request.get()
    user = getattr(request, 'user', None) if request is not None else None
    return user if (user is not None and user.is_authenticated) else None
