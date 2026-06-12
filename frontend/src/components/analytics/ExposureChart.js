import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { scaleFont } from '../../constants/responsive';
import { getAQIColor } from '../../utils';

export default function ExposureChart({
  analyticsData,
  selectedIdx,
  setSelectedIdx,
  exposureMultiplier,
  onRefresh,
  topLocationsByDay,
  setDateFilter,
}) {
  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <View style={styles.chartHeaderLeft}>
          <View style={styles.chartAccent} />
          <Text style={styles.chartTitle}>Diễn biến theo ngày</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={{ padding: 6, alignSelf: 'center' }} activeOpacity={0.7}>
          <Feather name="refresh-cw" size={scaleFont(18)} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {/* Chart container with Y-axis */}
      <View style={styles.chartContainer}>
        {/* Y-axis labels */}
        <View style={styles.yAxisContainer}>
          <Text style={styles.yAxisLabel}>300</Text>
          <Text style={styles.yAxisLabel}>250</Text>
          <Text style={styles.yAxisLabel}>200</Text>
          <Text style={styles.yAxisLabel}>150</Text>
          <Text style={styles.yAxisLabel}>100</Text>
          <Text style={styles.yAxisLabel}>50</Text>
          <Text style={styles.yAxisLabel}>0</Text>
        </View>

        {/* Bars container */}
        <View style={styles.barsContainer}>
          {/* Grid lines */}
          <View style={styles.gridLinesContainer}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={styles.gridLine} />
            ))}
          </View>

          <View style={styles.barRow}>
            {analyticsData.map((item, idx) => {
              if (!item) return null;
              const adjustedAqi = item.aqi * exposureMultiplier;
              const heightRatio = Math.min(adjustedAqi, 300) / 300; // Max AQI 300
              const barHeight = 115 * heightRatio + 5; // 115 là chiều cao khả dụng (145 - 30 paddingBottom)
              const isSelected = idx === selectedIdx;
              const isToday = item.type === 'present';
              // Hiển thị label mỗi 3 ngày (index 0, 3, 6, 9, 12) hoặc ngày hôm nay
              const shouldShowLabel = idx % 3 === 0 || isToday;
              const dateLabel = isToday ? '' : item.date;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={styles.barWrapper}
                  onPress={() => {
                    setSelectedIdx(idx);
                    // Tự động load dayStats khi chọn ngày quá khứ
                    if (item.type === 'past' && item.date && topLocationsByDay && setDateFilter) {
                      // item.date format: 'dd/mm' hoặc 'dd-mm' (ví dụ: '07-12' hoặc '07/12')
                      // item.key format: số âm cho past days (ví dụ: '-1', '-2', '-7')
                      // topLocationsByDay keys format: 'yyyy-mm-dd' (ví dụ: '2025-12-07')
                      // Convert item.date + item.key thành dateKey
                      const [selDay, selMonth] = item.date.split(/[-\/]/).map(s => s.padStart(2, '0'));
                      const today = new Date();
                      const daysAgo = Math.abs(parseInt(item.key) || 0);
                      const targetDate = new Date(today);
                      targetDate.setDate(today.getDate() - daysAgo);
                      const dateKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
                      
                      // Verify dateKey exists in topLocationsByDay
                      if (topLocationsByDay[dateKey]) {
                        console.log('[ExposureChart] Setting dateFilter to:', dateKey, 'for item.date:', item.date, 'item.key:', item.key);
                        setDateFilter(dateKey);
                      } else {
                        // Fallback: tìm dateKey bằng cách so sánh day và month
                        const foundKey = Object.keys(topLocationsByDay).find(key => {
                          const [year, month, day] = key.split('-');
                          return day === selDay && month === selMonth;
                        });
                        if (foundKey) {
                          console.log('[ExposureChart] Setting dateFilter to (fallback):', foundKey, 'for item.date:', item.date);
                          setDateFilter(foundKey);
                        } else {
                          console.warn('[ExposureChart] Could not find dateKey for item.date:', item.date, 'item.key:', item.key, 'available keys:', Object.keys(topLocationsByDay));
                        }
                      }
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeight,
                        backgroundColor: getAQIColor(adjustedAqi),
                        opacity: isSelected ? 1 : 0.4,
                        transform: [{ scale: isSelected ? 1.15 : 1 }],
                        borderWidth: isToday ? 2 : 1,
                        borderColor: isToday ? '#2563eb' : '#ffffffff',
                        shadowColor: isToday ? '#2563eb' : isSelected ? getAQIColor(adjustedAqi) : '#ffffffff',
                        shadowOpacity: isToday ? 0.4 : isSelected ? 0.3 : 0,
                        shadowRadius: isToday ? 6 : 4,
                        shadowOffset: { width: 0, height: isToday ? 3 : 2 },
                        elevation: isToday ? 4 : isSelected ? 3 : 0,
                      },
                    ]}
                  />
                  {shouldShowLabel && (
                    <View style={styles.barLabelContainer}>
                      {isToday ? (
                        <Text style={styles.barLabelTodayTag}>Hôm nay</Text>
                      ) : (
                        <Text style={styles.barLabel}>{dateLabel}</Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e7ff',
    marginBottom: 16,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  chartHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chartAccent: {
    width: 4,
    height: 20,
    borderRadius: 999,
    backgroundColor: '#6366f1',
    marginRight: 10,
  },
  chartTitle: {
    fontSize: scaleFont(15),
    fontWeight: '700',
    color: '#0f172a',
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 4,
  },
  yAxisContainer: {
    width: 32,
    height: 145,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 6,
    paddingBottom: 30,
  },
  yAxisLabel: {
    fontSize: scaleFont(9),
    color: '#9ca3af',
    fontWeight: '600',
  },
  barsContainer: {
    flex: 1,
    position: 'relative',
    paddingRight: 8, // Đảm bảo label ngày cuối không bị cắt
  },
  gridLinesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 145,
    justifyContent: 'space-between',
    paddingBottom: 30,
  },
  gridLine: {
    height: 1,
    backgroundColor: '#f3f4f6',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 145,
    paddingBottom: 30,
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  bar: {
    width: 11,
    borderRadius: 4,
    marginHorizontal: 1.5,
  },
  barLabelContainer: {
    position: 'absolute',
    bottom: -26,
    alignItems: 'center',
  },
  barLabel: {
    marginTop: 4,
    fontSize: scaleFont(7),
    color: '#9ca3af',
    fontWeight: '700',
  },
  barLabelTodayTag: {
    marginTop: 1,
    fontSize: scaleFont(6),
    color: '#2563eb',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
});

