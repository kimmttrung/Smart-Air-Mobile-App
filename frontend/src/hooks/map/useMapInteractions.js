import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as Location from 'expo-location';
import { fetchPM25DataFromBackend, fetchWeatherData, reverseGeocode } from '../../services/mapService';
import { getAQICategory, getAQIColor, getHealthAdvice } from '../../utils';

/**
 * Chứa toàn bộ logic tương tác người dùng với bản đồ:
 * - click trên map (custom point)
 * - định vị GPS (Locate Me)
 * - chọn kết quả search
 * - re-fetch khi đổi ngày cho custom point / GPS
 *
 * UI/UX, thông báo, log... giữ nguyên như MapScreen gốc,
 * chỉ tách code ra cho MapScreen gọn hơn.
 */
export default function useMapInteractions({
  selectedDay,
  selectedStation,
  lastClickedPoint,
  setSelectedStation,
  setLastClickedPoint,
  setLoadingPointData,
  clearSearch,
  webviewRef,
}) {
  const [locating, setLocating] = useState(false);
  // Rate limiting: giới hạn click 1 lần/1 giây trên MapScreen
  const lastClickTimeRef = useRef(0);
  const CLICK_THROTTLE_MS = 3000; // 1 giây

  const handleMapClick = useCallback(
    async (lat, lon, pointId = 'custom-point') => {
      try {
        // Rate limiting: giới hạn tất cả các click 1 lần/1 giây
        const now = Date.now();
        const timeSinceLastClick = now - lastClickTimeRef.current;
        
        if (timeSinceLastClick < CLICK_THROTTLE_MS) {
          console.log(`⏱️ Click throttled: ${timeSinceLastClick}ms < ${CLICK_THROTTLE_MS}ms`);
          return; // Bỏ qua click này
        }
        
        lastClickTimeRef.current = now;
        // Validate coordinates before making API calls
        const validLat = parseFloat(lat);
        const validLon = parseFloat(lon);

        if (isNaN(validLat) || isNaN(validLon)) {
          console.warn('⚠️ Invalid coordinates:', { lat, lon });
          Alert.alert('Lỗi', 'Tọa độ không hợp lệ');
          return;
        }

        if (validLat < -90 || validLat > 90 || validLon < -180 || validLon > 180) {
          console.warn('⚠️ Coordinates out of range:', { lat: validLat, lon: validLon });
          Alert.alert('Lỗi', 'Tọa độ nằm ngoài phạm vi cho phép');
          return;
        }

        setLoadingPointData(true);

        // Lưu tọa độ để có thể re-fetch khi đổi ngày (chỉ cho custom-point)
        if (pointId === 'custom-point') {
          setLastClickedPoint({ lat: validLat, lon: validLon });
        }

        // Use Promise.allSettled instead of Promise.all to handle individual failures gracefully
        const results = await Promise.allSettled([
          fetchPM25DataFromBackend(validLat, validLon, selectedDay?.isoDate),
          fetchWeatherData(validLat, validLon, selectedDay?.isoDate),
          reverseGeocode(validLat, validLon),
        ]);

        // Extract data from settled promises with fallback values
        const pm25Data = results[0].status === 'fulfilled' ? results[0].value : null;
        const weatherData =
          results[1].status === 'fulfilled'
            ? results[1].value
            : { temp: 0, humidity: 0, windSpeed: 0, weatherCode: 0, precipitation: 0 };
        const locationData =
          results[2].status === 'fulfilled'
            ? results[2].value
            : {
                name: 'Điểm được chọn',
                address: `${validLat.toFixed(4)}, ${validLon.toFixed(4)}`,
                district: '',
                city: '',
              };

        // Debug: Log fetched data
        console.log('📊 handleMapClick - Fetched data:', {
          pm25: pm25Data?.pm25,
          aqi: pm25Data?.aqi,
          temp: weatherData.temp,
          humidity: weatherData.humidity,
          precipitation: weatherData.precipitation,
          selectedDate: selectedDay?.isoDate || 'today',
          pointId: pointId,
        });

        // Log any failures for debugging
        const apiNames = ['fetchPM25Data', 'fetchWeatherData', 'reverseGeocode'];
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.warn(`⚠️ ${apiNames[index]} failed:`, result.reason?.message || result.reason);
          }
        });

        // Check if backend server is not available (but still show weather data if available)
        if (!pm25Data) {
          Alert.alert(
            '⚠️ Không có dữ liệu PM2.5',
            Platform.OS === 'android'
              ? `Không thể kết nối với server backend.\n\nĐã thử các URL:\n• http://10.0.2.2:8000\n• http://localhost:8000\n• http://127.0.0.1:8000\n\n✅ Giải pháp:\n1. Mở terminal mới\n2. cd server\n3. python run.py\n4. Đảm bảo server bind 0.0.0.0:8000`
              : `Không thể kết nối với server backend.\n\n✅ Giải pháp:\n1. Mở terminal: cd server\n2. Chạy: python run.py\n3. Kiểm tra: http://localhost:8000/health`,
            [{ text: 'Đã hiểu' }],
          );
        }

        // Construct station-like object (KHÔNG lưu vị trí này vào location history)
        const pointData = {
          id: pointId, // Sử dụng pointId được truyền vào (mặc định 'custom-point')
          lat: validLat,
          lon: validLon, // Đổi từ lng sang lon để consistent với DetailStationScreen
          lng: validLon, // Giữ lng để backward compatible
          name: locationData.name,
          address: locationData.address,
          district: locationData.district,
          city: locationData.city,
          aqi: pm25Data?.aqi || null,
          pm25: pm25Data?.pm25 || null,
          status: pm25Data?.aqi ? getAQICategory(pm25Data.aqi) : 'Không có dữ liệu',
          color: pm25Data?.aqi ? getAQIColor(pm25Data.aqi) : '#9ca3af',
          temp: weatherData.temp,
          humidity: weatherData.humidity,
          windSpeed: weatherData.windSpeed,
          weatherCode: weatherData.weatherCode,
          precipitation: weatherData.precipitation,
          advice: getHealthAdvice(pm25Data?.aqi),
          category: pm25Data?.category || null,
        };

        console.log('📍 pointData created for popup:', {
          name: pointData.name,
          temp: pointData.temp,
          humidity: pointData.humidity,
          aqi: pointData.aqi,
        });

        setSelectedStation(pointData);
      } catch (error) {
        console.error('Error handling map click:', error);
      } finally {
        setLoadingPointData(false);
      }
    },
    [selectedDay, setLoadingPointData, setLastClickedPoint, setSelectedStation],
  );

  const handleLocateMe = useCallback(async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Quyền truy cập vị trí',
          'Ứng dụng cần quyền truy cập vị trí để hiển thị vị trí của bạn trên bản đồ.',
          [{ text: 'OK' }],
        );
        setLocating(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = pos.coords;

      // Validate GPS coordinates
      const validLat = parseFloat(latitude);
      const validLon = parseFloat(longitude);

      if (isNaN(validLat) || isNaN(validLon)) {
        console.warn('⚠️ Invalid GPS coordinates:', { latitude, longitude });
        Alert.alert('Lỗi', 'Tọa độ GPS không hợp lệ');
        setLocating(false);
        return;
      }

      if (validLat < -90 || validLat > 90 || validLon < -180 || validLon > 180) {
        console.warn('⚠️ GPS coordinates out of range:', { lat: validLat, lon: validLon });
        Alert.alert('Lỗi', 'Tọa độ GPS nằm ngoài phạm vi cho phép');
        setLocating(false);
        return;
      }

      // Di chuyển bản đồ đến vị trí GPS
      if (webviewRef.current) {
        const js = `
          window.__setExternalLocation && window.__setExternalLocation(${validLat}, ${validLon});
          true;
        `;
        webviewRef.current.injectJavaScript(js);
      }

      // Fetch dữ liệu PM2.5 và hiển thị popup cho vị trí GPS của user
      setLoadingPointData(true);

      // Use Promise.allSettled to handle individual failures gracefully
      const results = await Promise.allSettled([
        fetchPM25DataFromBackend(validLat, validLon, selectedDay?.isoDate),
        fetchWeatherData(validLat, validLon, selectedDay?.isoDate),
        reverseGeocode(validLat, validLon),
      ]);

      // Extract data from settled promises with fallback values
      const pm25Data = results[0].status === 'fulfilled' ? results[0].value : null;
      const weatherData =
        results[1].status === 'fulfilled'
          ? results[1].value
          : { temp: 0, humidity: 0, windSpeed: 0, weatherCode: 0, precipitation: 0 };
      const locationData =
        results[2].status === 'fulfilled'
          ? results[2].value
          : {
              name: 'Vị trí của bạn',
              address: `${validLat.toFixed(4)}, ${validLon.toFixed(4)}`,
              district: '',
              city: '',
            };

      // Log any failures for debugging
      const apiNames = ['fetchPM25DataFromBackend', 'fetchWeatherData', 'reverseGeocode'];
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.warn(`⚠️ GPS location ${apiNames[index]} failed:`, result.reason?.message || result.reason);
        }
      });

      // Construct user GPS location object
      const userGpsLocation = {
        id: 'user-gps-location', // ID đặc biệt để nhận diện vị trí GPS của user
        lat: validLat,
        lon: validLon,
        lng: validLon,
        name: locationData.name,
        address: locationData.address,
        district: locationData.district,
        city: locationData.city,
        aqi: pm25Data?.aqi || null,
        pm25: pm25Data?.pm25 || null,
        status: pm25Data?.aqi ? getAQICategory(pm25Data.aqi) : 'Không có dữ liệu',
        color: pm25Data?.aqi ? getAQIColor(pm25Data.aqi) : '#9ca3af',
        temp: weatherData.temp,
        humidity: weatherData.humidity,
        windSpeed: weatherData.windSpeed,
        weatherCode: weatherData.weatherCode,
        precipitation: weatherData.precipitation,
        advice: getHealthAdvice(pm25Data?.aqi),
        category: pm25Data?.category || null,
      };

      // Hiển thị popup thông tin vị trí GPS
      setSelectedStation(userGpsLocation);
      setLoadingPointData(false);
    } catch (e) {
      console.warn('GPS error', e);
      Alert.alert(
        'Lỗi GPS',
        'Không thể lấy vị trí hiện tại. Vui lòng kiểm tra GPS và thử lại.',
        [{ text: 'OK' }],
      );
      setLoadingPointData(false);
    } finally {
      setLocating(false);
    }
  }, [selectedDay, setLoadingPointData, setSelectedStation, webviewRef]);

  const handleSelectSearchResult = useCallback(
    async (item) => {
      // Clear search UI completely
      clearSearch();

      // Center map tới địa điểm OSM
      if (webviewRef.current && item.lat && item.lng) {
        const js = `
          window.__setExternalLocation && window.__setExternalLocation(${item.lat}, ${item.lng});
          true;
        `;
        webviewRef.current.injectJavaScript(js);
      }

      // Fetch dữ liệu và hiển thị popup detail (giống như handleMapClick)
      await handleMapClick(item.lat, item.lng);
    },
    [clearSearch, handleMapClick, webviewRef],
  );

  // Re-fetch PM2.5 data khi đổi ngày (nếu đang xem điểm tùy ý hoặc vị trí GPS)
  // Lưu ý: giữ dependency chỉ theo selectedDay để tránh loop khi setSelectedStation
  useEffect(() => {
    if (selectedStation?.id === 'custom-point' && lastClickedPoint) {
      // Re-fetch dữ liệu với ngày mới cho điểm tùy ý
      handleMapClick(lastClickedPoint.lat, lastClickedPoint.lon, 'custom-point');
    } else if (selectedStation?.id === 'user-gps-location' && selectedStation?.lat && selectedStation?.lon) {
      // Re-fetch dữ liệu với ngày mới cho vị trí GPS (giữ nguyên id)
      handleMapClick(selectedStation.lat, selectedStation.lon, 'user-gps-location');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay]);

  return {
    locating,
    setLocating,
    handleMapClick,
    handleLocateMe,
    handleSelectSearchResult,
  };
}


