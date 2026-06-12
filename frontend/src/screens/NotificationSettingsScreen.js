// NotificationSettingsScreen - Quản lý cài đặt thông báo
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import dailyStatsService from '../services/dailyStatsService';
import geofenceService from '../services/geofenceService';
import notificationService from '../services/notificationService';

export default function NotificationSettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [geofenceEnabled, setGeofenceEnabled] = useState(true);
  const [dailyStatsEnabled, setDailyStatsEnabled] = useState(false);
  const [currentAQI, setCurrentAQI] = useState(null);
  const [lastStats, setLastStats] = useState(null);
  const [notificationStats, setNotificationStats] = useState(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Ensure user ID is set for notification service
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const authStr = await AsyncStorage.getItem('auth');
      if (authStr) {
        const auth = JSON.parse(authStr);
        if (auth.uid && !notificationService.currentUserId) {
          console.log('[NotificationSettings] Setting user ID from auth:', auth.uid);
          notificationService.setUserId(auth.uid);
        }
      }
      
      // Check notification permission
      const notifEnabled = await notificationService.isNotificationEnabled();
      setNotificationEnabled(notifEnabled);
      
      // Check geofence tracking status
      const geoEnabled = await geofenceService.isTrackingActive();
      setGeofenceEnabled(geoEnabled);
      
      // Check daily stats status
      const statsEnabled = await dailyStatsService.isBackgroundFetchActive();
      setDailyStatsEnabled(statsEnabled);
      
      // Load current AQI
      const aqiData = await geofenceService.getCurrentAQI();
      setCurrentAQI(aqiData);
      
      // Load last stats
      const stats = await dailyStatsService.getLastStats();
      setLastStats(stats);
      
      // Load notification stats (local vs backend)
      const notifStats = await notificationService.getNotificationStats();
      setNotificationStats(notifStats);
      
    } catch (error) {
      console.error('[NotificationSettings] Load settings error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleNotifications = async (value) => {
    if (value) {
      const success = await notificationService.initialize();
      if (success) {
        setNotificationEnabled(true);
        await notificationService.sendLocalNotification('Thành công', 'Đã bật thông báo');
      } else {
        Alert.alert('Lỗi', 'Không thể bật thông báo. Vui lòng kiểm tra quyền trong cài đặt.');
      }
    } else {
      setNotificationEnabled(false);
      await notificationService.sendLocalNotification('Thông báo', 'Thông báo đã được tắt');
    }
  };

  const handleToggleGeofence = async (value) => {
    try {
      if (value) {
        const success = await geofenceService.initialize();
        if (success) {
          await geofenceService.startTracking();
          setGeofenceEnabled(true);
          await notificationService.sendLocalNotification('Đã bật cảnh báo AQI', 'App sẽ thông báo khi bạn di chuyển vào vùng có AQI > 150');
        } else {
          Alert.alert('Lỗi', 'Không thể bật theo dõi vị trí. Vui lòng kiểm tra quyền.');
        }
      } else {
        await geofenceService.stopTracking();
        setGeofenceEnabled(false);
        await notificationService.sendLocalNotification('Thông báo', 'Đã tắt cảnh báo AQI');
      }
    } catch (error) {
      console.error('[NotificationSettings] Toggle geofence error:', error);
      Alert.alert('Lỗi', error.message);
    }
  };

  const handleToggleDailyStats = async (value) => {
    try {
      if (value) {
        await dailyStatsService.initialize();
        setDailyStatsEnabled(true);
        await notificationService.sendLocalNotification('Đã bật thống kê hàng ngày', 'Bạn sẽ nhận được thống kê tiếp xúc không khí mỗi ngày lúc 8 giờ tối');
      } else {
        await dailyStatsService.unscheduleBackgroundFetch();
        await notificationService.cancelScheduledNotifications('daily_stats_scheduled');
        setDailyStatsEnabled(false);
        await notificationService.sendLocalNotification('Thông báo', 'Đã tắt thống kê hàng ngày');
      }
    } catch (error) {
      console.error('[NotificationSettings] Toggle daily stats error:', error);
      Alert.alert('Lỗi', error.message);
    }
  };

  const handleTestAQINotification = async () => {
    try {
      // Force refresh AQI data để đảm bảo có pm25 mới nhất
      console.log('[NotificationSettings] Refreshing AQI data for test...');
      const freshAQI = await geofenceService.getCurrentAQI(true); // forceRefresh = true
      
      // Update state với data mới
      setCurrentAQI(freshAQI);
      
      console.log('[NotificationSettings] Fresh AQI data:', freshAQI);
      
      // Gửi ngay với data mới fetch
      const aqi = freshAQI?.aqi ?? 175;
      const location = freshAQI?.locationName ?? (
        (freshAQI?.latitude && freshAQI?.longitude) 
          ? `${freshAQI.latitude.toFixed(4)}, ${freshAQI.longitude.toFixed(4)}` 
          : 'Vị trí test'
      );
      const pm25 = freshAQI?.pm25 ?? null;

      console.log('[NotificationSettings] Test AQI data:', { aqi, location, pm25 });
      
      // Gửi notification ngay lập tức
      await notificationService.sendAQIWarning(aqi, location, pm25);
      
      // Hiển thị confirmation ngay
      await notificationService.presentNotification(
        '✓ Test hoàn tất', 
        `Đã gửi thông báo AQI ${aqi}${pm25 ? `, PM2.5 ${pm25.toFixed(1)}` : ''}`,
        { type: 'test_confirmation' }
      );
      
      // Reload notification stats
      setTimeout(() => loadSettings(), 1000);
    } catch (error) {
      console.error('[NotificationSettings] Test AQI notification error:', error);
      Alert.alert('Lỗi', error.message);
    }
  };

  const handleTestDailyStats = async () => {
    try {
      console.log('[NotificationSettings] Sending test daily stats notification');
      const success = await dailyStatsService.sendTestNotification();
      if (!success) {
        // Nếu chưa có dữ liệu thật để gửi, gửi một notification demo ngay lập tức
        const demoStats = {
          days: 3,
          cigaretteEquivalent: 3.2,
          avgAQI: 120,
          totalExposureMinutes: 240,
          avgPM25: 55.0,
        };

        await notificationService.sendDailyStats(demoStats);
        
        // Confirmation
        setTimeout(() => {
          notificationService.presentNotification('✓ Test hoàn tất', 'Đã gửi thông báo thống kê (demo)');
        }, 500);
      } else {
        // Confirmation
        setTimeout(() => {
          notificationService.presentNotification('✓ Test hoàn tất', 'Đã gửi thông báo thống kê');
        }, 500);
      }
      
      // Reload notification stats
      setTimeout(() => loadSettings(), 1000);
    } catch (error) {
      console.error('[NotificationSettings] Test daily stats error:', error);
      Alert.alert('Lỗi', error.message);
    }
  };

  const handleViewStats = async () => {
    try {
      const stats = await dailyStatsService.calculateCurrentStats(3);
      
      if (stats && stats.cigaretteEquivalent > 0) {
        // Use system notification to present stats
        await notificationService.sendDailyStats({
          days: 3,
          ...stats,
        });
      } else {
        await notificationService.sendLocalNotification('Thông báo', stats?.message || 'Chưa có dữ liệu thống kê');
      }
    } catch (error) {
      console.error('[NotificationSettings] View stats error:', error);
      Alert.alert('Lỗi', error.message);
    }
  };

  const handleDebugInfo = async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const authStr = await AsyncStorage.getItem('auth');
      const auth = authStr ? JSON.parse(authStr) : null;
      
      const debugInfo = {
        userId: auth?.uid || 'NOT_SET',
        notificationServiceUserId: notificationService.currentUserId || 'NOT_SET',
        hasAuth: !!auth,
        email: auth?.email || 'N/A',
      };
      
      console.log('[NotificationSettings] Debug info:', debugInfo);
      
      Alert.alert(
        'Debug Information',
        `User ID: ${debugInfo.userId}\n` +
        `Service User ID: ${debugInfo.notificationServiceUserId}\n` +
        `Has Auth: ${debugInfo.hasAuth}\n` +
        `Email: ${debugInfo.email}\n\n` +
        `Check console for more details.`
      );
      
      // Ensure user ID is set
      if (auth?.uid && !notificationService.currentUserId) {
        console.log('[NotificationSettings] Setting user ID:', auth.uid);
        notificationService.setUserId(auth.uid);
        await notificationService.presentNotification('Debug', 'User ID has been set');
      }
    } catch (error) {
      console.error('[NotificationSettings] Debug info error:', error);
      Alert.alert('Lỗi', error.message);
    }
  };

  const handleSyncNotifications = async () => {
    try {
      setSyncing(true);
      const result = await notificationService.syncLocalNotificationsToBackend();
      
      if (result.success) {
        Alert.alert(
          'Đồng bộ thành công',
          `Đã đồng bộ ${result.synced} thông báo lên server.${result.failed > 0 ? `\n\nThất bại: ${result.failed}` : ''}`,
          [{ text: 'OK', onPress: loadSettings }]
        );
      } else {
        Alert.alert('Lỗi', result.message || result.error || 'Không thể đồng bộ');
      }
    } catch (error) {
      console.error('[NotificationSettings] Sync error:', error);
      Alert.alert('Lỗi', error.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleClearLocalNotifications = async () => {
    Alert.alert(
      'Xóa thông báo local',
      'Xóa tất cả thông báo trong AsyncStorage (local device)?\n\nThông báo trên server vẫn được giữ.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await notificationService.clearLocalStorage();
              await notificationService.presentNotification('Thành công', 'Đã xóa thông báo local');
              await loadSettings();
            } catch (error) {
              Alert.alert('Lỗi', error.message);
            }
          },
        },
      ]
    );
  };

  const handleClearAllNotifications = async () => {
    Alert.alert(
      'Xóa tất cả thông báo',
      'Xóa tất cả thông báo (cả local và server)?\n\nHành động này không thể hoàn tác.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa tất cả',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear backend
              await notificationService.clearHistory(false);
              // Clear local
              await notificationService.clearLocalStorage();
              await notificationService.presentNotification('Thành công', 'Đã xóa tất cả thông báo');
              await loadSettings();
            } catch (error) {
              Alert.alert('Lỗi', error.message);
            }
          },
        },
      ]
    );
  };

  const handleClearHistory = async () => {
    Alert.alert(
      'Xác nhận',
      'Bạn có chắc muốn xóa toàn bộ lịch sử exposure?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await geofenceService.clearExposureHistory();
              await notificationService.sendLocalNotification('Thành công', 'Đã xóa lịch sử exposure');
              await loadSettings();
            } catch (error) {
              Alert.alert('Lỗi', error.message);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Notification Permission */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quyền Thông báo</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Bật thông báo</Text>
              <Text style={styles.settingDescription}>
                Cho phép app gửi thông báo
              </Text>
            </View>
            <Switch
              value={notificationEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: '#767577', true: '#81C784' }}
              thumbColor={notificationEnabled ? '#4CAF50' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* AQI Warning */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cảnh báo AQI</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Cảnh báo vùng AQI cao</Text>
              <Text style={styles.settingDescription}>
                Thông báo khi AQI {'>'} 100
              </Text>
            </View>
            <Switch
              value={geofenceEnabled}
              onValueChange={handleToggleGeofence}
              trackColor={{ false: '#767577', true: '#81C784' }}
              thumbColor={geofenceEnabled ? '#4CAF50' : '#f4f3f4'}
              disabled={!notificationEnabled}
            />
          </View>

          {currentAQI && (
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>AQI hiện tại</Text>
              <Text style={styles.infoValue}>{currentAQI.aqi}</Text>
              <Text style={styles.infoLocation}>{currentAQI.locationName}</Text>
            </View>
          )}
        </View>

        {/* Daily Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thống kê hàng ngày</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Thông báo thống kê</Text>
              <Text style={styles.settingDescription}>
                Nhận thống kê mỗi ngày lúc 8 giờ tối
              </Text>
            </View>
            <Switch
              value={dailyStatsEnabled}
              onValueChange={handleToggleDailyStats}
              trackColor={{ false: '#767577', true: '#81C784' }}
              thumbColor={dailyStatsEnabled ? '#4CAF50' : '#f4f3f4'}
              disabled={!notificationEnabled}
            />
          </View>

          {lastStats && (
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Thống kê gần nhất</Text>
              <Text style={styles.infoValue}>
                {lastStats.cigaretteEquivalent} điếu thuốc
              </Text>
              <Text style={styles.infoSubtext}>
                AQI TB: {lastStats.avgAQI} | {Math.round(lastStats.totalExposureMinutes / 60)}h
              </Text>
            </View>
          )}
        </View>

        {/* Notification Storage Management */}
        {notificationStats && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quản lý Thông báo</Text>
            
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Local (Device)</Text>
                <Text style={styles.statValue}>{notificationStats.local}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Server (Cloud)</Text>
                <Text style={styles.statValue}>{notificationStats.backend.total}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Chưa đọc</Text>
                <Text style={styles.statValue}>{notificationStats.backend.unread}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleSyncNotifications}
              disabled={syncing || !notificationStats.useBackend}
            >
              <Text style={styles.buttonText}>
                {syncing ? '⏳ Đang đồng bộ...' : '☁️ Đồng bộ lên Server'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.warningButton]}
              onPress={handleClearLocalNotifications}
              disabled={notificationStats.local === 0}
            >
              <Text style={styles.buttonText}>🗑️ Xóa thông báo Local</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.dangerButton]}
              onPress={handleClearAllNotifications}
            >
              <Text style={styles.buttonText}>⚠️ Xóa tất cả thông báo</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Test & Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thử nghiệm & Hành động</Text>
          
          <TouchableOpacity
            style={styles.button}
            onPress={handleTestAQINotification}
            disabled={!notificationEnabled}
          >
            <Text style={styles.buttonText}>🔔 Test thông báo AQI</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={handleTestDailyStats}
            disabled={!notificationEnabled}
          >
            <Text style={styles.buttonText}>📊 Test thông báo thống kê</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={handleViewStats}
          >
            <Text style={styles.buttonText}>📈 Xem thống kê hiện tại</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.dangerButton]}
            onPress={handleClearHistory}
          >
            <Text style={styles.buttonText}>🗑️ Xóa lịch sử exposure</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={loadSettings}
          >
            <Text style={styles.buttonText}>🔄 Làm mới</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.debugButton]}
            onPress={handleDebugInfo}
          >
            <Text style={styles.buttonText}>🔍 Debug Info</Text>
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={styles.infoSection}>
          <Text style={styles.infoSectionText}>
            ℹ️ Tính năng geofencing cần quyền truy cập vị trí background.{'\n\n'}
            📊 Cigarette equivalent được tính dựa trên PM2.5 và thời gian tiếp xúc.{'\n\n'}
            ☁️ <Text style={styles.bold}>Đồng bộ thông báo:</Text>{'\n'}
            • Local: Thông báo lưu trên thiết bị (AsyncStorage){'\n'}
            • Server: Thông báo lưu trên cloud (MongoDB){'\n'}
            • Nhấn "Đồng bộ lên Server" để chuyển thông báo local lên cloud{'\n'}
            • Sau khi đồng bộ, thông báo local sẽ tự động xóa{'\n\n'}
            💡 <Text style={styles.bold}>Lưu ý:</Text> Thông báo trên server sẽ đồng bộ giữa các thiết bị.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 20,
    backgroundColor: '#4CAF50',
    color: '#fff',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 10,
    padding: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  settingInfo: {
    flex: 1,
    marginRight: 10,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
  },
  infoBox: {
    backgroundColor: '#E8F5E9',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  infoTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  infoValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  infoLocation: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  infoSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#2196F3',
  },
  warningButton: {
    backgroundColor: '#FF9800',
  },
  dangerButton: {
    backgroundColor: '#F44336',
  },
  debugButton: {
    backgroundColor: '#9E9E9E',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  infoSection: {
    backgroundColor: '#FFF9C4',
    padding: 15,
    margin: 10,
    borderRadius: 8,
  },
  infoSectionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  bold: {
    fontWeight: 'bold',
    color: '#333',
  },
});
