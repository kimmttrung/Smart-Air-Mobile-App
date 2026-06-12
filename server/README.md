# SmartAir Backend API Server

FastAPI-based backend server for SmartAir mobile app. Provides PM2.5/AQI data, map tiles, forecasts, user authentication, and health analytics.

## Project Structure

```
server/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── api/
│   │   ├── __init__.py
│   │   └── endpoints/
│   │       ├── __init__.py
│   │       └── pm25.py      # PM2.5 endpoints
│   ├── core/
│   │   ├── __init__.py
│   │   └── config.py        # Configuration & settings
│   ├── models/              # Data models (Pydantic)
│   ├── services/
│   │   ├── __init__.py
│   │   ├── aqi_service.py   # AQI calculation
│   │   ├── geotiff_service.py  # GeoTIFF file management
│   │   └── tile_service.py  # Tile rendering
│   └── utils/               # Utility functions
├── data/
│   └── tif_files/           # GeoTIFF data files
│       └── PM25_YYYYMMDD_3kmNRT.tif
├── scripts/
│   └── download_pm25.py     # Data download script
├── requirements.txt
├── run.py                   # Server entry point
├── .env                     # Environment variables
└── README.md
```

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create `.env` file (optional):
```env
HOST=0.0.0.0
PORT=8000
DEBUG=True
TIF_DIR=data/tif_files
```

## Usage

### Start Server

```bash
# Method 1: Using run.py
python run.py
```

### API Endpoints

#### Core Endpoints
- **Root**: `GET /` - API information and status
- **Health Check**: `GET /health` - Server health status
- **API Docs**: `GET /docs` - Interactive Swagger UI documentation
- **OpenAPI Schema**: `GET /openapi.json` - API schema

#### PM2.5 & AQI Data
- **Available Dates**: `GET /pm25/dates` - List of available GeoTIFF dates
- **Point Query**: `GET /pm25/point?lon=105.8&lat=21.0&date=20251202` 
  - Get PM2.5 value and AQI at specific coordinates
  - Returns: `{ "pm25": float, "aqi": int, "category": string, "date": string }`
- **Forecast**: `GET /pm25/forecast?lat=21.0&lon=105.8&days=7`
  - Get PM2.5 forecast for multiple days
  - Returns array of daily forecasts with current + future predictions
- **Map Tiles**: `GET /pm25/tiles/{z}/{x}/{y}.png?date=20251202&colormap_name=aqi`
  - Get map tiles for visualization
  - Supports custom colormaps: `aqi` (default), `viridis`, `plasma`, `jet`

#### Statistics & Analytics
- **Location Stats**: `GET /location/stats?days=30`
  - Get aggregated statistics (avg_aqi, avg_pm25, max, min)
  - Pre-calculated for performance
  - Used by mobile app for historical analysis

#### Authentication & User Management
- **Register**: `POST /auth/register`
  - Body: `{ "email": string, "username": string, "password": string, "profile": object }`
  - Creates new user account
- **Login**: `POST /auth/login`
  - Body: `{ "username": string, "password": string }`
  - Returns: `{ "token": string, "user": object }`
- **Get Profile**: `GET /auth/profile/{uid}`
  - Get user profile information

#### Health Data
- **Save Exposure**: `POST /health/exposure`
  - Save user's PM2.5 exposure data
  - Body: `{ "uid": string, "timestamp": string, "pm25": float, "aqi": int }`
- **Get History**: `GET /health/exposure/history?uid={uid}&start={date}&end={date}`
  - Get user's exposure history for date range
  - Used for analytics and visualizations

### Download PM2.5 Data

```bash
# Download for specific date
python scripts/download_pm25.py 20251202

# Download from URL
python scripts/download_pm25.py --url "http://..."

# Download last 7 days
python scripts/download_pm25.py --last-n-days 7
```

## Features

### Data & Processing
- ✅ PM2.5 to AQI conversion (US EPA standard with 6 ranges)
- ✅ GeoTIFF data management for satellite PM2.5 data
- ✅ Multi-day forecast support (1-7 days)
- ✅ Location-based statistics aggregation
- ✅ Real-time point queries for any coordinate

### Map Visualization
- ✅ Map tile generation with custom colormaps
- ✅ AQI colormap optimized for air quality
- ✅ Support for matplotlib colormaps (viridis, plasma, jet, etc.)
- ✅ XYZ tile standard for seamless map integration

### Backend Architecture
- ✅ FastAPI with async/await support
- ✅ Modular service-based architecture
- ✅ Type safety with Pydantic models
- ✅ Comprehensive error handling and logging
- ✅ CORS enabled for mobile & web clients

### User & Health
- ✅ JWT-based authentication
- ✅ User profile management
- ✅ Exposure history tracking
- ✅ Health analytics data storage

### Developer Experience
- ✅ Interactive API documentation (Swagger UI at `/docs`)
- ✅ Auto-generated OpenAPI schema
- ✅ Easy deployment with uvicorn
- ✅ Environment-based configuration

## Configuration

Edit `app/core/config.py` or use environment variables:

- `APP_NAME`: Application name
- `HOST`: Server host (default: 0.0.0.0)
- `PORT`: Server port (default: 8000)
- `TIF_DIR`: Path to GeoTIFF files directory
- `DEFAULT_COLORMAP`: Default colormap (default: aqi)
- `CORS_ORIGINS`: Allowed CORS origins

## Development

### Adding New Endpoints

