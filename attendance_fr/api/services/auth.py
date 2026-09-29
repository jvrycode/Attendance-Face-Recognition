"""
Authentication Service
Handles user profile updates, password validations, session context,
and login brute-force lockout.
"""
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from attendance_fr.api.services.users import UserService


class AuthService:

    @staticmethod
    def update_profile(user, data):
        """
        Updates the authenticated user's own profile.
        Delegates to UserService.update_current_user_profile.
        """
        return UserService.update_current_user_profile(user, data)


class LoginLockout:
    """
    Temporary lockout after repeated failed logins.
    Keyed on username + client IP, so one person guessing cannot lock a teacher out
    from every device; the per-IP login throttle limits spraying across usernames.
    """

    FAIL_PREFIX = 'login_fail_'
    LOCK_PREFIX = 'login_lock_'

    @staticmethod
    def _ident(username, ip):
        return f"{str(username or '').strip().lower()}|{ip or 'unknown'}"

    @staticmethod
    def _max_attempts():
        return max(1, int(getattr(settings, 'LOGIN_MAX_FAILED_ATTEMPTS', 5)))

    @staticmethod
    def _lock_seconds():
        return max(1, int(getattr(settings, 'LOGIN_LOCKOUT_MINUTES', 15))) * 60

    @classmethod
    def seconds_remaining(cls, username, ip):
        """Seconds until this username+IP may try again (0 = not locked)."""
        locked_until = cache.get(cls.LOCK_PREFIX + cls._ident(username, ip))
        if not locked_until:
            return 0
        return max(0, int(locked_until - timezone.now().timestamp()))

    @classmethod
    def register_failure(cls, username, ip):
        """Counts a failed login; locks the pair once the limit is reached. Returns lock seconds (0 if not locked)."""
        ident = cls._ident(username, ip)
        fail_key = cls.FAIL_PREFIX + ident
        lock_seconds = cls._lock_seconds()
        cache.add(fail_key, 0, timeout=lock_seconds)
        try:
            failures = cache.incr(fail_key)
        except ValueError:
            cache.set(fail_key, 1, timeout=lock_seconds)
            failures = 1

        if failures >= cls._max_attempts():
            cache.set(cls.LOCK_PREFIX + ident, timezone.now().timestamp() + lock_seconds, timeout=lock_seconds)
            cache.delete(fail_key)
            return lock_seconds
        return 0

    @classmethod
    def reset(cls, username, ip):
        ident = cls._ident(username, ip)
        cache.delete_many([cls.FAIL_PREFIX + ident, cls.LOCK_PREFIX + ident])


class TokenRevocation:
    """
    Server-side JWT revocation (logout + single-use refresh tokens).
    Lookups are cached briefly; a revoke writes the cache immediately, so the
    worker that handled the logout rejects the token at once. Other workers see
    it within REVOCATION_NEGATIVE_CACHE_SECONDS (LocMemCache is per process).
    """
    CACHE_PREFIX = 'jwt_revoked_'
    REVOCATION_NEGATIVE_CACHE_SECONDS = 15

    @staticmethod
    def _expires_at(token):
        from datetime import datetime, timezone as dt_timezone
        exp = token.get('exp')
        if exp:
            return datetime.fromtimestamp(int(exp), tz=dt_timezone.utc)
        return timezone.now()

    @classmethod
    def revoke(cls, token):
        """
        Revoke a validated simplejwt token object.
        Returns True if this call revoked it, False if it was already revoked
        (used to make refresh tokens strictly single-use).
        """
        from django.db import IntegrityError, transaction
        from accounts.models import RevokedToken

        jti = token.get('jti')
        if not jti:
            return False
        try:
            with transaction.atomic():
                RevokedToken.objects.create(
                    jti=jti,
                    token_type=str(token.get('token_type', ''))[:10],
                    expires_at=cls._expires_at(token),
                )
            created = True
        except IntegrityError:
            created = False
        cache.set(cls.CACHE_PREFIX + jti, True, timeout=24 * 3600)
        return created

    @classmethod
    def is_revoked(cls, jti):
        if not jti:
            return False
        cached = cache.get(cls.CACHE_PREFIX + jti)
        if cached is not None:
            return cached
        from accounts.models import RevokedToken
        revoked = RevokedToken.objects.filter(jti=jti).exists()
        cache.set(
            cls.CACHE_PREFIX + jti, revoked,
            timeout=24 * 3600 if revoked else cls.REVOCATION_NEGATIVE_CACHE_SECONDS,
        )
        return revoked

    @staticmethod
    def purge_expired():
        """Expired tokens are rejected by signature/expiry checks anyway; drop their rows."""
        from accounts.models import RevokedToken
        return RevokedToken.objects.filter(expires_at__lt=timezone.now()).delete()[0]
