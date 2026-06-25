import re
from typing import Any, Dict, Optional

def mock_query(question: str) -> Optional[Dict[str, Any]]:
    """
    Mock dữ liệu trả về dựa vào từ khóa trong câu hỏi của User 
    để LLM diễn giải kết quả ở bước sau.
    """
    q_lower = question.lower()
    
    # 1. Câu hỏi về thời tiết / AQI hôm nay
    if "hôm nay" in q_lower or "hiện tại" in q_lower:
        return {
            "location": "Phường Phù Khê, Từ Sơn, Bắc Ninh",
            "aqi": 50,
            "pm25": 24.78,
            "temp": 33,
            "humidity": 65,
            "status": "Tốt",
            "timestamp": "2026-06-24 10:00:00"
        }
        
    # 2. Câu hỏi về xu hướng / tuần qua / so sánh
    elif "tuần" in q_lower or "so sánh" in q_lower or "lịch sử" in q_lower:
        return {
            "summary": "Thống kê 7 ngày gần nhất",
            "avg_aqi": 115.4,
            "max_aqi": 165,
            "min_aqi": 42,
            "avg_pm25": 41.2,
            "location_count": 3,
            "most_visited": "Quận Cầu Giấy, Hà Nội"
        }
        
    # 3. Câu hỏi về dự báo tương lai
    elif "dự báo" in q_lower or "ngày mai" in q_lower or "tới" in q_lower:
        return {
            "forecast_period": "7 ngày tới (2026-06-25 đến 2026-07-01)",
            "trend": "Có xu hướng giảm ô nhiễm nhờ gió mùa đông bắc",
            "predicted_aqi_range": "50 - 85",
            "safety_level": "An toàn cho các hoạt động ngoài trời"
        }
        
    # Fallback mặc định nếu không khớp từ khóa nào
    return {
        "location": "Vị trí mặc định của người dùng",
        "aqi": 75,
        "pm25": 31.5,
        "status": "Trung bình"
    }