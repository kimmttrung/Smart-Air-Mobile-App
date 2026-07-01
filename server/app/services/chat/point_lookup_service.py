"""
Point-lookup service — trả lời câu hỏi AQI/PM2.5 tại MỘT địa điểm cụ thể bằng
cách đọc TRỰC TIẾP file GeoTIFF (không qua database).

Luồng xử lý:
  1. Xác định toạ độ:
       - Ưu tiên lat/lon do app gửi kèm ("chỗ tôi", "vị trí của tôi").
       - Nếu không có -> trích tên địa danh từ câu hỏi rồi geocode (Open-Meteo).
  2. Xác định thời gian: "hôm nay" (1 ngày) hoặc "tuần qua" (chuỗi nhiều ngày).
  3. Đọc PM2.5 tại điểm qua read_pm25_at_point() cho từng ngày.
  4. LLM diễn giải kết quả + khuyến nghị.
"""
from __future__ import annotations

import json
import logging
import re

from datetime import datetime

import httpx
from app.core.config import settings
from app.services.geotiff_service import get_available_dates, read_pm25_at_point
from app.services.chat.llm_factory import get_chat_llm

logger = logging.getLogger(__name__)

llm = get_chat_llm(temperature=0.2)

# Từ khóa nhận biết câu hỏi về nhiều ngày (tuần qua / mấy ngày qua)
_WEEK_PATTERN = re.compile(
    r"tu[aầ]n\s*(qua|nay|tr[uư][oớ]c)|7\s*ng[aà]y|m[aấ]y\s*ng[aà]y|"
    r"nh[uữ]ng\s*ng[aà]y\s*qua|g[aầ]n\s*[dđ][aâ]y",
    re.IGNORECASE,
)


