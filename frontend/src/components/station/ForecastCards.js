import { StyleSheet, ScrollView, Text, View } from 'react-native';
import { getAQIColor } from '../../utils/stationUtils';

import { scaleFont } from '../../constants/responsive';
export default function ForecastCards({ weekly, dateRange }) {
  return (
    <View style={styles.forecastSection}>
      <View style={styles.forecastHeader}>
        <View style={styles.forecastHeaderLeft}>
          <View style={styles.forecastIconBox}>
            <Text style={styles.forecastIcon}>📅</Text>
          </View>
          <View>
            <Text style={styles.forecastTitle}>Dự báo 7 ngày</Text>
            <Text style={styles.forecastSubtitle}>
              Thời tiết &amp; chất lượng không khí
            </Text>
          </View>
        </View>
        {!!dateRange && (
          <Text style={styles.forecastDateRange}>{dateRange}</Text>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.forecastScroll}
        contentContainerStyle={styles.forecastScrollContent}
      >
        {weekly.map((item) => {
          const hasData = item.aqi !== null && item.aqi !== undefined;
          const aqiBgColor = hasData ? getAQIColor(item.aqi) : '#f3f4f6';
          const aqiTextColor = hasData ? '#ffffff' : '#9ca3af';
          
          // Calculate temp display with min/max if available
          const tempDisplay = hasData ? (
            item.temp_max !== null && item.temp_min !== null 
              ? `${Math.round(item.temp_min)}° - ${Math.round(item.temp_max)}° `
              : `${Math.round(item.temp)}°C`
          ) : 'N/A';
          
          return (
            <View key={item.date} style={[
              styles.forecastCard,
              !hasData && styles.forecastCardNoData
            ]}>
              <Text style={styles.forecastDay}>{item.label}</Text>
              <Text style={[styles.forecastDate, { opacity: 0.8 }]}>{item.date}</Text>
              <Text style={styles.forecastTemp}>
                {tempDisplay}
              </Text>
              {hasData && item.precipitation !== null && item.precipitation !== undefined && (
                <Text style={styles.forecastPrecip}>
                  🌧️ {item.precipitation}mm
                </Text>
              )}
              <View
                style={[
                  styles.forecastAqiBadge,
                  { 
                    backgroundColor: aqiBgColor,
                    borderWidth: hasData ? 0 : 1,
                    borderColor: hasData ? 'transparent' : '#e5e7eb'
                  },
                ]}
              >
                <Text
                  style={[
                    styles.forecastAqiText,
                    { color: aqiTextColor, fontWeight: '700' },
                  ]}
                >
                  {hasData ? `${item.aqi}` : 'Chưa có'}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
      <Text style={styles.forecastHintText}>Kéo sang phải để xem thêm</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  forecastSection: {
    marginTop: 12,
    borderRadius: 24,
    padding: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  forecastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  forecastHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  forecastIconBox: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  forecastIcon: {
    fontSize: scaleFont(18),
    color: '#ffffff',
  },
  forecastTitle: {
    fontSize: scaleFont(15),
    fontWeight: '700',
    color: '#111827',
  },
  forecastSubtitle: {
    fontSize: scaleFont(11),
    color: '#6b7280',
    marginTop: 2,
  },
  forecastDateRange: {
    fontSize: scaleFont(11),
    color: '#9ca3af',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  forecastScroll: {
    marginTop: 4,
  },
  forecastScrollContent: {
    paddingVertical: 4,
  },
  forecastCard: {
    width: 96,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
    alignItems: 'center',
  },
  forecastDay: {
    fontSize: scaleFont(12),
    fontWeight: '700',
    color: '#111827',
  },
  forecastDate: {
    fontSize: scaleFont(11),
    color: '#9ca3af',
    marginBottom: 4,
  },
  forecastTemp: {
    fontSize: scaleFont(14),
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  forecastPrecip: {
    fontSize: scaleFont(11),
    fontWeight: '600',
    marginBottom: 4,
    opacity: 0.95,
  },
  forecastAqiBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  forecastAqiText: {
    fontSize: scaleFont(13),
    fontWeight: '700',
  },
  forecastHintText: {
    marginTop: 6,
    fontSize: scaleFont(11),
    color: '#9ca3af',
    textAlign: 'center',
  },
  forecastCardNoData: {
    opacity: 0.5,
    borderStyle: 'dashed',
  },
});

