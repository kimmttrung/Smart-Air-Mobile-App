"""
Location tracking endpoints
"""
from datetime import datetime, timedelta, timezone
from math import asin, cos, radians, sin, sqrt
from typing import List, Optional

from app.core.security import get_current_user
from app.db.mongodb import get_database
from app.models.location import (LocationHistoryStats, LocationRecordCreate,
                                 LocationRecordResponse)
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

router = APIRouter()


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on Earth (in kilometers)
    """
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    
    # Radius of Earth in kilometers
    r = 6371
    
    return c * r


def filter_duplicate_locations(locations: List[dict], time_threshold_minutes: int = 30, distance_threshold_km: float = 1.0) -> List[dict]:
    """
    Filter out duplicate location records that are too close in time and distance.
    
    Args:
        locations: List of location documents (sorted by timestamp DESC)
        time_threshold_minutes: Minimum time gap between records (default 30 minutes)
        distance_threshold_km: Minimum distance between records (default 1 km)
    
    Returns:
        Filtered list of locations
    """
    if not locations:
        return []
    
    filtered = [locations[0]]  # Always keep the first (most recent) record
    
    for current_loc in locations[1:]:
        should_keep = True
        
        for kept_loc in filtered:
            # Check time difference
            time_diff = abs((kept_loc["timestamp"] - current_loc["timestamp"]).total_seconds() / 60)
            
            # Check distance difference
            distance = haversine_distance(
                kept_loc["latitude"],
                kept_loc["longitude"],
                current_loc["latitude"],
                current_loc["longitude"]
            )
            
            # If within time threshold AND within distance threshold, skip this record
            if time_diff < time_threshold_minutes and distance < distance_threshold_km:
                should_keep = False
                break
        
        if should_keep:
            filtered.append(current_loc)
    
    return filtered


@router.post('/save', response_model=LocationRecordResponse, status_code=status.HTTP_201_CREATED)
async def save_location(
    payload: LocationRecordCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Save user location with AQI data
    
    Requires JWT authentication. User can only save their own location.
    """
    db = get_database()
    
    # Verify user is saving their own location
    if current_user["user_id"] != payload.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only save your own location"
        )
    
    # Create location record
    vn_tz = timezone(timedelta(hours=7))  # UTC+7 Vietnam timezone
    location_doc = {
        "user_id": payload.user_id,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "aqi": payload.aqi,
        "pm25": payload.pm25,
        "address": payload.address,
        "timestamp": datetime.now(vn_tz)  # Lưu theo giờ Việt Nam
    }
    
    # Insert into database
    result = await db.locations.insert_one(location_doc)
    
    return LocationRecordResponse(
        _id=str(result.inserted_id),
        user_id=location_doc["user_id"],
        latitude=location_doc["latitude"],
        longitude=location_doc["longitude"],
        aqi=location_doc["aqi"],
        pm25=location_doc["pm25"],
        address=location_doc["address"],
        timestamp=location_doc["timestamp"]
    )


