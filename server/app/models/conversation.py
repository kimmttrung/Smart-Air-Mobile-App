from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from datetime import datetime
from pydantic import BaseModal  # Giả sử em có Base class

class Conversation(BaseModal):
    __tablename__ = "conversations"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    session_id = Column(String(255), index=True)  # Để phân biệt từng cuộc trò chuyện
    role = Column(String(50))  # "user" hoặc "assistant"
    content = Column(Text)
    metadata = Column(JSON, nullable=True)  # Lưu thêm source, SQL query...
    created_at = Column(DateTime, default=datetime.utcnow)