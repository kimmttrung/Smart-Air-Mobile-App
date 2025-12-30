import { useNavigation, useRoute } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  ForecastCards,
  ForecastChart,
  HealthAdviceCard,
  LocationChip,
  MetricsGrid,
  StationHeader,
} from '../components/station';
import { width } from '../constants/deviceDimensions';
import useChartData from '../hooks/station/useChartData';
import useStationData from '../hooks/station/useStationData';
import useStationDetail from '../hooks/station/useStationDetail';
import { formatTimestamp, generateWeeklyData } from '../utils/stationUtils';

import { scaleFont } from '../constants/responsive';
export default function DetailStationScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const station = route.params?.station;
  const selectedDay = route.params?.selectedDay;
  
  console.log('🔍 DetailScreen received params:', {
    stationName: station?.name,
    temp: station?.temp,
    humidity: station?.humidity,
    aqi: station?.aqi,
    pm25: station?.pm25,
    selectedDay: selectedDay?.isoDate,
    timestamp: station?.timestamp
  });

  const [userGroup, setUserGroup] = useState('normal'); // 'normal' or 'sensitive'
  const [chartWidth, setChartWidth] = useState(width - 100); // Chart width for responsive

  // Hooks
  const { realtimeData, loading } = useStationDetail(station);
  // console.log('📊 DetailStationCScreen realtimeData:', realtimeData);
  const data = useStationData(station, realtimeData, userGroup, selectedDay);
  // console.log('📊 DetailStationCScreen display data:', data);
  // Sử dụng realtime data nếu có, không thì fallback về mock data
  const weekly = useMemo(() => {
    if (realtimeData?.weekly && realtimeData.weekly.length > 0) {
      console.log('✅ Using realtime weekly data:', realtimeData.weekly.length, 'days');
      return realtimeData.weekly;
    }
    console.log('⚠️ Using mock weekly data');
    return generateWeeklyData(data.color || '#22c55e');
  }, [realtimeData, data.color]);

  const chartData = useChartData(weekly, chartWidth);

  const now = useMemo(() => {
    const d = new Date();
    const date = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const displayDate = `${date}/${month}/${year}`;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const displayTime = `${hours}:${minutes}`;
    return {
      displayDate,
      displayTime,
      displayLabel: `Hôm nay, ${displayDate}`,
    };
  }, []);

  const displayTs = formatTimestamp(station?.timestamp, now.displayDate, now.displayTime);

  const weeklyDateRange = useMemo(() => {
    if (!weekly || weekly.length === 0) return '';
    return `${weekly[0].date} - ${weekly[weekly.length - 1].date}`;
  }, [weekly]);

  // Handle user group change with logging
  const handleUserGroupChange = (newGroup) => {
    console.log('🔄 User group changed:', userGroup, '->', newGroup);
    setUserGroup(newGroup);
  };

  return (
    <View style={styles.root}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Đang tải dữ liệu realtime...</Text>
        </View>
      )}
      
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backIcon}>{'‹'}</Text>
        </TouchableOpacity>

        <LocationChip
          date={displayTs.date}
          time={displayTs.time}
          stationName={data.name}
        />

        <StationHeader
          aqi={data.aqi}
          pm25={data.pm25}
          status={data.status}
          backgroundColor={data.color}
        />

        {/* Main info */}
        <View style={styles.mainSection}>
          <MetricsGrid
            temp={data.temp}
            humidity={data.humidity}
            wind={data.wind}
            precipitation={data.precipitation}
          />

          <HealthAdviceCard
            advice={data.advice}
            userGroup={userGroup}
            onUserGroupChange={handleUserGroupChange}
          />

          <ForecastChart
            chartData={chartData}
            weekly={weekly}
            chartWidth={chartWidth}
            onChartWidthChange={setChartWidth}
          />

          <ForecastCards
            weekly={weekly}
            dateRange={weeklyDateRange}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 40,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(196, 138, 138, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    // zIndex: 10,
  },
  backIcon: {
    color: 'rgba(0, 0, 0, 0.62)',
    fontSize: scaleFont(40),
    lineHeight: scaleFont(20),
    textAlign: 'center',
    fontWeight: '300',
  },
  mainSection: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: scaleFont(13),
    color: '#2563eb',
    fontWeight: '600',
  },
});

