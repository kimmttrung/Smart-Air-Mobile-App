"""
RAG service — trả lời câu hỏi giải thích/diễn giải dữ liệu ô nhiễm, sức khỏe,
tác động AQI dựa trên vector database (host ngoài).

Vector DB (FastAPI) — xem http://112.137.129.163:8001/docs :
    POST {VECTOR_DB_URL}/api/v1/search?top_k=N   body {"query": "..."}
      -> {"results": [{"score": float, "text": str}, ...]}
    GET  {VECTOR_DB_URL}/api/v1/health
"""
from __future__ import annotations

import logging

import httpx
from app.core.config import settings
from app.services.chat.llm_factory import get_chat_llm

logger = logging.getLogger(__name__)

llm = get_chat_llm(temperature=0.2)


class RAGService:
    def __init__(self):
        self.base_url = settings.VECTOR_DB_URL.rstrip("/")

    async def _search(self, query: str, top_k: int) -> list[dict]:
        """Gọi vector DB lấy các đoạn văn bản liên quan nhất."""
        url = f"{self.base_url}/api/v1/search"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                url,
                params={"top_k": top_k},
                json={"query": query},
            )
            resp.raise_for_status()
            return resp.json().get("results", [])

    async def health(self) -> bool:
        """Kiểm tra vector DB có sống không (dùng cho /chat/health)."""
        url = f"{self.base_url}/api/v1/health"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(url)
                return resp.status_code == 200
        except Exception as e:
            logger.warning(f"Vector DB health check failed: {e}")
            return False

    async def query(self, question: str, k: int | None = None) -> dict:
        top_k = k or settings.VECTOR_DB_TOP_K

        try:
            results = await self._search(question, top_k)
        except Exception as e:
            logger.error(f"Vector DB search failed: {e}")
            results = []

        if results:
            context = "\n\n".join(
                f"[{i + 1}] {r.get('text', '')}" for i, r in enumerate(results)
            )
            prompt = f"""
            Bạn là trợ lý tư vấn về ô nhiễm không khí (ONKK) và sức khỏe.
            Hãy trả lời câu hỏi CHỈ dựa trên các đoạn tài liệu tham khảo dưới đây.
            Nếu tài liệu không đủ thông tin, hãy nói rõ và khuyên tham khảo bác sĩ/chuyên gia.
            Trả lời ngắn gọn, dễ hiểu bằng tiếng Việt.

            ### TÀI LIỆU THAM KHẢO ###
            {context}

            ### CÂU HỎI ###
            {question}

            ### TRẢ LỜI ###
            """
            sources = [
                {"text": r.get("text", ""), "score": r.get("score")}
                for r in results
            ]
        else:
            # Fallback khi vector DB lỗi/không có kết quả — vẫn trả lời bằng kiến thức LLM
            prompt = f"""
            Bạn là trợ lý tư vấn về ô nhiễm không khí (ONKK) và sức khỏe.
            Hãy trả lời câu hỏi sau dựa trên kiến thức chung của bạn.
            Nếu không chắc chắn, hãy khuyên tham khảo bác sĩ/chuyên gia.
            Trả lời ngắn gọn, dễ hiểu bằng tiếng Việt.

            Câu hỏi: {question}
            Trả lời:
            """
            sources = []

        response = await llm.ainvoke(prompt)
        return {
            "answer": response.content,
            "sources": sources,
        }
