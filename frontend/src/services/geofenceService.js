// GeofenceService - Monitor location và trigger notification khi AQI cao
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState } from 'react-native';
import { getLocationHistory, getPM25Point } from './api';
import { reverseGeocode } from './mapService';
import notificationService from './notificationService';
const GEOFENCE_TASK_NAME = 'smartair-geofence-task';
const LOCATION_TRACKING_TASK = 'smartair-location-tracking';
const AQI_CHECK_INTERVAL = 5 * 60 * 1000; // 5 phút
const AQI_WARNING_THRESHOLD = 100;
const MIN_NOTIFICATION_INTERVAL = 1 * 60 * 1000; // 30 phút giữa các notification

// Define background task trước khi khởi tạo service
TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.error('[GeofenceService] Background task error:', error);
    return;
  }

  if (data) {
    const { locations } = data;
    console.log('[GeofenceService] Background location update:', locations);

    if (locations && locations.length > 0) {
      const location = locations[0];
      await GeofenceService._handleLocationUpdate(location);
    }
  }
});

class GeofenceServiceClass {
  constructor() {
    this.isTracking = false;
    this.lastNotificationTime = {};
    this.currentAQI = null;
    this.checkInterval = null;
    this.appStateSubscription = null;
  }

  /**
   * Khởi tạo geofence service và yêu cầu quyền location
   */
  async initialize() {
    try {
      // Yêu cầu quyền location
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        console.warn('[GeofenceService] Foreground location permission not granted');
        return false;
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      
      if (backgroundStatus !== 'granted') {
        console.warn('[GeofenceService] Background location permission not granted');
      }

      // Kiểm tra xem task đã được đăng ký chưa
      const isTaskDefined = await TaskManager.isTaskDefined(LOCATION_TRACKING_TASK);
      console.log('[GeofenceService] Task defined:', isTaskDefined);

      // Setup AppState listener để xử lý pending start
      this.appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
        if (nextAppState === 'active') {
          const pendingStart = await AsyncStorage.getItem('@geofence_pending_start');
          if (pendingStart === 'true') {
            console.log('[GeofenceService] App returned to foreground, starting pending tracking');
            await AsyncStorage.removeItem('@geofence_pending_start');
            await this.startTracking();
          }
        }
      });

