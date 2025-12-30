import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { scaleFont } from '../../constants/responsive';
import { getAQIColor } from '../../utils';
const RADIUS_OPTIONS = [20, 50, 70, 100, 120, 150, 200];

export default function EscapeTab({
  loadingDestinations,
  userLocation,
  filteredDestinations,
  escapeDestinations,
  selectedRadius,
  setSelectedRadius,
  showRadiusMenu,
  setShowRadiusMenu,
  escapeForecastDays,
  setEscapeForecastDays,
  showEscapeDaysMenu,
  setShowEscapeDaysMenu,
  setDestinationsLoaded,
}) {
  if (loadingDestinations) {
    return (
      <View style={styles.loadingTabContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingTabText}>Đang tải địa điểm...</Text>
      </View>
    );
  }

  return (
    <View style={styles.escapeContainer}>
      <View style={styles.weekendSection}>
        {/* Header + nút chọn bán kính */}
        <View style={styles.weekendHeaderRow}>
          <View style={styles.weekendHeaderText}>
            <Text style={styles.weekendTitle}>Trốn bụi 🚆</Text>
          </View>
          <View style={styles.weekendRadiusContainer}>
            <TouchableOpacity
              style={styles.weekendRadiusButton}
              onPress={() => setShowRadiusMenu((v) => !v)}
              activeOpacity={0.8}
            >
              <Feather name="navigation-2" size={scaleFont(12)} color="#1d4ed8" />
              <Text style={styles.weekendRadiusButtonText}>{selectedRadius}km</Text>
              <Feather
                  name={showRadiusMenu ? 'chevron-up' : 'chevron-down'}
                  size={scaleFont(12)}
                color="#6b7280"
              />
            </TouchableOpacity>
            {showRadiusMenu && (
              <View style={styles.weekendRadiusMenu}>
                {RADIUS_OPTIONS.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.weekendRadiusMenuItem,
                      selectedRadius === r && styles.weekendRadiusMenuItemActive,
                    ]}
                    onPress={() => {
                      setSelectedRadius(r);
                      setShowRadiusMenu(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.weekendRadiusMenuText,
                        selectedRadius === r && styles.weekendRadiusMenuTextActive,
                      ]}
                    >
                      {r} km
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={{ width: 8, height: 8 }} />
            {/* Forecast days selector (1..7) */}
            <TouchableOpacity
              style={[styles.weekendRadiusButton, { marginLeft: 8 }]}
              onPress={() => setShowEscapeDaysMenu((v) => !v)}
              activeOpacity={0.8}
            >
              <Feather name="clock" size={scaleFont(12)} color="#1d4ed8" />
              <Text style={styles.weekendRadiusButtonText}>{`${escapeForecastDays} ngày`}</Text>
              <Feather
                name={showEscapeDaysMenu ? 'chevron-up' : 'chevron-down'}
                size={scaleFont(12)}
                color="#6b7280"
              />
            </TouchableOpacity>
            {showEscapeDaysMenu && (
              <View style={[styles.weekendRadiusMenu, { right: 0, left: undefined, marginLeft: 0, marginTop: 8 }]}>
                {Array.from({ length: 7 }, (_, i) => i + 1).map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.weekendRadiusMenuItem,
                      escapeForecastDays === d && styles.weekendRadiusMenuItemActive,
                    ]}
                    onPress={() => {
                      setEscapeForecastDays(d);
                      setShowEscapeDaysMenu(false);
                      setDestinationsLoaded(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.weekendRadiusMenuText,
                        escapeForecastDays === d && styles.weekendRadiusMenuTextActive,
                      ]}
                    >
                      {`${d} ngày`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Thẻ vị trí hiện tại */}
        {userLocation ? (
          <View style={styles.weekendLocationCard}>
            <View>
              <Text style={styles.weekendLocationLabel}>Vị trí hiện tại</Text>
              <Text style={styles.weekendLocationName}>{userLocation.name || userLocation.address}</Text>
            </View>
            <View style={styles.weekendLocationAqiBox}>
              <Text style={styles.weekendLocationAqiLabel}>AQI</Text>
              <Text style={[styles.weekendLocationAqiValue, { color: getAQIColor(userLocation.aqi || 0) }]}>
                {userLocation.aqi || 0}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.weekendLocationCard}>
            <View style={{ flex: 1, alignItems: 'center', paddingVertical: 16 }}>
              <Feather name="map-pin" size={scaleFont(32)} color="#cbd5e1" />
              <Text style={{ fontSize: scaleFont(14), color: '#64748b', marginTop: 8 }}>Chưa có vị trí</Text>
              <Text style={{ fontSize: scaleFont(12), color: '#94a3b8', marginTop: 4, textAlign: 'center' }}>
                Nhấn nút GPS trên bản đồ để lưu vị trí của bạn
              </Text>
            </View>
          </View>
        )}

        <Text style={styles.weekendSectionHeading}>Gợi ý hàng đầu</Text>

        {filteredDestinations.length === 0 ? (
          <View style={styles.emptyDestinationsContainer}>
            <Feather name="map" size={scaleFont(48)} color="#cbd5e1" />
            <Text style={styles.emptyDestinationsText}>
              {!userLocation
                ? 'Vui lòng lưu vị trí để xem gợi ý'
                : escapeDestinations.length === 0
                ? 'Không thể tải dữ liệu địa điểm'
                : 'Không có địa điểm nào trong bán kính này'}
            </Text>
            {userLocation && escapeDestinations.length === 0 && (
              <Text style={styles.emptyDestinationsSubtext}>
                Vui lòng kiểm tra kết nối mạng và thử lại
              </Text>
            )}
          </View>
        ) : (
          userLocation &&
          filteredDestinations.map((dest) => {
            const cleanRatio = (userLocation.aqi / dest.aqi).toFixed(1);
            const aqiChange = dest.currentAqi > 0 ? dest.aqi - dest.currentAqi : 0;
            const aqiChangePercent =
              dest.currentAqi > 0 ? Math.round((aqiChange / dest.currentAqi) * 100) : 0;

            return (
              <View key={dest.id} style={styles.weekendCardOuter}>
                <ImageBackground
                  source={{ uri: dest.img_url }}
                  style={styles.weekendCardImage}
                  imageStyle={styles.weekendCardImageStyle}
                >
                  <View style={styles.weekendCardOverlay} />
                  <View style={styles.weekendCardInner}>
                    <View style={styles.weekendCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.weekendCardTitle}>{dest.name}</Text>
                        <Text style={styles.weekendMetaText}>
                          {dest.distance} km • {dest.driveTime}
                        </Text>
                        {dest.currentAqi > 0 && aqiChange !== 0 && (
                          <View
                            style={[
                              styles.forecastBadge,
                              aqiChange < 0 ? styles.forecastBadgeGood : styles.forecastBadgeBad,
                            ]}
                          >
                            <Text
                              style={[
                                styles.forecastBadgeText,
                                aqiChange < 0 ? styles.forecastBadgeTextGood : styles.forecastBadgeTextBad,
                              ]}
                            >
                              {aqiChange < 0 ? '↓' : '↑'} {Math.abs(aqiChangePercent)}% sau{' '}
                              {escapeForecastDays === 1 ? '24h' : `${escapeForecastDays} ngày`}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.weekendAqiBadge}>
                        <View style={[styles.weekendAqiBadge, { backgroundColor: getAQIColor(dest.aqi) }]}>
                          <Text style={styles.weekendAqiLabel}>AQI VN {dest.aqi}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.weekendStatsRow}>
                      <View style={styles.weekendStatBox}>
                        <Text style={styles.weekendStatLabel}>
                          {cleanRatio > 1 ? 'Độ sạch' : 'Độ ô nhiễm'}
                        </Text>
                        <Text style={styles.weekendStatValue}>
                          Gấp {cleanRatio > 1 ? cleanRatio : (1 / cleanRatio).toFixed(1)} lần
                        </Text>
                      </View>
                      <View style={styles.weekendStatBox}>
                        <Text style={styles.weekendStatLabel}>Thời tiết</Text>
                        <Text style={styles.weekendStatValue}>
                          {dest.temp_min}°C - {dest.temp_max}°C
                        </Text>
                      </View>
                      <View style={styles.weekendStatBox}>
                        <Text style={styles.weekendStatLabel}>Lượng mưa</Text>
                        <Text style={styles.weekendStatValue}>{dest.precipitation} mm</Text>
                      </View>
                    </View>

                    <Text style={styles.weekendRecommendation}>💡 {dest.recommendation}</Text>
                  </View>
                </ImageBackground>
              </View>
            );
          })
        )}
      </View>
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
  escapeContainer: {
    flex: 1,
  },
  weekendSection: {
    marginTop: 20,
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  weekendHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  weekendHeaderText: {
    flex: 1,
    marginRight: 8,
  },
  weekendTitle: {
    fontSize: scaleFont(16),
    fontWeight: '700',
    color: '#0f172a',
  },
  weekendRadiusContainer: {
    position: 'relative',
    flexDirection: 'row',
  },
  weekendRadiusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  weekendRadiusButtonText: {
    fontSize: scaleFont(11),
    fontWeight: '700',
    color: '#1d4ed8',
    marginHorizontal: 4,
  },
  weekendRadiusMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 6,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 4,
    minWidth: 90,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    zIndex: 20,
  },
  weekendRadiusMenuItem: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  weekendRadiusMenuItemActive: {
    backgroundColor: '#dbeafe',
  },
  weekendRadiusMenuText: {
    fontSize: scaleFont(11),
    color: '#4b5563',
  },
  weekendRadiusMenuTextActive: {
    fontWeight: '700',
    color: '#1d4ed8',
  },
  weekendLocationCard: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekendLocationLabel: {
    fontSize: scaleFont(11),
    color: '#6b7280',
  },
  weekendLocationName: {
    fontSize: scaleFont(13),
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 2,
  },
  weekendLocationAqiBox: {
    alignItems: 'flex-end',
  },
  weekendLocationAqiLabel: {
    fontSize: scaleFont(11),
    color: '#6b7280',
  },
  weekendLocationAqiValue: {
    fontSize: scaleFont(18),
    fontWeight: '800',
  },
  weekendSectionHeading: {
    marginTop: 12,
    fontSize: scaleFont(11),
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
  },
  weekendCardOuter: {
    marginTop: 10,
    borderRadius: 18,
    overflow: 'hidden',
    minHeight: 150,
  },
  weekendCardImage: {
    height: 150,
    width: '100%',
    justifyContent: 'flex-end',
  },
  weekendCardImageStyle: {
    borderRadius: 18,
  },
  weekendCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.35)',
  },
  weekendCardInner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  weekendCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  weekendCardTitle: {
    fontSize: scaleFont(14),
    fontWeight: '700',
    color: '#ffffff',
  },
  weekendMetaText: {
    fontSize: scaleFont(12),
    color: '#e5e7eb',
    marginTop: 2,
  },
  weekendAqiBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  weekendAqiLabel: {
    fontSize: scaleFont(12),
    color: 'rgba(255, 255, 255, 0.72)',
    fontWeight: '600',
  },
  weekendStatsRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  weekendStatBox: {
    flex: 1,
    marginRight: 4,
    backgroundColor: 'rgba(126, 139, 170, 0.72)',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  weekendStatLabel: {
    fontSize: scaleFont(10),
    color: '#e5e7eb',
  },
  weekendStatValue: {
    fontSize: scaleFont(12),
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.72)',
  },
  weekendRecommendation: {
    marginTop: 6,
    fontSize: scaleFont(10),
    color: '#e5e7eb',
  },
  forecastBadge: {
    marginTop: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  forecastBadgeGood: {
    backgroundColor: 'rgba(187, 247, 208, 0.9)',
  },
  forecastBadgeBad: {
    backgroundColor: 'rgba(254, 226, 226, 0.9)',
  },
  forecastBadgeText: {
    fontSize: scaleFont(9),
    fontWeight: '700',
  },
  forecastBadgeTextGood: {
    color: '#14532d',
  },
  forecastBadgeTextBad: {
    color: '#7f1d1d',
  },
  emptyDestinationsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 48,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyDestinationsText: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: '#64748b',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyDestinationsSubtext: {
    fontSize: scaleFont(13),
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
  },
});

