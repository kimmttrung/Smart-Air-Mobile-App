from app.services.chat.rag_service import RAGService
from app.services.chat.text_to_sql_service import TextToSQLService
from app.services.chat.llm_factory import get_chat_llm
from langchain_core.prompts import PromptTemplate

rag = RAGService()
text_sql = TextToSQLService()

# Dùng LLM để phân loại (rẻ/nhanh, temperature=0)
classifier_llm = get_chat_llm(temperature=0)

class ChatOrchestrator:
    @staticmethod
    async def _classify_intent(question: str) -> str:
        prompt = PromptTemplate.from_template("""
        Bạn là bộ phân loại intent cho chatbot tư vấn chất lượng không khí (ONKK).
        Phân loại câu hỏi của người dùng vào đúng MỘT trong 2 nhãn sau:

        SQL — câu hỏi cần TRA SỐ LIỆU cụ thể từ database (AQI/PM2.5 trung bình, cao nhất,
        thấp nhất theo tỉnh/quận/huyện/phường/xã, so sánh mức độ ô nhiễm giữa các địa phương,
        phân tích/dự báo phơi nhiễm cá nhân theo địa điểm).
        Ví dụ: "Hà Nội ô nhiễm thế nào?", "Quận nào ở TP.HCM có AQI cao nhất?",
        "So sánh PM2.5 giữa Hà Nội và Đà Nẵng".

        RAG — câu hỏi về KIẾN THỨC chung, GIẢI THÍCH/DIỄN GIẢI khái niệm, hoặc TƯ VẤN/
        KHUYẾN NGHỊ hành động liên quan sức khỏe và môi trường, không cần số liệu tra cứu.
        Ví dụ: "PM2.5 là gì?", "Chỉ số AQI 150 có nguy hiểm không?",
        "Tôi nên làm gì khi không khí ô nhiễm?", "Khẩu trang nào lọc bụi mịn tốt?".

        Chỉ trả lời duy nhất một từ: SQL hoặc RAG. Không giải thích thêm.

        Câu hỏi: {question}
        Nhãn:
        """)

        chain = prompt | classifier_llm
        # Dùng ainvoke để chạy bất đồng bộ
        result = (await chain.ainvoke({"question": question})).content.strip().upper()

        if "SQL" in result:
            return "SQL"
        return "RAG"

    @staticmethod
    async def route(question: str):
        intent = await ChatOrchestrator._classify_intent(question)
        if intent == "SQL":
            return "text_to_sql", await text_sql.process(question)
        else:
            return "rag", await rag.query(question) # Nhớ await nếu rag.query là async