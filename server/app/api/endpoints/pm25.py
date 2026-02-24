"""
PM2.5 API endpoints
"""
import logging
from datetime import datetime, timedelta
from typing import Optional

import httpx
from app.services import (create_tile_png, create_transparent_tile,
                          get_aqi_category, get_available_dates,
                          get_tif_file_path, pm25_to_aqi)
from fastapi import APIRouter, HTTPException, Query
from rio_tiler.io import Reader
from starlette.responses import Response

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/dates")
async def get_pm25_dates():
    """Get list of available PM2.5 dates"""
    try:
        dates = get_available_dates()
        return {
            "count": len(dates),
            "dates": dates
        }
    except Exception as e:
        logger.error(f"Error getting available dates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/point")
async def get_pm25_point(
    lon: float = Query(..., description="Longitude"),
    lat: float = Query(..., description="Latitude"),
    date: Optional[str] = Query(None, description="Date in YYYYMMDD format")
):
    """Get PM2.5 and AQI value at a specific coordinate"""
    try:
        import rasterio
        from rasterio.transform import rowcol
        
        tif_path = get_tif_file_path(date)
        abs_path = str(tif_path.resolve())
        
        # logger.info(f"Point query: lon={lon}, lat={lat}, date={date}, file={tif_path.name}")
        
        with rasterio.open(abs_path) as src:
            try:
                row, col = rowcol(src.transform, lon, lat)
                
                # Check bounds
                if row < 0 or row >= src.height or col < 0 or col >= src.width:
                    return {
                        "lon": lon,
                        "lat": lat,
                        "pm25": None,
                        "aqi": None,
                        "category": None,
                        "message": "Coordinates out of bounds"
                    }
                
                # Read pixel value
                value = src.read(1)[row, col]
                
                # Check for nodata
                if src.nodata is not None and value == src.nodata:
                    value = None
                
                pm25_value = float(value) if value is not None else None
                aqi_value = pm25_to_aqi(pm25_value) if pm25_value is not None else None
                category = get_aqi_category(aqi_value)
                
                return {
                    "lon": lon,
                    "lat": lat,
                    "pm25": pm25_value,
                    "aqi": aqi_value,
                    "category": category,
                    "date": date,
                    "unit": "μg/m³"
                }
                
            except Exception as e:
                logger.error(f"Error converting coordinates: {e}")
                return {
                    "lon": lon,
                    "lat": lat,
                    "pm25": None,
                    "aqi": None,
                    "category": None,
                    "error": str(e)
                }
                
    except FileNotFoundError as e:
        logger.error(f"File not found for date {date}: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting PM2.5 point value: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tiles/{z}/{x}/{y}.png")
async def get_pm25_tile(
    z: int,
    x: int,
    y: int,
    date: Optional[str] = Query(None, description="Date in YYYYMMDD format"),
    colormap_name: str = Query("aqi", description="Colormap name"),
    rescale: Optional[str] = Query(None, description="Min,Max rescaling values")
):
    """Get PM2.5 tile with AQI colormap"""
    try:
        tif_path = get_tif_file_path(date)
        abs_path = str(tif_path.resolve())
        
        # logger.info(f"Tile request: z={z}, x={x}, y={y}, date={date}, colormap={colormap_name}")
        
        # Read tile using rio-tiler
        with Reader(abs_path) as src:
            img = src.tile(x, y, z)
            
            # Check if tile has data
            if img.data.size == 0:
                png_bytes = create_transparent_tile()
                return Response(content=png_bytes, media_type="image/png")
            
            data = img.data[0]
            mask = img.mask[0] if img.mask is not None else None
            
            # Parse rescale for non-AQI colormaps
            vmin, vmax = 0, 150
            if rescale:
                vmin, vmax = map(float, rescale.split(','))
            
            # Create PNG tile
            png_bytes = create_tile_png(data, mask, colormap_name, vmin, vmax)
            return Response(content=png_bytes, media_type="image/png")
            
    except FileNotFoundError as e:
        logger.error(f"File not found for date {date}: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting PM2.5 tile: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/forecast")
