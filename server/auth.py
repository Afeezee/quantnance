"""
Clerk JWT verification dependency for FastAPI.
Fetches the JWKS from Clerk and verifies incoming Bearer tokens.
"""
import os
import time
import logging
import jwt
import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

log = logging.getLogger(__name__)

CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL", "")

_bearer_scheme = HTTPBearer(auto_error=True)

# Simple in-memory JWKS cache with TTL
_jwks_data: dict | None = None
_jwks_fetched_at: float = 0.0
_JWKS_TTL = 3600  # 1 hour


async def _fetch_jwks(force: bool = False) -> dict:
    global _jwks_data, _jwks_fetched_at
    now = time.monotonic()
    if not force and _jwks_data is not None and (now - _jwks_fetched_at) < _JWKS_TTL:
        return _jwks_data
    if not CLERK_JWKS_URL:
        raise HTTPException(status_code=500, detail="CLERK_JWKS_URL not configured")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(CLERK_JWKS_URL)
            resp.raise_for_status()
            _jwks_data = resp.json()
            _jwks_fetched_at = now
            return _jwks_data
    except httpx.HTTPError as exc:
        log.error("Failed to fetch Clerk JWKS: %s", exc)
        raise HTTPException(status_code=503, detail="Could not fetch authentication keys")


def _find_public_key(jwks: dict, kid: str | None):
    """Return RSA public key matching the given kid, or None."""
    for key_data in jwks.get("keys", []):
        if kid is None or key_data.get("kid") == kid:
            return jwt.algorithms.RSAAlgorithm.from_jwk(key_data)
    return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> dict:
    """
    FastAPI dependency that verifies a Clerk JWT and returns the decoded payload.
    Raises HTTP 401 if the token is missing, expired, or invalid.
    """
    token = credentials.credentials
    try:
        header = jwt.get_unverified_header(token)
    except jwt.DecodeError as exc:
        raise HTTPException(status_code=401, detail=f"Malformed token: {exc}")

    kid = header.get("kid")

    # Try cached JWKS first, then retry with fresh keys if key not found
    for attempt in range(2):
        jwks = await _fetch_jwks(force=(attempt == 1))
        public_key = _find_public_key(jwks, kid)
        if public_key is not None:
            break
    else:
        raise HTTPException(status_code=401, detail="Signing key not found")

    try:
        payload: dict = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_aud": False},
            leeway=120,
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")
