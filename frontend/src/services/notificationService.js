// NotificationService - Quản lý push notifications cho SmartAir
// Now with MongoDB backend sync support
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import api from './api';

const NOTIFICATION_PREFS_KEY = '@notification_prefs';
const USE_MONGODB_BACKEND = true; // Toggle to enable/disable MongoDB sync

// Cấu hình notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

class NotificationService {
  constructor() {
    this.notificationListener = null;
    this.responseListener = null;
    this.unreadCountListeners = []; // Listeners cho unread count changes
    this.currentUserId = null; // Track current user ID
  }

  /**
   * Set current user ID for user-specific storage
   */
  setUserId(userId) {
    this.currentUserId = userId;
    console.log('[NotificationService] User ID set to:', userId);
  }

  /**
   * Get user-specific storage key
   */
  _getStorageKey() {
    if (!this.currentUserId) {
      console.warn('[NotificationService] No userId set, using default key');
      return '@notification_history';
    }
    return `@notification_history_${this.currentUserId}`;
  }

  /**
   * Get notifications from local AsyncStorage only (helper method)
   * Does NOT fetch from MongoDB
   */
  async _getLocalNotifications() {
    try {
      const storageKey = this._getStorageKey();
      const history = await AsyncStorage.getItem(storageKey);
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.error('[NotificationService] Get local notifications error:', error);
      return [];
    }
  }

  /**
   * Clear notifications for current user (used on logout)
   * Now also clears from MongoDB backend
   */
  async clearUserNotifications() {
    try {
      // Clear from backend if enabled and user is logged in
      if (USE_MONGODB_BACKEND && this.currentUserId) {
        try {
          await api.notifications.clearNotifications(false); // Clear all
          console.log('[NotificationService] Cleared notifications from MongoDB for user:', this.currentUserId);
        } catch (apiError) {
          console.warn('[NotificationService] Failed to clear from MongoDB:', apiError.message);
        }
      }
      
      // Clear local storage
      const key = this._getStorageKey();
      await AsyncStorage.removeItem(key);
      console.log('[NotificationService] Cleared local notifications for user:', this.currentUserId);
      
      this.currentUserId = null;
    } catch (error) {
      console.error('[NotificationService] Clear user notifications error:', error);
    }
  }

  /**
   * Khởi tạo và yêu cầu quyền gửi notification
   */
  async initialize() {
    try {
      const token = await this.registerForPushNotifications();
      console.log('[NotificationService] Initialized with token:', token);
      
      // Lưu token vào storage
      if (token) {
        await AsyncStorage.setItem('@expo_push_token', token);
      }
      
      return token;
    } catch (error) {
      console.error('[NotificationService] Initialize error:', error);
      return null;
    }
  }

