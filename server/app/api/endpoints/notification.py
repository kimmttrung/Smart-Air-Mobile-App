"""
Notification endpoints for managing user notifications in MongoDB
"""
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from app.core.security import get_current_admin, get_current_user
from app.db.mongodb import get_database
from app.models.notification import (BroadcastNotification, BroadcastResponse,
                                     NotificationCreate, NotificationResponse,
                                     NotificationStats, NotificationUpdate)
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

# UTC+7 timezone (Vietnam)
VN_TIMEZONE = timezone(timedelta(hours=7))

def get_vn_now():
    """Get current datetime in Vietnam timezone (UTC+7)"""
    # Store as UTC in MongoDB, we'll convert on retrieval
    return datetime.utcnow()

def convert_to_vn_tz(dt):
    """Convert UTC naive datetime from MongoDB to UTC+7 aware datetime"""
    if dt is None:
        return None
    # MongoDB returns UTC naive datetime, make it aware then convert to VN timezone
    utc_aware = dt.replace(tzinfo=timezone.utc)
    return utc_aware.astimezone(VN_TIMEZONE)

router = APIRouter()


@router.post('/', response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
async def create_notification(
    payload: NotificationCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new notification for the current user
    
    This is typically called from backend services or when saving
    notification history from the mobile app.
    """
    db = get_database()
    
    notification_doc = {
        "user_id": current_user["user_id"],
        "type": payload.type,
        "data": payload.data,
        "title": payload.title,
        "body": payload.body,
        "timestamp": get_vn_now(),
        "read": False,
        "created_at": get_vn_now(),
    }
    
    result = await db.notifications.insert_one(notification_doc)
    notification_doc["_id"] = str(result.inserted_id)
    
    return NotificationResponse(**notification_doc)


@router.get('/', response_model=List[NotificationResponse])
async def get_notifications(
    limit: int = Query(100, ge=1, le=500, description="Maximum number of notifications to return"),
    skip: int = Query(0, ge=0, description="Number of notifications to skip"),
    unread_only: bool = Query(False, description="Only return unread notifications"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get notifications for the current user
    
    Returns notifications sorted by timestamp (newest first)
    """
    db = get_database()
    
    query = {"user_id": current_user["user_id"]}
    if unread_only:
        query["read"] = False
    
    cursor = db.notifications.find(query).sort("timestamp", -1).skip(skip).limit(limit)
    notifications = await cursor.to_list(length=limit)
    
    # Convert ObjectId to string and timestamps to UTC+7
    for notif in notifications:
        notif["_id"] = str(notif["_id"])
        # Convert timestamps from UTC to UTC+7
        if "timestamp" in notif and notif["timestamp"]:
            notif["timestamp"] = convert_to_vn_tz(notif["timestamp"])
        if "created_at" in notif and notif["created_at"]:
            notif["created_at"] = convert_to_vn_tz(notif["created_at"])
        if "updated_at" in notif and notif["updated_at"]:
            notif["updated_at"] = convert_to_vn_tz(notif["updated_at"])
    
    return [NotificationResponse(**notif) for notif in notifications]


@router.get('/stats', response_model=NotificationStats)
async def get_notification_stats(
    current_user: dict = Depends(get_current_user)
):
    """
    Get notification statistics for the current user
    """
    db = get_database()
    
    query = {"user_id": current_user["user_id"]}
    
    # Total count
    total = await db.notifications.count_documents(query)
    
    # Unread count
    unread = await db.notifications.count_documents({**query, "read": False})
    
    # Today's count (UTC+7)
    # Calculate today's midnight in UTC+7, then convert to UTC for MongoDB query
    vn_now = datetime.now(VN_TIMEZONE)
    today_start_vn = vn_now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_utc = today_start_vn.astimezone(timezone.utc).replace(tzinfo=None)
    today = await db.notifications.count_documents({
        **query,
        "timestamp": {"$gte": today_start_utc}
    })
    
    return NotificationStats(total=total, unread=unread, today=today)


@router.patch('/{notification_id}/read', response_model=NotificationResponse)
async def mark_notification_as_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Mark a specific notification as read
    """
    db = get_database()
    
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid notification ID"
        )
    
    result = await db.notifications.find_one_and_update(
        {
            "_id": ObjectId(notification_id),
            "user_id": current_user["user_id"]
        },
        {"$set": {"read": True, "updated_at": get_vn_now()}},
        return_document=True
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    result["_id"] = str(result["_id"])
    # Convert timestamps to UTC+7
    if "timestamp" in result and result["timestamp"]:
        result["timestamp"] = convert_to_vn_tz(result["timestamp"])
    if "created_at" in result and result["created_at"]:
        result["created_at"] = convert_to_vn_tz(result["created_at"])
    if "updated_at" in result and result["updated_at"]:
        result["updated_at"] = convert_to_vn_tz(result["updated_at"])
    
    return NotificationResponse(**result)


@router.patch('/read-all', status_code=status.HTTP_200_OK)
async def mark_all_notifications_as_read(
    current_user: dict = Depends(get_current_user)
):
    """
    Mark all notifications as read for the current user
    """
    db = get_database()
    
    result = await db.notifications.update_many(
        {
            "user_id": current_user["user_id"],
            "read": False
        },
        {"$set": {"read": True, "updated_at": get_vn_now()}}
    )
    
    return {
        "success": True,
        "modified_count": result.modified_count,
        "message": f"Marked {result.modified_count} notifications as read"
    }


@router.delete('/clear', status_code=status.HTTP_200_OK)
async def clear_notifications(
    keep_unread: bool = Query(False, description="Keep unread notifications"),
    older_than_days: Optional[int] = Query(None, ge=1, description="Only delete notifications older than N days"),
    current_user: dict = Depends(get_current_user)
):
    """
    Clear notifications for the current user
    
    Options:
    - keep_unread: If true, only delete read notifications
    - older_than_days: Only delete notifications older than specified days
    """
    db = get_database()
    
    query = {"user_id": current_user["user_id"]}
    
    if keep_unread:
        query["read"] = True
    
    if older_than_days:
        cutoff_date = get_vn_now() - timedelta(days=older_than_days)
        query["timestamp"] = {"$lt": cutoff_date}
    
    result = await db.notifications.delete_many(query)
    
    return {
        "success": True,
        "deleted_count": result.deleted_count,
        "message": f"Deleted {result.deleted_count} notifications"
    }


@router.delete('/{notification_id}', status_code=status.HTTP_200_OK)
async def delete_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a specific notification
    """
    db = get_database()
    
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid notification ID"
        )
    
    result = await db.notifications.delete_one({
        "_id": ObjectId(notification_id),
        "user_id": current_user["user_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    return {
        "success": True,
        "message": "Notification deleted"
    }


@router.post('/broadcast', response_model=BroadcastResponse, status_code=status.HTTP_201_CREATED)
async def broadcast_notification(
    payload: BroadcastNotification,
    admin_user: dict = Depends(get_current_admin)
):
    """
    Broadcast notification to all users or specific users (Admin only)
    
    This endpoint allows admins to send notifications to:
    - All users in the system (if target_users is None)
    - Specific users (if target_users contains list of user_ids)
    
    Example payload:
    {
        "type": "system_announcement",
        "title": "Bảo trì hệ thống",
        "body": "Hệ thống sẽ bảo trì từ 2-4 giờ sáng ngày mai",
        "data": {"priority": "high", "url": "https://..."},
        "target_users": null  // null = all users, or ["user1", "user2", ...]
    }
    """
    db = get_database()
    
    # Get target users
    if payload.target_users:
        # Send to specific users
        target_user_ids = payload.target_users
        total_users = len(target_user_ids)
    else:
        # Send to all users - fetch all user_ids from users collection
        users_cursor = db.users.find({}, {"_id": 1})
        all_users = await users_cursor.to_list(length=None)
        target_user_ids = [str(user["_id"]) for user in all_users]
        total_users = len(target_user_ids)
    
    if total_users == 0:
        return BroadcastResponse(
            success=True,
            total_users=0,
            notifications_created=0,
            message="No users to send notification to"
        )
    
    # Create notification documents for all target users
    notifications_to_insert = []
    timestamp = get_vn_now()
    
    for user_id in target_user_ids:
        notification_doc = {
            "user_id": user_id,
            "type": payload.type,
            "data": payload.data,
            "title": payload.title,
            "body": payload.body,
            "timestamp": timestamp,
            "read": False,
            "created_at": timestamp,
        }
        notifications_to_insert.append(notification_doc)
    
    # Bulk insert all notifications
    try:
        result = await db.notifications.insert_many(notifications_to_insert)
        notifications_created = len(result.inserted_ids)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to broadcast notifications: {str(e)}"
        )
    
    return BroadcastResponse(
        success=True,
        total_users=total_users,
        notifications_created=notifications_created,
        message=f"Successfully sent notification to {notifications_created} users"
    )
