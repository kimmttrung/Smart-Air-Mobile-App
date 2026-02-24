import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { scaleFont } from '../../constants/responsive';
import HistoryItemCard from './HistoryItemCard';

export default function HistoryTab({
  loading,
  historyLoaded,
  historyData,
  filteredHistoryData,
  dateFilter,
  setDateFilter,
  dayStats,
  onReload,
}) {
  if (loading || !historyLoaded) {
    // console.log('HistoryTab: loading history data...', { loading, historyLoaded });
    return (
      <View style={styles.loadingTabContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingTabText}>Đang tải lịch sử vị trí...</Text>
      </View>
    );
  }

  return (
    <View style={styles.historyContainer}>
      <View style={styles.historyHeader}>
        <View style={styles.historyHeaderIcon}>
          <Feather name="map-pin" size={scaleFont(18)} color="#1d4ed8" />
        </View>
        <View style={styles.historyHeaderText}>
          <Text style={styles.historyTitle}>Lịch sử vị trí đã lưu</Text>
          <Text style={styles.historySubtitle}>
            {filteredHistoryData.length} vị trí
            {dateFilter === 'today' && ' • Hôm nay'}
            {dateFilter === 'last3days' && ' • 3 ngày qua'}
            {dateFilter === 'last7days' && ' • 7 ngày qua'}
            {dateFilter === 'all' && ` • Tất cả (${historyData.length} tổng)`}
            {dateFilter && dateFilter.match(/^\d{4}-\d{2}-\d{2}$/) && (() => {
              const [year, month, day] = dateFilter.split('-');
              return ` • Ngày ${day}/${month}/${year}`;
            })()}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.reloadButton}
          onPress={onReload}
          activeOpacity={0.7}
        >
          <Feather name="refresh-cw" size={scaleFont(18)} color="#1d4ed8" />
        </TouchableOpacity>
      </View>

      {/* Day-specific stats (when user tapped a past bar) */}
      {dayStats && <DayStatsCard dayStats={dayStats} />}

      {/* Date Filter */}
      <HistoryDateFilter dateFilter={dateFilter} onFilterChange={setDateFilter} />

      {filteredHistoryData.length === 0 ? (
        <View style={styles.emptyHistory}>
          <Feather name="map" size={scaleFont(48)} color="#cbd5e1" />
          <Text style={styles.emptyHistoryText}>
            {historyData.length === 0 ? 'Chưa có lịch sử vị trí' : 'Không có dữ liệu'}
          </Text>
          <Text style={styles.emptyHistorySubtext}>
            {historyData.length === 0 
              ? 'Nhấn nút GPS trên bản đồ để lưu vị trí hiện tại'
              : 'Thử chọn bộ lọc khác'}
          </Text>
        </View>
      ) : (
        filteredHistoryData.map((item, index) => (
          <HistoryItemCard key={`${item.timestamp}-${index}`} item={item} />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingTabContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  loadingTabText: {
    marginTop: 16,
    fontSize: scaleFont(14),
    color: '#64748b',
    fontWeight: '500',
  },
  historyContainer: {
    flex: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
    gap: 12,
  },
  historyHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyHeaderText: {
    flex: 1,
  },
  historyTitle: {
    fontSize: scaleFont(16),
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  historySubtitle: {
    fontSize: scaleFont(12),
    color: '#64748b',
  },
  reloadButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHistory: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 48,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyHistoryText: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: '#64748b',
    marginTop: 16,
  },
  emptyHistorySubtext: {
    fontSize: scaleFont(13),
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
  },
});

// DayStatsCard component - gộp vào HistoryTab
function DayStatsCard({ dayStats }) {
  if (!dayStats) return null;

  return (
    <View style={dayStatsCardStyles.dayStatsCard}>
      <View style={{ flexDirection: 'row', marginTop: scaleFont(8) }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#64748b', fontSize: scaleFont(12) }}>AQI VN Trung bình</Text>
          <Text style={{ fontSize: scaleFont(18), fontWeight: '700' }}>{dayStats.avg_aqi ?? '--'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#64748b', fontSize: scaleFont(12) }}>PM2.5 Trung bình</Text>
          <Text style={{ fontSize: scaleFont(18), fontWeight: '700' }}>
            {dayStats.avg_pm25 != null ? `${Number(dayStats.avg_pm25).toFixed(1)} µg/m³` : '--'}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', marginTop: scaleFont(10) }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#64748b', fontSize: scaleFont(12) }}>AQI VN Max</Text>
          <Text style={{ fontSize: scaleFont(14), fontWeight: '600' }}>{dayStats.max_aqi ?? '--'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#64748b', fontSize: scaleFont(12) }}>PM2.5 Max</Text>
          <Text style={{ fontSize: scaleFont(14), fontWeight: '600' }}>
            {dayStats?.max_pm25 != null
              ? `${Number(dayStats.max_pm25).toFixed(1)} µg/m³`
              : '--'}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', marginTop: scaleFont(8) }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#64748b', fontSize: scaleFont(12) }}>AQI VN Min</Text>
          <Text style={{ fontSize: scaleFont(14), fontWeight: '600' }}>{dayStats.min_aqi ?? '--'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#64748b', fontSize: scaleFont(12) }}>PM2.5 Min</Text>
          <Text style={{ fontSize: scaleFont(14), fontWeight: '600' }}>
            {dayStats?.min_pm25 != null
              ? `${Number(dayStats.min_pm25).toFixed(1)} µg/m³`
              : '--'}
          </Text>
        </View>
      </View>

      {/* Most visited locations with counts */}
      {dayStats.most_visited_location && Object.keys(dayStats.most_visited_location).length > 0 && (
        <View style={{ marginTop: scaleFont(10) }}>
          <Text style={{ fontWeight: '700', color: '#0f172a', marginBottom: scaleFont(6) }}>Địa điểm thường đến</Text>
          {Object.entries(dayStats.most_visited_location).map(([addr, count]) => (
            <View
              key={addr}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginVertical: scaleFont(2),
              }}
            >
              <Text
                style={{ color: '#334155', fontSize: scaleFont(13), flex: 1, marginRight: scaleFont(8) }}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {addr}
              </Text>
              <Text style={{ color: '#64748b', fontSize: scaleFont(13), flexShrink: 0, minWidth: 48, textAlign: 'right' }}>
                {count} lần
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const dayStatsCardStyles = StyleSheet.create({
  dayStatsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
});

// HistoryDateFilter component - gộp vào HistoryTab
function HistoryDateFilter({ dateFilter, onFilterChange }) {
  return (
    <View style={dateFilterStyles.filterContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <TouchableOpacity
          style={[dateFilterStyles.filterButton, dateFilter === 'all' && dateFilterStyles.filterButtonActive]}
          onPress={() => onFilterChange('all')}
          activeOpacity={0.7}
        >
          <Text style={[dateFilterStyles.filterButtonText, dateFilter === 'all' && dateFilterStyles.filterButtonTextActive]}>
            Tất cả
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[dateFilterStyles.filterButton, dateFilter === 'today' && dateFilterStyles.filterButtonActive]}
          onPress={() => onFilterChange('today')}
          activeOpacity={0.7}
        >
          <Feather 
            name="sun" 
            size={14} 
            color={dateFilter === 'today' ? '#1d4ed8' : '#64748b'} 
          />
          <Text style={[dateFilterStyles.filterButtonText, dateFilter === 'today' && dateFilterStyles.filterButtonTextActive]}>
            Hôm nay
          </Text>
        </TouchableOpacity>
        
        {/* Specific date buttons for last 7 days */}
        {Array.from({ length: 7 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (i + 1));
          const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          const displayDate = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
          const isActive = dateFilter === dateKey;
          
          return (
            <TouchableOpacity
              key={dateKey}
              style={[dateFilterStyles.filterButton, isActive && dateFilterStyles.filterButtonActive]}
              onPress={() => onFilterChange(dateKey)}
              activeOpacity={0.7}
            >
              <Text style={[dateFilterStyles.filterButtonText, isActive && dateFilterStyles.filterButtonTextActive]}>
                {displayDate}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const dateFilterStyles = StyleSheet.create({
  filterContainer: {
    marginBottom: 16,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  filterButtonActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#93c5fd',
  },
  filterButtonText: {
    fontSize: scaleFont(13),
    fontWeight: '600',
    color: '#64748b',
  },
  filterButtonTextActive: {
    color: '#1d4ed8',
  },
});

