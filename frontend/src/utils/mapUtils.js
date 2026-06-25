/**
 * Create day options for forecast selector
 * @param {number} days - Number of days to generate, including today
 * @returns {Array} Array of day options with label, dateStr, and isoDate
 */
export const createDayOptions = (days = 7) => {
  const weekdays = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  const result = [];
  const today = new Date();

  for (let offset = 0; offset < days; offset++) {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    const dayName = weekdays[d.getDay()];
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const dateStr = `${day}/${month}`;
    const isoDate = `${year}-${month}-${day}`; // YYYY-MM-DD cho PopGIS

    let label;
    if (offset === 0) label = 'Hôm nay';
    else if (offset === 1) label = 'Ngày mai';
    else label = dayName;

    result.push({ label, dateStr, isoDate });
  }

  return result;
};

/**
 * Get health advice based on AQI value and user group
 * Based on: Công văn 12/MT-SKHC/2024 - Bộ Y tế
 * @param {number} aqi - Air Quality Index value
 * @param {string} userGroup - 'normal' (người bình thường) or 'sensitive' (nhóm nhạy cảm)
 * @returns {Object} Health advice object with text and action
 */
export const getHealthAdvice = (aqi, userGroup = 'normal') => {
  // console.log('🏥 getHealthAdvice called with:', { aqi, userGroup });
  const isSensitive = userGroup === 'sensitive';
  // console.log('🏥 isSensitive:', isSensitive);
  
  // AQI 0-50: Tốt (Good)
  if (!aqi || aqi <= 50) {
    return {
      text: isSensitive 
        ? 'An toàn cho mọi hoạt động ngoài trời.'
        : 'Chất lượng không khí tốt.',
      action: 'Thoải mái ra ngoài',
      level: 'good',
      color: '#22c55e'
    };
  }
  
  // AQI 51-100: Trung bình (Moderate)
  if (aqi <= 100) {
    const result = {
      text: isSensitive
        ? 'Hạn chế hoạt động ngoài trời lâu. \nTheo dõi sức khoẻ, nếu xuất hiện các triệu chứng cấp tính như khó thở, ho, sốt cần đến ngay các cơ sở y tế để khám và được tư vấn, điều trị.'
        : 'Tham gia các hoạt động ngoài trời không hạn chế',
      action: isSensitive ? 'Hạn chế thời gian' : 'Bình thường',
      level: 'moderate',
      color: '#eab308'
    };
    // console.log('🏥 Returning for AQI 51-100:', result.text);
    return result;
  }
  
  // AQI 101-150: Kém (Unhealthy for Sensitive Groups)
  if (aqi <= 150) {
    const text_normal_150 = "- Giảm thời gian hoạt động ngoài trời, đặc biệt nếu bị đau mắt, ho hoặc đau họng.\n- Tránh khu vực ô nhiễm cao như đường đông xe, công trình, khu công nghiệp.\n- Học sinh có thể hoạt động ngoài trời nhưng nên hạn chế vận động mạnh kéo dài.";
    const text_sensitive_150 = "- Hạn chế hoạt động ngoài trời và vận động gắng sức; nghỉ ngơi và hoạt động nhẹ.\n- Vệ sinh mũi, súc họng và rửa mắt bằng nước muối sau khi ra ngoài.\n- Theo dõi sức khỏe; nếu khó thở, ho hoặc sốt cần đến cơ sở y tế.";

    return {
      text: isSensitive
        ? text_sensitive_150
        : text_normal_150,
      action: 'Đeo khẩu trang',
      level: 'unhealthy_sensitive',
      color: '#f97316'
    };
  }
  
  // AQI 151-200: Xấu (Unhealthy)
  if (aqi <= 200) {
    const text_normal_200 = "- Hạn chế hoạt động ngoài trời, giảm vận động mạnh. Tránh khu vực ô nhiễm cao.\n- Ưu tiên sử dụng giao thông công cộng, hạn chế xe máy/xe đạp.\n- Hạn chế mở cửa khi không khí ô nhiễm nặng.\n- Vệ sinh mũi, súc họng và rửa mắt bằng nước muối sau khi ra ngoài.";
    const text_sensitive_200 = "- Tránh các hoạt động ngoài trời; nên tập luyện trong nhà. Hạn chế mở cửa khi ô nhiễm nặng.\n- Vệ sinh mũi, súc họng và rửa mắt bằng nước muối mỗi ngày.\n- Theo dõi sức khỏe; nếu khó thở, ho hoặc sốt cần đến cơ sở y tế ngay.";

    return {
      text: isSensitive
        ? text_sensitive_200
        : text_normal_200,
      action: 'Ở trong nhà',
      level: 'unhealthy',
      color: '#ef4444'
    };
  }
  
  // AQI 201-300: Rất xấu (Very Unhealthy)
  if (aqi <= 300) {
    const text_normal_300 = "- Tránh hoạt động ngoài trời; ưu tiên sinh hoạt trong nhà.\n- Nếu phải ra ngoài, cần đeo khẩu trang chống bụi mịn PM2.5.\n- Tránh khu vực ô nhiễm cao; hạn chế mở cửa.\n- Vệ sinh mũi, họng và mắt bằng nước muối sau khi ra ngoài.";
    const text_sensitive_300 = "- Tránh hoàn toàn hoạt động ngoài trời; di chuyển sinh hoạt vào trong nhà.\n- Nếu bắt buộc phải ra ngoài, cần rút ngắn thời gian và đeo khẩu trang PM2.5.\n- Theo dõi triệu chứng; đi khám nếu khó thở, ho, sốt.";

    return {
      text: isSensitive
        ? text_sensitive_300
        : text_normal_300,
      action: 'Máy lọc không khí',
      level: 'very_unhealthy',
      color: '#a855f7'
    };
  }
  const text_normal_500 = "- Tránh mọi hoạt động ngoài trời; chuyển sang sinh hoạt trong nhà.\n- Đóng cửa sổ và cửa ra vào để hạn chế tiếp xúc với không khí ô nhiễm.";
  const text_sensitive_500 = "- Tuyệt đối không ra ngoài; sinh hoạt hoàn toàn trong nhà và đóng kín cửa.\n- Theo dõi triệu chứng và đến cơ sở y tế nếu có khó thở, ho, sốt.\n- Trẻ em (mẫu giáo/tiểu học) có thể được nghỉ học nếu AQI nguy hại kéo dài 3 ngày.";

  // AQI 301+: Nguy hại (Hazardous)
  return {
    text: isSensitive
      ? text_sensitive_500
      : text_normal_500,
    action: '⚠️ Khẩn cấp',
    level: 'hazardous',
    color: '#7c2d12'
  };
};

