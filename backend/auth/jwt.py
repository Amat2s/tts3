import jwt
from jwt import PyJWKClient
from jwt.exceptions import InvalidTokenError  # noqa: F401 — re-exported for callers

from config import settings

# PyJWKClient caches keys by default; one instance is shared across all requests.
_jwks_client = PyJWKClient(
    f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json",
    cache_keys=True,
)


def decode_supabase_token(token: str) -> dict:
    signing_key = _jwks_client.get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key,
        algorithms=["RS256", "ES256"],
        options={"verify_aud": False},
    )
