"""
Authentication Service — JWT token handling and user operations
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Optional

import jwt
from jwt import PyJWTError

from user_models import UserInDB, hash_password, verify_password
from database import get_db

logger = logging.getLogger(__name__)

# JWT configuration
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "24"))


# ---------------------------------------------------------------------------
# Token Operations
# ---------------------------------------------------------------------------

def create_access_token(user_id: str, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.
    
    Args:
        user_id: The user's MongoDB ID
        expires_delta: Optional custom expiration time
        
    Returns:
        Encoded JWT token
    """
    if expires_delta is None:
        expires_delta = timedelta(hours=JWT_EXPIRY_HOURS)
    
    expire = datetime.utcnow() + expires_delta
    
    payload = {
        "sub": str(user_id),  # subject (user ID)
        "exp": expire,
        "iat": datetime.utcnow(),
    }
    
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token


def verify_access_token(token: str) -> Optional[str]:
    """
    Verify and decode a JWT access token.
    
    Args:
        token: The JWT token to verify
        
    Returns:
        User ID if valid, None if invalid/expired
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        return user_id
    except PyJWTError as exc:
        logger.warning(f"Invalid token: {exc}")
        return None


# ---------------------------------------------------------------------------
# User Operations
# ---------------------------------------------------------------------------

async def create_user(email: str, username: str, first_name: str, last_name: str, password: str) -> Optional[UserInDB]:
    """
    Create a new user in the database.
    
    Args:
        email: User email (must be unique)
        username: Username (must be unique)
        first_name: User's first name
        last_name: User's last name
        password: Plain password (will be hashed)
        
    Returns:
        Created UserInDB document, or None if user already exists
    """
    db = get_db()
    users = db["users"]
    
    # Check if user already exists
    existing = await users.find_one({"$or": [{"email": email}, {"username": username}]})
    if existing:
        logger.warning(f"User registration failed: email or username already exists")
        return None
    
    # Create user document
    password_hash = hash_password(password)
    now = datetime.utcnow()
    
    user_doc = {
        "email": email,
        "username": username,
        "first_name": first_name,
        "last_name": last_name,
        "password_hash": password_hash,
        "created_at": now,
        "updated_at": now,
        "is_active": True,
    }
    
    try:
        result = await users.insert_one(user_doc)
        user_doc["_id"] = result.inserted_id
        logger.info(f"User created: {email}")
        return UserInDB(**user_doc)
    except Exception as exc:
        logger.error(f"Failed to create user: {exc}")
        return None


async def get_user_by_email(email: str) -> Optional[UserInDB]:
    """
    Retrieve a user by email.
    
    Args:
        email: User's email address
        
    Returns:
        UserInDB document if found, None otherwise
    """
    db = get_db()
    users = db["users"]
    
    user_doc = await users.find_one({"email": email})
    if user_doc:
        return UserInDB(**user_doc)
    return None


async def get_user_by_id(user_id: str) -> Optional[UserInDB]:
    """
    Retrieve a user by ID.
    
    Args:
        user_id: MongoDB user ID
        
    Returns:
        UserInDB document if found, None otherwise
    """
    from bson.objectid import ObjectId
    
    db = get_db()
    users = db["users"]
    
    try:
        user_doc = await users.find_one({"_id": ObjectId(user_id)})
        if user_doc:
            return UserInDB(**user_doc)
    except Exception as exc:
        logger.warning(f"Invalid user ID format: {exc}")
    
    return None


async def verify_user_credentials(email: str, password: str) -> Optional[UserInDB]:
    """
    Verify user email and password.
    
    Args:
        email: User's email
        password: Plain password to verify
        
    Returns:
        UserInDB if credentials valid, None otherwise
    """
    user = await get_user_by_email(email)
    if not user:
        return None
    
    if not verify_password(password, user.password_hash):
        logger.warning(f"Invalid password for user: {email}")
        return None
    
    if not user.is_active:
        logger.warning(f"User account inactive: {email}")
        return None
    
    return user