class PointLookupService:
    async def _extract_location(self, question: str) -> str | None:
        """Dùng LLM trích tên địa danh trong câu hỏi. Trả None nếu không có."""
        prompt = f"""
        Trích xuất TÊN ĐỊA DANH (tỉnh/thành/quận/huyện/phường/xã ở Việt Nam)
        được nhắc tới trong câu hỏi sau. Chỉ trả về JSON đúng định dạng:
        {{"location": "<tên địa danh hoặc null nếu không có>"}}

        Câu hỏi: {question}
        JSON:
        """
        try:
            resp = await llm.ainvoke(prompt)
            content = resp.content.strip()
            match = re.search(r"\{.*\}", content, re.DOTALL)
            if match:
                loc = json.loads(match.group(0)).get("location")
                if loc and str(loc).lower() not in ("null", "none", ""):
                    return str(loc).strip()
        except Exception as e:
            logger.warning(f"Extract location failed: {e}")
        return None

    async def _geocode(self, place: str) -> dict | None:
        """
        Đổi tên địa danh -> toạ độ.
        Ưu tiên Photon (OSM, hỗ trợ tốt phường/xã VN), fallback Open-Meteo.
        """
        geo = await self._geocode_photon(place)
        if geo:
            return geo
        return await self._geocode_openmeteo(place)

    async def _geocode_photon(self, place: str) -> dict | None:
        """
        Photon/OSM: hỗ trợ địa danh cấp phường/xã tiếng Việt.
        Chấm điểm kết quả để ưu tiên đơn vị hành chính (place/boundary) đúng
        tỉnh/thành, tránh chọn nhầm POI/đường trùng tên.
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    settings.PHOTON_API_URL,
                    params={
                        "q": place,
                        "limit": 10,
                        "lang": "default",
                        # Ưu tiên đơn vị hành chính, không lấy nhà/đường
                        "layer": ["locality", "district", "city", "county"],
                    },
                    headers={"User-Agent": "SmartAir/1.0"},
                )
                resp.raise_for_status()
                features = resp.json().get("features") or []

                # Gợi ý tỉnh/thành = phần sau dấu phẩy cuối; lõi = phần đầu (bỏ tiền tố)
                parts = [p.strip() for p in place.split(",") if p.strip()]
                hint = parts[-1].lower() if len(parts) > 1 else ""
                core = parts[0].lower()
                for pre in ("phường", "xã", "quận", "huyện", "thị trấn",
                            "thị xã", "tỉnh", "thành phố", "tp.", "tp"):
                    core = core.replace(pre, "").strip()

                best, best_score = None, -1
                for f in features:
                    p = f.get("properties", {})
                    if p.get("countrycode") != "VN":
                        continue
                    admin = " ".join(
                        str(p.get(k, "")) for k in
                        ("name", "district", "city", "county", "state")
                    ).lower()
                    score = 0
                    if hint and hint in admin:
                        score += 3
                    if p.get("osm_key") in ("place", "boundary"):
                        score += 2
                    if core and core in str(p.get("name", "")).lower():
                        score += 2
                    if score > best_score:
                        best, best_score = f, score

                if best is not None:
                    p = best["properties"]
                    lon, lat = best["geometry"]["coordinates"]  # [lon, lat]
                    label = ", ".join(
                        x for x in (p.get("name"), p.get("district"),
                                    p.get("city")) if x
                    ) or place
                    return {"lat": lat, "lon": lon, "name": label}
        except Exception as e:
            logger.warning(f"Photon geocode '{place}' failed: {e}")
        return None

    async def _geocode_openmeteo(self, place: str) -> dict | None:
        """Fallback: Open-Meteo Geocoding (tốt cho tỉnh/thành, yếu ở phường/xã)."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    settings.GEOCODING_API_URL,
                    params={
                        "name": place,
                        "count": 1,
                        "language": "vi",
                        "format": "json",
                    },
                )
                resp.raise_for_status()
                results = resp.json().get("results") or []
                if results:
                    r = results[0]
                    return {
                        "lat": r["latitude"],
                        "lon": r["longitude"],
                        "name": r.get("name", place),
                    }
        except Exception as e:
            logger.warning(f"Open-Meteo geocode '{place}' failed: {e}")
        return None

    def _resolve_dates(self, question: str, date: str | None) -> list[str]:
        """
        Chọn danh sách ngày (YYYYMMDD) để tra, dựa trên file TIF sẵn có.
        - "tuần qua" -> tối đa 7 ngày trong 7 ngày gần hôm nay nhất.
        - còn lại   -> 1 ngày: date yêu cầu > HÔM NAY > ngày gần hôm nay nhất.

        Lưu ý: get_available_dates() sort GIẢM DẦN nên phần tử [0] là ngày MỚI
        NHẤT (có thể là ngày dự báo xa), KHÔNG phải hôm nay -> phải chọn theo
        ngày thực tế, tránh trả nhầm ngày cuối kỳ dự báo.
        """
        available = [d["date_str"] for d in get_available_dates()]
        if not available:
            return []

        today = datetime.now()

        def days_from_today(d: str) -> int:
            return abs((datetime.strptime(d, "%Y%m%d") - today).days)

        # Nhiều ngày: ưu tiên các ngày trong ±3 ngày quanh hôm nay, tối đa 7 ngày
        if _WEEK_PATTERN.search(question):
            nearest7 = sorted(available, key=days_from_today)[:7]
            return sorted(nearest7)

        # 1 ngày cụ thể do client truyền
        if date and date in available:
            return [date]

        # Mặc định: hôm nay nếu có file, ngược lại ngày gần hôm nay nhất
        today_str = today.strftime("%Y%m%d")
        if today_str in available:
            return [today_str]
        return [min(available, key=days_from_today)]

    async def process(
        self,
        question: str,
        lat: float | None = None,
        lon: float | None = None,
        date: str | None = None,
    ) -> dict:
        # 1. Toạ độ — ƯU TIÊN địa danh nêu trong câu hỏi (vd "phường Thái Bình,
        #    Hưng Yên"); chỉ dùng vị trí user (lat/lon) khi câu KHÔNG nêu địa danh
        #    (vd "chỗ tôi", "vị trí này").
        place_name = "vị trí của bạn"
        place = await self._extract_location(question)
        if place:
            geo = await self._geocode(place)
            if not geo:
                return {"error": f"Không tìm thấy toạ độ cho địa danh '{place}'."}
            lat, lon, place_name = geo["lat"], geo["lon"], geo["name"]
        elif lat is None or lon is None:
            return {
                "error": "Bạn muốn hỏi ô nhiễm ở địa điểm nào? "
                "Vui lòng nêu rõ tên địa danh hoặc chia sẻ vị trí."
            }

        # 2. Ngày
        dates = self._resolve_dates(question, date)
        if not dates:
            return {"error": "Hiện chưa có dữ liệu bản đồ PM2.5 nào."}

        # 3. Đọc PM2.5 tại điểm cho từng ngày
        points = []
        for d in dates:
            try:
                result = read_pm25_at_point(lon, lat, d)
                points.append(result)
            except FileNotFoundError:
                continue
            except Exception as e:
                logger.warning(f"read_pm25_at_point failed for {d}: {e}")

        if not points or all(p.get("pm25") is None for p in points):
            return {
                "error": f"Không có dữ liệu PM2.5 tại {place_name} cho khoảng thời gian này.",
                "points": points,
            }

        # 4. LLM diễn giải
        prompt = f"""
        Địa điểm: {place_name} (lon={lon}, lat={lat})
        Dữ liệu PM2.5/AQI đọc từ bản đồ theo ngày: {points}
        Câu hỏi gốc của người dùng: {question}

        Đóng vai chuyên gia môi trường, diễn giải kết quả trên bằng tiếng Việt,
        dễ hiểu, đi thẳng vào vấn đề. Nếu có nhiều ngày, hãy nêu xu hướng
        (tăng/giảm) và ngày ô nhiễm nhất. Áp dụng thang đo AQI:
        - 0-50: Tốt | 51-100: Trung bình | 101-150: Nhạy cảm
        - 151-200: Không tốt | 201-300: Rất xấu | >300: Nguy hại
        Kết thúc bằng 1 khuyến nghị hành động.
        """
        interpretation = (await llm.ainvoke(prompt)).content

        return {
            "answer": interpretation,
            "points": points,
        }