      console.log('[GeofenceService] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[GeofenceService] Initialize error:', error);
      return false;
    }
  }

  /**
   * Bắt đầu theo dõi location
   */
  async startTracking() {
    try {
      if (this.isTracking) {
        console.log('[GeofenceService] Already tracking');
        return;
      }

      // Kiểm tra permissions
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[GeofenceService] Location permission not granted');
        return;
      }

      // Kiểm tra app state - chỉ start foreground service khi app đang active
      const currentState = AppState.currentState;
      if (currentState !== 'active') {
        console.warn('[GeofenceService] Cannot start tracking when app is not in foreground. Current state:', currentState);
        // Lưu flag để start sau khi app về foreground
        await AsyncStorage.setItem('@geofence_pending_start', 'true');
        return;
      }

      // Start background location updates
      await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5 * 60 * 1000, // 5 phút
        distanceInterval: 500, // 500 mét
        foregroundService: {
          notificationTitle: 'SmartAir đang theo dõi vị trí',
          notificationBody: 'Để cảnh báo chất lượng không khí',
          notificationColor: '#4CAF50',
        },
        pausesUpdatesAutomatically: false,
      });

      this.isTracking = true;
      await AsyncStorage.setItem('@geofence_tracking', 'true');
      
      console.log('[GeofenceService] Started tracking');
      
      // Lấy vị trí hiện tại và check AQI ngay
      await this.checkCurrentLocationAQI();
      
    } catch (error) {
      console.error('[GeofenceService] Start tracking error:', error);
    }
  }

  /**
   * Dừng theo dõi location
   */
  async stopTracking() {
    try {
      const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TRACKING_TASK);
      
      if (isTaskRegistered) {
        await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
      }

      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }

      this.isTracking = false;
      await AsyncStorage.setItem('@geofence_tracking', 'false');
      await AsyncStorage.removeItem('@geofence_pending_start');
      
      console.log('[GeofenceService] Stopped tracking');
    } catch (error) {
      console.error('[GeofenceService] Stop tracking error:', error);
    }
  }

  /**
   * Cleanup và remove listeners
   */
  cleanup() {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  /**
   * Kiểm tra AQI tại vị trí hiện tại
   */
  async checkCurrentLocationAQI() {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      await this._handleLocationUpdate(location);
    } catch (error) {
      console.error('[GeofenceService] Check current location AQI error:', error);
    }
  }

  /**
   * Xử lý cập nhật vị trí (static method cho background task)
   */
  static async _handleLocationUpdate(location) {
    try {
      const { latitude, longitude } = location.coords;
      console.log('[GeofenceService] Location update:', latitude, longitude);
      // Use local date (yyyyMMdd) for today's PM2.5 point to avoid timezone shift
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      const dateStr = `${y}${m}${d}`;
      // Lấy AQI tại vị trí này từ API (date as yyyyMMdd)
      console.log(`[GeofenceService] Fetching AQI for ${latitude}, ${longitude} on ${dateStr}`);
      const aqiData = await getPM25Point(latitude, longitude, dateStr);
      
      if (!aqiData || !aqiData.aqi) {
        console.log('[GeofenceService] No AQI data for this location');
        return;
      }

      const aqi = aqiData.aqi;
      let locationName = '';

      // Luôn lấy address từ reverse geocode để đảm bảo address cập nhật theo vị trí hiện tại
      try {
        // Try mapService.reverseGeocode (returns object) first, fallback to Location.reverseGeocodeAsync (returns array)
        let geocodeResult = null;
        try {
          geocodeResult = await reverseGeocode(latitude, longitude);
        } catch (e) {
          // fallback to native Location reverse geocode
          try {
            geocodeResult = await Location.reverseGeocodeAsync({ latitude, longitude });
          } catch (err2) {
            throw err2;
          }
        }

        // Normalize result: accept either array (take first) or object
        const g = Array.isArray(geocodeResult) ? geocodeResult[0] : geocodeResult;
        if (g) {
          locationName = [g.name, g.street, g.city, g.region, g.country]
            .filter(Boolean)
            .slice(0, 3)
            .join(', ');
        }
      } catch (rgErr) {
        console.warn('[GeofenceService] reverseGeocode failed:', rgErr?.message || rgErr);
        // Fallback to API location name if reverse geocode fails
        locationName = aqiData.locationName || aqiData.location || '';
      }

      if (!locationName) locationName = 'vị trí hiện tại';

      console.log('[GeofenceService] AQI at location:', aqi, locationName);

      // Lưu AQI vào AsyncStorage
      await AsyncStorage.setItem('@current_aqi', JSON.stringify({
        aqi,
        locationName,
        latitude,
        longitude,
        timestamp: new Date().toISOString(),
      }));

      // Gửi notification cho mọi mức AQI (với throttling)
      const lastNotifTime = await AsyncStorage.getItem('@last_aqi_notification');
      const now = Date.now();
      
      // Nếu AQI >= 150 hoặc đã qua interval tối thiểu
      const shouldNotify = aqi >= AQI_WARNING_THRESHOLD || 
                          (!lastNotifTime || (now - parseInt(lastNotifTime)) > MIN_NOTIFICATION_INTERVAL);
      
      if (shouldNotify) {
        if (!lastNotifTime || (now - parseInt(lastNotifTime)) > MIN_NOTIFICATION_INTERVAL) {
          // Gửi notification với mức độ phù hợp
          await notificationService.sendAQIWarning(aqi, locationName);
          await AsyncStorage.setItem('@last_aqi_notification', now.toString());
          
          console.log('[GeofenceService] AQI notification sent:', aqi, locationName);
        } else {
          console.log('[GeofenceService] Skipped notification (too soon)');
        }
      }

      // Note: Exposure data is now fetched from server API, not stored locally
      
    } catch (error) {
      console.error('[GeofenceService] Handle location update error:', error);
    }
  }

  /**
   * Xử lý cập nhật vị trí (instance method)
   */
  async _handleLocationUpdate(location) {
    return GeofenceServiceClass._handleLocationUpdate(location);
  }

  /**
   * Lưu dữ liệu exposure để tính toán cigarette equivalent
   * Note: Deprecated - exposure data is now stored on server via location/save API
   */
  static async _saveExposureData(latitude, longitude, aqi, locationName) {
    // Exposure data is now fetched from backend API (getLocationHistory)
    // No longer storing locally to avoid data duplication
    console.log('[GeofenceService] Exposure data tracking (server-side only):', { latitude, longitude, aqi, locationName });
  }

  /**
   * Lấy exposure history
   */
  async getExposureHistory(days = 3) {
    try {
      // Try to fetch exposure/location history from backend when available
      try {
        const apiHistory = await getLocationHistory(days, 1000);
        if (Array.isArray(apiHistory) && apiHistory.length > 0) {
          // Map api records to local exposure format if necessary
          const mapped = apiHistory.map(item => ({
            latitude: item.lat ?? item.latitude ?? item.latitude,
            longitude: item.lng ?? item.longitude ?? item.long,
            aqi: item.aqi ?? item.aqi_value ?? item.pm25 ?? null,
            locationName: item.address || item.location || item.locationName || '',
            timestamp: item.timestamp || item.created_at || item.time || new Date().toISOString(),
          }));

          // Filter by days just in case backend returns more
          const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
          return mapped.filter(it => new Date(it.timestamp).getTime() > cutoffTime);
        }
      } catch (apiErr) {
        console.warn('[GeofenceService] getExposureHistory: API fetch failed, falling back to local storage', apiErr?.message || apiErr);
      }

      // No local fallback - all exposure data is from server
      console.log('[GeofenceService] No API data available for exposure history');
      return [];
    } catch (error) {
      console.error('[GeofenceService] Get exposure history error:', error);
      return [];
    }
  }

  /**
   * Kiểm tra trạng thái tracking
   */
  async isTrackingActive() {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TRACKING_TASK);
      const storedStatus = await AsyncStorage.getItem('@geofence_tracking');
      return isRegistered && storedStatus === 'true';
    } catch (error) {
      console.error('[GeofenceService] Check tracking status error:', error);
      return false;
    }
  }

  /**
   * Lấy AQI hiện tại
   */
  async getCurrentAQI(forceRefresh = false) {
    try {
      // Nếu không yêu cầu refresh, trả về cache nếu có
      if (!forceRefresh) {
        const currentAQIStr = await AsyncStorage.getItem('@current_aqi');
        if (currentAQIStr) return JSON.parse(currentAQIStr);
      }

      // Kiểm tra quyền location trước khi lấy vị trí
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        // Nếu không có quyền, trả về cache (nếu có)
        const cached = await AsyncStorage.getItem('@current_aqi');
        return cached ? JSON.parse(cached) : null;
      }

      // Lấy vị trí hiện tại và fetch AQI từ API
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      const now = new Date();
      const dateNow = now.toISOString().slice(0, 10).replace(/-/g, '');
      try {
        const aqiData = await getPM25Point(latitude, longitude, dateNow);
        if (!aqiData) {
          const cached = await AsyncStorage.getItem('@current_aqi');
          return cached ? JSON.parse(cached) : null;
        }

        // Build payload and ensure human-readable locationName
        let locationName = aqiData.locationName || aqiData.location || '';
        if (!locationName) {
          try {
            let geocodeResult = null;
            try {
              geocodeResult = await reverseGeocode(latitude, longitude);
            } catch (e) {
              geocodeResult = await Location.reverseGeocodeAsync({ latitude, longitude });
            }
            const g = Array.isArray(geocodeResult) ? geocodeResult[0] : geocodeResult;
            if (g) {
              locationName = [g.name, g.street, g.city, g.region, g.country]
                .filter(Boolean)
                .slice(0, 3)
                .join(', ');
            }
          } catch (rgErr) {
            console.warn('[GeofenceService] reverseGeocode failed:', rgErr?.message || rgErr);
          }
        }
        if (!locationName) locationName = 'Unknown';

        const payload = {
          aqi: aqiData.aqi,
          pm25: aqiData.pm25,
          locationName,
          latitude,
          longitude,
          timestamp: new Date().toISOString(),
        };

        await AsyncStorage.setItem('@current_aqi', JSON.stringify(payload));
        return payload;
      } catch (apiErr) {
        console.warn('[GeofenceService] getCurrentAQI: API fetch failed, returning cache if any', apiErr?.message || apiErr);
        const cached = await AsyncStorage.getItem('@current_aqi');
        return cached ? JSON.parse(cached) : null;
      }
    } catch (error) {
      console.error('[GeofenceService] Get current AQI error:', error);
      return null;
    }
  }

  /**
   * Clear exposure history
   * Note: Now clears server-side data via API (would need DELETE endpoint)
   */
  async clearExposureHistory() {
    try {
      // TODO: Call API to delete server-side exposure/location history
      // await deleteLocationHistory();
      
      // Clear any cached AQI data
      await AsyncStorage.removeItem('@current_aqi');
      console.log('[GeofenceService] Exposure cache cleared (server data requires API deletion)');
    } catch (error) {
      console.error('[GeofenceService] Clear history error:', error);
    }
  }
}

// Export singleton instance
const GeofenceService = new GeofenceServiceClass();
export default GeofenceService;
