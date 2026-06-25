"""
Server entry point với tự động check và tải TIF files
"""
import logging
import sys
from datetime import datetime, timedelta
from pathlib import Path

import uvicorn
from app.core.config import settings

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def get_next_10_days():
    """
    Tính toán 10 ngày tiếp theo từ 00:00 hiện tại

    Returns:
        List of date strings in YYYYMMDD format
    """
    today = datetime.now().replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    dates = []

    for i in range(1, 10):  # 10 ngày tiếp theo (từ ngày mai đến +9 ngày)
        date = today + timedelta(days=i)
        date_str = date.strftime('%Y%m%d')
        dates.append(date_str)

    return dates


def check_tif_files_available():
    """
    Kiểm tra xem đã có đủ 10 ngày TIF files tiếp theo chưa

    Returns:
        tuple: (has_all_files: bool, missing_dates: list)
    """
    if not settings.TIF_DIR.exists():
        return False, []

    dates = get_next_10_days()
    missing_dates = []

    for date_str in dates:
        # Kiểm tra cả 2 format: ưu tiên 1km, chấp nhận 3km
        file_1km = settings.TIF_DIR / f'PM25_{date_str}_1kmNRT.tif'
        file_3km = settings.TIF_DIR / f'PM25_{date_str}_3kmNRT.tif'

        # Nếu không có file nào (1km hoặc 3km) thì cần tải
        if not file_1km.exists() and not file_3km.exists():
            missing_dates.append(date_str)

    has_all = len(missing_dates) == 0
    return has_all, missing_dates


def ensure_tif_files():
    """
    Đảm bảo có đủ 10 ngày TIF files tiếp theo
    Tự động tải nếu thiếu
    """
    logger.info('🔍 Kiểm tra TIF files...')
    logger.info(f'📁 Thư mục TIF: {settings.TIF_DIR}')

    # Tạo thư mục nếu chưa tồn tại
    settings.TIF_DIR.mkdir(parents=True, exist_ok=True)
    logger.info(f'✅ Thư mục TIF đã sẵn sàng: {settings.TIF_DIR.exists()}')

    # Kiểm tra files
    has_all, missing_dates = check_tif_files_available()
    logger.info(
        f'📊 Kết quả check: has_all={has_all}, '
        f'missing_count={len(missing_dates)}'
    )

    if has_all:
        logger.info('✅ Đã có đủ 10 ngày TIF files tiếp theo')
        return

    logger.warning(
        f'⚠️  Thiếu {len(missing_dates)} file TIF: '
        f'{missing_dates[:3] if len(missing_dates) > 3 else missing_dates}...'
    )

    # Thử import và download
    try:
        # Kiểm tra dependencies trước
        try:
            import minio  # noqa: F401
            from dotenv import load_dotenv  # noqa: F401
            logger.debug('✅ Dependencies (minio, python-dotenv) đã sẵn sàng')
        except ImportError as deps_err:
            logger.error(
                f'❌ Thiếu dependencies: {deps_err}'
            )
            logger.error(
                '💡 Hãy cài đặt: pip install minio python-dotenv'
            )
            return

        # Import từ tools
        sys.path.insert(0, str(Path(__file__).parent))
        from tools.tif_downloader import download_tif_files

        logger.info('📥 Bắt đầu tải TIF files thiếu...')
        logger.info(f'📋 Danh sách ngày cần tải: {missing_dates}')
        download_tif_files()
        logger.info('✅ Hoàn thành tải TIF files')

    except ImportError as e:
        logger.error(
            f'❌ Không thể import download tool: {e}'
        )
        logger.error(
            '💡 Hãy kiểm tra: '
            '1. Đã cài đặt minio và python-dotenv chưa? '
            '(pip install minio python-dotenv) '
            '2. File .env có tồn tại và có credentials chưa?'
        )
    except ValueError as e:
        # ValueError từ download_tif_files khi thiếu credentials
        logger.error(f'❌ {e}')
        logger.error(
            '💡 Vui lòng kiểm tra file .env và set đầy đủ '
            'MINIO_ACCESS_KEY và MINIO_SECRET_KEY'
        )
    except Exception as e:
        logger.error(
            f'❌ Lỗi khi tải TIF files: {e}',
            exc_info=True  # Log full traceback để debug
        )
        logger.error(
            '💡 Server vẫn sẽ chạy bình thường, '
            'nhưng có thể thiếu TIF files.'
        )


if __name__ == "__main__":
    # Tự động check và tải TIF files khi start server
    logger.info('=' * 60)
    logger.info('🚀 Khởi động server...')
    logger.info('=' * 60)
    
    try:
        ensure_tif_files()
    except Exception as e:
        logger.error(
            f'❌ Lỗi khi check TIF files: {e}',
            exc_info=True  # Log full traceback
        )
        logger.error(
            '💡 Server vẫn sẽ chạy bình thường, '
            'nhưng có thể thiếu TIF files.'
        )

    logger.info('=' * 60)
    logger.info('🌐 Đang khởi động FastAPI server...')
    logger.info(f'📍 URL: http://{settings.HOST}:{settings.PORT}')
    logger.info('=' * 60)

    # Khởi động server
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.RELOAD,
        log_level="info"
    )
