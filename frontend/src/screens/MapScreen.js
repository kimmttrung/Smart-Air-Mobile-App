import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  StyleSheet,
  View
} from 'react-native';
import {
  MapDayDropdown,
  MapLayerControls,
  MapSearchDropdown,
  MapTopBar,
  MapWebView,
  StationDetailSheet,
} from '../components/map';
import { AqiBar } from '../components/ui';
import { moderateScale, scaleFont } from '../constants/responsive';
import useAutoSaveUserLocation from '../hooks/map/useAutoSaveUserLocation';
import { useLocationTracking } from '../hooks/map/useLocationTracking';
import useMapInteractions from '../hooks/map/useMapInteractions';
import useMapSearch from '../hooks/map/useMapSearch';
import useMapStations from '../hooks/map/useMapStations';
import { BASE_URL } from '../services/api';
import { fetchWeatherData } from '../services/mapService';
import {
  createDayOptions,
  getAQIColor,
  getHealthAdvice
} from '../utils';
import { getAQICategory } from '../utils/aqiUtils';
import { generateLeafletHTML } from '../utils/mapHtmlUtils';
const CONTROL_HEIGHT = 40;
const FORECAST_DAY_COUNT = 10; // Today plus the next 9 days from tif_files

export default function MapScreen() {
  const { saveCurrentLocation } = useLocationTracking(true); // Enable auto-tracking
  // On mount: ensure location permission is requested first
  useEffect(() => {
    let mounted = true;
    const ensurePermission = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') return;

        const res = await Location.requestForegroundPermissionsAsync();
        if (res.status === 'granted') {
          console.log('[MapScreen] Location permission granted');
          return;
        }

        // If permission denied, prompt user to open settings
        Alert.alert(
          'Cho phép vị trí',
          'Ứng dụng cần quyền vị trí để hiển thị bản đồ và vị trí của bạn. Vui lòng bật quyền trong Cài đặt.',
          [
            { text: 'Huỷ', style: 'cancel' },
            { text: 'Mở cài đặt', onPress: () => Linking.openSettings() },
          ],
        );
      } catch (e) {
        console.warn('[MapScreen] Permission check error', e);
      }
    };

    ensurePermission();
    return () => { mounted = false; };
  }, []);
  const [dayOptions] = useState(() => createDayOptions(FORECAST_DAY_COUNT));
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [dayMenuOpen, setDayMenuOpen] = useState(false);
  const selectedDay = dayOptions[selectedDayIndex];
  const webviewRef = React.useRef(null);
  const [selectedStation, setSelectedStation] = useState(null);
  const [loadingPointData, setLoadingPointData] = useState(false);
  
  // Search logic từ hook
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    searchLoading,
    searchError,
    clearSearch,
  } = useMapSearch();
  const [lastClickedPoint, setLastClickedPoint] = useState(null); // Lưu tọa độ điểm đã click
  const { cemStations, loadingStations, stationDetailsById } = useMapStations(); // Station management
  const [webviewReady, setWebviewReady] = useState(false); // Track WebView ready state

  // Tự động lưu lịch sử vị trí GPS khi user xem chi tiết vị trí của mình
  const { savedLocationRef } = useAutoSaveUserLocation(selectedStation, saveCurrentLocation);
  const [showHeatmap, setShowHeatmap] = useState(true); // Toggle heatmap
  const [showMarkers, setShowMarkers] = useState(true); // Toggle markers

  // Map interactions (click, locate me, select search result, re-fetch on day change)
  const {
    locating,
    handleMapClick,
    handleLocateMe,
    handleSelectSearchResult,
  } = useMapInteractions({
    selectedDay,
    selectedStation,
    lastClickedPoint,
    setSelectedStation,
    setLastClickedPoint,
    setLoadingPointData,
    clearSearch,
    webviewRef,
  });

  const navigation = useNavigation();


  // Lấy thêm thông tin chi tiết (temp, humidity, advice, color, address...) giống AirGuardApp.jsx
  const selectedStationDetail = useMemo(() => {
    if (!selectedStation) return null;
    
    // If it's a custom point from map click or user GPS location, return as-is
    if (selectedStation.id === 'custom-point' || selectedStation.id === 'user-gps-location') {
      return selectedStation;
    }
    
    // Otherwise, merge data from stationDetailsById with weather data from selectedStation
    const detailed = stationDetailsById[selectedStation.id];
    if (detailed) {
      // Merge: Keep weather data from selectedStation (temp, humidity, windSpeed, precipitation)
      return {
        ...detailed,
        temp: selectedStation.temp !== undefined ? selectedStation.temp : detailed.temp,
        humidity: selectedStation.humidity !== undefined ? selectedStation.humidity : detailed.humidity,
        windSpeed: selectedStation.windSpeed !== undefined ? selectedStation.windSpeed : detailed.windSpeed,
        precipitation: selectedStation.precipitation !== undefined ? selectedStation.precipitation : detailed.precipitation,
        weatherCode: selectedStation.weatherCode !== undefined ? selectedStation.weatherCode : detailed.weatherCode,
      };
    }
    
    // Fallback: calculate status, color, advice if not in stationDetailsById
    const aqi = selectedStation.aqi || selectedStation.baseAqi || 0;
    return {
      ...selectedStation,
      status: getAQICategory(aqi),
      color: getAQIColor(aqi),
      advice: getHealthAdvice(aqi),
    };
  }, [selectedStation, stationDetailsById]);


  // Inject stations vào WebView sau khi cemStations được load và WebView ready
  useEffect(() => {
    console.log('🔍 Inject stations check:', {
      webviewReady,
      hasWebviewRef: !!webviewRef.current,
      cemStationsLength: cemStations.length
    });
    
    if (webviewReady && webviewRef.current && cemStations.length > 0) {
      console.log(`🗺️ Injecting ${cemStations.length} stations into map...`);
      
      // Delay nhỏ để đảm bảo map đã init xong
      setTimeout(() => {
        const js = `
          if (window.__updateStations) {
            window.__updateStations(${JSON.stringify(cemStations)});
            console.log('✅ Stations injected successfully');
          } else {
            console.error('❌ __updateStations function not found');
          }
          true;
        `;
        webviewRef.current.injectJavaScript(js);
      }, 500); // 500ms delay
    }
  }, [cemStations, webviewReady]); // Trigger khi cemStations hoặc webviewReady thay đổi

  // Toggle markers visibility
  useEffect(() => {
    if (webviewReady && webviewRef.current) {
      const js = `
        window.__toggleMarkers && window.__toggleMarkers(${showMarkers});
        true;
      `;
      webviewRef.current.injectJavaScript(js);
    }
  }, [showMarkers, webviewReady]);

  // Ẩn markers khi chọn ngày khác ngày hôm nay
  useEffect(() => {
    if (webviewReady && webviewRef.current) {
      const shouldShowMarkers = selectedDayIndex === 0 && showMarkers;
      const js = `
        window.__toggleMarkers && window.__toggleMarkers(${shouldShowMarkers});
        true;
      `;
      webviewRef.current.injectJavaScript(js);
    }
  }, [selectedDayIndex, showMarkers, webviewReady]);

  // Toggle heatmap visibility
  useEffect(() => {
    if (webviewReady && webviewRef.current) {
      const js = `
        window.__toggleHeatmap && window.__toggleHeatmap(${showHeatmap});
        true;
      `;
      webviewRef.current.injectJavaScript(js);
    }
  }, [showHeatmap, webviewReady]);

  // Generate HTML with BASE_URL
  const leafletHTML = useMemo(() => generateLeafletHTML(BASE_URL), []);

  const handleSelectDay = (idx, opt) => {
    setSelectedDayIndex(idx);
    if (webviewRef.current && opt.isoDate) {
      const js = `window.__setWmsDate && window.__setWmsDate('${opt.isoDate}'); true;`;
      webviewRef.current.injectJavaScript(js);
    }
  };

  return (
    <View style={styles.container}>
      {/* WebView hiển thị Leaflet map */}
      <MapWebView
        ref={webviewRef}
        leafletHTML={leafletHTML}
        style={styles.webview}
        onReady={() => {
          console.log('✅ WebView loaded, map ready');
          setWebviewReady(true);
        }}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'station_click') {
              // Get full station data from cemStations by id
              const stationId = data.payload.id;
              const fullStation = cemStations.find((s) => s.id === stationId);

              // Hide any external GPS/custom marker when a station is selected
              try {
                if (webviewRef.current) {
                  webviewRef.current.injectJavaScript("window.__clearExternalMarker && window.__clearExternalMarker(); true;");
                }
              } catch (e) {
                console.warn('inject clearExternalMarker failed', e);
              }

              if (fullStation) {
                // Merge point-level data (payload) into fullStation so that
                // point-specific AQI/pm25/name override the station defaults.
                const payload = data.payload || {};
                const payloadAqi = payload.aqi ?? payload.baseAqi ?? payload.pointAqi;
                const mergedStation = {
                  ...fullStation,
                  // prefer payload values when available
                  ...(payloadAqi !== undefined && payloadAqi !== null ? { aqi: payloadAqi } : {}),
                  ...(payload.pm25 !== undefined && payload.pm25 !== null ? { pm25: payload.pm25 } : {}),
                  ...(payload.name ? { name: payload.name } : {}),
                  // keep any other payload props (e.g., timestamp)
                  ...payload,
                };

                const lon = mergedStation.lon || mergedStation.lng || fullStation.lon || fullStation.lng;
                fetchWeatherData(mergedStation.lat || fullStation.lat, lon, selectedDay?.isoDate)
                  .then((weatherData) => {
                    setSelectedStation({
                      ...mergedStation,
                      temp: weatherData.temp,
                      humidity: weatherData.humidity,
                      windSpeed: weatherData.windSpeed,
                      precipitation: weatherData.precipitation,
                      weatherCode: weatherData.weatherCode,
                    });
                  })
                  .catch((err) => {
                    console.error('Error fetching weather for station:', err);
                    // Still show station without weather data
                    setSelectedStation(mergedStation);
                  });
              } else {
                // Fallback to basic data from WebView
                setSelectedStation(data.payload);
              }
            } else if (data.type === 'map_click') {
              // Handle map click - fetch data from backend
              const { lat, lng } = data.payload;
              handleMapClick(lat, lng);
            } else if (data.type === 'console_log') {
              console.log('[WebView]', data.payload);
            } else if (data.type === 'console_error') {
              console.error('[WebView]', data.payload);
            }
          } catch (e) {
            // ignore parse errors
          }
        }}
      />

      

      {/* Thanh control trên cùng: chọn ngày + GPS */}
      <MapTopBar
        searchQuery={searchQuery}
        onChangeSearch={setSearchQuery}
        locating={locating}
        onPressLocate={handleLocateMe}
        selectedDay={selectedDay}
        dayMenuOpen={dayMenuOpen}
        onToggleDayMenu={() => setDayMenuOpen((prev) => !prev)}
      />

      {/* Layer Controls - Toggle Heatmap & Markers */}
      <MapLayerControls
        showHeatmap={showHeatmap}
        onToggleHeatmap={() => setShowHeatmap(!showHeatmap)}
        showMarkers={showMarkers}
        onToggleMarkers={() => setShowMarkers(!showMarkers)}
        selectedDayIndex={selectedDayIndex}
          />

      {/* Zoom controls */}
      {/* <View style={styles.zoomControls}>
        <TouchableOpacity
          style={styles.zoomButton}
          onPress={() => {
            if (webviewRef.current) {
              webviewRef.current.injectJavaScript(`
                map.zoomIn();
                true;
              `);
            }
          }}
        >
          <Feather name="plus" size={20} color="#374151" />
        </TouchableOpacity>
        <View style={styles.zoomDivider} />
        <TouchableOpacity
          style={styles.zoomButton}
          onPress={() => {
            if (webviewRef.current) {
              webviewRef.current.injectJavaScript(`
                map.zoomOut();
                true;
              `);
            }
          }}
        >
          <Feather name="minus" size={20} color="#374151" />
        </TouchableOpacity>
      </View> */}

      {/* Dropdown kết quả tìm kiếm OSM */}
      <MapSearchDropdown
        searchQuery={searchQuery}
        searchResults={searchResults}
        searchLoading={searchLoading}
        searchError={searchError}
        onSelectResult={handleSelectSearchResult}
      />

      {/* Thanh ngày dạng popup phía dưới, scroll ngang giống SmartAir-UI */}
      <MapDayDropdown
        visible={dayMenuOpen}
        dayOptions={dayOptions}
        selectedDayIndex={selectedDayIndex}
        onSelectDay={handleSelectDay}
      />

      {/* Bottom sheet hiển thị chi tiết station – giống popup trong SmartAir-UI */}
      <StationDetailSheet
        station={selectedStationDetail}
        loading={loadingPointData}
        selectedDay={selectedDay}
        onClose={() => {
                setSelectedStation(null);
                savedLocationRef.current = null; // Reset để có thể save lại location nếu quay lại
              }}
      />

      {/* AQI bar dưới cùng – mô phỏng giống SmartAir-UI */}
      <View style={styles.bottomPanel}>
        <AqiBar />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loadingBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  loadingText: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: scaleFont(13),
    color: '#6b7280',
  },
  searchDropdown: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 92,
    left: 12,
    right: 12,
    zIndex: 11,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    maxHeight: 220,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  searchDropdownContent: {
    paddingVertical: 6,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchResultName: {
    fontSize: scaleFont(13),
    fontWeight: '600',
    color: '#111827',
  },
  searchResultAddress: {
    fontSize: scaleFont(11),
    color: '#6b7280',
    marginTop: 2,
  },
  searchStatusText: {
    fontSize: scaleFont(12),
    color: '#9ca3af',
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: 'center',
  },
  zoomControls: {
    position: 'absolute',
    right: 12,
    top: 100,
    zIndex: 10,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    overflow: 'hidden',
  },
  zoomButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dayButton: {
    marginRight: 8,
    paddingHorizontal: 12,
    height: CONTROL_HEIGHT,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayButtonText: {
    fontSize: scaleFont(11),
    color: '#111827',
    fontWeight: '600',
    marginRight: 4,
  },
  dayButtonArrow: {
    fontSize: scaleFont(10),
    color: '#9ca3af',
  },
  dayDropdown: {
    position: 'absolute',
    top: 96,
    left: 12,
    right: 60,
    zIndex: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  
  dayScrollContent: {
    flexDirection: 'row',
  },
  dayChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginHorizontal: 4,
    backgroundColor: 'transparent',
  },
  dayChipActive: {
    backgroundColor: '#2563eb',
  },
  dayChipText: {
    fontSize: scaleFont(11),
    color: '#4b5563',
  },
  dayChipTextActive: {
    color: '#f9fafb',
    fontWeight: '600',
  },
  dayChipDate: {
    fontSize: scaleFont(10),
    color: '#9ca3af',
  },
  dayChipDateActive: {
    color: '#e5e7eb',
  },
bottomPanel: {
  position: 'absolute',
  left: moderateScale(12),
  right: moderateScale(12),
  bottom: moderateScale(32),
  zIndex: 10,
},
  aqiWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  aqiTitle: {
    color: '#e5e7eb',
    fontSize: scaleFont(12),
    fontWeight: '600',
    marginBottom: 6,
  },
  aqiBar: {
    flexDirection: 'row',
    borderRadius: 999,
    overflow: 'hidden',
    height: 18,
    marginBottom: 6,
  },
  aqiSegment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aqiSegmentText: {
    color: '#f9fafb',
    fontSize: scaleFont(9),
    fontWeight: '700',
  },
  aqiNote: {
    color: '#9ca3af',
    fontSize: scaleFont(10),
  },
});