  /**
   * Đăng ký và xin quyền push notifications
   */
  async registerForPushNotifications() {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });

      // High priority channel cho AQI warnings
      await Notifications.setNotificationChannelAsync('aqi-warning', {
        name: 'AQI Warnings',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#FF0000',
        sound: 'default',
        description: 'Cảnh báo chất lượng không khí xấu',
      });

      // Channel cho daily stats
      await Notifications.setNotificationChannelAsync('daily-stats', {
        name: 'Daily Statistics',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250],
        lightColor: '#4CAF50',
        sound: 'default',
        description: 'Thống kê tiếp xúc không khí hàng ngày',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.warn('[NotificationService] Permission not granted!');
        return null;
      }
      
      token = (await Notifications.getExpoPushTokenAsync()).data;
    } else {
      console.warn('[NotificationService] Must use physical device for Push Notifications');
    }

    return token;
  }

  /**
   * Gửi local notification ngay lập tức
   */
  async sendLocalNotification(title, body, data = {}, channelId = 'default') {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
          channelId,
        },
        trigger: null, // Send immediatelydata,
        sound: true,
        channelId,
      
        
      });
      console.log('[NotificationService] Local notification sent:', title);
    } catch (error) {
      console.error('[NotificationService] Send local notification error:', error);
    }
  }

  /**
   * Hiển thị notification ngay lập tức (dùng cho test/demo)
   * Notification sẽ hiện ngay cả khi app đang mở
   */
  async presentNotification(title, body, data = {}, channelId = 'default') {
    try {
      await Notifications.presentNotificationAsync({
        title,
        body,
        data,
        sound: true,
        android: {
          channelId,
        },
        ios: {
          sound: true,
        },
      });
      console.log('[NotificationService] Notification presented:', title);
    } catch (error) {
      console.error('[NotificationService] Present notification error:', error);
    }
  }

  /**
   * Gửi notification cảnh báo AQI (tất cả các mức)
   */
  async sendAQIWarning(aqi, location, pm25 = null) {
    let title = 'Cảnh báo chất lượng không khí';
    let body = `Khu vực ${location} có AQI ${aqi}`;
    // if (pm25 !== null && pm25 !== undefined) body += ` · PM2.5: ${pm25}`;
    body += ' - ';
    let priority = Notifications.AndroidNotificationPriority.HIGH;
    
    if (aqi >= 300) {
      body += 'Nguy hiểm! Hạn chế ra ngoài.';
      priority = Notifications.AndroidNotificationPriority.MAX;
    } else if (aqi >= 200) {
      body += 'Rất không tốt! Đeo khẩu trang.';
    } else if (aqi >= 150) {
      body += 'Không tốt cho sức khỏe. Cẩn thận khi ra ngoài.';
    } else if (aqi >= 101) {
      title = 'Chất lượng không khí';
      body += 'Không tốt cho nhóm nhạy cảm.';
      priority = Notifications.AndroidNotificationPriority.DEFAULT;
    } else if (aqi >= 51) {
      title = 'Chất lượng không khí';
      body += 'Chấp nhận được.';
      priority = Notifications.AndroidNotificationPriority.DEFAULT;
    } else {
      title = 'Chất lượng không khí';
      body += 'Tốt! An toàn cho sức khỏe.';
      priority = Notifications.AndroidNotificationPriority.LOW;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { 
            type: 'aqi_info', 
            aqi, 
            pm25,
            location,
            timestamp: new Date().toISOString()
          },
          sound: true,
            priority,
            channelId: 'aqi-warning',
        },
        trigger: null,
      });
      
      // Lưu lại lịch sử notification
      await this.saveNotificationHistory('aqi-warning', { aqi, pm25, location }, title, body);
    } catch (error) {
      console.error('[NotificationService] Send AQI warning error:', error);
    }
  }

  /**
   * Gửi notification thống kê hàng ngày
   */
  async sendDailyStats(stats) {
    const { days, cigaretteEquivalent, avgAQI, exposureTime } = stats;
    
    const title = '📊 Thống kê tiếp xúc không khí';
    const body = `Trong ${days} ngày qua, bạn đã hít phải lượng không khí tương đương ${cigaretteEquivalent} điếu thuốc. Trung bình AQI: ${avgAQI}.`;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { 
            type: 'daily_stats', 
            ...stats,
            timestamp: new Date().toISOString()
          },
          sound: true,
          channelId: 'daily-stats',
        },
        trigger: null,
      });
      
      await this.saveNotificationHistory('daily-stats', stats, title, body);
    } catch (error) {
      console.error('[NotificationService] Send daily stats error:', error);
    }
  }

  /**
   * Lên lịch notification hàng ngày (mặc định 8 giờ tối)
   */
  async scheduleDailyStatsNotification(hour = 20, minute = 0) {
    try {
      // Cancel existing daily notifications
      await this.cancelScheduledNotifications('daily_stats_scheduled');

      const trigger = {
        type: 'daily',
        hour,
        minute,
        repeats: true,
      };

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '📊 Thống kê hàng ngày',
          body: 'Xem thống kê tiếp xúc không khí của bạn',
          data: { type: 'daily_stats_scheduled' },
          sound: true,
          channelId: 'daily-stats',
        },
        trigger,
      });

      console.log('[NotificationService] Scheduled daily notification:', id);
      await AsyncStorage.setItem('@daily_notification_id', id);
      
      return id;
    } catch (error) {
      console.error('[NotificationService] Schedule daily notification error:', error);
      return null;
    }
  }

  /**
   * Hủy scheduled notifications
   */
  async cancelScheduledNotifications(type) {
    try {
      const notifications = await Notifications.getAllScheduledNotificationsAsync();
      
      for (const notification of notifications) {
        if (notification.content.data?.type === type) {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
      }
      
      console.log('[NotificationService] Cancelled notifications of type:', type);
    } catch (error) {
      console.error('[NotificationService] Cancel notifications error:', error);
    }
  }

  /**
   * Lưu lịch sử notification với read status
   */
  // as Now syncs to MongoDB backend
  //  **/
  async saveNotificationHistory(type, data, title = '', body = '') {
    try {
      console.log('[NotificationService] saveNotificationHistory called:', { type, title, currentUserId: this.currentUserId });
      
      const newNotification = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        type,
        data,
        title,
        body,
        timestamp: new Date().toISOString(),
        read: false, // Mặc định chưa đọc
      };
      
      // Try to save to MongoDB backend if enabled and user is logged in
      if (USE_MONGODB_BACKEND && this.currentUserId) {
        console.log('[NotificationService] Attempting to save to MongoDB...');
        try {
          const backendNotif = await api.notifications.createNotification(type, data, title, body);
          console.log('[NotificationService] ✅ Saved to MongoDB:', backendNotif);
          // Use backend ID
          newNotification.id = backendNotif._id || backendNotif.id;
          newNotification.timestamp = backendNotif.timestamp;
          
          // Notify listeners
          await this.notifyUnreadCountChange();
          return newNotification;
        } catch (apiError) {
          console.warn('[NotificationService] ❌ Failed to save to MongoDB, falling back to local storage:', apiError.message);
          // Fall through to local storage
        }
      } else {
        console.log('[NotificationService] Skipping MongoDB (useBackend:', USE_MONGODB_BACKEND, 'userId:', this.currentUserId, ')');
      }
      
      // Fallback: Save to local AsyncStorage
      console.log('[NotificationService] 💾 Saving to local AsyncStorage (fallback)');
      const history = await this._getLocalNotifications(); // Use local method to avoid recursion
      history.push(newNotification);
      
      // Chỉ giữ lại 100 notification gần nhất
      const recentHistory = history.slice(-100);
      const storageKey = this._getStorageKey();
      await AsyncStorage.setItem(storageKey, JSON.stringify(recentHistory));
      console.log('[NotificationService] Saved to local storage, total notifications:', recentHistory.length);
      
      // Notify listeners
      await this.notifyUnreadCountChange();
      
      return newNotification;
    } catch (error) {
      console.error('[NotificationService] Save history error:', error);
      return null;
    }
  }

  /**
   * Lấy lịch sử notification (tối đa limit items)
   * Now fetches from MongoDB backend
   */
  async getNotificationHistory(limit = 100) {
    try {
      // Try to fetch from MongoDB backend if enabled and user is logged in
      if (USE_MONGODB_BACKEND && this.currentUserId) {
        try {
          const notifications = await api.notifications.getNotifications(limit, 0, false);
          console.log(`[NotificationService] ✅ Fetched ${notifications.length} notifications from MongoDB`);
          // Transform backend format to match local format
          return notifications.map(n => ({
            id: n._id || n.id,
            type: n.type,
            data: n.data,
            title: n.title,
            body: n.body,
            timestamp: n.timestamp,
            read: n.read
          }));
        } catch (apiError) {
          console.warn('[NotificationService] ❌ Failed to fetch from MongoDB, using local storage:', apiError.message);
          // Fall through to local storage
        }
      }
      
      // Fallback: Get from local AsyncStorage
      console.log('[NotificationService] 💾 Fetching from local AsyncStorage (fallback)');
      const storageKey = this._getStorageKey();
      const history = await AsyncStorage.getItem(storageKey);
      const parsed = history ? JSON.parse(history) : [];
      
      // Trả về limit notifications mới nhất
      return parsed.slice(-limit).reverse(); // Đảo ngược để mới nhất ở đầu
    } catch (error) {
      console.error('[NotificationService] Get history error:', error);
      return [];
    }
  }


  /**
   * Đánh dấu notification đã đọc
   * Now syncs to MongoDB backend
   */
  async markNotificationAsRead(notificationId) {
    try {
      // Try to update in MongoDB backend if enabled and user is logged in
      if (USE_MONGODB_BACKEND && this.currentUserId) {
        try {
          await api.notifications.markAsRead(notificationId);
          console.log('[NotificationService] Marked as read in MongoDB:', notificationId);
          await this.notifyUnreadCountChange();
          return true;
        } catch (apiError) {
          console.warn('[NotificationService] Failed to mark as read in MongoDB, using local storage:', apiError.message);
          // Fall through to local storage
        }
      }
      
      // Fallback: Update local AsyncStorage
      const storageKey = this._getStorageKey();
      const history = await AsyncStorage.getItem(storageKey);
      const parsed = history ? JSON.parse(history) : [];
      
      const updated = parsed.map(noti => {
        if (noti.id === notificationId) {
          return { ...noti, read: true };
        }
        return noti;
      });
      
      await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      await this.notifyUnreadCountChange();
      return true;
    } catch (error) {
      console.error('[NotificationService] Mark as read error:', error);
      return false;
    }
  }

  /**
   * Đánh dấu tất cả notifications đã đọc
   * Now syncs to MongoDB backend
   */
  async markAllNotificationsAsRead() {
    try {
      // Try to update in MongoDB backend if enabled and user is logged in
      if (USE_MONGODB_BACKEND && this.currentUserId) {
        try {
          const result = await api.notifications.markAllAsRead();
          console.log('[NotificationService] Marked all as read in MongoDB:', result);
          await this.notifyUnreadCountChange();
          return true;
        } catch (apiError) {
          console.warn('[NotificationService] Failed to mark all as read in MongoDB, using local storage:', apiError.message);
          // Fall through to local storage
        }
      }
      
      // Fallback: Update local AsyncStorage
      const storageKey = this._getStorageKey();
      const history = await AsyncStorage.getItem(storageKey);
      const parsed = history ? JSON.parse(history) : [];
      
      const updated = parsed.map(noti => ({ ...noti, read: true }));
      
      await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      await this.notifyUnreadCountChange();
      return true;
    } catch (error) {
      console.error('[NotificationService] Mark all as read error:', error);
      return false;
    }
  }

  /**
   * Lấy số lượng notifications chưa đọc
   * Now fetches from MongoDB backend
   */
  async getUnreadCount() {
    try {
      // Try to fetch from MongoDB backend if enabled and user is logged in
      if (USE_MONGODB_BACKEND && this.currentUserId) {
        try {
          const stats = await api.notifications.getStats();
          console.log('[NotificationService] Got unread count from MongoDB:', stats.unread);
          return stats.unread;
        } catch (apiError) {
          console.warn('[NotificationService] Failed to get unread count from MongoDB, using local storage:', apiError.message);
          // Fall through to local storage
        }
      }
      
      // Fallback: Count from local AsyncStorage
      const history = await this.getNotificationHistory();
      return history.filter(noti => !noti.read).length;
    } catch (error) {
      console.error('[NotificationService] Get unread count error:', error);
      return 0;
    }
  }

  /**
   * Migrate local AsyncStorage notifications to MongoDB backend
   * This should be called once after login to sync existing notifications
   */
  async syncLocalNotificationsToBackend() {
    if (!USE_MONGODB_BACKEND || !this.currentUserId) {
      console.log('[NotificationService] Skipping sync - MongoDB backend disabled or no user');
      return { success: false, message: 'Backend sync disabled or no user' };
    }

    try {
      console.log('[NotificationService] Starting local to MongoDB sync...');
      
      // Get local notifications from AsyncStorage
      const localNotifications = await this._getLocalNotifications();
      
      if (localNotifications.length === 0) {
        console.log('[NotificationService] No local notifications to sync');
        return { success: true, synced: 0, message: 'No local notifications' };
      }

      let syncedCount = 0;
      let failedCount = 0;

      // Upload each notification to backend
      for (const notif of localNotifications) {
        try {
          await api.notifications.createNotification(
            notif.type,
            notif.data,
            notif.title,
            notif.body
          );
          syncedCount++;
        } catch (err) {
          console.warn('[NotificationService] Failed to sync notification:', err.message);
          failedCount++;
        }
      }

      console.log(`[NotificationService] Sync complete: ${syncedCount} synced, ${failedCount} failed`);

      // Clear local storage after successful sync
      if (syncedCount > 0 && failedCount === 0) {
        const storageKey = this._getStorageKey();
        await AsyncStorage.removeItem(storageKey);
        console.log('[NotificationService] Cleared local storage after successful sync');
      }

      return {
        success: true,
        synced: syncedCount,
        failed: failedCount,
        message: `Synced ${syncedCount} notifications to backend`
      };
    } catch (error) {
      console.error('[NotificationService] Sync error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get local notification count (from AsyncStorage only)
   */
  async getLocalNotificationCount() {
    try {
      const notifications = await this._getLocalNotifications();
      return notifications.length;
    } catch (error) {
      console.error('[NotificationService] Get local count error:', error);
      return 0;
    }
  }

  /**
   * Force clear local AsyncStorage notifications
   * Use this after successful sync to MongoDB
   */
  async clearLocalStorage() {
    try {
      const storageKey = this._getStorageKey();
      await AsyncStorage.removeItem(storageKey);
      console.log('[NotificationService] Local storage cleared for user:', this.currentUserId);
      return { success: true, message: 'Local storage cleared' };
    } catch (error) {
      console.error('[NotificationService] Clear local storage error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get notification statistics from both local and backend
   */
  async getNotificationStats() {
    const stats = {
      local: 0,
      backend: { total: 0, unread: 0, today: 0 },
      useBackend: USE_MONGODB_BACKEND && this.currentUserId
    };

    try {
      // Local count
      stats.local = await this.getLocalNotificationCount();

      // Backend stats
      if (stats.useBackend) {
        try {
          stats.backend = await api.notifications.getStats();
        } catch (err) {
          console.warn('[NotificationService] Failed to get backend stats:', err.message);
        }
      }

      return stats;
    } catch (error) {
      console.error('[NotificationService] Get stats error:', error);
      return stats;
    }
  }

  /**
   * Delete a specific notification
   * Now syncs to MongoDB backend
   */
  async deleteNotification(notificationId) {
    try {
      // Try to delete from MongoDB backend if enabled and user is logged in
      if (USE_MONGODB_BACKEND && this.currentUserId) {
        try {
          const result = await api.notifications.deleteNotification(notificationId);
          console.log('[NotificationService] Deleted notification from MongoDB:', result);
          await this.notifyUnreadCountChange();
          return true;
        } catch (apiError) {
          console.warn('[NotificationService] Failed to delete from MongoDB, using local storage:', apiError.message);
          // Fall through to local storage
        }
      }
      
      // Fallback: Delete from local AsyncStorage
      const storageKey = this._getStorageKey();
      const history = await this._getLocalNotifications();
      const updated = history.filter(noti => noti.id !== notificationId);
      await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      console.log('[NotificationService] Deleted notification from local storage');
      
      await this.notifyUnreadCountChange();
      return true;
    } catch (error) {
      console.error('[NotificationService] Delete notification error:', error);
      return false;
    }
  }

  /**
   * Clear notification history
   * Now syncs to MongoDB backend
   */
  async clearHistory(keepUnread = false) {
    try {
      // Try to clear in MongoDB backend if enabled and user is logged in
      if (USE_MONGODB_BACKEND && this.currentUserId) {
        try {
          const result = await api.notifications.clearNotifications(keepUnread);
          console.log('[NotificationService] Cleared notifications in MongoDB:', result);
          await this.notifyUnreadCountChange();
          return true;
        } catch (apiError) {
          console.warn('[NotificationService] Failed to clear in MongoDB, using local storage:', apiError.message);
          // Fall through to local storage
        }
      }
      
      // Fallback: Clear local AsyncStorage
      const storageKey = this._getStorageKey();
      
      if (keepUnread) {
        const history = await this._getLocalNotifications();
        const unreadOnly = history.filter(noti => !noti.read);
        await AsyncStorage.setItem(storageKey, JSON.stringify(unreadOnly));
      } else {
        await AsyncStorage.removeItem(storageKey);
      }
      
      await this.notifyUnreadCountChange();
      return true;
    } catch (error) {
      console.error('[NotificationService] Clear history error:', error);
      return false;
    }
  }

  /**
   * Subscribe to unread count changes
   */
  onUnreadCountChange(callback) {
    this.unreadCountListeners.push(callback);
    // Return unsubscribe function
    return () => {
      this.unreadCountListeners = this.unreadCountListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all listeners về unread count change
   */
  async notifyUnreadCountChange() {
    const count = await this.getUnreadCount();
    this.unreadCountListeners.forEach(callback => callback(count));
  }

  /**
   * Thiết lập notification listeners
   */
  setupNotificationListeners(onNotificationReceived, onNotificationResponse) {
    // Listener khi nhận notification trong khi app đang mở
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('[NotificationService] Notification received:', notification);
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    });

    // Listener khi user tap vào notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[NotificationService] Notification tapped:', response);
      if (onNotificationResponse) {
        onNotificationResponse(response);
      }
    });
  }

  /**
   * Xóa listeners
   */
  removeNotificationListeners() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }

  /**
   * Kiểm tra xem notification có được bật không
   */
  async isNotificationEnabled() {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  }

  /**
   * Lấy tất cả delivered notifications
   */
  async getDeliveredNotifications() {
    try {
      return await Notifications.getPresentedNotificationsAsync();
    } catch (error) {
      console.error('[NotificationService] Get delivered notifications error:', error);
      return [];
    }
  }

  /**
   * Clear tất cả notifications
   */
  async clearAllNotifications() {
    try {
      await Notifications.dismissAllNotificationsAsync();
      console.log('[NotificationService] All notifications cleared');
    } catch (error) {
      console.error('[NotificationService] Clear notifications error:', error);
    }
  }
}

// Export singleton instance
export default new NotificationService();
