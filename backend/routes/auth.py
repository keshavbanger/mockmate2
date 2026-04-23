"""
Authentication Routes — signup, login, user info
"""

import logging
from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional

from user_models import UserSignup, UserLogin, UserResponse, TokenResponse
from auth_service import (
    create_user,
    verify_user_credentials,
    create_access_token,
    verify_access_token,
    get_user_by_id,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Dependency: Extract and verify token from Authorization header
# ---------------------------------------------------------------------------

async def get_current_user(authorization: Optional[str] = Header(None)) -> UserResponse:
    """
    Extract and verify JWT token from Authorization header.
    
    Expected format: "Bearer <token>"
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    
    token = parts[1]
    user_id = verify_access_token(token)
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return UserResponse(
        id=str(user.id),
        email=user.email,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        created_at=user.created_at,
    )


# ---------------------------------------------------------------------------
# Signup Route
# ---------------------------------------------------------------------------

@router.post("/signup", response_model=TokenResponse)
async def signup(payload: UserSignup) -> TokenResponse:
    """
    Create a new user account and return JWT token.
    
    Request body:
    {
        "email": "user@example.com",
        "first_name": "John",
        "last_name": "Doe",
        "username": "johndoe",
        "password": "securepassword123"
    }
    
    Returns: JWT token and user info
    """
    logger.info(f"Signup attempt: {payload.email}")
    
    # Validate inputs
    if len(payload.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    
    # Create user
    user = await create_user(
        email=payload.email,
        username=payload.username,
        first_name=payload.first_name,
        last_name=payload.last_name,
        password=payload.password,
    )
    
    if not user:
        raise HTTPException(
            status_code=409,
            detail="Email or username already registered",
        )
    
    # Generate token
    token = create_access_token(str(user.id))
    
    logger.info(f"User registered successfully: {payload.email}")
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            created_at=user.created_at,
        ),
    )


# ---------------------------------------------------------------------------
# Login Route
# ---------------------------------------------------------------------------

@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin) -> TokenResponse:
    """
    Authenticate user and return JWT token.
    
    Request body:
    {
        "email": "user@example.com",
        "password": "securepassword123"
    }
    
    Returns: JWT token and user info
    """
    logger.info(f"Login attempt: {payload.email}")
    
    # Verify credentials
    user = await verify_user_credentials(payload.email, payload.password)
    
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )
    
    # Generate token
    token = create_access_token(str(user.id))
    
    logger.info(f"User logged in: {payload.email}")
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            created_at=user.created_at,
        ),
    )


# ---------------------------------------------------------------------------
# Get Current User Info
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
    """
    Get the current authenticated user's info.
    
    Requires: Authorization header with valid JWT token
    """
    return current_user


# ---------------------------------------------------------------------------
# Logout (Token invalidation on frontend)
# ---------------------------------------------------------------------------

@router.post("/logout")
async def logout(current_user: UserResponse = Depends(get_current_user)):
    """
    Logout the current user.
    
    Note: JWT tokens are stateless. The frontend should delete the token from localStorage.
    This endpoint is mainly for audit/logging purposes.
    """
    logger.info(f"User logged out: {current_user.email}")
    return {"message": "Logged out successfully"}
