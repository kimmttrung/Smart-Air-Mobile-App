// API service helper for SmartAir backend
// Unified BASE_URL for all API calls (auth, location, pm25)

import Constants from 'expo-constants';

// URL resolution priority:
// 1. Environment variable (highest priority)
// 2. Auto-detection from Expo debuggerHost
// 3. Config from app.json
// 4. Fallback to Android Emulator localhost

const ENV_BASE = process.env.API_BASE_URL_ANDROID;

let CONFIG_BASE = Constants.expoConfig?.extra?.backendUrl || Constants.manifest?.extra?.backendUrl;
if (CONFIG_BASE === 'AUTO_DISCOVER' || CONFIG_BASE === '') {
  CONFIG_BASE = null;
}

// Auto-detect from Expo debugger host
let detectedBackendUrl = null;
try {
  const manifest = Constants.manifest || Constants.expoConfig || {};
  const expoConfig = Constants.expoConfig || {};

  console.warn('[api.js] Expo Constants available:');
  if (manifest.debuggerHost) console.warn(`  manifest.debuggerHost: ${manifest.debuggerHost}`);

  const debuggerHost =
    manifest.debuggerHost ||
    manifest.extra?.debuggerHost ||
    expoConfig.extra?.debuggerHost ||
    null;

  if (debuggerHost) {
    const hostPart = debuggerHost.includes(':') ? debuggerHost.split(':')[0] : debuggerHost;

    if (hostPart && hostPart !== 'localhost' && hostPart !== '127.0.0.1' && !hostPart.startsWith('127.')) {
      detectedBackendUrl = `http://${hostPart}:8000`;
      console.warn(`[api.js] ✓ Auto-detected backend: ${detectedBackendUrl}`);
    }
  }
} catch (e) {
  console.warn('[api.js] Failed to auto-detect:', e.message);
}

// Single BASE_URL for all endpoints (port 8000)
const DEFAULT_FALLBACK = 'http://10.0.2.2:8000';
const DEPLOY_URL = 'https://smart-air-mobile-app.onrender.com'; // Thay bằng Vercel URL sau khi deploy
// Thay YOUR_WIFI_IP bằng IP máy tính của bạn (xem bằng lệnh ipconfig)
const LOCAL_NETWORK_URL = 'http://192.168.1.6:8000'; // VD: http://192.168.1.10:8000, http://10.0.0.5:8000, etc.
// const LOCAL_NETWORK_URL = 'http://10.11.49.207:8000'; // VD:
// const LOCAL_NETWORK_URL = ''; 
const BASE_URL = LOCAL_NETWORK_URL || DEPLOY_URL || ENV_BASE || detectedBackendUrl || CONFIG_BASE || DEFAULT_FALLBACK;


console.warn(`[api.js] 🌐 BASE_URL: ${BASE_URL}`);
console.warn(`[api.js] Priority: local=${LOCAL_NETWORK_URL || 'none'} > deploy=${DEPLOY_URL || 'none'} > env=${ENV_BASE || 'none'} > detected=${detectedBackendUrl || 'none'} > config=${CONFIG_BASE || 'none'} > fallback=${DEFAULT_FALLBACK}`);

// Export BASE_URL for use in other components (like MapWebView)
export { BASE_URL };

// Helper function to check server connectivity
export const checkServerConnection = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${BASE_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      console.warn(`[api.js] ✅ Server is reachable at ${BASE_URL}`);
      return { success: true, message: 'Server connected' };
    } else {
      console.warn(`[api.js] ⚠️ Server responded with status ${response.status}`);
      return { success: false, message: `Server error: ${response.status}` };
    }
  } catch (error) {
    console.error(`[api.js] ❌ Cannot connect to server at ${BASE_URL}:`, error.message);
    return {
      success: false,
      message: `Cannot reach server at ${BASE_URL}. Please check:\n1. Backend is running\n2. IP address is correct\n3. Phone and server are on the same network`
    };
  }
};