1. Create endpoint file in `app/api/endpoints/`
2. Define router and endpoints
3. Register in `app/api/__init__.py`

### Adding New Services

1. Create service file in `app/services/`
2. Implement service functions
3. Export in `app/services/__init__.py`

## API Response Examples

### Point Query Response
```json
{
  "pm25": 45.3,
  "aqi": 124,
  "category": "Unhealthy for Sensitive Groups",
  "date": "20251206",
  "coordinates": {
    "lon": 105.8,
    "lat": 21.0
  }
}
```

### Forecast Response
```json
{
  "location": { "lat": 21.0, "lon": 105.8 },
  "forecasts": [
    {
      "date": "2025-12-06",
      "pm25": 45.3,
      "aqi": 124,
      "category": "Unhealthy for Sensitive Groups"
    },
    {
      "date": "2025-12-07",
      "pm25": 38.2,
      "aqi": 108,
      "category": "Unhealthy for Sensitive Groups"
    }
  ]
}
```

### Location Stats Response
```json
{
  "days": 30,
  "avg_pm25": 42.5,
  "avg_aqi": 118,
  "max_pm25": 87.3,
  "min_pm25": 12.1,
  "max_aqi": 165,
  "min_aqi": 50
}
```

## AQI Calculation

EPA AQI Standard with 6 concentration ranges:

| AQI Range | PM2.5 (µg/m³) | Category |
|-----------|---------------|----------|
| 0-50 | 0.0-12.0 | Good |
| 51-100 | 12.1-35.4 | Moderate |
| 101-150 | 35.5-55.4 | Unhealthy for Sensitive Groups |
| 151-200 | 55.5-150.4 | Unhealthy |
| 201-300 | 150.5-250.4 | Very Unhealthy |
| 301-500 | 250.5-500.4 | Hazardous |

Formula: Linear interpolation between breakpoints
```python
AQI = ((I_high - I_low) / (C_high - C_low)) * (C - C_low) + I_low
```

## Performance Considerations

- **Caching**: Consider implementing Redis for frequently accessed data
- **Tile Caching**: Pre-generate tiles for common zoom levels and dates
- **Database**: Use PostgreSQL with PostGIS for spatial queries
- **Rate Limiting**: Implement rate limiting for public endpoints
- **CDN**: Use CDN for tile delivery in production

## Deployment

### Development
```bash
# Run with hot reload
python run.py

# Or with uvicorn directly
uvicorn app.main:app --reload --port 8000
```

### Production

**Option 1: Uvicorn with multiple workers**
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

**Option 2: Gunicorn + Uvicorn workers**
```bash
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

**Option 3: Docker (Recommended)**
```bash
# Build image
docker build -t smartair-api .

# Run container
docker run -d \
  -p 8000:8000 \
  -v ./data:/app/data \
  -e HOST=0.0.0.0 \
  -e PORT=8000 \
  --name smartair-api \
  smartair-api

# With docker-compose
docker-compose up -d
```

**Option 4: Systemd Service**
```bash
# Create /etc/systemd/system/smartair-api.service
[Unit]
Description=SmartAir API Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/smartair-api
Environment="PATH=/opt/smartair-api/venv/bin"
ExecStart=/opt/smartair-api/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always

[Install]
WantedBy=multi-user.target

# Enable and start
sudo systemctl enable smartair-api
sudo systemctl start smartair-api
```

## Environment Variables

```env
# Server Configuration
HOST=0.0.0.0
PORT=8000
DEBUG=False

# Data Storage
TIF_DIR=data/tif_files

# Map Settings
DEFAULT_COLORMAP=aqi
TILE_SIZE=256

# CORS (comma-separated origins)
CORS_ORIGINS=https://smartair.app,http://localhost:3000

# Authentication (if applicable)
SECRET_KEY=your-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Database (if using)
DATABASE_URL=postgresql://user:pass@localhost/smartair
```

## Monitoring & Logging

```python
# Logs are written to console by default
# Configure in app/core/config.py

import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

## Testing

```bash
# Run tests (when available)
pytest tests/

# Test coverage
pytest --cov=app tests/

# Load testing
locust -f tests/locustfile.py --host=http://localhost:8000
```

## API Versioning

Current version: **v1**

Future versions will use URL prefixing:
- `/v1/pm25/...`
- `/v2/pm25/...`

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/NewEndpoint`)
3. Follow code style (Black formatter, PEP 8)
4. Add tests for new features
5. Update documentation
6. Commit changes (`git commit -m 'Add NewEndpoint'`)
7. Push to branch (`git push origin feature/NewEndpoint`)
8. Create Pull Request

## Troubleshooting

**Issue: "Module not found" errors**
```bash
pip install -r requirements.txt --upgrade
```

**Issue: Tiles not rendering**
- Check TIF_DIR path is correct
- Verify GeoTIFF files exist for requested dates
- Check tile coordinates are within bounds

**Issue: Slow tile generation**
- Pre-generate tiles for common zoom levels
- Implement tile caching (filesystem or Redis)
- Use smaller tile sizes (256x256)

**Issue: CORS errors**
- Add frontend domain to CORS_ORIGINS
- Check browser console for specific CORS error

## License

MIT License

## Contact & Support

- **Documentation**: `/docs` endpoint on running server
- **Issues**: GitHub Issues
- **API Status**: Check `/health` endpoint
- **Frontend Integration**: See `../frontend/README.md`
