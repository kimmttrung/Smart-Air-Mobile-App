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
