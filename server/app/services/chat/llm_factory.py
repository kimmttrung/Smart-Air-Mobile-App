"""
Factory tạo Chat LLM dùng chung cho orchestrator/rag/text_to_sql.
Chọn provider (Gemini hoặc Groq) dựa trên settings.LLM_PROVIDER trong .env,
để chuyển đổi khi Gemini free-tier hết quota mà không cần sửa code.
"""
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq

from app.core.config import settings

def get_chat_llm(temperature: float = 0.2) -> BaseChatModel:
    provider = settings.LLM_PROVIDER.lower()

    if provider == "groq":
        return ChatGroq(
            model=settings.LLM_MODEL_GROQ,
            api_key=settings.GROQ_API_KEY,
            temperature=temperature,
        )

    return ChatGoogleGenerativeAI(
        model=settings.LLM_MODEL,
        api_key=settings.GOOGLE_API_KEY,
        temperature=temperature,
    )
