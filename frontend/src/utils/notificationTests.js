// Test script for notification system
// Run this in a component or screen to test the notification features

import dailyStatsService from '../services/dailyStatsService';
import geofenceService from '../services/geofenceService';
import notificationService from '../services/notificationService';

/**
 * Test Suite cho Notification System
 */
export const NotificationSystemTests = {
  /**
   * Test 1: Initialize all services
   */
  async testInitialize() {
    console.log('=== Test 1: Initialize Services ===');
    
    try {
      const notifResult = await notificationService.initialize();
      console.log('✓ Notification Service initialized:', notifResult);
      
      const geoResult = await geofenceService.initialize();
      console.log('✓ Geofence Service initialized:', geoResult);
      
      const statsResult = await dailyStatsService.initialize();
      console.log('✓ Daily Stats Service initialized:', statsResult);
      
      return { success: true };
    } catch (error) {
      console.error('✗ Initialize failed:', error);
      return { success: false, error };
    }
  },

  /**
   * Test 2: Send test AQI notification
   */
  async testAQINotification() {
    console.log('=== Test 2: AQI Notification ===');
    
    try {
      await notificationService.sendAQIWarning(175, 'Hà Nội (Test)');
      console.log('✓ AQI notification sent');
      return { success: true };
    } catch (error) {
      console.error('✗ AQI notification failed:', error);
      return { success: false, error };
    }
  },

  /**
   * Test 3: Send test daily stats notification
   */
  async testDailyStatsNotification() {
    console.log('=== Test 3: Daily Stats Notification ===');
    
    try {
      const testStats = {
        days: 3,
        cigaretteEquivalent: 12.5,
        avgAQI: 145,
        totalExposureMinutes: 720,
        avgPM25: 65.2,
      };
      
      await notificationService.sendDailyStats(testStats);
      console.log('✓ Daily stats notification sent');
      return { success: true };
    } catch (error) {
      console.error('✗ Daily stats notification failed:', error);
      return { success: false, error };
    }
  },

  /**
   * Test 4: Start geofence tracking
   */
  async testStartGeofence() {
    console.log('=== Test 4: Start Geofence Tracking ===');
    
    try {
      await geofenceService.startTracking();
      console.log('✓ Geofence tracking started');
      
      // Check status
      const isActive = await geofenceService.isTrackingActive();
      console.log('  Tracking active:', isActive);
      
      return { success: true, isActive };
    } catch (error) {
      console.error('✗ Start geofence failed:', error);
      return { success: false, error };
    }
  },

  /**
   * Test 5: Check current location AQI
   */
  async testCurrentAQI() {
    console.log('=== Test 5: Check Current AQI ===');
    
    try {
      await geofenceService.checkCurrentLocationAQI();
      
      // Wait a bit for the check to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const currentAQI = await geofenceService.getCurrentAQI();
      console.log('✓ Current AQI:', currentAQI);
      
      return { success: true, data: currentAQI };
    } catch (error) {
      console.error('✗ Check AQI failed:', error);
      return { success: false, error };
    }
  },

  /**
   * Test 6: Calculate current stats
   */
  async testCalculateStats() {
    console.log('=== Test 6: Calculate Current Stats ===');
    
    try {
      const stats = await dailyStatsService.calculateCurrentStats(3);
      console.log('✓ Stats calculated:', stats);
      
      return { success: true, data: stats };
    } catch (error) {
      console.error('✗ Calculate stats failed:', error);
      return { success: false, error };
    }
  },

  /**
   * Test 7: Get exposure history
   */
  async testExposureHistory() {
    console.log('=== Test 7: Get Exposure History ===');
    
    try {
      const history = await geofenceService.getExposureHistory(3);
      console.log('✓ Exposure history retrieved:', history.length, 'records');
      
      if (history.length > 0) {
        console.log('  First record:', history[0]);
        console.log('  Last record:', history[history.length - 1]);
      }
      
      return { success: true, count: history.length, data: history };
    } catch (error) {
      console.error('✗ Get exposure history failed:', error);
      return { success: false, error };
    }
  },

  /**
   * Test 8: Get daily breakdown
   */
  async testDailyBreakdown() {
    console.log('=== Test 8: Get Daily Breakdown ===');
    
    try {
      const breakdown = await dailyStatsService.getDailyBreakdown(7);
      console.log('✓ Daily breakdown:', breakdown.length, 'days');
      
      breakdown.forEach(day => {
        console.log(`  ${day.date}: ${day.cigaretteEquivalent} cigarettes, AQI ${day.avgAQI}`);
      });
      
      return { success: true, data: breakdown };
    } catch (error) {
      console.error('✗ Get daily breakdown failed:', error);
      return { success: false, error };
    }
  },

  /**
   * Test 9: Schedule daily notification
   */
  async testScheduleDaily() {
    console.log('=== Test 9: Schedule Daily Notification ===');
    
    try {
      const id = await notificationService.scheduleDailyStatsNotification(20, 0);
      console.log('✓ Daily notification scheduled:', id);
      
      return { success: true, id };
    } catch (error) {
      console.error('✗ Schedule daily notification failed:', error);
      return { success: false, error };
    }
  },

  /**
   * Test 10: Get notification history
   */
  async testNotificationHistory() {
    console.log('=== Test 10: Get Notification History ===');
    
    try {
      const history = await notificationService.getNotificationHistory();
      console.log('✓ Notification history:', history.length, 'notifications');
      
      const aqiNotifs = history.filter(n => n.type === 'aqi_warning');
      const statsNotifs = history.filter(n => n.type === 'daily_stats');
      
      console.log(`  AQI warnings: ${aqiNotifs.length}`);
      console.log(`  Daily stats: ${statsNotifs.length}`);
      
      return { success: true, total: history.length, aqiCount: aqiNotifs.length, statsCount: statsNotifs.length };
    } catch (error) {
      console.error('✗ Get notification history failed:', error);
      return { success: false, error };
    }
  },

  /**
   * Test 11: Stop geofence tracking
   */
  async testStopGeofence() {
    console.log('=== Test 11: Stop Geofence Tracking ===');
    
    try {
      await geofenceService.stopTracking();
      console.log('✓ Geofence tracking stopped');
      
      const isActive = await geofenceService.isTrackingActive();
      console.log('  Tracking active:', isActive);
      
      return { success: true, isActive };
    } catch (error) {
      console.error('✗ Stop geofence failed:', error);
      return { success: false, error };
    }
  },

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('╔═══════════════════════════════════╗');
    console.log('║  Notification System Test Suite  ║');
    console.log('╚═══════════════════════════════════╝\n');
    
    const results = {};
    
    // Test 1: Initialize
    results.initialize = await this.testInitialize();
    await this.delay(1000);
    
    // Test 2: AQI Notification
    results.aqiNotification = await this.testAQINotification();
    await this.delay(1000);
    
    // Test 3: Daily Stats Notification
    results.dailyStatsNotification = await this.testDailyStatsNotification();
    await this.delay(1000);
    
    // Test 4: Start Geofence
    results.startGeofence = await this.testStartGeofence();
    await this.delay(2000);
    
    // Test 5: Check Current AQI
    results.currentAQI = await this.testCurrentAQI();
    await this.delay(2000);
    
    // Test 6: Calculate Stats
    results.calculateStats = await this.testCalculateStats();
    await this.delay(1000);
    
    // Test 7: Exposure History
    results.exposureHistory = await this.testExposureHistory();
    await this.delay(1000);
    
    // Test 8: Daily Breakdown
    results.dailyBreakdown = await this.testDailyBreakdown();
    await this.delay(1000);
    
    // Test 9: Schedule Daily
    results.scheduleDaily = await this.testScheduleDaily();
    await this.delay(1000);
    
    // Test 10: Notification History
    results.notificationHistory = await this.testNotificationHistory();
    await this.delay(1000);
    
    // Test 11: Stop Geofence
    results.stopGeofence = await this.testStopGeofence();
    
    // Summary
    console.log('\n╔═══════════════════════════════════╗');
    console.log('║         Test Summary              ║');
    console.log('╚═══════════════════════════════════╝');
    
    const passed = Object.values(results).filter(r => r.success).length;
    const total = Object.keys(results).length;
    
    console.log(`✓ Passed: ${passed}/${total}`);
    console.log(`✗ Failed: ${total - passed}/${total}`);
    
    Object.entries(results).forEach(([name, result]) => {
      const status = result.success ? '✓' : '✗';
      console.log(`  ${status} ${name}`);
    });
    
    return results;
  },

  /**
   * Helper: Delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
};

// Export individual test functions
export const {
  testInitialize,
  testAQINotification,
  testDailyStatsNotification,
  testStartGeofence,
  testCurrentAQI,
  testCalculateStats,
  testExposureHistory,
  testDailyBreakdown,
  testScheduleDaily,
  testNotificationHistory,
  testStopGeofence,
  runAllTests,
} = NotificationSystemTests;

export default NotificationSystemTests;
