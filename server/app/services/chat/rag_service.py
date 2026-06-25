from app.services.chat.llm_factory import get_chat_llm

llm = get_chat_llm(temperature=0.2)

class RAGService:
    def __init__(self):
        pass

    async def query(self, question: str, k: int = 4):
        prompt = f"""a
        Bạn là trợ lý tư vấn về ô nhiễm không khí (ONKK) và sức khỏe.
        Hãy trả lời câu hỏi sau dựa trên kiến thức chung của bạn.
        Nếu không biết, hãy nói không biết và khuyên tham khảo bác sĩ.
        Câu hỏi: {question}
        Trả lời:
        """
        # 👇 Dùng ainvoke
        response = await llm.ainvoke(prompt)
        return {
            "answer": response.content,
            "sources": ["Mock (chưa có vector DB)"],
            "context_used": "Dùng Google Gemini."
        }
