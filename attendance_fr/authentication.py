"""JWT authentication that honours server-side revocation (logout)."""
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken


class RevocationAwareJWTAuthentication(JWTAuthentication):
    """Standard simplejwt auth, but tokens revoked at logout are rejected."""

    def get_validated_token(self, raw_token):
        token = super().get_validated_token(raw_token)
        from attendance_fr.api.services.auth import TokenRevocation
        if TokenRevocation.is_revoked(token.get('jti')):
            raise InvalidToken({'detail': 'Token has been revoked.', 'code': 'token_revoked'})
        return token
