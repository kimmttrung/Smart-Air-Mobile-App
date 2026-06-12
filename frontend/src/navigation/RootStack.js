import AsyncStorage from '@react-native-async-storage/async-storage';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import DetailStationScreen from '../screens/DetailStationScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import IntroScreen from '../screens/auth/IntroScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import RootTabs from './RootTabs';

const Stack = createNativeStackNavigator();

export default function RootStack() {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check if user has valid token on app start
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const authData = await AsyncStorage.getItem('auth');
      if (authData) {
        const auth = JSON.parse(authData);
        // Check if token exists
        if (auth.access_token) {
          setIsLoggedIn(true);
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <Stack.Navigator initialRouteName={isLoggedIn ? 'MainTabs' : 'Intro'}>
      {/* Intro screen - first time users */}
      <Stack.Screen
        name="Intro"
        component={IntroScreen}
        options={{ headerShown: false }}
      />
      {/* Auth screens */}
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ headerShown: false }}
      />
      {/* Màn hình chính chứa Bottom Tabs */}
      <Stack.Screen
        name="MainTabs"
        component={RootTabs}
        options={{ headerShown: false }}
      />

      {/* Màn hình chi tiết trạm */}
      <Stack.Screen
        name="DetailStation"
        component={DetailStationScreen}
        options={{ 
          headerShown: true,
           title: 'Chi tiết trạm ',
          headerStyle: {
            backgroundColor: '#4CAF50',
          },
          headerTintColor: '#f3f3f3ff',
        }}
      />

      {/* Màn hình cài đặt thông báo */}
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ 
          headerShown: true,
          title: 'Cài đặt Thông báo',
          headerStyle: {
            backgroundColor: '#4CAF50',
            elevation: 0,
            shadowOpacity: 0, 
          },
          headerShadowVisible: false,
          headerTintColor: '#f3f3f3ff',
          headerTopInsetEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
}



