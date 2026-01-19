import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import NotificationCard from '../components/NotificationCard';
import { scale } from '../constants/responsive';
import notificationService from '../services/notificationService';

/**
 * NotificationScreen - Màn hình hiển thị danh sách notifications
 * - Hiển thị 20 notifications mới nhất
 * - Đánh dấu đã đọc khi user tap vào notification
 * - Pull to refresh
 */
export default function NotificationScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    try {
      // Lấy 20 notifications mới nhất
      const history = await notificationService.getNotificationHistory(20);
      // Sort by timestamp desc (newest first). Fallback to 0 for missing/invalid timestamps.
      history.sort((a, b) => {
        const ta = a?.timestamp ? Date.parse(a.timestamp) : 0;
        const tb = b?.timestamp ? Date.parse(b.timestamp) : 0;
        return tb - ta;
      });
      setNotifications(history);
      
      // Đếm số lượng chưa đọc
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('[NotificationScreen] Load error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Refresh khi focus màn hình
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadNotifications();
    });
    return unsubscribe;
  }, [navigation, loadNotifications]);

  // Handle refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, [loadNotifications]);

  // Handle tap notification -> mark as read
  const handleNotificationPress = useCallback(async (notification) => {
    if (!notification.read) {
      await notificationService.markNotificationAsRead(notification.id);
      // Reload để update UI
      loadNotifications();
    }
  }, [loadNotifications]);

  // Mark all as read
  const handleMarkAllRead = useCallback(async () => {
    await notificationService.markAllNotificationsAsRead();
    loadNotifications();
  }, [loadNotifications]);

  // Render header
  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.headerTitle}>Thông báo</Text>
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>
      
      {unreadCount > 0 && (
        <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllButton}>
          <Feather name="check-circle" size={18} color="#3b82f6" />
          <Text style={styles.markAllText}>Đọc tất cả</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Render empty state
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Feather name="bell-off" size={64} color="#d1d5db" />
      <Text style={styles.emptyTitle}>Chưa có thông báo</Text>
      <Text style={styles.emptyText}>
        Bạn sẽ nhận được thông báo về chất lượng không khí tại đây
      </Text>
    </View>
  );

  // Render item
  const renderItem = ({ item }) => (
    <NotificationCard
      notification={item}
      onPress={() => handleNotificationPress(item)}
    />
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      
      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={(item, index) => {
          // Some older notifications may lack `id`. Fallback to timestamp+index to ensure uniqueness.
          if (item?.id) return String(item.id);
          const ts = item?.timestamp ? String(item.timestamp) : String(index);
          return `${ts}-${index}`;
        }}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={notifications.length === 0 && styles.emptyList}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    // paddingVertical: scale(25),
    paddingTop: scale(40),
    paddingBottom: scale(12),
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: scale(20),
    fontWeight: '700',
    color: '#111827',
  },
  unreadBadge: {
    marginLeft: scale(8),
    backgroundColor: '#ef4444',
    paddingHorizontal: scale(8),
    paddingVertical: scale(2),
    borderRadius: scale(12),
    minWidth: scale(24),
    alignItems: 'center',
  },
  unreadBadgeText: {
    fontSize: scale(12),
    fontWeight: '700',
    color: '#fff',
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: scale(6),
    backgroundColor: '#eff6ff',
  },
  markAllText: {
    fontSize: scale(13),
    fontWeight: '600',
    color: '#3b82f6',
    marginLeft: scale(6),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(32),
  },
  emptyTitle: {
    fontSize: scale(18),
    fontWeight: '700',
    color: '#374151',
    marginTop: scale(16),
    marginBottom: scale(8),
  },
  emptyText: {
    fontSize: scale(14),
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: scale(20),
  },
});
