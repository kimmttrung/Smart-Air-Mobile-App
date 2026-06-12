import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useState } from 'react';
import authService from '../../services/authService';
import notificationService from '../../services/notificationService';

/**
 * Manage login form state, validation, and submission side-effects.
 * Keeps screen lean; returns handlers and UI state.
 */
export default function useLoginForm({ onSuccess } = {}) {
  const [values, setValues] = useState({ identifier: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setField = useCallback((field, value) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const validate = useCallback(() => {
    if (!values.identifier || !values.password) {
      setError('Vui lòng nhập email/username và mật khẩu');
      return false;
    }
    return true;
  }, [values.identifier, values.password]);

  const submit = useCallback(async () => {
    if (!validate()) return;
    setLoading(true);
    setError('');
    try {
      const result = await authService.login(values.identifier, values.password);
      const authData = {
        access_token: result.token,
        token_type: result.tokenType,
        uid: result.user?._id || null,
        email: result.user?.email || null,
        username: result.user?.username || null,
      };
      await AsyncStorage.setItem('auth', JSON.stringify(authData));
      
      // Set user ID for notification service
      if (authData.uid) {
        notificationService.setUserId(authData.uid);
      }
      
      if (onSuccess) onSuccess(authData);
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [onSuccess, validate, values.identifier, values.password]);

  return {
    values,
    loading,
    error,
    setError,
    setField,
    submit,
  };
}


