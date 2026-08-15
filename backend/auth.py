import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from dotenv import load_dotenv
from jose import JWTError, jwt
from passlib.context import CryptContext

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "change-this-secret-key-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a plain-text password using bcrypt (truncated to 72 bytes max)."""
    # Convert string to bytes and truncate to 72 bytes limit for bcrypt
    safe_password = password.encode('utf-8')[:72].decode('utf-8', errors='ignore')
    return pwd_context.hash(safe_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check a plain-text password against a bcrypt hash."""
    safe_password = plain_password.encode('utf-8')[:72].decode('utf-8', errors='ignore')
    return pwd_context.verify(safe_password, hashed_password)


def create_access_token(username: str, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT access token for the given username."""
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    payload = {"sub": username, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[str]:
    """Decode a JWT and return the username (subject), or None if invalid/expired."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None