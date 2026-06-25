# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SmartAir is a Vietnamese air-quality mobile app: a React Native/Expo frontend (`frontend/`) and a FastAPI backend (`server/`). The backend serves PM2.5/AQI data derived from GeoTIFF satellite rasters, map tiles, weather, auth, location stats, notifications, and an AI chat assistant. All app-facing UI text is in Vietnamese.

## Commands

### Frontend (`frontend/`)

```bash
cd frontend
npm install
npm start              # Expo dev server (scan QR with Expo Go)
npm start -- --tunnel  # When phone/PC are not on the same WiFi
npm run android        # Android emulator (needs Android Studio)
npm run ios            # iOS simulator (macOS + Xcode only)
npm run web            # Web build
npx expo start -c      # Clear Metro cache
```

No lint/test scripts are configured for the frontend.

### Backend (`server/`)

```bash
cd server
pip install -r requirements.txt
python run.py                                   # Auto-downloads missing PM2.5 TIFs from MinIO, then starts uvicorn with reload
uvicorn app.main:app --reload --port 8000       # Run directly without the TIF-sync step
```

Server reads config from `server/.env` (see `server/.env.example`). Required settings include `SECRET_KEY`, `GOOGLE_API_KEY`, `POSTGRES_*`, and MongoDB/MinIO connection values — `app/core/config.py` raises a validation error at import time if a required field is missing.

Run from the `server/` directory (not repo root) — imports are rooted at `app.*`.

Tests (pytest, uses FastAPI `TestClient`, does not need a running server):

```bash
cd server
pytest testing/test_auth_api.py -v
pytest testing/test_auth_api.py::TestAuthRegister -v          # one class
pytest testing/test_auth_api.py -k "test_register_with_full_profile"  # one test
pytest testing/test_auth_api.py --cov=app.api.endpoints.auth --cov-report=html
```

TIF data tooling:

```bash
cd server
python -m tools.tif_downloader              # one-off download of the next 7 days of PM2.5 GeoTIFFs from MinIO
python -m tools.tif_downloader --scheduler   # run continuously, re-downloads daily at 00:00
python export_schema.py                     # dump Postgres schema to db_schema_for_llm.txt (used as LLM context for text-to-SQL)
```

## Architecture

### Backend: two parallel databases, one routing layer

The backend talks to **two different databases for two different purposes** — this is the most important thing to know before touching backend code:

- **MongoDB** (`app/db/mongodb.py`, motor) — users, auth, profiles, notifications. `app/api/endpoints/auth.py` reads/writes `db.users` directly (no ORM).
- **PostgreSQL** (`app/db/postgres_db.py`, asyncpg pool) — administrative geo data (`provinces`, `districts`, `distric_stats`) used for aggregate AQI/PM2.5 statistics by location. There is no ORM here either; `app/services/chat/text_to_sql_service.py` generates raw SQL via an LLM and executes it through `get_pool()`.

Both connections are opened in `app/main.py`'s `startup` event and closed on `shutdown`; failures to connect are logged but do not crash the app (endpoints relying on the unavailable DB will fail individually).

GeoTIFF PM2.5 rasters (`data/tif_files/PM25_YYYYMMDD_{1km,3km}NRT.tif`) are a third, file-based data source read directly by `app/services/geotiff_service.py` / `tile_service.py` — these are not DB-backed. `1kmNRT` files are preferred over `3kmNRT` when both exist for a date (see `geotiff_service.get_tif_file_path`).

### AI Chat: intent-routed RAG vs. Text-to-SQL

`app/api/endpoints/chat.py` → `app/services/chat/orchestrator.py` (`ChatOrchestrator.route`) classifies each user question with a cheap Gemini call, then dispatches to one of two services:

- **Text-to-SQL** (`text_to_sql_service.py`) — for questions about numeric/location stats. Prompts Gemini with the Postgres DDL (provinces/districts/distric_stats) inline, extracts the generated SQL, executes it against the Postgres pool, then has the LLM interpret the result back into Vietnamese using the EPA AQI scale embedded in the prompt.
- **RAG** (`rag_service.py`) — for advisory/health questions. Currently just forwards to Gemini with a system-style prompt; there is no vector DB wired up yet despite `VECTOR_DB_PATH`/`EMBEDDING_MODEL` settings existing in `config.py` (sources field returns a hardcoded mock string).

Both services use `langchain_google_genai.ChatGoogleGenerativeAI` directly, not via `OPENAI_API_KEY` (that setting exists in config but is currently unused by the chat services).

`app/services/chat/*_service1.py` files (`rag_service1.py`, `text_to_sql_service1.py`) are alternate/older drafts — check `orchestrator.py` to confirm which version is actually wired in before assuming the `1`-suffixed file is live. `app/models/conversation.py` (SQLAlchemy-style `Conversation` model) is not yet integrated — it imports a nonexistent `pydantic.BaseModal` and is not used by any endpoint.

### Backend module layout

- `app/api/endpoints/` — one router module per domain (`pm25`, `auth`, `weather`, `location`, `notification`, `chat`); all registered in `app/api/__init__.py` with their URL prefixes.
- `app/services/` — business logic per domain; `chat/` is its own subpackage.
- `app/models/` — Pydantic (Mongo-facing) and SQLAlchemy-style (Postgres-facing, partially unused) schemas.
- `app/core/config.py` — single `Settings` (pydantic-settings) object loaded from `server/.env`; `AQI_BREAKPOINTS` here defines both the EPA AQI thresholds and tile colormap colors used by `tile_service.py`.

### Frontend structure

- `src/navigation/RootStack.js` — top-level stack; checks `AsyncStorage` for a saved JWT (`auth.access_token`) on boot to decide whether to land on `Intro` or `MainTabs`.
- `src/navigation/RootTabs.js` — bottom tabs nested inside `MainTabs` (Map, Analytics, News, AI Chat, Profile).
- `src/services/api.js` — single `BASE_URL` resolution shared by all API calls. Resolution order is hardcoded as `LOCAL_NETWORK_URL || DEPLOY_URL || ENV_BASE || detectedBackendUrl || CONFIG_BASE || DEFAULT_FALLBACK` — note `LOCAL_NETWORK_URL` is a literal IP string at the top of the file and wins over everything else when set, including the `.env` value. When switching between physical-device testing and deployed backend, edit that constant directly rather than relying on `.env`.
- `src/services/cemApi.js` — separate external API for historical AQI from monitoring stations (distinct from the SmartAir backend).
- `src/hooks/{map,analytics,auth,station}/` — domain-grouped data-fetching hooks consumed by the corresponding screens.
- `src/constants/escapeDestinations.js` — static candidate list for the "Trốn bụi" (escape pollution) feature in `AnalyticExposureScreen`; results are fetched live but the candidate locations are fixed.

### AQI calculation

EPA PM2.5 breakpoint formula (`AQI = ((I_high - I_low) / (C_high - C_low)) * (C - C_low) + I_low`) is duplicated in three places that must stay consistent: `frontend` AQI/PM2.5 conversion (`src/utils/aqiUtils.js`), `server/app/services/aqi_service.py`, and the breakpoint table in `server/app/core/config.py` (`AQI_BREAKPOINTS`, also reused for tile colormap colors). The frontend's breakpoint values differ slightly from the backend's `AQI_BREAKPOINTS` (e.g. PM2.5 "Good" cutoff is 12.0 in the frontend doc vs. 25.0 in `config.py`) — check both when changing AQI logic.
