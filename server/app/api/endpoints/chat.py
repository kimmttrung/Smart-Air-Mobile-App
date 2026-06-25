from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging

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