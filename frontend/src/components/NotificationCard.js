import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { scale } from '../constants/responsive';

/**
 * NotificationCard - Component hiển thị một notification với status read/unread
 * @param {Object} notification - { id, title, body, timestamp, read, type, data }
 * @param {Function} onPress - Callback khi tap vào notification
 * @param {Function} onDelete - Callback khi delete notification
 */
export default function NotificationCard({ notification, onPress, onDelete }) {
  const { title: rawTitle, body: rawBody, timestamp, read, type, data } = notification;

  // Derive title/body when not provided (support payload like { type: 'aqi_info', data: { aqi, location } })
  const deriveText = () => {
    if ((rawTitle && rawBody) || !type) return { title: rawTitle, body: rawBody };

    // AQI notifications
    if (type === 'aqi_info' || type === 'aqi-warning' || type === 'aqi_info_v2') {
      const aqi = data?.aqi ?? data?.AQI ?? null;
      const location = data?.location || data?.locationName || '';
      const title = aqi ? `AQI ${aqi}` : 'Cảnh báo chất lượng không khí';
      let body = location || '';
      if (aqi) {
        if (aqi >= 300) body = `${body} · Nguy hiểm! Hạn chế ra ngoài.`.trim();
        else if (aqi >= 200) body = `${body} · Rất không tốt! Đeo khẩu trang.`.trim();
        else if (aqi >= 150) body = `${body} · Không tốt cho sức khỏe.`.trim();
      }
      return { title, body };
    }

    // Daily stats
    if (type === 'daily-stats' || type === 'daily_stats') {
      const days = data?.days ?? data?.period ?? null;
      const avgAQI = data?.avgAQI ?? data?.avg_aqi ?? null;
      const title = 'Thống kê tiếp xúc không khí';
      const body = days && avgAQI ? `Trong ${days} ngày · Trung bình AQI: ${avgAQI}` : rawBody || '';
      return { title, body };
    }

    // Fallback
    return { title: rawTitle, body: rawBody };
  };

  const { title, body } = deriveText();

  // Format timestamp
  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Icon dựa trên type
  const getIcon = () => {
    switch (type) {
      case 'aqi_info':
        return { name: 'alert-circle', color: '#ef4444' };
      case 'aqi-warning':
        return { name: 'alert-triangle', color: '#ef4444' };
      case 'daily-stats':
        return { name: 'activity', color: '#3b82f6' };
      case 'geofence':
        return { name: 'map-pin', color: '#8b5cf6' };
      default:
        return { name: 'bell', color: '#6b7280' };
    }
  };

  const icon = getIcon();

  return (
    <View style={[styles.container, !read && styles.unreadContainer]}>
      <TouchableOpacity
        style={styles.touchable}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          <Feather name={icon.name} size={20} color={icon.color} />
          {!read && <View style={styles.unreadDot} />}
        </View>

        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.title, !read && styles.unreadTitle]} numberOfLines={1}>
              {title || 'Thông báo'}
            </Text>
            <Text style={styles.time}>{formatTime(timestamp)}</Text>
          </View>
          
          <Text style={styles.body} numberOfLines={2}>
            {body || 'Nội dung thông báo'}
          </Text>
        </View>
      </TouchableOpacity>
      
      {/* Delete button */}
      {onDelete && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => onDelete(notification)}
          activeOpacity={0.7}
        >
          <Feather name="trash-2" size={18} color="#ef4444" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  unreadContainer: {
    backgroundColor: '#eff6ff',
  },
  touchable: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: scale(12),
    paddingHorizontal: scale(16),
  },
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
  },
  iconContainer: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#fff',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(4),
  },
  title: {
    flex: 1,
    fontSize: scale(14),
    fontWeight: '600',
    color: '#374151',
    marginRight: scale(8),
  },
  unreadTitle: {
    fontWeight: '700',
    color: '#111827',
  },
  time: {
    fontSize: scale(11),
    color: '#9ca3af',
  },
  body: {
    fontSize: scale(13),
    color: '#6b7280',
    lineHeight: scale(18),
  },
});
