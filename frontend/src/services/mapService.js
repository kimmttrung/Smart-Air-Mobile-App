import { Platform } from 'react-native';
import api, { BASE_URL } from './api';
import { config } from '../../config';

const OPENMETEO_API_URL = config.OPENMETEO_API_URL;

/**
 * Fetch PM2.5 and AQI data from backend using api service
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} date - Date string (optional)
 * @returns {Promise<Object|null>} PM2.5 data or null if failed
 */
export const fetchPM25DataFromBackend = async (lat, lon, date) => {
  try {
    const data = await api.getPM25Point(lat, lon, date);
    return data;
  } catch (error) {
    console.warn('❌ Backend PM2.5 fetch failed:', error.message);
    console.warn('💡 Solutions:');
    console.warn('1. Make sure server is running: cd server && python run.py');
    console.warn('2. Check server binds to 0.0.0.0:8000 (not 127.0.0.1)');
    console.warn('3. Try accessing http://localhost:8000/health in browser');
    return null;
  }
};

/**
 * Fetch weather data from Open-Meteo API (free, no API key required)
 * If date is provided, use forecast API; otherwise use current API
 * Tries backend first, then falls back to Open-Meteo directly
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} date - Date string (optional, format: YYYY-MM-DD)
 * @returns {Promise<Object>} Weather data with temp, humidity, windSpeed, weatherCode, precipitation
 */
export const fetchWeatherData = async (lat, lon, date = null) => {
  try {
    console.log('🌤️ fetchWeatherData called with:', { lat, lon, date });
    
    // Sử dụng backend endpoint để lấy forecast (giống DetailScreen)
    // Điều này đảm bảo data NHẤT QUÁN giữa popup và detail screen
    const formattedDate = date ? date.split('T')[0] : null;
    
    console.log('🔍 formattedDate after split:', formattedDate);
    
    // LUÔN LUÔN fetch từ backend (cả khi date = null, lấy hôm nay)
    console.log('🔄 Fetching weather from BACKEND:', formattedDate || 'today');
    const backendUrl = `${BASE_URL}/pm25/forecast?lat=${lat}&lon=${lon}&days=7`;
    
    try {
      const response = await fetch(backendUrl, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        console.log('📦 Backend forecast received:', {
          forecastLength: data.forecast?.length,
          requestedDate: formattedDate || 'today (first day)'
        });
        
        // Tìm ngày được chọn trong forecast (hoặc lấy ngày đầu tiên nếu không có date)
        const targetDate = formattedDate || data.forecast?.[0]?.dateKey;
        const dayData = data.forecast?.find(d => d.dateKey === targetDate);
        
        console.log('🔍 Searching for date in forecast:', {
          targetDate,
          found: !!dayData,
          availableDates: data.forecast?.map(f => f.dateKey)
        });
        
        if (dayData) {
          console.log('✅ Using backend forecast data:', {
            temp: dayData.temp,
            temp_max: dayData.temp_max,
            temp_min: dayData.temp_min,
            humidity: dayData.humidity,
            precipitation: dayData.rain_sum
          });
          
          return {
            temp: dayData.temp || Math.round((dayData.temp_max + dayData.temp_min) / 2),
            humidity: dayData.humidity || 0,
            windSpeed: dayData.wind_speed || 0,
            weatherCode: 0,
            precipitation: dayData.rain_sum || 0,
          };
        } else {
          console.warn('⚠️ Date not found in backend forecast, falling back to Open-Meteo');
        }
      } else {
        console.warn('⚠️ Backend response not OK:', response.status);
      }
    } catch (backendError) {
      console.warn('⚠️ Backend forecast failed, using Open-Meteo directly:', backendError.message);
    }
    
    // Fallback: Gọi Open-Meteo trực tiếp (khi backend fail)
    console.warn('📢 FALLBACK: Using Open-Meteo direct (this causes inconsistency!)');
    let url;
    if (formattedDate) {
      url = `${OPENMETEO_API_URL}?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,precipitation&start_date=${formattedDate}&end_date=${formattedDate}&timezone=auto`;
    } else {
      url = `${OPENMETEO_API_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,precipitation&timezone=auto`;
    }

    console.log('Fetching weather from Open-Meteo directly:', url);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (formattedDate && data.hourly) {
      // For forecast data, get average of the day (or middle of day around noon)
      const hourly = data.hourly;
      const midIndex = Math.floor(hourly.time.length / 2); // Get noon data
      console.log(`Fetched weather data for ${formattedDate}:`, hourly.precipitation !== undefined ? `Temp: ${hourly.temperature_2m[midIndex]}°C, Precip: ${hourly.precipitation[midIndex]}mm` : 'No hourly data');
      return {
        temp: Math.round(hourly.temperature_2m[midIndex] || 0),
        humidity: hourly.relative_humidity_2m[midIndex] || 0,
        windSpeed: hourly.wind_speed_10m[midIndex] || 0,
        weatherCode: hourly.weather_code[midIndex] || 0,
        precipitation: hourly.precipitation[midIndex] || 0,
      };
    } else {
      // For current data
      const current = data.current || {};
      console.log('Fetched current weather data:', current.precipitation !== undefined ? current : 'No current weather data available');
      return {
        temp: Math.round(current.temperature_2m || 0),
        humidity: current.relative_humidity_2m || 0,
        windSpeed: current.wind_speed_10m || 0,
        weatherCode: current.weather_code || 0,
        precipitation: current.precipitation || 0,
      };
    }
  } catch (error) {
    console.error('Error fetching weather data:', error);
    return {
      temp: 0,
      humidity: 0,
      windSpeed: 0,
      weatherCode: 0,
      precipitation: 0,
    };
  }
};

