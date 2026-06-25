import asyncpg
from app.core.config import settings

pool: asyncpg.Pool = None

async def init_postgres_pool():
    """Khởi tạo connection pool khi app start"""
    global pool
    try:
        pool = await asyncpg.create_pool(
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            database=settings.POSTGRES_DB,
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
            min_size=2,
            max_size=10
        )
        print(f"✅ Connected to PostgreSQL: {settings.POSTGRES_DB}")
    except Exception as e:
        print(f"❌ PostgreSQL connection failed: {e}")
        raise

async def close_postgres_pool():
    """Đóng connection pool khi app shutdown"""
    global pool
    if pool:
        await pool.close()
        print("✅ PostgreSQL connection closed")

def get_pool():
    """Lấy connection pool"""
    return pool