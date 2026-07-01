"""
GeoTIFF file management service
"""
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


def get_tif_file_path(date_str: Optional[str] = None) -> Path:
    """
    Find GeoTIFF file for the specified date
    
    Args:
        date_str: Date in YYYYMMDD format. If None, returns latest file
        
    Returns:
        Path to the GeoTIFF file
        
    Raises:
        FileNotFoundError: If no matching file is found
    """
    if not settings.TIF_DIR.exists():
        raise FileNotFoundError(f"TIF directory does not exist: {settings.TIF_DIR}")
    
    # Get all TIF files
    tif_files = list(settings.TIF_DIR.glob("PM25_*.tif"))
    
    if not tif_files:
        raise FileNotFoundError(f"No GeoTIFF files found in {settings.TIF_DIR}")
    
    if date_str:
        # Ưu tiên tìm file 1kmNRT, fallback sang 3kmNRT
        file_1km = settings.TIF_DIR / f"PM25_{date_str}_1kmNRT.tif"
        file_3km = settings.TIF_DIR / f"PM25_{date_str}_3kmNRT.tif"
        
        if file_1km.exists():
            return file_1km
        elif file_3km.exists():
            logger.info(
                f"Using 3kmNRT file for {date_str} "
                "(1kmNRT not available)"
            )
            return file_3km
        else:
            # Fallback: tìm bất kỳ file nào có date_str
            pattern = f"PM25_{date_str}_*.tif"
            matching_files = list(settings.TIF_DIR.glob(pattern))
            
            if not matching_files:
                raise FileNotFoundError(
                    f"No PM2.5 file found for date {date_str}"
                )
            
            return matching_files[0]
    else:
        # Return latest file
        tif_files.sort(reverse=True)
        return tif_files[0]


def read_pm25_at_point(
    lon: float,
    lat: float,
    date_str: Optional[str] = None,
) -> dict:
    """
    Đọc trực tiếp giá trị PM2.5 tại 1 toạ độ từ file GeoTIFF và quy đổi AQI.

    Dùng chung cho endpoint /pm25/point và tool point-lookup của chatbot.

    Args:
        lon: Kinh độ
        lat: Vĩ độ
        date_str: Ngày YYYYMMDD. None -> dùng file mới nhất.

    Returns:
        dict gồm lon, lat, pm25, aqi, category, date, unit.
        Nếu ngoài vùng dữ liệu -> pm25/aqi/category = None kèm "message".

    Raises:
        FileNotFoundError: Không tìm thấy file TIF cho ngày yêu cầu.
    """
    import rasterio
    from rasterio.transform import rowcol

    from app.services.aqi_service import get_aqi_category, pm25_to_aqi

    tif_path = get_tif_file_path(date_str)
    abs_path = str(tif_path.resolve())

    with rasterio.open(abs_path) as src:
        row, col = rowcol(src.transform, lon, lat)

        if row < 0 or row >= src.height or col < 0 or col >= src.width:
            return {
                "lon": lon,
                "lat": lat,
                "pm25": None,
                "aqi": None,
                "category": None,
                "date": date_str,
                "message": "Coordinates out of bounds",
            }

        value = src.read(1)[row, col]

        # Bỏ nodata và giá trị âm
        if src.nodata is not None and value == src.nodata:
            value = None
        pm25_value = float(value) if value is not None and value >= 0 else None
        aqi_value = pm25_to_aqi(pm25_value) if pm25_value is not None else None
        category = get_aqi_category(aqi_value)

        return {
            "lon": lon,
            "lat": lat,
            "pm25": round(pm25_value, 1) if pm25_value is not None else None,
            "aqi": aqi_value,
            "category": category,
            "date": date_str,
            "unit": "μg/m³",
        }


def get_available_dates() -> List[dict]:
    """
    Get list of available dates from TIF files
    
    Returns:
        List of date information dictionaries
    """
    if not settings.TIF_DIR.exists():
        return []
    
    tif_files = list(settings.TIF_DIR.glob("PM25_*.tif"))
    dates = []
    
    for file in tif_files:
        # Extract date from filename: PM25_YYYYMMDD_*.tif
        parts = file.stem.split("_")
        if len(parts) >= 2:
            date_str = parts[1]
            try:
                # Parse and format date
                date_obj = datetime.strptime(date_str, "%Y%m%d")
                dates.append({
                    "date": date_obj.strftime("%Y-%m-%d"),
                    "date_str": date_str,
                    "filename": file.name
                })
            except ValueError:
                logger.warning(f"Invalid date format in filename: {file.name}")
                continue
    
    # Sort by date descending
    dates.sort(key=lambda x: x["date"], reverse=True)
    
    return dates