/**
 * Reverse geocoding to get address from coordinates using Nominatim (OpenStreetMap)
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} Location data with name, address, district, city
 */
export const reverseGeocode = async (lat, lon) => {
  // Add timeout handling with AbortController (5 seconds)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=vi`;
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SmartAir-Mobile/1.0',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    const address = data.address || {};
    
    // Extract address components
    const road = address.road || address.street || '';
    const suburb = address.suburb || address.neighbourhood || '';
    const district = address.city_district || address.district || '';
    const city = address.city || address.town || address.village || '';
    const state = address.state || '';
    
    // Build clean address string - bỏ postcode và country
    const addressParts = [
      road,
      suburb,
      district,
      city,
      state
    ].filter(Boolean);
    
    const cleanAddress = addressParts.join(', ');
    
    return {
      name: road || suburb || district || city || 'Điểm được chọn',
      address: cleanAddress || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      district: district || city,
      city: state || city,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Handle timeout specifically
    if (error.name === 'AbortError') {
      console.warn('⚠️ Reverse geocoding timeout: Request took longer than 5 seconds');
    } else if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
      console.warn('⚠️ Reverse geocoding network error: No internet connection or server unreachable');
    } else {
      console.warn('⚠️ Reverse geocoding error:', error.message || error);
    }
    
    // Return fallback data - không crash app
    return {
      name: 'Điểm được chọn',
      address: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      district: '',
      city: '',
    };
  }
};

/**
 * Search location using Nominatim (OpenStreetMap)
 * @param {string} query - Search query
 * @param {string} endpoint - Nominatim endpoint URL
 * @returns {Promise<Array>} Array of search results
 */
export const searchLocation = async (query, endpoint) => {
  try {
    const params = new URLSearchParams({
      format: 'json',
      addressdetails: '1',
      polygon_geojson: '0',
      limit: '5',
      countrycodes: 'vn',
      dedupe: '1',
      q: query,
    });

    const res = await fetch(`${endpoint}?${params.toString()}`, {
      headers: {
        'Accept-Language': 'vi',
        'User-Agent': 'SmartAir-Mobile/1.0',
      },
    });

    if (!res.ok) {
      throw new Error('Search failed');
    }

    const data = await res.json();

    const mapped = data.map((item) => {
      const city = item.address?.city || item.address?.town || item.address?.village || '';
      const district = item.address?.city_district || item.address?.district || '';
      const state = item.address?.state || '';
      const formatted = [district, city, state].filter(Boolean).join(', ');

      return {
        id: `osm-${item.place_id}`,
        name: item.display_name?.split(',')[0] || item.display_name,
        address: formatted || item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      };
    });

    return mapped;
  } catch (error) {
    console.error('Error searching location:', error);
    throw error;
  }
};

