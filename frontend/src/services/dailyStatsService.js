// DailyStatsService - Tính toán cigarette equivalent và gửi thống kê hàng ngày
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import api from './api';
import geofenceService from './geofenceService';
import notificationService from './notificationService';

const DAILY_STATS_TASK = 'smartair-daily-stats-task';
const STATS_NOTIFICATION_TIME = { hour: 20, minute: 0 }; // 8 giờ tối

// AQI to Cigarette Conversion
// Nghiên cứu: 1 điếu thuốc ≈ tăng PM2.5 22 μg/m³ trong 1 giờ
// Công thức tham khảo: cigarettes = (PM2.5 * hours) / 22
// AQI to PM2.5 (xấp xỉ): PM2.5 ≈ AQI * 0.5 (for AQI < 200)

/**
 * Chuyển đổi AQI sang PM2.5 (μg/m³)
 */
function aqiToPM25(aqi) {
  // Công thức chính xác hơn theo US EPA
  if (aqi <= 50) {
    return aqi * 12 / 50;
  } else if (aqi <= 100) {
    return 12 + (aqi - 50) * 23.4 / 50;
  } else if (aqi <= 150) {
    return 35.4 + (aqi - 100) * 19.1 / 50;
  } else if (aqi <= 200) {
    return 55.4 + (aqi - 150) * 44.6 / 50;
  } else if (aqi <= 300) {
    return 150.4 + (aqi - 200) * 99.6 / 100;
  } else {
    return 250 + (aqi - 300) * 150 / 100;
  }
}

/**
 * Tính cigarette equivalent từ exposure data
 */
function calculateCigaretteEquivalent(exposureHistory) {
  if (!exposureHistory || exposureHistory.length === 0) {
    return {
      cigaretteEquivalent: 0,
      avgAQI: 0,
      totalExposureMinutes: 0,
      avgPM25: 0,
    };
  }

  // Giả sử mỗi data point là 5 phút exposure
  const minutesPerPoint = 5;
  const totalPoints = exposureHistory.length;
  const totalMinutes = totalPoints * minutesPerPoint;
  const totalHours = totalMinutes / 60;

  // Tính average AQI
  const totalAQI = exposureHistory.reduce((sum, item) => sum + item.aqi, 0);
  const avgAQI = Math.round(totalAQI / totalPoints);

  // Chuyển sang PM2.5
  const avgPM25 = aqiToPM25(avgAQI);

  // Tính cigarette equivalent
  // 1 cigarette = 22 μg/m³ PM2.5 for 1 hour
  const cigaretteEquivalent = (avgPM25 * totalHours) / 22;

  return {
    cigaretteEquivalent: Math.round(cigaretteEquivalent * 10) / 10, // 1 chữ số thập phân
    avgAQI: Math.round(avgAQI),
    totalExposureMinutes: Math.round(totalMinutes),
    avgPM25: Math.round(avgPM25 * 10) / 10,
    dataPoints: totalPoints,
  };
}

