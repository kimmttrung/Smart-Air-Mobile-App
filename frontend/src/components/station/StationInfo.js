import { Platform, StyleSheet, Text, View } from 'react-native';
import { getAQIIcon } from '../../utils/stationUtils';

import { scaleFont } from '../../constants/responsive';
/**
 * LocationChip - Hiển thị thông tin location và timestamp
 */
export function LocationChip({ date, time, stationName }) {
  return (
    <View style={styles.locationChipWrapper}>
      <View style={styles.locationChip}>
        <Text style={styles.locationText}>
          Ngày {date}
        </Text>
        {/* {time !== '' && (
          <Text style={styles.locationText}>
            {time}
          </Text>
        )} */}
        <Text style={styles.locationText}>
          {stationName || 'Trạm quan trắc'}
        </Text>
      </View>
    </View>
  );
}

/**
 * StationHeader - Header với AQI, PM2.5 và icon
 */
export function StationHeader({ aqi, pm25, status, backgroundColor }) {
  return (
    <View
      style={[
        styles.header,
        { backgroundColor: backgroundColor || '#22c55e' },
      ]}
    >
      <View style={styles.headerCenter}>
        {/* Cột trái: Số AQI */}
        <View style={styles.aqiColumn}>
          <Text style={styles.aqiLabelText}>AQI VN</Text>
          <View style={styles.aqiCircleWrapper}>
            <View style={styles.aqiCircleGlow} />
            <Text style={styles.aqiNumber}>{aqi ?? 0}</Text>
          </View>
          
          <Text style={styles.pm25Label}>PM2.5:</Text>
          <Text style={styles.pm25Value}>
            {typeof pm25 === 'number' ? pm25.toFixed(1) : pm25} µg/m³
          </Text>
        </View>

        {/* Cột phải: Thông tin chi tiết */}
        <View style={styles.infoColumn}>
          <View style={styles.statusIcon}>
            {getAQIIcon(aqi || 0)}
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{status || 'Trung bình'}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * MetricCard - Card hiển thị một metric (temp, humidity, wind, precipitation)
 */
function MetricCard({ icon, label, value, iconBgColor = '#e5e7eb' }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIconBox, { backgroundColor: iconBgColor }]}>
        <Text style={styles.metricIcon}>{icon}</Text>
      </View>
      <View style={styles.metricInfoBox}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
    </View>
  );
}

/**
 * MetricsGrid - Grid 4 metrics cards
 */
export function MetricsGrid({ temp, humidity, wind, precipitation }) {
  return (
    <View style={styles.metricsGrid}>
      <MetricCard
        icon="🌡️"
        label="Nhiệt độ"
        value={`${temp}°`}
        iconBgColor="#ffedd5"
      />
      <MetricCard
        icon="💧"
        label="Độ ẩm"
        value={`${humidity}%`}
        iconBgColor="#dbeafe"
      />
      <MetricCard
        icon="💨"
        label="Gió"
        value={`${wind} km/h`}
        iconBgColor="#e5e7eb"
      />
      <MetricCard
        icon="🌧️"
        label="Lượng mưa"
        value={`${precipitation} mm`}
        iconBgColor="#e5e7eb"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // LocationChip styles
  locationChipWrapper: {
    width: '100%',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  locationChip: {
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: 'rgb(255, 255, 255)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 4,
    width: '70%',
  },
  locationText: {
    fontSize: scaleFont(13),
    color: 'rgb(0, 0, 0)',
    fontWeight: '600',
    textAlign: 'center',
  },
  // StationHeader styles
  header: {
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  aqiColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  infoColumn: {
    flex: 1,
    gap: 8,
    alignItems: 'center',
  },
  aqiLabelText: {
    flex: 1,
    fontSize: scaleFont(13),
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 4,
    opacity: 0.95,
  },
  aqiCircleWrapper: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aqiCircleGlow: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.35)',
    opacity: 0.9,
  },
  aqiNumber: {
    fontSize: scaleFont(44),
    fontWeight: '900',
    color: '#ffffff',
  },
  pm25Label: {
    fontSize: scaleFont(11),
    color: '#ffffff',
    opacity: 0.9,
    fontWeight: '600',
  },
  pm25Value: {
    fontSize: scaleFont(15),
    fontWeight: '800',
    color: '#ffffff',
  },
  statusIcon: {
    fontSize: scaleFont(90),
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusPillText: {
    fontSize: scaleFont(24),
    fontWeight: '700',
    color: '#ffffff',
  },
  // MetricsGrid styles
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  metricCard: {
    flexBasis: '48%',
    minWidth: 100,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  metricIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricIcon: {
    fontSize: scaleFont(24),
  },
  metricInfoBox: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    flex: 1,
  },
  metricLabel: {
    fontSize: scaleFont(13),
    color: '#6b7280',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: scaleFont(17),
    fontWeight: '700',
    color: '#111827',
    lineHeight: 26,
  },
});