// Helper function to decode JWT and check expiration
const isTokenExpired = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const isExpired = now >= exp;
    if (isExpired) {
      const expiredAgo = Math.floor((now - exp) / 1000 / 60); // minutes
      console.warn(`[api.js] Token expired ${expiredAgo} minutes ago`);
    } else {
      const expiresIn = Math.floor((exp - now) / 1000 / 60); // minutes
      console.warn(`[api.js] Token expires in ${expiresIn} minutes`);
    }
    return isExpired;
  } catch (err) {
    console.warn(`[api.js] Failed to decode token:`, err.message);
    return false; // If we can't decode, assume it's not expired
  }
};

const api = {
  BASE_URL,
  get AUTH_BASE() {
    return `${BASE_URL}/auth`;
  },
  // POST /location/save
  saveLocation: async (userId, lat, lng, aqi, address, pm25 = null) => {
    const url = `${BASE_URL}/location/save`;
    console.warn(`[api.js] saveLocation: POST to ${url}`);
    console.warn(`  userId=${userId}, lat=${lat}, lng=${lng}, aqi=${aqi}, pm25=${pm25}`);
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const authStr = await AsyncStorage.getItem('auth');
      if (!authStr) throw new Error('No auth token found. Please login first.');

      const auth = JSON.parse(authStr);
      console.warn(`[api.js] saveLocation: Auth object keys:`, Object.keys(auth));
      const token = auth.token || auth.access_token;
      if (!token) {
        console.error(`[api.js] saveLocation: No token found. Auth data:`, auth);
        throw new Error('No JWT token found in auth data.');
      }

      console.warn(`[api.js] saveLocation: Using token (first 20 chars): ${token.substring(0, 20)}...`);

      // Check if token is expired
      if (isTokenExpired(token)) {
        console.error(`[api.js] saveLocation: Token is EXPIRED - user needs to login again`);
        throw new Error('Your session has expired. Please login again.');
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ user_id: userId, lat, lng, aqi, pm25, address })
      });

      console.warn(`[api.js] saveLocation: Response status ${res.status}`);
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 401) {
          console.error(`[api.js] saveLocation: 401 Unauthorized - Token may be expired or invalid`);
          console.error(`[api.js] saveLocation: Response body:`, text);
          throw new Error(`Authentication failed. Please login again. ${text}`);
        }
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const data = await res.json();
      console.warn(`[api.js] saveLocation: Success`, data);
      return data;
    } catch (err) {
      console.error(`[api.js] saveLocation: Error: ${err.message}`);
      throw err;
    }
  },

  // GET /location/history?days=15&limit=100
  getLocationHistory: async (days = 15, limit = 100) => {
    const url = `${BASE_URL}/location/history?days=${days}&limit=${limit}`;
    console.warn(`[api.js] getLocationHistory: GET from ${url}`);
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const authStr = await AsyncStorage.getItem('auth');
      if (!authStr) throw new Error('No auth token found. Please login first.');

      const auth = JSON.parse(authStr);
      const token = auth.token || auth.access_token;
      if (!token) throw new Error('No JWT token found in auth data.');

      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`

        }
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const data = await res.json();
      console.warn(`[api.js] getLocationHistory: Success, got ${data.length} records`);
      console.warn(`[api.js] getLocationHistory: Sample record:`, data || 'No records');
      return data;
    } catch (err) {
      console.error(`[api.js] getLocationHistory: Error: ${err.message}`);
      throw err;
    }
  },

  // GET /location/stats?days=15
  getLocationStats: async (days = 15) => {
    const url = `${BASE_URL}/location/stats?days=${days}`;
    // console.warn(`[api.js] getLocationStats: GET from ${url}`);
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const authStr = await AsyncStorage.getItem('auth');
      if (!authStr) throw new Error('No auth token found. Please login first.');

      const auth = JSON.parse(authStr);
      const token = auth.token || auth.access_token;
      if (!token) throw new Error('No JWT token found in auth data.');

      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const data = await res.json();
      // console.warn(`[api.js] getLocationStats: Success`, data);
      return data;
    } catch (err) {
      console.error(`[api.js] getLocationStats: Error: ${err.message}`);
      throw err;
    }
  },

  // GET /location/stats/day?date=YYYY-MM-DD
  getLocationStatsForDay: async (date) => {
    const url = `${BASE_URL}/location/stats/day?date=${encodeURIComponent(date)}`;
    // console.log(`[api.js] getLocationStatsForDay -> GET ${url}`);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const authStr = await AsyncStorage.getItem('auth');
      if (!authStr) throw new Error('No auth token found. Please login first.');
      const auth = JSON.parse(authStr);
      const token = auth.token || auth.access_token;
      if (!token) throw new Error('No JWT token found in auth data.');

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const data = await res.json();
      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Request timeout - server took too long to respond');
      }
      if (err.message.includes('Failed to fetch') || err.message.includes('Network request failed')) {
        throw new Error(`Cannot reach server at ${url}. Make sure the FastAPI server is running on port 8000.`);
      }
      throw err;
    }
  },

  // GET /pm25/forecast?lat=21.0285&lon=105.8542&days=7
  getPM25Forecast: async (lat, lon, days = 7) => {
    const url = `${BASE_URL}/pm25/forecast?lat=${lat}&lon=${lon}&days=${days}`;
    // console.warn(`[api.js] getPM25Forecast: GET from ${url}`);
    try {
      const res = await fetch(url, {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const data = await res.json();
      // console.warn(`[api.js] getPM25Forecast: Success, got ${data.forecast?.length || 0} days`);
      return data;
    } catch (err) {
      console.error(`[api.js] getPM25Forecast: Error: ${err.message}`);
      throw err;
    }
  },

  // GET /pm25/point?lon=105.8542&lat=21.0285&date=20241206
  getPM25Point: async (lat, lon, date = null, retries = 2) => {
    let dateParam = '';
    console.warn(`[api.js] getPM25Point: lat=${lat}, lon=${lon}, date=${date}`);
    if (date) {
      let dateStr = date;
      if (date instanceof Date) {
        // Format to yyyyMMdd
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        dateStr = `${y}${m}${d}`;
      } else {
        // Remove all non-digits, fallback
        dateStr = String(date).replace(/[^\d]/g, '');
      }
      dateParam = `&date=${dateStr}`;
    }
    const url = `${BASE_URL}/pm25/point?lon=${lon}&lat=${lat}${dateParam}`;
    console.warn(`[api.js] getPM25Point: GET from ${url}`);

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          console.warn(`[api.js] getPM25Point: Retry attempt ${attempt}/${retries}`);
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // Increased to 8s

        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text}`);
        }

        const data = await res.json();
        console.warn(`[api.js] getPM25Point: Success, AQI=${data.aqi}`);
        return data;
      } catch (err) {
        const isLastAttempt = attempt === retries;

        if (err.name === 'AbortError') {
          console.error(`[api.js] getPM25Point: Timeout after 8 seconds (attempt ${attempt + 1})`);
          if (isLastAttempt) {
            throw new Error(`Server timeout. Please check if backend is running at ${BASE_URL}`);
          }
        } else if (err.message.includes('Network request failed')) {
          console.error(`[api.js] getPM25Point: Network error (attempt ${attempt + 1}): ${err.message}`);
          if (isLastAttempt) {
            throw new Error(`Cannot connect to server at ${BASE_URL}. Make sure the backend is running and the IP address is correct.`);
          }
        } else {
          console.error(`[api.js] getPM25Point: Error (attempt ${attempt + 1}): ${err.message}`);
          if (isLastAttempt) {
            throw err;
          }
        }
      }
    }
  },

  // GET AQI by location (lat, lon) - For Geofencing
  getAQIByLocation: async (lat, lon) => {
    try {
      // Get today's date as yyyyMMdd
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      const dateStr = `${y}${m}${d}`;

      // Reuse getPM25Point for AQI data with today's date
      const data = await api.getPM25Point(lat, lon, dateStr);
      return {
        aqi: data.aqi,
        pm25: data.pm25,
        locationName: data.location || 'Unknown',
      };
    } catch (err) {
      console.error(`[api.js] getAQIByLocation: Error: ${err.message}`);
      throw err;
    }
  }
};

