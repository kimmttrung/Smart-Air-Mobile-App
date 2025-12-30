import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef } from 'react';
import api from '../../services/api';
import { reverseGeocode } from '../../services/mapService';
const getTrackingKey = (userId) => `@location_tracking_${userId}`;
const TRACKING_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
const MIN_SAVE_INTERVAL = 30 * 60 * 1000; // 30 minutes
const MIN_DISTANCE_THRESHOLD = 1000; // 1000 meters
const DISTANCE_CHECK_TIMEOUT = 60 * 60 * 1000; // 1 hour

const calculateAQI = (pm25) => {
  if (pm25 <= 12) return Math.round((pm25 / 12) * 50);
  if (pm25 <= 35.4) return Math.round(((pm25 - 12) / (35.4 - 12)) * 50 + 50);
  if (pm25 <= 55.4) return Math.round(((pm25 - 35.4) / (55.4 - 35.4)) * 50 + 100);
  if (pm25 <= 150.4) return Math.round(((pm25 - 55.4) / (150.4 - 55.4)) * 50 + 150);
  return Math.round(((pm25 - 150.4) / (250.4 - 150.4)) * 50 + 200);
};

const getAddressFromCoords = async (latitude, longitude) => {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (results && results.length > 0) {
      const result = results[0];
      // console.log('[useLocationTracking] Reverse geocoding result:', result);
      const parts = [result.name, result.subregion, result.region].filter(Boolean);
      console.log('[useLocationTracking] Formatted address parts:', parts);
      return parts.join(', ') || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }
  } catch (error) {
    console.warn('[useLocationTracking] Reverse geocoding failed:', error);
  }
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

const saveLocationToServer = async (
  userId,
  latitude,
  longitude,
  aqi = null,
  address = null,
  pm25 = null,
  forceCheck = true,
) => {
  try {
    if (!userId) {
      console.warn('[useLocationTracking] No userId, skipping save');
      return null;
    }

    if (forceCheck) {
      try {
        const trackingKey = getTrackingKey(userId);
        const trackingDataStr = await AsyncStorage.getItem(trackingKey);
        if (trackingDataStr) {
          const trackingData = JSON.parse(trackingDataStr);
          const { lastSaveTime, lastLat, lastLng } = trackingData;
          const now = Date.now();
          const timeSinceLastSave = now - (lastSaveTime || 0);
          if (timeSinceLastSave < MIN_SAVE_INTERVAL) {
            console.log(
              `[useLocationTracking] ⚠️ Spam prevention: Only ${Math.round(
                timeSinceLastSave / 1000,
              )}s since last save (min: ${MIN_SAVE_INTERVAL / 1000}s)`,
            );
            return { skipped: true, reason: 'time_threshold' };
          }
          if (timeSinceLastSave < DISTANCE_CHECK_TIMEOUT) {
            if (lastLat && lastLng) {
              const distance = calculateDistance(lastLat, lastLng, latitude, longitude);
              if (distance < MIN_DISTANCE_THRESHOLD) {
                console.log(
                  `[useLocationTracking] ⚠️ Spam prevention: Only ${Math.round(
                    distance,
                  )}m from last location (min: ${MIN_DISTANCE_THRESHOLD}m)`,
                );
                return { skipped: true, reason: 'distance_threshold' };
              }
            }
          } else {
            console.log(
              `[useLocationTracking] ℹ️ Over 1 hour since last save (${Math.round(
                timeSinceLastSave / 60000,
              )} minutes), skipping distance check`,
            );
          }
        }
      } catch (checkError) {
        console.warn('[useLocationTracking] Failed to check spam prevention:', checkError);
      }
    }

    console.log('Address before reverse geocoding:', address);
    // Nếu đã có `address` từ UI (ví dụ khi bấm GPS), dùng luôn để tránh khác biệt
  
  const locationData = await reverseGeocode(latitude, longitude);
  // console.log('Reverse geocoding data:', locationData);

  // Use `address` returned by mapService.reverseGeocode when available,
  // otherwise fall back to `name` then device reverseGeocode.
  const reverseAddress = (locationData && (locationData.address || locationData.name)) || null;
  // console.log('Reverse geocode resolved address:', reverseAddress);
  const finalAddress = address || reverseAddress || (await getAddressFromCoords(latitude, longitude));
    const finalAqi = aqi !== null && aqi !== undefined ? aqi : null;
    const finalPm25 = pm25 !== null && pm25 !== undefined ? pm25 : finalAqi ? finalAqi * 0.6 : null;

    if (finalAqi === null) {
      console.warn('[useLocationTracking] ⚠️ No AQI data available, skipping save');
      return { skipped: true, reason: 'no_aqi_data' };
    }

    console.log('[useLocationTracking] ✅ Saving location:', {
      userId,
      lat: latitude,
      lng: longitude,
      aqi: finalAqi,
      pm25: finalPm25,
      address: finalAddress,
      source: aqi !== null ? 'manual' : 'auto-tracking',
    });

    const result = await api.saveLocation(
      userId,
      latitude,
      longitude,
      finalAqi,
      finalAddress,
      finalPm25,
    );
    console.log('[useLocationTracking] Location saved successfully:', result);

    const trackingKey = getTrackingKey(userId);
    await AsyncStorage.setItem(
      trackingKey,
      JSON.stringify({
        lastSaveTime: Date.now(),
        lastLat: latitude,
        lastLng: longitude,
      }),
    );

    return result;
  } catch (error) {
    console.error('[useLocationTracking] Failed to save location:', error);
    return null;
  }
};

