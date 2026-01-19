import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import RootStack from './src/navigation/RootStack';
import dailyStatsService from './src/services/dailyStatsService';
import geofenceService from './src/services/geofenceService';
import notificationService from './src/services/notificationService';

export default function App() {
  useEffect(() => {
    // Initialize notification services
    const initServices = async () => {
      try {
        console.log('[App] Initializing notification services...');
        
        // Check if user is logged in and set userId for notifications
        try {
          const authStr = await AsyncStorage.getItem('auth');
          if (authStr) {
            const auth = JSON.parse(authStr);
            if (auth.uid) {
              notificationService.setUserId(auth.uid);
              console.log('[App] User ID set for notifications:', auth.uid);
            }
          }
        } catch (err) {
          console.warn('[App] Failed to load auth data:', err.message);
        }
        
        // Initialize notification service
        await notificationService.initialize();
        
        // Initialize geofence service
        await geofenceService.initialize();
        
        // Initialize daily stats service
        await dailyStatsService.initialize();
        
        console.log('[App] All services initialized successfully');
        
        // Setup notification listeners
        notificationService.setupNotificationListeners(
          // On notification received
          (notification) => {
            console.log('[App] Notification received:', notification);
          },
          // On notification tapped
          (response) => {
            console.log('[App] Notification tapped:', response);
            // TODO: Navigate to appropriate screen based on notification type
            const notificationType = response.notification.request.content.data?.type;
            if (notificationType === 'aqi_warning') {
              // Navigate to map or AQI detail screen
            } else if (notificationType === 'daily_stats') {
              // Navigate to analytics screen
            }
          }
        );
      } catch (error) {
        console.error('[App] Error initializing services:', error);
      }
    };

    initServices();

    // Cleanup
    return () => {
      notificationService.removeNotificationListeners();
    };
  }, []);

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <RootStack />
    </NavigationContainer>
  );
}
