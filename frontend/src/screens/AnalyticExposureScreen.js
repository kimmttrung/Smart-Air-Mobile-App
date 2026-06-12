import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { EscapeTab, HistoryTab, OverviewTab, StatsInfoModal } from '../components/analytics';
import { BASE_ESCAPE_DESTINATIONS } from '../constants/escapeDestinations';
import { useLocationTracking } from '../hooks/map/useLocationTracking';
import useExposureHistory from '../hooks/analytics/useExposureHistory';
import useExposureOverview from '../hooks/analytics/useExposureOverview';
import useEscapeDestinations from '../hooks/analytics/useEscapeDestinations';
import { getDateRangeForecast, getDateRangePast } from '../utils/aqiUtils';

import { scaleFont } from '../constants/responsive';
export default function AnalyticExposureScreen() {
  const [showStatsInfo, setShowStatsInfo] = useState(false);
  const { getLocationHistory } = useLocationTracking(true);
  const [loading, setLoading] = useState(false); // Changed to false - only load when needed
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'history', 'escape'
  const [userLocation, setUserLocation] = useState(null); // Vị trí thực của user từ GPS/history

  // History (7 ngày) + filter
  const {
    historyData,
    historyLoaded,
    dateFilter,
    setDateFilter,
    filteredHistoryData,
    loadHistoryBasic,
    setHistoryLoaded,
    dayStats,
    setDayStats,
    reloadHistory,
  } = useExposureHistory(getLocationHistory, useCallback((latestLocation) => setUserLocation(latestLocation), []));

  // Overview (analytics + stats)
  const {
    analyticsData,
    setAnalyticsData,
    selectedIdx,
    setSelectedIdx,
    statsPeriod,
    setStatsPeriod,
    showStatsPeriodMenu,
    setShowStatsPeriodMenu,
    locationStats,
    setLocationStats,
    overviewLoaded,
    setOverviewLoaded,
    loadOverviewData,
    reloadStatsOnly,
    refreshChart,
    exposureMultiplier,
    futureMinAqi,
    futureMaxAqi,
    futureAvg,
    pastAvg,
    pastPm25Avg,
    futurePm25Avg,
    cigPast,
    cigFuture,
    topLocationsByDay,
    selectedData,
  } = useExposureOverview(historyData);

  const {
    escapeDestinations,
    filteredDestinations,
    loadingDestinations,
    selectedRadius,
    setSelectedRadius,
    showRadiusMenu,
    setShowRadiusMenu,
    escapeForecastDays,
    setEscapeForecastDays,
    showEscapeDaysMenu,
    setShowEscapeDaysMenu,
    setDestinationsLoaded,
  } = useEscapeDestinations({ baseDestinations: BASE_ESCAPE_DESTINATIONS, userLocation, activeTab });

  // Đồng bộ dayStats (địa điểm thường đến + AQI theo ngày) với ngày đang chọn trên chart
  // Khi user chọn 1 cột "past" trên biểu đồ, tự động set dateFilter tương ứng (YYYY-MM-DD)
  useEffect(() => {
    if (!selectedData || selectedData.type !== 'past' || !selectedData.date) return;
    if (!topLocationsByDay || Object.keys(topLocationsByDay).length === 0) return;

    // selectedData.date đang ở dạng 'dd-MM' hoặc 'dd/MM'
    const [selDay, selMonth] = selectedData.date.split(/[-\/]/);
    const matchedKey = Object.keys(topLocationsByDay).find((key) => {
      const [, month, day] = key.split('-'); // YYYY-MM-DD
      return day === selDay && month === selMonth;
    });

    if (matchedKey) {
      setDateFilter((prev) => (prev === matchedKey ? prev : matchedKey));
    }
  }, [selectedData, topLocationsByDay, setDateFilter]);

  // Khi đổi statsPeriod chỉ gọi lại API stats, không reload chart
  useEffect(() => {
    const reloadStats = async () => {
      if (!overviewLoaded) return;
      await reloadStatsOnly({ setLoading });
    };
    reloadStats();
  }, [statsPeriod, overviewLoaded, reloadStatsOnly]);

  // Wrapper for reloadHistory với params từ hooks
  const reloadHistoryWrapper = useCallback(async () => {
    await reloadHistory({ 
      setLoading, 
      overviewLoaded, 
      loadOverviewData: () => loadOverviewData({ historyData, userLocation, setLoading })
    });
  }, [reloadHistory, overviewLoaded, loadOverviewData, historyData, userLocation]);

  // Refresh the chart (force re-process history and forecasts)
  // Initial load - only basic history data
  useEffect(() => {
    if (!historyLoaded) {
    loadHistoryBasic();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Chỉ chạy 1 lần khi mount

  // Lazy load data khi switch tab
  useEffect(() => {
    if (activeTab === 'overview' && !overviewLoaded && historyData.length > 0) {
      console.log('[AnalyticExposureScreen] Lazy loading overview data...');
      loadOverviewData({ historyData, userLocation, setLoading });
    }
  }, [activeTab, overviewLoaded, historyData, userLocation, loadOverviewData]);

  // Reload when screen becomes focused and auth changes (event-based, no polling)
  const isFocused = useIsFocused();
  const lastTokenRef = useRef(null);
  useEffect(() => {
    if (!isFocused) return;

    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('auth');
        const auth = raw ? JSON.parse(raw) : null;
        const token = auth?.token || auth?.access_token || null;
        // console.log('[AnalyticExposureScreen] auth token check, current:', token, 'last:', lastTokenRef.current);
        if (token !== lastTokenRef.current) {
          lastTokenRef.current = token;
          if (!mounted) return;
          setOverviewLoaded(false);
          setHistoryLoaded(false);
          setAnalyticsData([]);
          setDayStats(null);
          const hist = await loadHistoryBasic();
          if (activeTab === 'overview') {
            try {
              await refreshChart({ historyData: hist, userLocation, setLoading });
            } catch (e) {
              console.error('[AnalyticExposureScreen] Failed to process history after auth change:', e);
            }
          }
        }
      } catch (err) {
        // ignore
      }
    })();

    return () => { mounted = false; };
  }, [isFocused, activeTab, loadHistoryBasic, loadOverviewData]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Popup chú thích thống kê */}
      <StatsInfoModal visible={showStatsInfo} onClose={() => setShowStatsInfo(false)} />
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Phơi nhiễm cá nhân</Text>
          <Text style={styles.headerSubtitle}>Phân tích chất lượng không khí theo ngày</Text>
        </View>
           <Pressable onPress={() => setShowStatsInfo(true)} style={{ marginRight: 8, alignSelf: 'flex-start' }}>
             <Ionicons name="information-circle-outline" size={25} color="#2563eb" />
          </Pressable>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
          onPress={() => setActiveTab('overview')}
          activeOpacity={0.7}
        >
          <Feather 
            name="bar-chart-2" 
            size={16} 
            color={activeTab === 'overview' ? '#1d4ed8' : '#64748b'} 
          />
          <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
            Tổng quan
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
          activeOpacity={0.7}
        >
          <Feather 
            name="clock" 
            size={16} 
            color={activeTab === 'history' ? '#1d4ed8' : '#64748b'} 
          />
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            Lịch sử
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'escape' && styles.tabActive]}
          onPress={() => setActiveTab('escape')}
          activeOpacity={0.7}
        >
          <Feather 
            name="map" 
            size={16} 
            color={activeTab === 'escape' ? '#1d4ed8' : '#64748b'} 
          />
          <Text style={[styles.tabText, activeTab === 'escape' && styles.tabTextActive]}>
            Trốn bụi
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content: Tổng quan */}
      {activeTab === 'overview' && (
        <OverviewTab
          loading={loading}
          analyticsData={analyticsData}
          selectedIdx={selectedIdx}
          setSelectedIdx={setSelectedIdx}
          exposureMultiplier={exposureMultiplier}
          selectedData={selectedData}
          dayStats={dayStats}
          topLocationsByDay={topLocationsByDay}
          statsPeriod={statsPeriod}
          setStatsPeriod={setStatsPeriod}
          showStatsPeriodMenu={showStatsPeriodMenu}
          setShowStatsPeriodMenu={setShowStatsPeriodMenu}
          locationStats={locationStats}
          pastAvg={pastAvg}
          pastPm25Avg={pastPm25Avg}
          cigPast={cigPast}
          futureAvg={futureAvg}
          futurePm25Avg={futurePm25Avg}
          cigFuture={cigFuture}
          futureMinAqi={futureMinAqi}
          futureMaxAqi={futureMaxAqi}
          getDateRangePast={getDateRangePast}
          getDateRangeForecast={getDateRangeForecast}
          onRefreshChart={() => refreshChart({ historyData, userLocation, setLoading })}
          setActiveTab={setActiveTab}
          setDateFilter={setDateFilter}
        />
      )}
      {/* Tab Content: Trốn bụi */}
      {activeTab === 'escape' && (
        <EscapeTab
          loadingDestinations={loadingDestinations}
          userLocation={userLocation}
          filteredDestinations={filteredDestinations}
          escapeDestinations={escapeDestinations}
          selectedRadius={selectedRadius}
          setSelectedRadius={setSelectedRadius}
          showRadiusMenu={showRadiusMenu}
          setShowRadiusMenu={setShowRadiusMenu}
          escapeForecastDays={escapeForecastDays}
          setEscapeForecastDays={setEscapeForecastDays}
          showEscapeDaysMenu={showEscapeDaysMenu}
          setShowEscapeDaysMenu={setShowEscapeDaysMenu}
          setDestinationsLoaded={setDestinationsLoaded}
        />
      )}

      {/* Tab Content: Lịch sử chi tiết */}
      {activeTab === 'history' && (
        <HistoryTab
          loading={loading}
          historyLoaded={historyLoaded}
          historyData={historyData}
          filteredHistoryData={filteredHistoryData}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          dayStats={dayStats}
          onReload={reloadHistoryWrapper}
        />
      )}
    </ScrollView>
  );

}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: scaleFont(14),
    color: '#64748b',
    fontWeight: '500',
  },
  container: {
    flex: 1,
    backgroundColor: '#eff6ff',
  },
  content: {
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: scaleFont(24),
    fontWeight: '800',
    color: '#1d4ed8',
  },
  headerSubtitle: {
    fontSize: scaleFont(12),
    color: '#64748b',
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#dbeafe',
  },
  tabText: {
    fontSize: scaleFont(13),
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#1d4ed8',
  },
});