@router.get('/history', response_model=List[LocationRecordResponse])
async def get_location_history(
    user_id: Optional[str] = Query(None, description="User ID to get history for"),
    days: int = Query(15, ge=1, le=90, description="Number of days to retrieve"),
    limit: int = Query(1000, ge=1, le=10000, description="Maximum records to return"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get location history for a user
    
    Requires JWT authentication. User can only get their own history.
    """
    db = get_database()
    
    # Use current user's ID if not specified
    target_user_id = user_id or current_user["user_id"]
    
    # Verify user is getting their own history
    if current_user["user_id"] != target_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own location history"
        )
    
    # Calculate date range
    vn_tz = timezone(timedelta(hours=7))  # UTC+7 Vietnam timezone
    cutoff_date = datetime.now(vn_tz) - timedelta(days=days)  # Giờ Việt Nam
    
    # Query database
    cursor = db.locations.find({
        "user_id": target_user_id,
        "timestamp": {"$gte": cutoff_date}
    }).sort("timestamp", -1).limit(limit)
    
    locations = await cursor.to_list(length=limit)
    
    # Filter out duplicates (same location within 30 minutes and 1km)
    filtered_locations = filter_duplicate_locations(locations)
    
    return [
        LocationRecordResponse(
            _id=str(loc["_id"]),
            user_id=loc["user_id"],
            latitude=loc["latitude"],
            longitude=loc["longitude"],
            aqi=loc.get("aqi"),
            pm25=loc.get("pm25"),
            address=loc.get("address"),
            timestamp=loc["timestamp"]
        )
        for loc in filtered_locations
    ]


@router.get('/history/{user_id}', response_model=List[LocationRecordResponse])
async def get_user_location_history(
    user_id: str,
    days: int = Query(15, ge=1, le=90, description="Number of days to retrieve"),
    limit: int = Query(1000, ge=1, le=10000, description="Maximum records to return"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get location history for a specific user by ID
    
    Requires JWT authentication. User can only get their own history.
    """
    db = get_database()
    
    # Verify user is getting their own history
    if current_user["user_id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own location history"
        )
    
    # Calculate date range
    vn_tz = timezone(timedelta(hours=7))  # UTC+7 Vietnam timezone
    cutoff_date = datetime.now(vn_tz) - timedelta(days=days)  # Giờ Việt Nam
    
    # Query database
    cursor = db.locations.find({
        "user_id": user_id,
        "timestamp": {"$gte": cutoff_date}
    }).sort("timestamp", -1).limit(limit)
    
    locations = await cursor.to_list(length=limit)
    
    # Filter out duplicates (same location within 30 minutes and 1km)
    filtered_locations = filter_duplicate_locations(locations)
    
    return [
        LocationRecordResponse(
            _id=str(loc["_id"]),
            user_id=loc["user_id"],
            latitude=loc["latitude"],
            longitude=loc["longitude"],
            aqi=loc.get("aqi"),
            pm25=loc.get("pm25"),
            address=loc.get("address"),
            timestamp=loc["timestamp"]
        )
        for loc in filtered_locations
    ]


@router.get('/stats', response_model=LocationHistoryStats)
async def get_location_stats(
    days: int = Query(15, ge=1, le=90, description="Number of days for statistics"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get statistics for user's location history
    
    Requires JWT authentication.
    """
    db = get_database()
    user_id = current_user["user_id"]
    
    # Calculate date range: use VN-local midnight (00:00) of the day `days` ago
    vn_tz = timezone(timedelta(hours=7))  # UTC+7 Vietnam timezone
    now_local_for_cutoff = datetime.now(vn_tz)
    today_local_for_cutoff = now_local_for_cutoff.date()
    start_local_date = today_local_for_cutoff - timedelta(days=days)
    cutoff_vn = datetime(start_local_date.year, start_local_date.month, start_local_date.day, 0, 0, 0, tzinfo=vn_tz)
    print('[get_location_stats] cutoff_vn:', cutoff_vn)
    # Get all records for the period (DB stores timestamps in Vietnam timezone UTC+7)
    cursor = db.locations.find({
        "user_id": user_id,
        "timestamp": {"$gte": cutoff_vn}
    })
   
    locations = await cursor.to_list(length=10000)
   
    if not locations:
        return LocationHistoryStats(
            total_records=0,
            date_range={"start": None, "end": None},
            avg_aqi=None,
            max_aqi=None,
            min_aqi=None,
            avg_pm25=None,
            max_pm25=None,
            min_pm25=None,
            most_visited_location=None,
            unique_locations=0,
            daily_avg_aqi=[]
        )
    
    # We'll build a list of valid records (exclude today's partial data) and compute stats from that
    valid_records = []
    # Set end_date to yesterday (VN local) to avoid including today's partial data
    now_local = datetime.now(vn_tz)
    today_local = now_local.date()
    yesterday_local = (now_local - timedelta(days=1)).date()
    end_date = yesterday_local.strftime("%Y-%m-%d")

    # AQI statistics - compute per-day averages then average across days
    from collections import defaultdict

    # Group AQI and PM2.5 values by local date string
    daily_aqi_map = defaultdict(list)
    daily_pm25_map = defaultdict(list)
    aqi_values = []
    pm25_values = []
    for loc in locations:
        ts = loc.get("timestamp")
        if ts is None:
            continue
        # make tz-aware if naive: interpret naive timestamps as VN-local
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=vn_tz)
        # convert to VN local for grouping and for excluding today
        ts_local = ts.astimezone(vn_tz)
        if ts_local.date() == today_local:
            # skip today's partial data
            continue
        # record is valid for stats
        valid_records.append(loc)

        if loc.get("aqi") is not None and loc.get("aqi") > 0:
            date_str = ts_local.strftime("%Y-%m-%d")
            daily_aqi_map[date_str].append(loc["aqi"])
            aqi_values.append(loc["aqi"])  # keep flat list for max/min

        if loc.get("pm25") is not None and loc.get("pm25") > 0:
            date_str = ts_local.strftime("%Y-%m-%d")
            daily_pm25_map[date_str].append(loc["pm25"])
            pm25_values.append(loc["pm25"])  # keep flat list for max/min
    print('[get_location_stats] daily_aqi_map:', daily_aqi_map)
    # total_records should count valid_records (we excluded today's records above)
    total_records = len(valid_records)
    if valid_records:
        valid_timestamps = [r["timestamp"] for r in valid_records if r.get("timestamp") is not None]
        min_ts = min(valid_timestamps)
        if min_ts.tzinfo is None:
            min_ts = min_ts.replace(tzinfo=vn_tz)
        start_date = min_ts.astimezone(vn_tz).strftime("%Y-%m-%d")
    else:
        start_date = None
    # Average across days (only days that have values)
    daily_aqi_avgs = [sum(v) / len(v) for v in daily_aqi_map.values()] if daily_aqi_map else []
    avg_aqi = sum(daily_aqi_avgs) / len(daily_aqi_avgs) if daily_aqi_avgs else None
    max_aqi = max(aqi_values) if aqi_values else None
    min_aqi = min(aqi_values) if aqi_values else None

    # PM2.5: average across days
    daily_pm25_avgs = [sum(v) / len(v) for v in daily_pm25_map.values()] if daily_pm25_map else []
    avg_pm25 = sum(daily_pm25_avgs) / len(daily_pm25_avgs) if daily_pm25_avgs else None
    max_pm25 = max(pm25_values) if pm25_values else None
    min_pm25 = min(pm25_values) if pm25_values else None
   

    # Most visited location
    address_counts = {}
    for loc in locations:
        addr = loc.get("address")
        if addr:
            address_counts[addr] = address_counts.get(addr, 0) + 1

    most_visited = max(address_counts.items(), key=lambda x: x[1])[0] if address_counts else None
    unique_locations = len(address_counts)

    # Tính daily_avg_aqi: mảng các dict {date, avg_aqi}, chỉ lấy từ ngày -7 đến -1 (không lấy hôm nay)
    import datetime as dt
    today = dt.datetime.now(timezone(timedelta(hours=7))).date()
    # Lấy các ngày từ -7 đến -1 (không lấy hôm nay)
    valid_dates = [(today - dt.timedelta(days=i)).strftime("%Y-%m-%d") for i in range(1, 8)]
    daily_avg_aqi = [
        {"date": date, "avg_aqi": round(sum(daily_aqi_map[date]) / len(daily_aqi_map[date]), 1)}
        for date in sorted(daily_aqi_map.keys())
        if date in valid_dates
    ]

    length = len(daily_avg_aqi)
    return LocationHistoryStats(
        total_records=total_records,
        date_range={"start": start_date, "end": end_date},
        avg_aqi=round(avg_aqi, 1) if avg_aqi is not None else None,
        max_aqi=max_aqi,
        min_aqi=min_aqi,
        avg_pm25=round(avg_pm25, 1) if avg_pm25 is not None else None,
        max_pm25=round(max_pm25, 1) if max_pm25 else None,
        min_pm25=round(min_pm25, 1) if min_pm25 else None,
        most_visited_location=most_visited,
        unique_locations=unique_locations,
        daily_avg_aqi=daily_avg_aqi,
        length=length
    )


@router.get('/stats/day')
async def get_stats_for_day(
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get statistics for a specific calendar day (user's local VN date).

    Date must be in YYYY-MM-DD. Returns simple stats for that day.
    """
    db = get_database()
    user_id = current_user["user_id"]

    # Parse date and compute VN-local start/end (DB stores in Vietnam timezone)
    try:
        year, month, day = map(int, date.split('-'))
        vn_tz = timezone(timedelta(hours=7))
        start_vn = datetime(year, month, day, 0, 0, 0, tzinfo=vn_tz)
        end_vn = start_vn + timedelta(days=1)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date format, expected YYYY-MM-DD")

    cursor = db.locations.find({
        "user_id": user_id,
        "timestamp": {"$gte": start_vn, "$lt": end_vn}
    })

    records = await cursor.to_list(length=10000)

    total = len(records)
    if total == 0:
        return {
            "date": date,
            "total_records": 0,
            "avg_aqi": None,
            "max_aqi": None,
            "min_aqi": None,
            "avg_pm25": None,
            "max_pm25": None,
            "min_pm25": None,
            "most_visited_location": None,
            "unique_locations": 0
        }

    aqi_values = [r["aqi"] for r in records if r.get("aqi") is not None and r.get("aqi") > 0]
    avg_aqi = round(sum(aqi_values) / len(aqi_values), 1) if aqi_values else None
    max_aqi = max(aqi_values) if aqi_values else None
    min_aqi = min(aqi_values) if aqi_values else None

    pm25_values = [r.get("pm25") for r in records if r.get("pm25") is not None and r.get("pm25") > 0]
    avg_pm25 = round(sum(pm25_values) / len(pm25_values), 1) if pm25_values else None
    max_pm25 = max(pm25_values) if pm25_values else None
    min_pm25 = min(pm25_values) if pm25_values else None

    address_counts = {}
    for r in records:
        addr = r.get("address")
        if addr:
            address_counts[addr] = address_counts.get(addr, 0) + 1

    most_visited = max(address_counts.items(), key=lambda x: x[1])[0] if address_counts else None
    unique_locations = len(address_counts)

    return {
        "date": date,
        "total_records": total,
        "avg_aqi": avg_aqi,
        "max_aqi": max_aqi,
        "min_aqi": min_aqi,
        "avg_pm25": avg_pm25,
        "max_pm25": max_pm25,
        "min_pm25": min_pm25,
        "most_visited_location": address_counts,
        "unique_locations": unique_locations,
    }


@router.delete('/history', status_code=status.HTTP_204_NO_CONTENT)
async def clear_location_history(
    days: Optional[int] = Query(None, ge=1, le=365, description="Clear records older than N days (optional)"),
    current_user: dict = Depends(get_current_user)
):
    """
    Clear location history for current user
    
    If days parameter is provided, only records older than N days will be deleted.
    Otherwise, all records will be deleted.
    """
    db = get_database()
    user_id = current_user["user_id"]
    
    # Build query
    query = {"user_id": user_id}
    
    if days:
        vn_tz = timezone(timedelta(hours=7))
        cutoff_date = datetime.now(vn_tz) - timedelta(days=days)
        query["timestamp"] = {"$lt": cutoff_date}
    
    # Delete records
    result = await db.locations.delete_many(query)
    
    return {"deleted_count": result.deleted_count}
