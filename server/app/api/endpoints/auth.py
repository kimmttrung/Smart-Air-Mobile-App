"""
Auth endpoints using MongoDB and JWT tokens
Provides /register, /login, /profile endpoints with JWT authentication
"""
from datetime import datetime, timedelta
from typing import Optional

from app.core.config import settings
from app.core.security import (create_access_token, get_current_user,
                               get_password_hash, verify_password)
from app.db.mongodb import get_database
from app.models.user import (Token, UserCreate, UserInDB, UserLogin,
                             UserProfile, UserResponse)
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

router = APIRouter()


class UpdateProfilePayload(BaseModel):
    """Payload for updating user profile"""
    profile: UserProfile


@router.post('/register', response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate):
    """
    Register a new user with email and password
    
    - **email**: Valid email address (unique)
    - **password**: Minimum 6 characters
    - **profile**: Optional user profile information
    - **role**: Optional user role (default: "user")
    
    Returns JWT access token and user information
    """
    db = get_database()
    
    # Check if user already exists
    existing_user = await db.users.find_one({"email": payload.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if username already exists
    existing_username = await db.users.find_one({"username": payload.username})
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Validate username (alphanumeric and underscore only, 3-20 characters)
    import re
    if not re.match(r'^[a-zA-Z0-9_]{3,20}$', payload.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must be 3-20 characters and contain only letters, numbers, and underscores"
        )
    
    # Validate password length
    if len(payload.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters"
        )
    
    # Create user document
    profile_dict = payload.profile.dict() if payload.profile else {}
    # Ensure enum values (if any) are converted to raw values for storage
    try:
        if 'group' in profile_dict:
            val = profile_dict.get('group')
            profile_dict['group'] = getattr(val, 'value', val)
    except Exception:
        pass
    # Always ensure a default group is present
    if not profile_dict.get('group'):
        profile_dict['group'] = 'normal'

    user_dict = {
        "email": payload.email,
        "username": payload.username,
        "hashed_password": get_password_hash(payload.password),
        "profile": profile_dict,
        "role": payload.role or "user",
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    
    # Insert into database
    result = await db.users.insert_one(user_dict)
    user_dict["_id"] = str(result.inserted_id)
    
    # Create access token
    access_token = create_access_token(
        data={
            "sub": payload.email, 
            "user_id": str(result.inserted_id),
            "role": user_dict["role"]
        },
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    # Prepare user response
    user_response = UserResponse(
        _id=str(result.inserted_id),
        email=user_dict["email"],
        username=user_dict["username"],
        profile=UserProfile(**user_dict["profile"]),
        role=user_dict["role"],
        is_active=user_dict["is_active"],
        created_at=user_dict["created_at"]
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )


@router.post('/login', response_model=Token)
async def login(payload: UserLogin):
    """
    Login with email or username and password
    
    - **email_or_username**: Registered email address or username
    - **password**: User password
    
    Returns JWT access token and user information
    """
    db = get_database()
    
    # Find user by email or username
    # Try to determine if input is email or username
    identifier = payload.email_or_username
    
    # Check if identifier contains @ (likely email)
    if "@" in identifier:
        user = await db.users.find_one({"email": identifier})
    else:
        # Try username first, then email
        user = await db.users.find_one({"username": identifier})
        if not user:
            user = await db.users.find_one({"email": identifier})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email/username or password"
        )
    
    # Verify password
    if not verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email/username or password"
        )
    
    # Check if user is active
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )
    
    # Create access token
    access_token = create_access_token(
        data={
            "sub": user["email"], 
            "user_id": str(user["_id"]),
            "role": user.get("role", "user")
        },
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    # Prepare user response
    user_response = UserResponse(
        _id=str(user["_id"]),
        email=user["email"],
        username=user.get("username", ""),
        profile=UserProfile(**user.get("profile", {})),
        role=user.get("role", "user"),
        is_active=user.get("is_active", True),
        created_at=user["created_at"]
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )


@router.get('/profile', response_model=UserResponse)
async def get_profile(current_user: dict = Depends(get_current_user)):
    """
    Get current user profile
    
    Requires JWT authentication via Bearer token in Authorization header
    """
    db = get_database()
    
    user = await db.users.find_one({"email": current_user["email"]})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse(
        _id=str(user["_id"]),
        email=user["email"],
        username=user.get("username", ""),
        profile=UserProfile(**user.get("profile", {})),
        role=user.get("role", "user"),
        is_active=user.get("is_active", True),
        created_at=user["created_at"]
    )


@router.get('/profile/{user_id}', response_model=UserResponse)
async def get_profile_by_id(user_id: str):
    """
    Get user profile by user ID (public endpoint)
    
    No authentication required - returns public profile information
    """
    db = get_database()
    
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse(
        _id=str(user["_id"]),
        email=user["email"],
        username=user.get("username", ""),
        profile=UserProfile(**user.get("profile", {})),
        role=user.get("role", "user"),
        is_active=user.get("is_active", True),
        created_at=user["created_at"]
    )


@router.get('/profile/username/{username}', response_model=UserResponse)
async def get_profile_by_username(username: str):
    """
    Get user profile by username (public endpoint)
    
    No authentication required - returns public profile information
    """
    db = get_database()
    
    user = await db.users.find_one({"username": username})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse(
        _id=str(user["_id"]),
        email=user["email"],
        username=user.get("username", ""),
        profile=UserProfile(**user.get("profile", {})),
        role=user.get("role", "user"),
        is_active=user.get("is_active", True),
        created_at=user["created_at"]
    )


@router.put('/profile', response_model=UserResponse)
async def update_profile(
    payload: UpdateProfilePayload,
    current_user: dict = Depends(get_current_user)
):
    """
    Update current user profile
    
    Requires JWT authentication via Bearer token in Authorization header
    """
    db = get_database()
    
    # Update profile fields
    profile_update = payload.profile.dict(exclude_none=True)
    if 'group' in profile_update:
        profile_update['group'] = getattr(profile_update['group'], 'value', profile_update['group'])

    update_data = {
        "profile": profile_update,
        "updated_at": datetime.utcnow()
    }
    
    # Merge profile fields instead of replacing whole profile to avoid removing existing keys
    set_ops = {"updated_at": datetime.utcnow()}
    for k, v in profile_update.items():
        set_ops[f"profile.{k}"] = v

    result = await db.users.find_one_and_update(
        {"email": current_user["email"]},
        {"$set": set_ops},
        return_document=True
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse(
        _id=str(result["_id"]),
        email=result["email"],
        username=result.get("username", ""),
        profile=UserProfile(**result.get("profile", {})),
        role=result.get("role", "user"),
        is_active=result.get("is_active", True),
        created_at=result["created_at"]
    )


@router.put('/profile/{user_id}', response_model=UserResponse)
async def update_profile_by_id(
    user_id: str,
    payload: UpdateProfilePayload,
    current_user: dict = Depends(get_current_user)
):
    """
    Update user profile by ID
    
    Requires JWT authentication. Users can only update their own profile.
    """
    db = get_database()
    
    # Verify user is updating their own profile
    if current_user["user_id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own profile"
        )
    
    # Update profile fields
    profile_update = payload.profile.dict(exclude_none=True)
    if 'group' in profile_update:
        profile_update['group'] = getattr(profile_update['group'], 'value', profile_update['group'])

    update_data = {
        "profile": profile_update,
        "updated_at": datetime.utcnow()
    }
    
    try:
        # Merge profile fields instead of replacing whole profile
        set_ops = {"updated_at": datetime.utcnow()}
        for k, v in profile_update.items():
            set_ops[f"profile.{k}"] = v

        result = await db.users.find_one_and_update(
            {"_id": ObjectId(user_id)},
            {"$set": set_ops},
            return_document=True
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse(
        _id=str(result["_id"]),
        email=result["email"],
        username=result.get("username", ""),
        profile=UserProfile(**result.get("profile", {})),
        role=result.get("role", "user"),
        is_active=result.get("is_active", True),
        created_at=result["created_at"]
    )


@router.get('/users', response_model=list[UserResponse])
async def get_all_users(
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """
    Get all users (paginated)
    
    Requires JWT authentication. Returns list of all users.
    
    Query params:
    - skip: Number of records to skip (default: 0)
    - limit: Maximum number of records to return (default: 100, max: 1000)
    """
    db = get_database()
    
    # Limit maximum to prevent abuse
    if limit > 1000:
        limit = 1000
    
    cursor = db.users.find().skip(skip).limit(limit)
    users = await cursor.to_list(length=limit)
    
    return [
        UserResponse(
            _id=str(user["_id"]),
            email=user["email"],
            username=user.get("username", ""),
            profile=UserProfile(**user.get("profile", {})),
            role=user.get("role", "user"),
            is_active=user.get("is_active", True),
            created_at=user["created_at"]
        )
        for user in users
    ]


@router.get('/status')
async def auth_status():
    """
    Check authentication system status
    
    Returns information about MongoDB connection and JWT configuration
    """
    db = get_database()
    
    # Test MongoDB connection
    try:
        await db.command('ping')
        mongo_connected = True
        # Count users
        user_count = await db.users.count_documents({})
    except Exception as e:
        mongo_connected = False
        user_count = 0
    
    return {
        "auth_type": "MongoDB + JWT",
        "mongodb_connected": mongo_connected,
        "mongodb_url": settings.MONGODB_URL,
        "mongodb_database": settings.MONGODB_DB_NAME,
        "user_count": user_count,
        "jwt_algorithm": settings.ALGORITHM,
        "token_expire_minutes": settings.ACCESS_TOKEN_EXPIRE_MINUTES,
    }