async def get_pm25_forecast(
    lon: float = Query(..., description="Longitude"),
    lat: float = Query(..., description="Latitude"),
    days: int = Query(7, description="Number of forecast days", ge=1, le=14)
):
    """
    Get PM2.5 forecast for next N days at a specific coordinate with weather data
    Returns null for dates without data
    """
    try:
        import rasterio
        from rasterio.transform import rowcol

        # Fetch weather forecast from Open-Meteo API
        weather_data = {}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,wind_speed_10m_max,rain_sum&timezone=Asia/Bangkok&forecast_days={days}"
                weather_response = await client.get(weather_url)
                
                if weather_response.status_code == 200:
                    weather_json = weather_response.json()
                    daily = weather_json.get("daily", {})
                    
                    # Map weather data by date
                    for i, date_str in enumerate(daily.get("time", [])):
                        weather_data[date_str] = {
                            "temp_max": daily.get("temperature_2m_max", [])[i] if i < len(daily.get("temperature_2m_max", [])) else None,
                            "temp_min": daily.get("temperature_2m_min", [])[i] if i < len(daily.get("temperature_2m_min", [])) else None,
                            "humidity": daily.get("relative_humidity_2m_mean", [])[i] if i < len(daily.get("relative_humidity_2m_mean", [])) else None,
                            "wind_speed": daily.get("wind_speed_10m_max", [])[i] if i < len(daily.get("wind_speed_10m_max", [])) else None,
                            "rain_sum": daily.get("rain_sum", [])[i] if i < len(daily.get("rain_sum", [])) else None,
                        }
                    logger.info(f"✅ Weather data fetched for {len(weather_data)} days")
                else:
                    logger.warning(f"⚠️ Weather API returned {weather_response.status_code}")
        except Exception as e:
            logger.warning(f"⚠️ Could not fetch weather data: {e}")

        # Get available dates
        available_dates_list = get_available_dates()
        if not available_dates_list:
            raise HTTPException(status_code=404, detail="No PM2.5 data available")
        
        # Find today's date or closest available
        available_date_strs = {d["date_str"]: d for d in available_dates_list}
        
        # Generate forecast for next N days
        forecast_data = []
        current_date = datetime.now()
        
        for i in range(days):
            forecast_date = current_date + timedelta(days=i)
            date_str = forecast_date.strftime("%Y%m%d")
            date_key = forecast_date.strftime("%Y-%m-%d")
            
            # Get weather data for this date
            weather = weather_data.get(date_key, {})
            temp_max = weather.get("temp_max")
            temp_min = weather.get("temp_min")
            temp_avg = round((temp_max + temp_min) / 2) if temp_max and temp_min else None
            humidity = round(weather.get("humidity")) if weather.get("humidity") else None
            wind_speed = round(weather.get("wind_speed"), 1) if weather.get("wind_speed") else None
            rain_sum = round(weather.get("rain_sum"), 1) if weather.get("rain_sum") else None
            # Check if we have PM2.5 data for this date
            pm25_value = None
            aqi_value = None
            category = None
            
            if date_str in available_date_strs:
                try:
                    tif_path = get_tif_file_path(date_str)
                    abs_path = str(tif_path.resolve())
                    
                    with rasterio.open(abs_path) as src:
                        row, col = rowcol(src.transform, lon, lat)
                        
                        # Check bounds
                        if 0 <= row < src.height and 0 <= col < src.width:
                            value = src.read(1)[row, col]
                            
                            # Check for nodata
                            if src.nodata is None or value != src.nodata:
                                pm25_value = float(value) if value >= 0 else None
                                if pm25_value is not None:
                                    aqi_value = pm25_to_aqi(pm25_value)
                                    category = get_aqi_category(aqi_value)
                
                except Exception as e:
                    logger.warning(f"Error reading data for date {date_str}: {e}")
            
            # Day of week: Monday=0 -> Sunday=6
            day_names = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
            day_of_week = day_names[forecast_date.weekday()]
            
            forecast_data.append({
                "date": forecast_date.strftime("%d/%m"),
                "dateKey": date_key,
                "dateStr": date_str,
                "dayOfWeek": day_of_week,
                "pm25": round(pm25_value, 1) if pm25_value is not None else None,
                "aqi": aqi_value,
                "category": category,
                "hasData": pm25_value is not None,
                # Weather data
                "temp": temp_avg,
                "temp_max": round(temp_max) if temp_max else None,
                "temp_min": round(temp_min) if temp_min else None,
                "humidity": humidity,
                "wind_speed": wind_speed,
                "rain_sum": rain_sum
            })
        
        return {
            "lon": lon,
            "lat": lat,
            "forecast": forecast_data,
            "unit": "μg/m³",
            "totalDays": days,
            "daysWithData": sum(1 for f in forecast_data if f["hasData"])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting PM2.5 forecast: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
