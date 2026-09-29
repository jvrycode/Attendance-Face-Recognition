"""
Auth & User Profile Views
Handles JWT login/refresh (throttled + lockout), GET /api/auth/me/ and PATCH /api/auth/me/.
"""
import math

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.throttling import SimpleRateThrottle
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from attendance_fr.api.serializers.auth import (
    CurrentUserProfileSerializer,
    UserProfileUpdateSerializer,
)
from attendance_fr.api.services.auth import AuthService, LoginLockout, TokenRevocation


class _PerIPRateThrottle(SimpleRateThrottle):
    """Rate limit by client IP, whether or not the request carries credentials."""

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}


class LoginRateThrottle(_PerIPRateThrottle):
    scope = 'login'


class TokenRefreshRateThrottle(_PerIPRateThrottle):
    scope = 'token_refresh'


def _lockout_response(seconds):
    minutes = max(1, math.ceil(seconds / 60))
    return Response(
        {
            'detail': f'Too many failed login attempts. Please try again in {minutes} minute(s).',
            'locked': True,
            'retry_after': seconds,
        },
        status=status.HTTP_429_TOO_MANY_REQUESTS,
        headers={'Retry-After': str(seconds)},
    )


class ThrottledTokenObtainPairView(TokenObtainPairView):
    """POST /api/token/ - JWT login with per-IP rate limit and username+IP lockout."""
    throttle_classes = [LoginRateThrottle]

    def post(self, request, *args, **kwargs):
        username = str(request.data.get('username', '') or '')
        ip = LoginRateThrottle().get_ident(request)

        remaining = LoginLockout.seconds_remaining(username, ip)
        if remaining:
            return _lockout_response(remaining)

        try:
            response = super().post(request, *args, **kwargs)
        except AuthenticationFailed:
            locked_for = LoginLockout.register_failure(username, ip)
            if locked_for:
                return _lockout_response(locked_for)
            raise

        if response.status_code == status.HTTP_200_OK:
            LoginLockout.reset(username, ip)
        return response


class SingleUseTokenRefreshSerializer(TokenRefreshSerializer):
    """
    Refresh tokens are single-use: the presented token is revoked atomically before a
    new pair is issued, so a stolen or replayed refresh token stops working, and a
    token revoked at logout can never mint new access tokens.
    """

    def validate(self, attrs):
        try:
            refresh = RefreshToken(attrs['refresh'])
        except TokenError as exc:
            raise InvalidToken(exc.args[0]) from exc

        if not TokenRevocation.revoke(refresh):
            raise InvalidToken({'detail': 'Refresh token has already been used or revoked.',
                                'code': 'token_revoked'})
        return super().validate(attrs)


class ThrottledTokenRefreshView(TokenRefreshView):
    """POST /api/token/refresh/ - per-IP rate limited, single-use refresh tokens."""
    throttle_classes = [TokenRefreshRateThrottle]
    serializer_class = SingleUseTokenRefreshSerializer


class LogoutAPIView(APIView):
    """
    POST /api/auth/logout/ {refresh} - revoke the refresh token and the current access token.
    Works even when the access token has already expired (no authentication required);
    only tokens with a valid signature can be revoked. Always answers 200 (idempotent).
    """
    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    throttle_classes = [TokenRefreshRateThrottle]

    def post(self, request):
        revoked = 0
        raw_refresh = request.data.get('refresh') if hasattr(request.data, 'get') else None
        if raw_refresh:
            try:
                TokenRevocation.revoke(RefreshToken(raw_refresh))
                revoked += 1
            except TokenError:
                pass

        header = request.META.get('HTTP_AUTHORIZATION', '')
        if header.startswith('Bearer '):
            try:
                TokenRevocation.revoke(AccessToken(header.split(' ', 1)[1].strip()))
                revoked += 1
            except TokenError:
                pass

        TokenRevocation.purge_expired()
        return Response({'success': True, 'revoked': revoked})


class CurrentUserAPIView(APIView):
    """GET /api/auth/me/ - Get profile. PATCH /api/auth/me/ - Update own profile."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(CurrentUserProfileSerializer(request.user).data)

    def patch(self, request):
        serializer = UserProfileUpdateSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = AuthService.update_profile(request.user, serializer.validated_data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CurrentUserProfileSerializer(user).data)
