// NotificationService - Quản lý push notifications cho SmartAir
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const NOTIFICATION_PREFS_KEY = '@notification_prefs';

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
   * Clear notifications for current user (used on logout)
   */
  async clearUserNotifications() {
    try {
      const key = this._getStorageKey();
      await AsyncStorage.removeItem(key);
      console.log('[NotificationService] Cleared notifications for user:', this.currentUserId);
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
        trigger: null, // Send immediately
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
  async saveNotificationHistory(type, data, title = '', body = '') {
    try {
      const history = await this.getNotificationHistory();
      const newNotification = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        type,
        data,
        title,
        body,
        timestamp: new Date().toISOString(),
        read: false, // Mặc định chưa đọc
      };
      
      history.push(newNotification);
      
      // Chỉ giữ lại 100 notification gần nhất
      const recentHistory = history.slice(-100);
      const storageKey = this._getStorageKey();
      await AsyncStorage.setItem(storageKey, JSON.stringify(recentHistory));
      
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
   */
  async getNotificationHistory(limit = 100) {
    try {
      const storageKey = this._getStorageKey();
      const history = await AsyncStorage.getItem(storageKey);
      // console.log('[NotificationService] Retrieved notification history', history);
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
   */
  async markNotificationAsRead(notificationId) {
    try {
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
   */
  async markAllNotificationsAsRead() {
    try {
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
   */
  async getUnreadCount() {
    try {
      const history = await this.getNotificationHistory();
      return history.filter(noti => !noti.read).length;
    } catch (error) {
      console.error('[NotificationService] Get unread count error:', error);
      return 0;
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