// Auth helpers
api.auth = {
  register: async (email, username, password, profile = {}) => {
    /**
     * Register a new user with extended profile information.
     * @param {string} email - User email
     * @param {string} username - Unique username (3-20 chars, alphanumeric + underscore)
     * @param {string} password - User password
     * @param {object} profile - User profile containing:
     *   - displayName: string (optional)
     *   - gender: 'male' | 'female' | 'other' (optional)
     *   - age: number (optional)
     *   - phone: string (optional)
     *   - location: string (optional)
     *   - city: string (optional)
     *   - country: string (optional)
     *   - photoURL: string (optional)
     *   - additionalInfo: object (optional, for custom fields)
     */
    const url = `${api.AUTH_BASE}/register`;
    console.warn(`[api.js] auth.register -> POST ${url}`);
    console.warn(`[api.js] auth.register: profile fields:`, {
      email,
      username,
      displayName: profile.displayName,
      gender: profile.gender,
      age: profile.age,
      phone: profile.phone,
      location: profile.location,
      city: profile.city,
      country: profile.country,
      group: profile.group
    });
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, username, password, profile })
      });
      if (!res.ok) {
        const text = await res.text();
        let errorMsg = text || `HTTP ${res.status}`;
        try {
          const json = JSON.parse(text);
          errorMsg = json.detail || json.message || errorMsg;
        } catch (e) {
          // Not JSON, use text as-is
        }
        throw new Error(errorMsg);
      }
      return res.json();
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.message.includes('Network request failed')) {
        throw new Error(`Cannot reach server at ${url}. Make sure the FastAPI server is running on port 8000.`);
      }
      throw err;
    }
  },

  // Get location history statistics
  getLocationStats: async (days = 7) => {
    const url = `${BASE_URL}/location/stats?days=${days}`;
    console.log(`[api.js] getLocationStats -> GET ${url}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();
      console.log(`[api.js] getLocationStats response:`, {
        total_records: data.total_records,
        avg_aqi: data.avg_aqi,
        date_range: data.date_range,
      });

      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn('[api.js] getLocationStats timeout after 10s');
        throw new Error('Request timeout - server took too long to respond');
      }
      if (err.message.includes('Failed to fetch') || err.message.includes('Network request failed')) {
        throw new Error(`Cannot reach server at ${url}. Make sure the FastAPI server is running on port 8000.`);
      }
      throw err;
    }
  },

  login: async (emailOrUsername, password) => {
    const url = `${api.AUTH_BASE}/login`;
    console.warn(`[api.js] auth.login -> POST ${url}`);
    console.warn(`[api.js] auth.login: identifier=${emailOrUsername}`);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ email_or_username: emailOrUsername, password })
      });
      if (!res.ok) {
        const text = await res.text();
        let errorMsg = text || `HTTP ${res.status}`;
        try {
          const json = JSON.parse(text);
          errorMsg = json.detail || json.message || errorMsg;
        } catch (e) {
          // Not JSON, use text as-is
        }
        throw new Error(errorMsg);
      }
      return res.json();
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.message.includes('Network request failed')) {
        throw new Error(`Cannot reach server at ${url}. Make sure the FastAPI server is running on port 8000.`);
      }
      throw err;
    }
  }
};

// Notification API methods
api.notifications = {
  /**
   * Get notifications for current user
   */
  getNotifications: async (limit = 100, skip = 0, unreadOnly = false) => {
    const url = `${BASE_URL}/notifications?limit=${limit}&skip=${skip}&unread_only=${unreadOnly}`;
    console.log(`[api.js] notifications.getNotifications -> GET ${url}`);
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const authStr = await AsyncStorage.getItem('auth');
      if (!authStr) throw new Error('No auth token found. Please login first.');

      const auth = JSON.parse(authStr);
      const token = auth.token || auth.access_token;
      if (!token) throw new Error('No JWT token found in auth data.');

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      return res.json();
    } catch (err) {
      console.error(`[api.js] notifications.getNotifications: Error: ${err.message}`);
      throw err;
    }
  },

  /**
   * Create a new notification (save to backend)
   */
  createNotification: async (type, data, title, body) => {
    const url = `${BASE_URL}/notifications`;
    console.log(`[api.js] notifications.createNotification -> POST ${url}`);
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const authStr = await AsyncStorage.getItem('auth');
      if (!authStr) throw new Error('No auth token found. Please login first.');

      const auth = JSON.parse(authStr);
      const token = auth.token || auth.access_token;
      if (!token) throw new Error('No JWT token found in auth data.');

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ type, data, title, body })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      return res.json();
    } catch (err) {
      console.error(`[api.js] notifications.createNotification: Error: ${err.message}`);
      throw err;
    }
  },

  /**
   * Get notification statistics
   */
  getStats: async () => {
    const url = `${BASE_URL}/notifications/stats`;
    console.log(`[api.js] notifications.getStats -> GET ${url}`);
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const authStr = await AsyncStorage.getItem('auth');
      if (!authStr) throw new Error('No auth token found. Please login first.');

      const auth = JSON.parse(authStr);
      const token = auth.token || auth.access_token;
      if (!token) throw new Error('No JWT token found in auth data.');

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      return res.json();
    } catch (err) {
      console.error(`[api.js] notifications.getStats: Error: ${err.message}`);
      throw err;
    }
  },

  /**
   * Mark notification as read
   */
  markAsRead: async (notificationId) => {
    const url = `${BASE_URL}/notifications/${notificationId}/read`;
    console.log(`[api.js] notifications.markAsRead -> PATCH ${url}`);
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const authStr = await AsyncStorage.getItem('auth');
      if (!authStr) throw new Error('No auth token found. Please login first.');

      const auth = JSON.parse(authStr);
      const token = auth.token || auth.access_token;
      if (!token) throw new Error('No JWT token found in auth data.');

      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      return res.json();
    } catch (err) {
      console.error(`[api.js] notifications.markAsRead: Error: ${err.message}`);
      throw err;
    }
  },

  /**
   * Mark all notifications as read
   */
  markAllAsRead: async () => {
    const url = `${BASE_URL}/notifications/read-all`;
    console.log(`[api.js] notifications.markAllAsRead -> PATCH ${url}`);
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const authStr = await AsyncStorage.getItem('auth');
      if (!authStr) throw new Error('No auth token found. Please login first.');

      const auth = JSON.parse(authStr);
      const token = auth.token || auth.access_token;
      if (!token) throw new Error('No JWT token found in auth data.');

      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      return res.json();
    } catch (err) {
      console.error(`[api.js] notifications.markAllAsRead: Error: ${err.message}`);
      throw err;
    }
  },

  /**
   * Clear notifications
   */
  clearNotifications: async (keepUnread = false, olderThanDays = null) => {
    let url = `${BASE_URL}/notifications/clear?keep_unread=${keepUnread}`;
    if (olderThanDays) {
      url += `&older_than_days=${olderThanDays}`;
    }
    console.log(`[api.js] notifications.clearNotifications -> DELETE ${url}`);
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const authStr = await AsyncStorage.getItem('auth');
      if (!authStr) throw new Error('No auth token found. Please login first.');

      const auth = JSON.parse(authStr);
      const token = auth.token || auth.access_token;
      if (!token) throw new Error('No JWT token found in auth data.');

      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      return res.json();
    } catch (err) {
      console.error(`[api.js] notifications.clearNotifications: Error: ${err.message}`);
      throw err;
    }
  },

  /**
   * Delete specific notification
   */
  deleteNotification: async (notificationId) => {
    const url = `${BASE_URL}/notifications/${notificationId}`;
    console.log(`[api.js] notifications.deleteNotification -> DELETE ${url}`);
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const authStr = await AsyncStorage.getItem('auth');
      if (!authStr) throw new Error('No auth token found. Please login first.');

      const auth = JSON.parse(authStr);
      const token = auth.token || auth.access_token;
      if (!token) throw new Error('No JWT token found in auth data.');

      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      return res.json();
    } catch (err) {
      console.error(`[api.js] notifications.deleteNotification: Error: ${err.message}`);
      throw err;
    }
  }
};

export default api;

// Export individual functions for direct import
export const { getAQIByLocation, getPM25Point, getPM25Forecast, saveLocation, getLocationHistory, getLocationStats } = api;
