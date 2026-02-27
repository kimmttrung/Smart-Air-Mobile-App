"""
Notification model and schemas for MongoDB storage
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class NotificationCreate(BaseModel):
    """Schema for creating a notification"""
    type: str = Field(..., description="Notification type: aqi-warning, daily-stats, etc.")
    data: dict = Field(default={}, description="Additional notification data")
    title: str = Field(..., description="Notification title")
    body: str = Field(..., description="Notification body")


class NotificationResponse(BaseModel):
    """Schema for notification response"""
    id: str = Field(..., alias="_id")
    user_id: str
    type: str
    data: dict
    title: str
    body: str
    timestamp: datetime
    read: bool
    
    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class NotificationUpdate(BaseModel):
    """Schema for updating notification"""
    read: Optional[bool] = None


class NotificationStats(BaseModel):
    """Notification statistics"""
    total: int
    unread: int
    today: int
