from __future__ import annotations

from app.services.chat.rag_service import RAGService
from app.services.chat.text_to_sql_service import TextToSQLService
from app.services.chat.point_lookup_service import PointLookupService
from app.services.chat.llm_factory import get_chat_llm
from langchain_core.prompts import PromptTemplate

rag = RAGService()
text_sql = TextToSQLService()
point_lookup = PointLookupService()

# Dùng LLM để phân loại (rẻ/nhanh, temperature=0)
classifier_llm = get_chat_llm(temperature=0)


class ChatOrchestrator:
    @staticmethod
    async def _classify_intent(question: str) -> str:
        prompt = PromptTemplate.from_template("""
        Bạn là bộ phân loại intent cho chatbot tư vấn chất lượng không khí (ONKK).
        Phân loại câu hỏi của người dùng vào đúng MỘT trong 3 nhãn sau:

        SQL — câu hỏi cần TRA SỐ LIỆU THỐNG KÊ từ database theo đơn vị hành chính:
        AQI/PM2.5 trung bình, tổng, cao nhất/thấp nhất theo tỉnh/quận/huyện/phường/xã,
        SO SÁNH mức độ ô nhiễm GIỮA CÁC KHU VỰC.
        Ví dụ: "Quận nào ở Hà Nội ô nhiễm nhất?", "So sánh AQI Hà Nội và Đà Nẵng",
        "AQI trung bình của tỉnh Cao Bằng là bao nhiêu?".

        POINT — câu hỏi về mức ô nhiễm TẠI MỘT ĐỊA ĐIỂM/VỊ TRÍ CỤ THỂ ở thời điểm
        hiện tại, hôm nay, hoặc trong tuần qua (đọc trực tiếp từ bản đồ).
        Ví dụ: "AQI chỗ tôi bây giờ thế nào?", "Không khí ở Cầu Giấy hôm nay ra sao?",
        "Mức độ ô nhiễm tại vị trí này trong tuần qua?".

        RAG — câu hỏi về KIẾN THỨC chung, GIẢI THÍCH/DIỄN GIẢI khái niệm, tác động
        sức khỏe, hoặc TƯ VẤN hành động, KHÔNG cần số liệu tra cứu.
        Ví dụ: "PM2.5 là gì?", "AQI 150 ảnh hưởng sức khỏe thế nào?",
        "Tôi nên làm gì khi không khí ô nhiễm?".

        Chỉ trả lời duy nhất một từ: SQL, POINT hoặc RAG. Không giải thích thêm.

        Câu hỏi: {question}
        Nhãn:
        """)

        chain = prompt | classifier_llm
        result = (await chain.ainvoke({"question": question})).content.strip().upper()

        if "SQL" in result:
            return "SQL"
        if "POINT" in result:
            return "POINT"
        return "RAG"

    @staticmethod
    async def route(
        question: str,
        lat: float | None = None,
        lon: float | None = None,
        date: str | None = None,
    ):
        intent = await ChatOrchestrator._classify_intent(question)
        if intent == "SQL":
            return "text_to_sql", await text_sql.process(question)
        if intent == "POINT":
            return "point_lookup", await point_lookup.process(question, lat, lon, date)
        return "rag", await rag.query(question)
