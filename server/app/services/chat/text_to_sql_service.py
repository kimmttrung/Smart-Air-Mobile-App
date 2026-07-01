import re
import asyncpg
from langchain_core.prompts import PromptTemplate
from app.db.postgres_db import get_pool
from app.services.chat.llm_factory import get_chat_llm

llm = get_chat_llm(temperature=0.2)

class TextToSQLService:
    def __init__(self):
        # 👇 PROMPT ĐÃ ĐƯỢC NÂNG CẤP (Thêm DDL, Rules và xử lý bảng districts chứa cả Phường)
        self.sql_prompt = PromptTemplate.from_template("""
        Bạn là chuyên gia PostgreSQL. Nhiệm vụ: Chuyển câu hỏi tiếng Việt thành câu lệnh SQL hợp lệ.

        ### DATABASE SCHEMA ###
        CREATE TABLE provinces (
            id TEXT PRIMARY KEY,
            name_vi TEXT, -- Tên tỉnh/TP (VD: 'Thành phố Hà Nội')
            type_vi TEXT  -- Loại (VD: 'thành phố trung ương', 'tỉnh')
        );

        CREATE TABLE districts (
            id TEXT PRIMARY KEY,
            province_id TEXT REFERENCES provinces(id),
            name_vi TEXT, -- Tên đơn vị hành chính (VD: 'Phường Ba Đình', 'Quận Hoàn Kiếm')
            type_vi TEXT  -- Loại (VD: 'phường', 'quận', 'huyện', 'thị xã')
        );
        -- ⚠️ LƯU Ý QUAN TRỌNG: Bảng districts đang chứa dữ liệu của CẢ PHƯỜNG/XÃ.

        CREATE TABLE distric_stats (
            id INTEGER PRIMARY KEY,
            district_id TEXT REFERENCES districts(id),
            category_id TEXT,
            num INTEGER,
            val_sum_pm25 DOUBLE PRECISION,
            val_avg_pm25 DOUBLE PRECISION,
            val_sum_aqi INTEGER,
            val_avg_aqi INTEGER -- Chỉ số AQI trung bình
        );

        ### RULES (QUY TẮC BẮT BUỘC) ###
        1. JOIN: distric_stats.district_id = districts.id VÀ districts.province_id = provinces.id.
        2. Khi hỏi về "Tỉnh" hoặc "Thành phố", tìm ở bảng provinces.
        3. Khi hỏi về "Quận/Huyện", filter districts.type_vi IN ('quận', 'huyện', 'thị xã'). 
           Khi hỏi về "Phường/Xã", filter districts.type_vi = 'phường' (hoặc 'xã', 'thị trấn').
        4. Nếu người dùng hỏi "Nơi nào ô nhiễm nhất", hãy ORDER BY val_avg_aqi DESC hoặc val_avg_pm25 DESC.
        5. Chỉ trả về duy nhất câu lệnh SQL, KHÔNG giải thích, KHÔNG bọc trong markdown (```).

        Câu hỏi: {question}
        SQL:
        """)
        
        # 👇 PROMPT DIỄN GIẢI ĐÃ THÊM THANG ĐO AQI
        self.interpret_prompt = PromptTemplate.from_template("""
        Dữ liệu trả về từ câu lệnh SQL: {sql_result}
        Câu hỏi gốc của người dùng: {question}
        
        Hãy đóng vai trò là chuyên gia môi trường, giải thích kết quả trên một cách dễ hiểu bằng tiếng Việt. 
        Áp dụng thang đo AQI để nhận xét mức độ ô nhiễm:
        - 0-50: Tốt (Màu xanh)
        - 51-100: Trung bình (Màu vàng)
        - 101-200: Kém (Màu cam - Nhóm nhạy cảm cần hạn chế ra ngoài)
        - 201-300: Xấu (Màu đỏ - Mọi người nên hạn chế ra ngoài)
        - >300: Nguy hại (Màu tím - Cảnh báo khẩn cấp)
        
        Trả lời ngắn gọn, đi thẳng vào vấn đề và đưa ra 1 khuyến nghị hành động.
        """)

    @staticmethod
    def _is_safe_select(sql: str) -> bool:
        """Chỉ cho phép 1 câu lệnh đọc (SELECT/WITH), chặn từ khóa ghi/DDL."""
        cleaned = sql.strip().rstrip(";").strip()
        if not cleaned:
            return False
        lowered = cleaned.lower()
        if not (lowered.startswith("select") or lowered.startswith("with")):
            return False
        # Chặn nhiều câu lệnh và các từ khóa nguy hiểm
        if ";" in cleaned:
            return False
        forbidden = (
            "insert", "update", "delete", "drop", "alter", "truncate",
            "create", "grant", "revoke", "copy", "merge",
        )
        return not any(re.search(rf"\b{kw}\b", lowered) for kw in forbidden)

    async def process(self, question: str):
        # 1. Tạo SQL
        chain = self.sql_prompt | llm
        sql_query = (await chain.ainvoke({"question": question})).content.strip()
        
        # 👇 Dùng Regex để làm sạch SQL an toàn hơn (Xử lý cả khi LLM thừa text trước/sau markdown)
        match = re.search(r"```(?:sql)?\n(.*?)\n```", sql_query, re.DOTALL | re.IGNORECASE)
        if match:
            sql_query = match.group(1).strip()
        else:
            # Nếu không có markdown, cứ lấy nguyên xi (vì prompt đã cấm markdown)
            sql_query = sql_query.replace("```sql", "").replace("```", "").strip()

        # 2. Chặn an toàn: chỉ cho phép câu lệnh đọc (SELECT/WITH)
        if not self._is_safe_select(sql_query):
            return {
                "error": "Chỉ hỗ trợ truy vấn đọc dữ liệu (SELECT).",
                "sql": sql_query,
            }

        # 3. Truy vấn Database
        pool = get_pool()
        if not pool:
            return {"error": "Database connection is not initialized", "sql": sql_query}

        try:
            async with pool.acquire() as conn:
                records = await conn.fetch(sql_query)
                data = [dict(record) for record in records]
                
            if not data:
                return {"error": "Truy vấn thành công nhưng không có dữ liệu phù hợp.", "sql": sql_query}
                
        except asyncpg.exceptions.PostgresError as e:
            return {"error": f"Lỗi SQL: {str(e)}", "sql": sql_query}
        except Exception as e:
            return {"error": f"Lỗi không xác định: {str(e)}", "sql": sql_query}

        # 4. Diễn giải kết quả (Truyền thêm cả 'question' để LLM hiểu ngữ cảnh)
        interpret_chain = self.interpret_prompt | llm
        interpretation = (await interpret_chain.ainvoke({
            "sql_result": str(data), 
            "question": question
        })).content
        
        return {
            "answer": interpretation,
            "sql": sql_query,
            "data": data
        }
