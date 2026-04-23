"""
User Models and Schemas for Authentication
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field
import bcrypt


class UserBase(BaseModel):
    """Base user model for input/output."""
    email: EmailStr
    first_name: str
    last_name: str
    username: str


class UserSignup(UserBase):
    """User signup request."""
    password: str = Field(..., min_length=8)


class UserLogin(BaseModel):
    """User login request."""
    email: EmailStr
    password: str


class UserResponse(UserBase):
    """User response (no password)."""
    id: Optional[str] = Field(None, alias="_id")
    created_at: datetime
    
    class Config:
        populate_by_name = True


class UserInDB(UserBase):
    """User document in database."""
    id: Optional[str] = Field(None, alias="_id")
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True
    
    class Config:
        populate_by_name = True


class TokenResponse(BaseModel):
    """JWT token response."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ---------------------------------------------------------------------------
# Password Hashing Utilities
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(password: str, hash_: str) -> bool:
    """Verify password against hash."""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hash_.encode('utf-8'))
    except Exception:
        return False
