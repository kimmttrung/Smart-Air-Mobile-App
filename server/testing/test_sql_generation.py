"""
Test pipeline đầy đủ từ câu hỏi của user -> ChatOrchestrator phân loại
(RAG vs SQL) -> nếu SQL thì sinh câu lệnh + chạy thử trên DB thật.

- Nếu route ra RAG: chỉ in ra nhãn, KHÔNG gọi LLM để sinh câu trả lời RAG
  (đỡ tốn quota Gemini, vì RAG đã test ở test_chat_manual.py rồi).
- Nếu route ra SQL: sinh SQL + chạy thử trên DB thật (distric_stats đang
  trống nên kết quả sẽ là "không có dữ liệu", nhưng vậy là pipeline chạy
  đúng tới bước thực thi SQL).

Không cần server đang chạy (gọi trực tiếp orchestrator), chỉ cần .env có
GOOGLE_API_KEY và POSTGRES_* hợp lệ.
"""
import asyncio
import sys
from pathlib import Path

# Cho phép chạy trực tiếp "python testing/test_sql_generation.py" từ thư mục
# server/ mà không cần "-m" — thêm server/ (thư mục cha của testing/) vào sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.postgres_db import init_postgres_pool, close_postgres_pool
from app.services.chat.orchestrator import ChatOrchestrator
from app.services.chat.text_to_sql_service import TextToSQLService

QUESTIONS = [
    "Hà Nội ô nhiễm không khí như thế nào?",
    "Quận/huyện nào ở Hà Nội có AQI trung bình cao nhất?",
    "PM2.5 là gì và tại sao nó nguy hiểm?",
    "Tôi nên làm gì khi chỉ số AQI ở mức 150?",
    "So sánh mức độ ô nhiễm giữa Hà Nội và Đà Nẵng",
]


async def main():
    await init_postgres_pool()
    text_sql = TextToSQLService()

    for q in QUESTIONS:
        print("\n" + "=" * 70)
        print(f"Câu hỏi: {q}")

        intent = await ChatOrchestrator._classify_intent(q)
        print(f"→ Orchestrator phân loại: {intent}")

        if intent == "RAG":
            print("→ Sẽ đi vào RAGService (dừng ở đây, không gọi LLM RAG để đỡ tốn quota)")
            continue

        # intent == SQL: sinh câu lệnh + chạy thử thật trên DB
        result = await text_sql.process(q)
        if "sql" in result:
            print(f"→ SQL sinh ra:\n{result['sql']}")
        if "error" in result:
            print(f"→ Kết quả thực thi: {result['error']}")
        else:
            print(f"→ Data trả về: {result.get('data')}")

    await close_postgres_pool()


if __name__ == "__main__":
    asyncio.run(main())
