import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { scaleFont } from '../../constants/responsive';
/**
 * StationDetailSheet - Bottom sheet component displaying station/point details
 * @param {Object} station - Station data object
 * @param {boolean} loading - Loading state
 * @param {Object} selectedDay - Selected day object
 * @param {Function} onClose - Callback when close button is pressed
 */
export default function StationDetailSheet({ station, loading, selectedDay, onClose }) {
  const navigation = useNavigation();

  if (!station) return null;

  // Format timestamp/time for display at bottom of the card
  let formattedTime = '';
  try {
    const ts = station.timestamp || station.time || station.date;
    if (ts) {
      const d = typeof ts === 'string' ? new Date(ts) : ts instanceof Date ? ts : new Date(ts);
      const pad = (n) => n.toString().padStart(2, '0');
      const hours = pad(d.getHours());
      const minutes = pad(d.getMinutes());
      const day = pad(d.getDate());
      const month = pad(d.getMonth() + 1);
      const year = d.getFullYear();
      formattedTime = `${hours}:${minutes} ${day}-${month}-${year}`;
    }
  } catch (e) {
    formattedTime = station.timestamp || station.time || '';
  }

  return (
    <View style={styles.stationSheet}>
      <View style={styles.stationSheetHandle} />

      {/* Header: Close button */}
      <View style={styles.stationHeaderRow}>
        <TouchableOpacity
          onPress={onClose}
          style={styles.stationHeaderClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="x" size={20} color="#4b5563" />
        </TouchableOpacity>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={[styles.stationContent, { alignItems: 'center', paddingVertical: 24 }]}>
          <Text style={{ color: '#6b7280', fontSize: scaleFont(14)}}>Đang tải dữ liệu...</Text>
        </View>
      ) : (
        <View style={styles.stationContent}>
          <View style={styles.stationMainRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.stationName}>{station.name}</Text>

              {/* Note for user GPS location */}
              {station.id === 'user-gps-location' && (
                <View style={{ marginTop: 4, marginBottom: 4 }}>
                  <Text style={{ fontSize: scaleFont(12), color: '#2563eb', fontStyle: 'italic' }}>
                    📍 Vị trí của bạn
                  </Text>
                </View>
              )}

              {station.address && (
                <View style={styles.stationAddressRow}>
                  <Feather
                    name="map-pin"
                    size={12}
                    color="#6b7280"
                    style={{ marginRight: 4, marginTop: 2 }}
                  />
                  <Text style={styles.stationAddressText}>
                    {station.address}
                  </Text>
                </View>
              )}

              <View style={styles.stationChipsRow}>
                <View
                  style={[
                    styles.stationAqiPill,
                    { backgroundColor: station.color || '#22c55e' },
                  ]}
                >
                  <Text style={styles.stationAqiPillText}>
                    {station.aqi ? `AQI ${station.aqi}` : 'Không có dữ liệu'}
                  </Text>
                </View>
                <Text style={styles.stationStatusText}>
                  • {station.status}
                </Text>
              </View>

              {/* Show PM2.5 value if available */}
              {station.pm25 !== null && station.pm25 !== undefined && (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ fontSize: scaleFont(12), color: '#6b7280' }}>
                    PM2.5: <Text style={{ fontWeight: '600', color: '#111827' }}>
                      {station.pm25.toFixed(1)} μg/m³
                    </Text>
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.stationSideMetrics}>
              {station.temp !== null && station.temp !== undefined && (
                <View style={styles.metricRow}>
                  <Feather name="thermometer" size={14} color="#6b7280" style={{ marginRight: 4 }} />
                  <Text style={styles.metricText}>{station.temp}°C</Text>
                </View>
              )}
              {station.humidity !== null && station.humidity !== undefined && (
                <View style={styles.metricRow}>
                  <Feather name="droplet" size={14} color="#6b7280" style={{ marginRight: 4 }} />
                  <Text style={styles.metricText}>{station.humidity}%</Text>
                </View>
              )}
              {station.windSpeed !== null && station.windSpeed !== undefined && (
                <View style={styles.metricRow}>
                  <Feather name="wind" size={14} color="#6b7280" style={{ marginRight: 4 }} />
                  <Text style={styles.metricText}>{station.windSpeed} m/s</Text>
                </View>
              )}
              {station.precipitation !== null && station.precipitation !== undefined && (
                <View style={styles.metricRow}>
                  <Feather name="cloud-rain" size={14} color="#6b7280" style={{ marginRight: 4 }} />
                  <Text style={styles.metricText}>{station.precipitation} mm</Text>
                </View>
              )}
            </View>
          </View>
          {/* Time displayed at the end of the card */}
          {formattedTime !== '' && (
            <View style={{ marginTop: 10, alignItems: 'center' }}>
              <Text style={styles.stationTimeText}>Thời gian đo gần nhất: {formattedTime}</Text>
            </View>
          )}
          {/* Button Xem chi tiết */}
          <TouchableOpacity
            style={styles.detailButton}
            activeOpacity={0.85}
            onPress={() => {
              if (station) {
                navigation.navigate('DetailStation', { station, selectedDay });
              }
            }}
          >
            <Text style={styles.detailButtonText}>
              Xem chi tiết
            </Text>
            <Feather name="chevron-right" size={16} color="#ffffff" />
          </TouchableOpacity>

          
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stationSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 8,
    paddingBottom: 16,
    zIndex: 15,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  stationSheetHandle: {
    alignSelf: 'center',
    width: 48,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#d1d5db',
    marginBottom: 6,
  },
  stationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  stationHeaderClose: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  stationContent: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  stationMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stationName: {
    fontSize: scaleFont(18),
    fontWeight: '700',
    color: '#111827',
  },
  stationAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  stationAddressText: {
    flex: 1,
    fontSize: scaleFont(12),
    color: '#6b7280',
  },
  stationChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 8,
  },
  stationAqiPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  stationAqiPillText: {
    fontSize: scaleFont(11),
    fontWeight: '700',
    color: '#ffffff',
  },
  stationStatusText: {
    marginLeft: 6,
    fontSize: scaleFont(13),
    color: '#6b7280',
    fontWeight: '500',
  },
  stationSideMetrics: {
    marginLeft: 12,
    alignItems: 'flex-end',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricText: {
    fontSize: scaleFont(13),
    color: '#6b7280',
  },
  detailButton: {
    marginTop: 8,
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailButtonText: {
    fontSize: scaleFont(13),
    fontWeight: '700',
    color: '#ffffff',
    marginRight: 6,
  },
  stationTimeText: {
    fontSize: scaleFont(12),
    color: '#6b7280',
  },
});

