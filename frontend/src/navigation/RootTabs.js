import { Feather } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { scale } from '../constants/responsive';
import AnalyticExposureScreen from '../screens/AnalyticExposureScreen';
import ProfileScreen from '../screens/auth/ProfileScreen';
import MapScreen from '../screens/MapScreen';
import NewsScreen from '../screens/NewsScreen';
import NotificationScreen from '../screens/NotificationScreen';
import notificationService from '../services/notificationService';
const Tab = createBottomTabNavigator();

function SimpleTabLabel({ label, focused }) {
  return (
    <View>
      <Text
        style={{
          fontSize: scale(11),
          fontWeight: focused ? '700' : '500',
          color: focused ? '#2563eb' : '#6b7280',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// Component hiển thị icon bell với badge đỏ nếu có thông báo chưa đọc
function NotificationIcon({ focused }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Load unread count khi mount
    const loadUnreadCount = async () => {
      const count = await notificationService.getUnreadCount();
      console.log('[NotificationIcon] Unread count:', count);
      setUnreadCount(count);
    };
    loadUnreadCount();

    // Subscribe to unread count changes
    const unsubscribe = notificationService.onUnreadCountChange((count) => {
      setUnreadCount(count);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <View style={{ position: 'relative' }}>
      <Feather
        name="bell"
        size={20}
        color={focused ? '#2563eb' : '#9ca3af'}
      />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function RootTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: 65,
          paddingBottom: 14,
          paddingTop: 8,
          bottom: 10,
        },
      }}
      initialRouteName="Map"
    >
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          title: 'Dự báo',
          tabBarIcon: ({ focused, color, size }) => (
            <Feather
              name="map"
              size={20}
              color={focused ? '#2563eb' : '#9ca3af'}
            />
          ),
          tabBarLabel: ({ focused }) => (
            <SimpleTabLabel label="Dự báo" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Analytics"
        component={AnalyticExposureScreen}
        options={{
          title: 'Phơi nhiễm',
          tabBarIcon: ({ focused, color, size }) => (
            <Feather
              name="activity"
              size={20}
              color={focused ? '#2563eb' : '#9ca3af'}
            />
          ),
          tabBarLabel: ({ focused }) => (
            <SimpleTabLabel label="Phơi nhiễm" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationScreen}
        options={{
          title: 'Thông báo',
          tabBarIcon: ({ focused }) => <NotificationIcon focused={focused} />,
          tabBarLabel: ({ focused }) => (
            <SimpleTabLabel label="Thông báo" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="News"
        component={NewsScreen}
        options={{
          title: 'Tin tức',
          tabBarIcon: ({ focused, color, size }) => (
            <Feather
              name="book-open"
              size={20}
              color={focused ? '#2563eb' : '#9ca3af'}
            />
          ),
          tabBarLabel: ({ focused }) => (
            <SimpleTabLabel label="Tin tức" focused={focused} />
          ),
        }}
      />
      {/* <Tab.Screen
        name="AIChat"
        component={AIChatScreen}
        options={{
          title: 'AI Chat',
          tabBarIcon: ({ focused, color, size }) => (
            <Feather
              name="message-circle"
              size={20}
              color={focused ? '#2563eb' : '#9ca3af'}
            />
          ),
          tabBarLabel: ({ focused }) => (
            <SimpleTabLabel label="AI Chat" focused={focused} />
          ),
        }}
      /> */}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Cá nhân',
          tabBarIcon: ({ focused, color, size }) => (
            <Feather
              name="user"
              size={20}
              color={focused ? '#2563eb' : '#9ca3af'}
            />
          ),
          tabBarLabel: ({ focused }) => (
            <SimpleTabLabel label="Cá nhân" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#ef4444',
    borderRadius: scale(10),
    minWidth: scale(16),
    height: scale(16),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(4),
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    fontSize: scale(9),
    fontWeight: '700',
    color: '#fff',
  },
});