/**
 * Search location using Nominatim API
 * @param {string} query - Search query
 * @param {string} endpoint - Nominatim endpoint URL
 * @returns {Promise<Array>} Array of search results
 */
export const searchLocation = async (query, endpoint) => {
  if (!query || query.trim().length < 2) {
    throw new Error('Vui lòng nhập ít nhất 2 ký tự');
  }

  const url = `${endpoint}?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=10&countrycodes=vn`;
  
  // Add timeout handling with AbortController (5 seconds)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SmartAir/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Lỗi tìm kiếm (${response.status})`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Không tìm thấy kết quả');
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Handle timeout specifically
    if (error.name === 'AbortError') {
      throw new Error('Timeout: Không thể tìm kiếm trong 5 giây');
    }
    
    throw error;
  }
};

/**
 * Fetch PM2.5 data for a location from Open-Meteo API
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} apiUrl - Open-Meteo API URL
 * @returns {Promise<Object>} PM2.5 data with AQI
 */
export const fetchPM25Data = async (lat, lon, apiUrl) => {
  const url = `${apiUrl}?latitude=${lat}&longitude=${lon}`;
  
  // Add timeout handling with AbortController (5 seconds)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Lỗi lấy dữ liệu PM2.5 (${response.status})`);
    }

    const data = await response.json();
    const pm25 = data?.current?.pm2_5;

    if (pm25 == null) {
      throw new Error('Không có dữ liệu PM2.5 tại vị trí này');
    }

    // Convert PM2.5 to AQI (simplified EPA formula for PM2.5)
    let aqi;
    if (pm25 <= 12) {
      aqi = Math.round((50 / 12) * pm25);
    } else if (pm25 <= 35.4) {
      aqi = Math.round(((100 - 51) / (35.4 - 12.1)) * (pm25 - 12.1) + 51);
    } else if (pm25 <= 55.4) {
      aqi = Math.round(((150 - 101) / (55.4 - 35.5)) * (pm25 - 35.5) + 101);
    } else if (pm25 <= 150.4) {
      aqi = Math.round(((200 - 151) / (150.4 - 55.5)) * (pm25 - 55.5) + 151);
    } else if (pm25 <= 250.4) {
      aqi = Math.round(((300 - 201) / (250.4 - 150.5)) * (pm25 - 150.5) + 201);
    } else {
      aqi = Math.round(((500 - 301) / (500 - 250.5)) * (pm25 - 250.5) + 301);
    }

    return {
      pm25: Math.round(pm25 * 10) / 10,
      aqi: Math.max(0, Math.min(500, aqi)),
    };
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Handle timeout specifically
    if (error.name === 'AbortError') {
      throw new Error('Timeout: API không phản hồi trong 5 giây');
    }
    
    throw error;
  }
};
