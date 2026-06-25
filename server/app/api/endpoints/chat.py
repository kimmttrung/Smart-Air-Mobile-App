from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging
import time
import uuid

from app.core.config import settings
from app.services.chat.orchestrator import ChatOrchestrator

logger = logging.getLogger(__name__)

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    type: str  # "rag" hoặc "text_to_sql"
    answer: str
    data: Optional[List[Dict[str, Any]]] = None  # text_to_sql trả về list các dòng (rows)
    sources: Optional[List[str]] = None
    sql: Optional[str] = None
    session_id: Optional[str] = None

@router.post("/chat", response_model=ChatResponse, summary="Chat với AI Agent")
async def chat_endpoint(request: ChatRequest):
    """
    Nhận câu hỏi từ người dùng, phân loại và xử lý bằng RAG hoặc Text-to-SQL.
    - Nếu câu hỏi liên quan đến số liệu, dự báo → Text-to-SQL (MongoDB aggregation)
    - Nếu câu hỏi về tư vấn, kiến thức ONKK → RAG
    """
    try:
        # Gọi orchestrator
        agent_type, result = await ChatOrchestrator.route(request.message)
        
        # Nếu có lỗi
        if "error" in result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["error"]
            )
        
        # Trả về response
        return ChatResponse(
            type=agent_type,
            answer=result.get("answer", ""),
            data=result.get("data"),
            sources=result.get("sources"),
            sql=result.get("sql"),
            session_id=request.session_id
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


# =============================================================================
# OpenAI-compatible Chat Completions API
# Cho phép frontend (chatbotService.js) gọi POST /v1/chat/completions như
# một LLM server OpenAI-style, trong khi backend vẫn xử lý bằng
# ChatOrchestrator (RAG / Text-to-SQL) ở trên.
# =============================================================================

class OpenAIChatMessage(BaseModel):
    role: str
    content: str

class OpenAIChatCompletionRequest(BaseModel):
    model: Optional[str] = "smartair-chat"
    messages: List[OpenAIChatMessage]
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 512
    top_k: Optional[int] = 5
    stream: Optional[bool] = False

class OpenAIChoice(BaseModel):
    index: int
    message: OpenAIChatMessage
    finish_reason: str = "stop"

class OpenAIUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0

class OpenAIChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[OpenAIChoice]
    usage: OpenAIUsage

@router.post(
    "/v1/chat/completions",
    response_model=OpenAIChatCompletionResponse,
    summary="OpenAI-compatible Chat Completions (wraps ChatOrchestrator)",
)
async def openai_chat_completions(request: OpenAIChatCompletionRequest):
    user_messages = [m for m in request.messages if m.role == "user"]
    if not user_messages:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No user message found")
    question = user_messages[-1].content

    try:
        agent_type, result = await ChatOrchestrator.route(question)
    except Exception as e:
        logger.error(f"Chat completions error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")

    if "error" in result:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])

    answer = result.get("answer", "")

    return OpenAIChatCompletionResponse(
        id=f"chatcmpl-{uuid.uuid4().hex[:24]}",
        created=int(time.time()),
        model=request.model or "smartair-chat",
        choices=[
            OpenAIChoice(index=0, message=OpenAIChatMessage(role="assistant", content=answer))
        ],
        usage=OpenAIUsage(),
    )

@router.get("/v1/models", summary="List available models (OpenAI-compatible)")
async def list_models():
    return {
        "object": "list",
        "data": [
            {"id": "smartair-chat", "object": "model", "owned_by": "smartair"},
        ],
    }
