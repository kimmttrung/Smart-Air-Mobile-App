from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging
import time
import uuid

from app.core.config import settings
from app.services.chat.orchestrator import (ChatOrchestrator, rag as rag_service,
                                            text_sql as text_to_sql_service,
                                            point_lookup as point_lookup_service)
from app.services.geotiff_service import get_available_dates
from app.db.postgres_db import get_pool

logger = logging.getLogger(__name__)

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    lat: Optional[float] = None   # vị trí user (cho tool point-lookup)
    lon: Optional[float] = None
    date: Optional[str] = None    # YYYYMMDD, mặc định ngày mới nhất

class ChatResponse(BaseModel):
    type: str  # "rag" | "text_to_sql" | "point_lookup"
    answer: str
    data: Optional[List[Dict[str, Any]]] = None    # text_to_sql: các dòng (rows)
    points: Optional[List[Dict[str, Any]]] = None  # point_lookup: PM2.5 theo ngày
    sources: Optional[List[Dict[str, Any]]] = None # rag: các đoạn tham khảo + score
    sql: Optional[str] = None
    session_id: Optional[str] = None

@router.post("/chat", response_model=ChatResponse, summary="Chat với AI Agent")
async def chat_endpoint(request: ChatRequest):
    """
    Nhận câu hỏi, phân loại intent và định tuyến tới 1 trong 3 tool:
    - RAG (kiến thức/giải thích/tác động sức khỏe) → vector DB
    - Text-to-SQL (thống kê/so sánh theo tỉnh/quận/phường) → PostgreSQL
    - Point-lookup (AQI tại 1 địa điểm, hôm nay/tuần qua) → đọc trực tiếp .tif
    """
    try:
        agent_type, result = await ChatOrchestrator.route(
            request.message,
            lat=request.lat,
            lon=request.lon,
            date=request.date,
        )

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
            points=result.get("points"),
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
# Direct tool endpoints — gọi thẳng từng tool (tiện test & cho frontend chủ động)
# =============================================================================

@router.post("/chat/rag", response_model=ChatResponse, summary="Chỉ chạy RAG")
async def chat_rag(request: ChatRequest):
    result = await rag_service.query(request.message)
    if "error" in result:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])
    return ChatResponse(
        type="rag",
        answer=result.get("answer", ""),
        sources=result.get("sources"),
        session_id=request.session_id,
    )


@router.post("/chat/sql", response_model=ChatResponse, summary="Chỉ chạy Text-to-SQL")
async def chat_sql(request: ChatRequest):
    result = await text_to_sql_service.process(request.message)
    if "error" in result:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])
    return ChatResponse(
        type="text_to_sql",
        answer=result.get("answer", ""),
        data=result.get("data"),
        sql=result.get("sql"),
        session_id=request.session_id,
    )


@router.post("/chat/point", response_model=ChatResponse, summary="Chỉ chạy Point-lookup")
async def chat_point(request: ChatRequest):
    result = await point_lookup_service.process(
        request.message, lat=request.lat, lon=request.lon, date=request.date
    )
    if "error" in result:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])
    return ChatResponse(
        type="point_lookup",
        answer=result.get("answer", ""),
        points=result.get("points"),
        session_id=request.session_id,
    )


@router.get("/chat/health", summary="Kiểm tra các phụ thuộc của chatbot")
async def chat_health():
    """Trạng thái vector DB, PostgreSQL và số file .tif sẵn có."""
    vector_ok = await rag_service.health()
    pg_ok = get_pool() is not None
    tif_count = len(get_available_dates())
    return {
        "status": "ok" if (vector_ok and pg_ok and tif_count > 0) else "degraded",
        "vector_db": vector_ok,
        "postgres": pg_ok,
        "tif_dates_available": tif_count,
    }


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
    # Mở rộng ngoài chuẩn OpenAI: vị trí user cho tool point-lookup
    lat: Optional[float] = None
    lon: Optional[float] = None
    date: Optional[str] = None

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

    logger.info(f"completions: lat={request.lat} lon={request.lon} date={request.date}")

    try:
        agent_type, result = await ChatOrchestrator.route(
            question, lat=request.lat, lon=request.lon, date=request.date
        )
    except Exception as e:
        logger.error(f"Chat completions error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")

    # Trong giao diện chat, lỗi tool (vd thiếu vị trí) trả về như câu trả lời
    # bình thường (200) để app hiển thị thân thiện, không phải bubble lỗi 400.
    answer = result.get("error") or result.get("answer", "")

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
