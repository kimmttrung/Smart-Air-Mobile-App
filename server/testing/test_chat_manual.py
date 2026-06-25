"""
Script test thủ công cho /chat endpoint (RAG vs Text-to-SQL routing)
Yêu cầu server đang chạy: python run.py (hoặc uvicorn app.main:app --reload)
"""
import json

import requests

BASE_URL = "http://localhost:8000"

# Câu hỏi mẫu: kỳ vọng route SQL (tra số liệu theo địa danh)
SQL_QUESTIONS = [
    "Hà Nội ô nhiễm không khí như thế nào?",
    "Quận/huyện nào ở Hà Nội có AQI trung bình cao nhất?",
]

# Câu hỏi mẫu: kỳ vọng route RAG (kiến thức / tư vấn)
RAG_QUESTIONS = [
    "PM2.5 là gì và tại sao nó nguy hiểm?",
    "Chỉ số AQI 150 thì tôi nên làm gì?",
]


def print_section(title):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def ask(question: str):
    print(f"\n>>> Câu hỏi: {question}")
    try:
        resp = requests.post(f"{BASE_URL}/chat", json={"message": question}, timeout=60)
    except Exception as e:
        print(f"❌ Không gọi được server: {e}")
        return
    print(f"Status: {resp.status_code}")
    if resp.status_code != 200:
        print(resp.text)
        return
    data = resp.json()
    print(f"Type routed: {data.get('type')}")
    if data.get("sql"):
        print(f"SQL sinh ra:\n{data['sql']}")
    if data.get("data") is not None:
        print(f"Data trả về (rút gọn): {json.dumps(data['data'], ensure_ascii=False)[:300]}")
    print(f"Answer: {data.get('answer')}")


if __name__ == "__main__":
    print_section("SQL-expected questions (tra số liệu theo địa danh)")
    for q in SQL_QUESTIONS:
        ask(q)

    print_section("RAG-expected questions (kiến thức / tư vấn)")
    for q in RAG_QUESTIONS:
        ask(q)