export const useLocationTracking = (enabled = true) => {
  const intervalRef = useRef(null);
  const lastSaveTimeRef = useRef(null);

  const saveCurrentLocation = useCallback(async (additionalData = {}) => {
    try {
      const getUserId = async () => {
        try {
          const authStr = await AsyncStorage.getItem('auth');
          if (authStr) {
            const auth = JSON.parse(authStr);
            return auth.uid || auth.user_id || null;
          }
        } catch (error) {
          console.warn('[useLocationTracking] Failed to get userId:', error);
        }
        return null;
      };

      const userId = await getUserId();
      if (!userId) {
        console.warn('[useLocationTracking] No userId found');
        return null;
      }

      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[useLocationTracking] Location permission not granted');
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;

      let finalAqi = additionalData.aqi;
      let finalPm25 = additionalData.pm25;
      let finalAddress = additionalData.address;
      const today = new Date();

      if (finalAqi === null || finalAqi === undefined) {
        try {
          console.log(
            '[useLocationTracking] Fetching PM2.5 data from backend for auto-save...',
          );

          const pm25Data = await api.getPM25Point(latitude, longitude, today);
          if (pm25Data && pm25Data.aqi) {
            finalAqi = pm25Data.aqi;
            finalPm25 = pm25Data.pm25;
            console.log('[useLocationTracking] ✅ Got real AQI from backend:', finalAqi);
          } else {
            console.warn(
              '[useLocationTracking] ⚠️ Backend returned no AQI data, skip auto-save',
            );
            return null;
          }
        } catch (error) {
          console.warn(
            '[useLocationTracking] ⚠️ Failed to fetch PM2.5 from backend:',
            error.message,
          );
          return null;
        }
      }

      console.log('[useLocationTracking] Attempting to save current location:', {
        latitude,
        longitude,
        finalAqi,
        finalPm25,
        finalAddress,
        today,
      });
      const result = await saveLocationToServer(
        userId,
        latitude,
        longitude,
        finalAqi,
        finalAddress,
        finalPm25,
        true,
      );

      if (result && !result.skipped) {
        lastSaveTimeRef.current = Date.now();
      }

      return result;
    } catch (error) {
      console.error('[useLocationTracking] Failed to save current location:', error);
      return null;
    }
  }, []);

  const getLocationHistory = useCallback(async (days = 15) => {
    try {
      const history = await api.getLocationHistory(days);
      console.log(
        '[useLocationTracking] Location history loaded:',
        history.length,
        'records',
      );
      return history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      console.error('[useLocationTracking] Failed to get location history:', error);
      return [];
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const startAutoTracking = async () => {
      try {
        const authStr = await AsyncStorage.getItem('auth');
        if (!authStr) {
          console.warn('[useLocationTracking] No auth found, skipping auto-tracking');
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('[useLocationTracking] Location permission not granted');
          return;
        }

        await saveCurrentLocation({ source: 'auto' });

        intervalRef.current = setInterval(async () => {
          const now = Date.now();
          if (
            !lastSaveTimeRef.current ||
            now - lastSaveTimeRef.current >= TRACKING_INTERVAL
          ) {
            await saveCurrentLocation({ source: 'auto' });
          }
        }, 5 * 60 * 1000);
      } catch (error) {
        console.error('[useLocationTracking] Failed to start auto-tracking:', error);
      }
    };

    startAutoTracking();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, saveCurrentLocation]);

  return {
    saveCurrentLocation,
    getLocationHistory,
  };
};


