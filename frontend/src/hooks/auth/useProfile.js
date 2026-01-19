import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import api from '../../services/api';
import notificationService from '../../services/notificationService';

/**
 * Encapsulate ProfileScreen side-effects and state:
 * - load auth info from AsyncStorage
 * - fetch profile from backend
 * - handle edit form modal and save
 * - handle logout
 */
export default function useProfile(navigation) {
  const [loading, setLoading] = useState(true);
  const [auth, setAuth] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: '',
    gender: '',
    age: '',
    phone: '',
    city: '',
    country: '',
    group: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('auth');
        if (!raw) {
          navigation.navigate('Login');
          return;
        }
        const authData = JSON.parse(raw);
        setAuth(authData);

        if (authData.uid) {
          try {
            const res = await fetch(`${api.AUTH_BASE}/profile/${authData.uid}`);
            if (res.ok) {
              const json = await res.json();
              setProfile(json.profile || null);
              console.log('[useProfile] profile loaded from server', json);
            } else {
              console.warn('[useProfile] profile fetch failed', res.status);
            }
          } catch (e) {
            console.warn('[useProfile] failed to fetch profile:', e.message);
          }
        }
      } catch (e) {
        console.error('[useProfile] Init error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigation]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Xác nhận đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: async () => {
            try {
              // Reset notification service user ID (but keep notifications in storage)
              notificationService.setUserId(null);
              
              // Clear user-scoped keys from AsyncStorage (targeted clear)
              const KEYS_TO_REMOVE = [
                'auth',
                '@expo_push_token'
              ];

              // Attempt multiRemove, fallback to individual removeItem if needed
              try {
                await AsyncStorage.multiRemove(KEYS_TO_REMOVE);
              } catch (innerErr) {
                // multiRemove may fail on some platforms; try individual removes
                console.warn('[useProfile] multiRemove failed, falling back', innerErr);
                for (const k of KEYS_TO_REMOVE) {
                  try {
                    await AsyncStorage.removeItem(k);
                  } catch (e2) {
                    console.warn('[useProfile] removeItem failed for', k, e2);
                  }
                }
              }

              // Clear in-memory state and navigate to Login
              setAuth(null);
              setProfile(null);
              navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
            } catch (e) {
              console.error('[useProfile] logout error', e);
              Alert.alert('Đăng xuất thất bại', String(e));
            }
          },
        },
      ],
      { cancelable: true },
    );
  }, [navigation]);

  const openEditModal = useCallback(() => {
    setEditForm({
      displayName: profile?.displayName || '',
      gender: profile?.gender || '',
      age: profile?.age?.toString() || '',
      phone: profile?.phone || '',
      city: profile?.city || '',
      country: profile?.country || '',
      group: profile?.group || 'normal',
    });
    setShowEditModal(true);
  }, [profile]);

  const closeEditModal = useCallback(() => {
    setShowEditModal(false);
  }, []);

  const handleSaveProfile = useCallback(async () => {
    try {
      setSaving(true);

      if (!editForm.displayName.trim()) {
        Alert.alert('Lỗi', 'Vui lòng nhập họ và tên');
        return;
      }

      const updatedProfile = {
        displayName: editForm.displayName.trim(),
        gender: editForm.gender || null,
        age: editForm.age ? parseInt(editForm.age, 10) : null,
        phone: editForm.phone.trim() || null,
        city: editForm.city.trim() || null,
        country: editForm.country.trim() || null,
        group: editForm.group || null,
      };

      const authStr = await AsyncStorage.getItem('auth');
      const authData = authStr ? JSON.parse(authStr) : null;
      const token = authData?.token || authData?.access_token;

      if (!token || !authData?.uid) {
        Alert.alert('Lỗi', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        navigation.navigate('Login');
        return;
      }

      const res = await fetch(`${api.AUTH_BASE}/profile/${authData.uid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ profile: updatedProfile }),
      });

      if (res.ok) {
        const json = await res.json();
        setProfile(json.profile || updatedProfile);
        setShowEditModal(false);
        Alert.alert('Thành công', 'Cập nhật thông tin thành công!');
      } else {
        const errorText = await res.text();
        console.error('[useProfile] Update profile failed:', errorText);
        Alert.alert('Lỗi', 'Không thể cập nhật thông tin. Vui lòng thử lại.');
      }
    } catch (e) {
      console.error('[useProfile] save profile error:', e);
      Alert.alert('Lỗi', 'Đã có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }, [editForm, navigation]);

  return {
    loading,
    auth,
    profile,
    showEditModal,
    editForm,
    saving,
    setEditForm,
    handleLogout,
    openEditModal,
    closeEditModal,
    handleSaveProfile,
  };
}


