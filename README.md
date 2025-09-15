# CyberGuard Platform (Kickstart)

A minimal end-to-end scaffold for a cybersecurity monitoring dashboard:
- FastAPI backend with WebSocket live metrics, simulated nodes, and threat simulation.
- Next.js (App Router) frontend with a live dashboard.

## Prereqs
- Python 3.10+
- Node.js 18+

## Run - Backend

```
cd backend
# Windows
venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

On macOS/Linux, activate the venv first or run: `venv/bin/python -m uvicorn main:app --reload --port 8000`.

## Run - Frontend

```
cd frontend
npm run dev
```

Open http://localhost:3000.

## Configuration

The frontend defaults to the backend at `http://localhost:8000` and WS at `ws://localhost:8000/ws`.
Override via `frontend/.env.local`:

```
NEXT_PUBLIC_BACKEND_HTTP_URL=http://localhost:8000
NEXT_PUBLIC_BACKEND_WS_URL=ws://localhost:8000/ws
```

Backend AI/env options (set in your shell):

```
# Gemini
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-1.5-flash

# AI thresholds (defaults shown)
AI_CPU_SPIKE_THRESHOLD=85
AI_CPU_SPIKE_DURATION_SEC=30
AI_MEM_LEAK_WINDOW_SEC=60
AI_MEM_LEAK_DELTA_PCT=10
AI_NET_BASELINE_WINDOW_SEC=60
AI_NET_SPIKE_FACTOR=3.0
AI_MONITOR_INTERVAL_SEC=5
AI_DECISION_COOLDOWN_SEC=30
REDIS_URL=redis://localhost:6379/0
```

## API Hints
- `GET /health` - service, nodes, uptime
- `GET /nodes` - list node statuses
- `POST /simulate-threat/{node_id}` - trigger a simulated event (use `random` for any node)
- `GET /threats` - recent security events
- `GET /analytics` - summary metrics
- `GET /metrics` - performance stats for presentation claims
- `POST /ai-analyze/{node_id}` - run AI analysis for a node
- `WS /ws` - real-time updates (init, metrics_update, security_event)

Demo controls:
- `POST /demo/ddos/{node_id|random}` - start sub-60s detection scenario
- `POST /redistribute-load/{node_id}` - simulate zero-downtime load balancing
- `POST /demo/reset` - reset demo and metrics

## Judge Criteria Mapping
- Innovation: Hybrid rule-based + optional Gemini + LangGraph workflow; topology visualization; AI-driven actions.
- Technical Depth: FastAPI + WS streaming, Mongo/Redis/Qdrant hooks, client-side trend aggregation, background AI loop.
- UI/UX: Live KPIs with sparklines, node detail modal, judge panel with one-click demo, pause/resume live feed.
- Impact: Sub-60s detection demo with automatic load redistribution for zero-downtime claim.
- Completeness: End-to-end demo flows (start DDoS, detect, redistribute, reset), CSV export of metrics for verification.
- Presentation: Judge Panel surfaces claim metrics, pass/fail badges, and downloadable evidence.

## Docker (Run Everything in Containers)

Build and start all services (backend, frontend, MongoDB, Redis, Qdrant):

```
cd cyberguard-platform
docker compose --profile dev up --build
```

Open the dashboard at http://localhost:3000.

Notes:
- Frontend is configured to call backend via `http://localhost:8000` so browser JS reaches the container-mapped port.
- Backend connects to MongoDB (`mongo`), Redis (`redis`), and Qdrant (`qdrant`) via the Docker network.
- Optional: set `GEMINI_API_KEY` in `docker.env` (used by backend ai_engine).

Production build (optimized images, Next.js build + next start):

```
docker compose --profile prod up --build -d
```

Stop and remove containers:

```
docker compose down
```