// Define background task
TaskManager.defineTask(DAILY_STATS_TASK, async () => {
  try {
    console.log('[DailyStatsService] Running daily stats task');
    
    // Lấy exposure history 3 ngày gần nhất
    const exposureHistory = await geofenceService.getExposureHistory(3);
    
    if (exposureHistory.length === 0) {
      console.log('[DailyStatsService] No exposure data');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Tính toán stats
    const stats = calculateCigaretteEquivalent(exposureHistory);
    
    // Gửi notification nếu có dữ liệu đáng kể
    if (stats.cigaretteEquivalent > 0.5) {
      await notificationService.sendDailyStats({
        days: 3,
        ...stats,
      });
      
      // Lưu stats
      await AsyncStorage.setItem('@last_daily_stats', JSON.stringify({
        ...stats,
        timestamp: new Date().toISOString(),
      }));
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('[DailyStatsService] Task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

class DailyStatsServiceClass {
  constructor() {
    this.isScheduled = false;
  }

  /**
   * Khởi tạo và đăng ký background fetch task
   */
  async initialize() {
    try {
      // Kiểm tra xem task đã được đăng ký chưa
      const isTaskDefined = await TaskManager.isTaskDefined(DAILY_STATS_TASK);
      console.log('[DailyStatsService] Task defined:', isTaskDefined);

      // Đăng ký background fetch
      await this.scheduleBackgroundFetch();
      
      // Schedule notification hàng ngày
      await notificationService.scheduleDailyStatsNotification(
        STATS_NOTIFICATION_TIME.hour,
        STATS_NOTIFICATION_TIME.minute
      );

      console.log('[DailyStatsService] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[DailyStatsService] Initialize error:', error);
      return false;
    }
  }

  /**
   * Đăng ký background fetch task
   */
  async scheduleBackgroundFetch() {
    try {
      const status = await BackgroundFetch.getStatusAsync();
      
      if (status === BackgroundFetch.BackgroundFetchStatus.Available) {
        await BackgroundFetch.registerTaskAsync(DAILY_STATS_TASK, {
          minimumInterval: 24 * 60 * 60, // 24 giờ
          stopOnTerminate: false,
          startOnBoot: true,
        });

        this.isScheduled = true;
        console.log('[DailyStatsService] Background fetch scheduled');
      } else {
        console.warn('[DailyStatsService] Background fetch not available:', status);
      }
    } catch (error) {
      console.error('[DailyStatsService] Schedule background fetch error:', error);
    }
  }

  /**
   * Hủy background fetch
   */
  async unscheduleBackgroundFetch() {
    try {
      await BackgroundFetch.unregisterTaskAsync(DAILY_STATS_TASK);
      this.isScheduled = false;
      console.log('[DailyStatsService] Background fetch unscheduled');
    } catch (error) {
      console.error('[DailyStatsService] Unschedule error:', error);
    }
  }

  /**
   * Lấy stats từ API (dữ liệu thực từ database)
   */
  async calculateStatsFromAPI(days = 3) {
    try {
      const stats = await api.getLocationStats(days);
      
      if (!stats || stats.total_records === 0) {
        return null;
      }

      // Chuyển đổi response từ API sang format notification
      const avgPM25 = stats.avg_pm25 || aqiToPM25(stats.avg_aqi);
      const totalHours = stats.length; // Giả sử mỗi record = 5 phút
      const cigaretteEquivalent = (avgPM25)* totalHours / 22;

      return {
        cigaretteEquivalent: Math.round(cigaretteEquivalent * 10) / 10,
        avgAQI: Math.round(stats.avg_aqi),
        avgPM25: Math.round(avgPM25 * 10) / 10,
        totalExposureMinutes: stats.total_records * 5,
        dataPoints: stats.total_records,
        maxAQI: stats.max_aqi,
        minAQI: stats.min_aqi,
        source: 'api',
      };
    } catch (error) {
      console.error('[DailyStatsService] Calculate stats from API error:', error);
      return null;
    }
  }

  /**
   * Tính toán stats ngay lập tức (manual trigger)
   * Ưu tiên dữ liệu từ API, fallback sang local storage
   */
  async calculateCurrentStats(days = 3) {
    try {
      // Thử lấy từ API trước
      const apiStats = await this.calculateStatsFromAPI(days);
      if (apiStats) {
        console.log('[DailyStatsService] Using stats from API', apiStats);
        return {
          ...apiStats,
          days,
        };
      }

      // Fallback: lấy từ local storage
      console.log('[DailyStatsService] API has no data, using local storage');
      const exposureHistory = await geofenceService.getExposureHistory(days);
      
      if (exposureHistory.length === 0) {
        return {
          cigaretteEquivalent: 0,
          avgAQI: 0,
          totalExposureMinutes: 0,
          message: 'Chưa có dữ liệu tiếp xúc',
        };
      }

      const stats = calculateCigaretteEquivalent(exposureHistory);
      
      return {
        ...stats,
        days,
        startDate: exposureHistory[0]?.timestamp,
        endDate: exposureHistory[exposureHistory.length - 1]?.timestamp,
        source: 'local',
      };
    } catch (error) {
      console.error('[DailyStatsService] Calculate stats error:', error);
      return null;
    }
  }

  /**
   * Gửi test notification với stats hiện tại từ API hoặc local
   */
  async sendTestNotification() {
    try {
      // Ưu tiên lấy từ API
      let stats = await this.calculateStatsFromAPI(3);
      let source = 'API (database)';
      
      // Nếu API không có dữ liệu, lấy từ local storage
      if (!stats || stats.cigaretteEquivalent === 0) {
        stats = await this.calculateCurrentStats(3);
        source = stats?.source === 'local' ? 'Local storage' : 'Mixed';
      }
      
      if (stats && stats.cigaretteEquivalent > 0) {
        await notificationService.sendDailyStats({
          days: 3,
          ...stats,
        });
        console.log(`[DailyStatsService] Test notification sent (${source})`);
        return true;
      } else {
        console.log('[DailyStatsService] No data for test notification');
        return false;
      }
    } catch (error) {
      console.error('[DailyStatsService] Send test notification error:', error);
      return false;
    }
  }

  /**
   * Lấy stats đã lưu gần nhất
   */
  async getLastStats() {
    try {
      const statsStr = await AsyncStorage.getItem('@last_daily_stats');
      return statsStr ? JSON.parse(statsStr) : null;
    } catch (error) {
      console.error('[DailyStatsService] Get last stats error:', error);
      return null;
    }
  }

  /**
   * Tính cigarette equivalent cho một khoảng thời gian cụ thể
   */
  async calculateStatsForPeriod(startDate, endDate) {
    try {
      const historyStr = await AsyncStorage.getItem('@exposure_history');
      if (!historyStr) return null;

      const history = JSON.parse(historyStr);
      
      const startTime = new Date(startDate).getTime();
      const endTime = new Date(endDate).getTime();
      
      const periodHistory = history.filter(item => {
        const timestamp = new Date(item.timestamp).getTime();
        return timestamp >= startTime && timestamp <= endTime;
      });

      if (periodHistory.length === 0) return null;

      const stats = calculateCigaretteEquivalent(periodHistory);
      
      const days = Math.ceil((endTime - startTime) / (24 * 60 * 60 * 1000));
      
      return {
        ...stats,
        days,
        startDate,
        endDate,
      };
    } catch (error) {
      console.error('[DailyStatsService] Calculate period stats error:', error);
      return null;
    }
  }

  /**
   * Lấy stats breakdown theo ngày
   */
  async getDailyBreakdown(days = 7) {
    try {
      const exposureHistory = await geofenceService.getExposureHistory(days);
      
      if (exposureHistory.length === 0) return [];

      // Group by date
      const dailyData = {};
      
      exposureHistory.forEach(item => {
        const date = new Date(item.timestamp).toISOString().split('T')[0];
        
        if (!dailyData[date]) {
          dailyData[date] = [];
        }
        
        dailyData[date].push(item);
      });

      // Calculate stats for each day
      const breakdown = Object.keys(dailyData).map(date => {
        const dayHistory = dailyData[date];
        const stats = calculateCigaretteEquivalent(dayHistory);
        
        return {
          date,
          ...stats,
        };
      }).sort((a, b) => new Date(a.date) - new Date(b.date));

      return breakdown;
    } catch (error) {
      console.error('[DailyStatsService] Get daily breakdown error:', error);
      return [];
    }
  }

  /**
   * Kiểm tra xem background fetch có đang active không
   */
  async isBackgroundFetchActive() {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(DAILY_STATS_TASK);
      return isRegistered;
    } catch (error) {
      console.error('[DailyStatsService] Check status error:', error);
      return false;
    }
  }
}

// Export singleton instance
const DailyStatsService = new DailyStatsServiceClass();
export default DailyStatsService;

// Export utility functions
export {
  aqiToPM25,
  calculateCigaretteEquivalent
};

