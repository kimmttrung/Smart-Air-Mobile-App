# Tools Directory

Thư mục chứa các công cụ tiện ích cho server.

## tif_downloader.py

Tool tự động tải ảnh TIF từ MinIO cho 7 ngày tiếp theo (tính từ 00:00 hiện tại).

**⚠️ LƯU Ý BẢO MẬT**: Credentials được lưu trong file `.env`, không hardcode trong code!

### Cài đặt

1. Cài đặt dependencies:
```bash
pip install minio
```

Hoặc cài đặt tất cả dependencies:
```bash
pip install -r requirements.txt
```

### Cấu hình

**⚠️ QUAN TRỌNG: Credentials được lưu trong file `.env` để bảo mật**

1. Tạo file `.env` trong thư mục `server/`:
```bash
cd server
touch .env  # hoặc tạo file .env thủ công
```

2. Thêm các biến môi trường sau vào file `server/.env`:
```env
# MinIO Configuration for TIF Downloader
MINIO_ENDPOINT=112.137.129.244:9001
MINIO_ACCESS_KEY=your_access_key_here
MINIO_SECRET_KEY=your_secret_key_here
MINIO_BUCKET=nrt-sci-pm25-map-daily-1km
MINIO_SECURE=false
```

3. Đảm bảo file `.env` không được commit vào git (đã có trong `.gitignore`)

**Lưu ý**: 
- Không được hardcode credentials trong code!
- Tool sẽ đọc trực tiếp từ file `.env` trong thư mục `server/`
- Nếu không có file `.env`, tool sẽ sử dụng giá trị mặc định (nhưng sẽ báo lỗi nếu thiếu ACCESS_KEY hoặc SECRET_KEY)

### Format file trong MinIO

Tool giả định format file trong MinIO là:
```
YYYYMMDD/PM25_YYYYMMDD_1kmNRT.tif
```

Ví dụ: `20251228/PM25_20251228_1kmNRT.tif`

Nếu format khác, chỉnh sửa hàm `get_minio_file_path()` trong file.

### Cách sử dụng

#### Windows:
```bash
cd server
python -m tools.tif_downloader
```

#### Linux/Mac:
```bash
cd server
python -m tools.tif_downloader

# Hoặc chạy trực tiếp (sau khi chmod +x)
chmod +x tools/tif_downloader.py
./tools/tif_downloader.py
```

### Tính năng

- ✅ Tự động tính 7 ngày tiếp theo từ 00:00 hiện tại
- ✅ Tự động ghi đè file nếu đã tồn tại
- ✅ Tải file từ MinIO và lưu vào `server/data/tif_files/`
- ✅ Log chi tiết quá trình tải
- ✅ Xử lý lỗi và báo cáo tổng kết
- ✅ **Scheduler tự động chạy mỗi ngày lúc 00:00** (xem phần dưới)

### Output

Files được lưu vào: `server/data/tif_files/`

Format tên file: `PM25_YYYYMMDD_1kmNRT.tif`

Ví dụ: `PM25_20251228_1kmNRT.tif`

### Lưu ý

- **File sẽ tự động ghi đè**: Nếu file đã tồn tại trong thư mục local, tool sẽ tự động tải và ghi đè file mới lên file cũ
- Nếu file không tồn tại trong MinIO, tool sẽ log warning và tiếp tục với file tiếp theo
- Đảm bảo có quyền ghi vào thư mục `server/data/tif_files/`

---

## Scheduler Mode

Tool có thể chạy ở chế độ scheduler tự động mỗi ngày lúc 00:00.

### Cách sử dụng Scheduler

#### Windows:
```bash
cd server
python -m tools.tif_downloader --scheduler
```

#### Linux/Mac:
```bash
cd server
python -m tools.tif_downloader --scheduler

# Hoặc chạy trực tiếp (sau khi chmod +x)
chmod +x tools/tif_downloader.py
./tools/tif_downloader.py --scheduler
```

### Tính năng Scheduler

- ✅ Tự động chạy mỗi ngày lúc 00:00 (đầu ngày)
- ✅ Log chi tiết vào file `download_tif_scheduler.log`
- ✅ Hiển thị thời gian còn lại đến lần chạy tiếp theo
- ✅ Chạy liên tục trong background (nhấn Ctrl+C để dừng)

### Log

Scheduler sẽ tạo file log: `server/download_tif_scheduler.log`

### Chạy như Windows Service (Tùy chọn)

Để chạy scheduler như một Windows Service tự động khởi động khi boot:

1. Sử dụng **NSSM (Non-Sucking Service Manager)**:
   - Download: https://nssm.cc/download
   - Cài đặt service:
     ```cmd
     nssm install TIFDownloadScheduler "C:\Python\python.exe" "-m" "tools.scheduler_download_tif"
     nssm set TIFDownloadScheduler AppDirectory "C:\path\to\server"
     nssm start TIFDownloadScheduler
     ```

2. Hoặc sử dụng **Task Scheduler** (Windows):
   - Mở Task Scheduler
   - Tạo task mới → Trigger: Daily at 00:00
   - Action: Start a program
   - Program: `python`
   - Arguments: `-m tools.scheduler_download_tif`
   - Start in: `C:\path\to\server`

### Chạy như Linux Systemd Service (Tùy chọn)

Tạo file `/etc/systemd/system/tif-download-scheduler.service`:

```ini
[Unit]
Description=TIF Download Scheduler
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/server
ExecStart=/usr/bin/python3 -m tools.scheduler_download_tif
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Sau đó:
```bash
sudo systemctl daemon-reload
sudo systemctl enable tif-download-scheduler
sudo systemctl start tif-download-scheduler
```

