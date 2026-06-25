"""
Application configuration and settings
"""
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""
    
    # API Info
    APP_NAME: str = "SmartAQ PM2.5 API"
    APP_VERSION: str = "1.0.0"
    APP_DESCRIPTION: str = "TiTiler-based tile server for PM2.5 GeoTIFF data"
    
    # Server
    # By default, bind to localhost for security. 
    # To expose the server on all interfaces (e.g., for production), set HOST to "0.0.0.0" via environment variable or config file.
    # WARNING: Binding to "0.0.0.0" exposes the server on all network interfaces and may be a security risk in production.
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    DEBUG: bool = True
    RELOAD: bool = True
    
    # CORS
    CORS_ORIGINS: list = ["*"]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: list = ["*"]
    CORS_ALLOW_HEADERS: list = ["*"]
    
    # Data paths
    BASE_DIR: Path = Path(__file__).parent.parent.parent  # Go up to server/ directory
    TIF_DIR: Path = BASE_DIR / "data" / "tif_files"
    
    # PM2.5 Settings
    DEFAULT_COLORMAP: str = "aqi"
    DEFAULT_OPACITY: float = 0.6
    TILE_SIZE: int = 256
    MAX_ZOOM: int = 18
    
    # AQI Breakpoints (US EPA for PM2.5)
    AQI_BREAKPOINTS: list = [
        {"pm_min": 0.0, "pm_max": 25.0, "aqi_min": 0, "aqi_max": 50, "color": (27, 190, 88, 255), "level": "Good"},
        {"pm_min": 25.0, "pm_max": 50.0, "aqi_min": 51, "aqi_max": 100, "color": (255, 255, 0, 255), "level": "Moderate"},
        {"pm_min": 50.0, "pm_max": 80.0, "aqi_min": 101, "aqi_max": 150, "color": (255, 126, 0, 255), "level": "Unhealthy for Sensitive Groups"},
        {"pm_min": 80.0, "pm_max": 150.0, "aqi_min": 151, "aqi_max": 200, "color": (213, 40, 39, 255), "level": "Unhealthy"},
        {"pm_min": 150.0, "pm_max": 250.0, "aqi_min": 201, "aqi_max": 300, "color": (143, 63, 151, 255), "level": "Very Unhealthy"},
        {"pm_min": 250.0, "pm_max": 500.0, "aqi_min": 301, "aqi_max": 500, "color": (126, 0, 35, 255), "level": "Hazardous"},
    ]

    
    # MongoDB Settings (load from .env)
    MONGODB_URL: str = "mongodb://localhost:27017"  # Default fallback
    MONGODB_DB_NAME: str = "smartair"
    
    # JWT Settings (load from .env - SECRET_KEY is required)
    SECRET_KEY: str  # Must be set in .env file
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30 * 24 * 60  # 30 days

    # MinIO Settings (load from .env)
    MINIO_ENDPOINT: str = "112.137.129.244:9001"
    MINIO_ACCESS_KEY: str = ""  # Must be set in .env file
    MINIO_SECRET_KEY: str = ""  # Must be set in .env file
    MINIO_BUCKET: str = "nrt-sci-pm25-map-daily-1km"
    MINIO_SECURE: bool = False

    OPENAI_API_KEY: str = ""  
    LLM_MODEL_v1: str = "gpt-4o-mini" 
    VECTOR_DB_PATH: str = "./data/vector_db"
    KNOWLEDGE_PATH: str = "./data/knowledge"
    EMBEDDING_MODEL: str = "text-embedding-3-small"  # OpenAI

    # LLM provider switch: "gemini" hoặc "groq"
    # Dùng để chuyển đổi khi Gemini free-tier hết quota mà không cần sửa code.
    LLM_PROVIDER: str = "groq"

    # Google Gemini
    GOOGLE_API_KEY: str
    LLM_MODEL: str = "gemini-2.5-flash"

    # Groq (OpenAI-compatible, free tier nhanh/rộng hơn Gemini free-tier)
    # Lấy key tại: https://console.groq.com/keys
    GROQ_API_KEY: str = ""
    LLM_MODEL_GROQ: str = "llama-3.3-70b-versatile"

    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_HOST: str
    POSTGRES_PORT: int
    POSTGRES_DB: str

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"  # Ignore extra fields in .env that aren't in Settings class


# Global settings instance
settings = Settings()
