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

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
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
      console.log('[NotificationSettings] Sending test AQI notification');
      
      // Gửi ngay với data có sẵn, không đợi API
      const aqi = currentAQI?.aqi ?? 175;
      const location = currentAQI?.locationName ?? (
        (currentAQI?.latitude && currentAQI?.longitude) 
          ? `${currentAQI.latitude.toFixed(4)}, ${currentAQI.longitude.toFixed(4)}` 
          : 'Vị trí test'
      );
      const pm25 = currentAQI?.pm25 ?? null;

      console.log('[NotificationSettings] Test AQI data:', { aqi, location, pm25 });
      
      // Gửi notification ngay lập tức
      await notificationService.sendAQIWarning(aqi, location, pm25);
      
      // Hiển thị confirmation ngay
      await notificationService.presentNotification(
        '✓ Test hoàn tất', 
        `Đã gửi thông báo AQI ${aqi}`,
        { type: 'test_confirmation' }
      );
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
        // Thêm 1 local confirmation nhỏ
        // setTimeout(() => {
        //   notificationService.sendLocalNotification('✓ Test hoàn tất', 'Đã gửi thông báo thống kê (demo)');
        // }, 1000);
      } else {
        // Confirmation
        setTimeout(() => {
          notificationService.sendLocalNotification('✓ Test hoàn tất', 'Đã gửi thông báo thống kê');
        }, 1000);
      }
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
        </View>

        {/* Info */}
        <View style={styles.infoSection}>
          <Text style={styles.infoSectionText}>
            ℹ️ Tính năng geofencing cần quyền truy cập vị trí background.{'\n\n'}
            📊 Cigarette equivalent được tính dựa trên PM2.5 và thời gian tiếp xúc.
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
  dangerButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
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
});
