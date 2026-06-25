"""
API router initialization
"""
from fastapi import APIRouter

from .endpoints import auth, location, notification, pm25, weather, chat

api_router = APIRouter()

# Include PM2.5 endpoints
api_router.include_router(pm25.router, prefix="/pm25", tags=["PM2.5"])

# Include Auth endpoints
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])

# Include Weather endpoints
api_router.include_router(weather.router, prefix="/weather", tags=["Weather"])

# Include Location endpoints
api_router.include_router(location.router, prefix="/location", tags=["Location"])

# Include Notification endpoints
api_router.include_router(notification.router, prefix="/notifications", tags=["Notifications"])

# Include Chat endpoints
api_router.include_router(chat.router, tags=["Chat"])