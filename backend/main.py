import asyncio
import logging
import os
import time
from typing import Any, Dict, List, Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from starlette.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

import models  # type: ignore
from database import db_state
from node_simulator import NodeSimulator
from ai_engine import AIEngine
from langgraph_workflows import run_workflow
from metrics import metrics
import io
import csv
from pydantic import BaseModel, Field
from collections import defaultdict, deque


logger = logging.getLogger("cyberguard")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


class ConnectionManager:
    def __init__(self) -> None:
        self.active: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active:
            self.active.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]) -> None:
        # Add 'event' alias for clients expecting it
        msg = dict(message)
        if "type" in msg and "event" not in msg:
            msg["event"] = msg["type"]
        # Normalize security_event payload shape for UI (add created_at)
        try:
            if msg.get("type") == "security_event" and isinstance(msg.get("data"), dict):
                d = dict(msg["data"])  # shallow copy
                if "created_at" not in d and "timestamp" in d:
                    from datetime import datetime

                    d["created_at"] = (
                        datetime.utcfromtimestamp(d["timestamp"]).isoformat() + "Z"
                    )
                    msg["data"] = d
        except Exception:
            pass
        stale: List[WebSocket] = []
        for ws in list(self.active):
            try:
                await ws.send_json(msg)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self.disconnect(ws)


manager = ConnectionManager()
simulator = NodeSimulator(node_count=5)
server_started = time.time()
engine = AIEngine()

app = FastAPI(title="CyberGuard Platform", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------- UX: consistent error responses -------
@app.exception_handler(HTTPException)
async def http_exc_handler(_: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"message": exc.detail, "code": exc.status_code}},
    )


@app.exception_handler(RequestValidationError)
async def validation_exc_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "message": "Validation failed",
                "code": 422,
                "details": exc.errors(),
            }
        },
    )


# ------- UX: simple rate limiter for demo endpoints -------
class RateLimiter:
    def __init__(self, max_events: int, window_sec: float) -> None:
        self.max_events = max_events
        self.window = window_sec
        self.events: dict[str, deque[float]] = defaultdict(lambda: deque())

    def check(self, key: str) -> bool:
        now = time.time()
        q = self.events[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.max_events:
            return False
        q.append(now)
        return True


limiter = RateLimiter(max_events=int(os.getenv("API_RATE_MAX", "15")), window_sec=float(os.getenv("API_RATE_WINDOW", "60")))


def rate_limit_or_429(request: Request) -> None:
    client = request.client.host if request.client else "unknown"
    if not limiter.check(client):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please retry later.")


# ------- UX: runtime settings (for config UI) -------
class AppSettings(BaseModel):
    refresh_rate_sec: float = Field(default=3.0, ge=1.0, le=60.0)
    alert_sound: bool = True
    alert_volume: float = Field(default=0.6, ge=0.0, le=1.0)
    presentation_mode_default: bool = False
    mobile_nav_collapsed_default: bool = True


app_settings = AppSettings()

# ------- Compatibility helpers for frontend (/api/*) -------
# Track quarantined nodes for UI actions
quarantined_nodes: Set[str] = set()


def status_to_state(status: str, node_id: str) -> str:
    if node_id in quarantined_nodes:
        return "quarantined"
    return {
        "healthy": "healthy",
        "warning": "degraded",
        "critical": "attacked",
        "offline": "degraded",
    }.get(status, "healthy")


def node_to_frontend(n: models.NodeStatus) -> Dict[str, Any]:
    cpu_frac = max(0.0, min(1.0, n.metrics.cpu / 100.0))
    mem_frac = max(0.0, min(1.0, n.metrics.memory / 100.0))
    return {
        "id": n.id,
        "name": n.name,
        "ip": n.ip,
        "state": status_to_state(n.status, n.id),
        "cpu": cpu_frac,
        "mem": mem_frac,
        "net_in": n.metrics.network_in,
        "net_out": n.metrics.network_out,
        "load": round((cpu_frac + mem_frac) / 2.0, 3),
        "quarantined": n.id in quarantined_nodes,
    }


def event_to_frontend(e: models.SecurityEvent) -> Dict[str, Any]:
    from datetime import datetime

    created_at = datetime.utcfromtimestamp(e.timestamp).isoformat() + "Z"
    return {
        "id": e.id,
        "node_id": e.node_id,
        "type": e.type,
        "severity": e.severity,
        "message": e.message,
        "created_at": created_at,
    }


async def metrics_loop() -> None:
    while True:
        await asyncio.sleep(2.0)
        simulator.tick()
        # Record metrics for AI baselines
        for node in simulator.nodes.values():
            engine.record(node)
        # Cache snapshot in Redis if available
        try:
            if db_state.redis_ok and db_state.redis_client is not None:
                payload = {n.id: n.model_dump() for n in simulator.nodes.values()}
                db_state.redis_client.setex(
                    "realtime:nodes", 5, __import__("json").dumps(payload)
                )
        except Exception:
            pass
        # persist nodes if DB available (best-effort)
        if db_state.mongo_ok and db_state.db is not None:
            try:
                payload = [n.model_dump() for n in simulator.nodes.values()]
                # upsert per id
                for doc in payload:
                    db_state.db["nodes"].update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
            except Exception as e:
                logger.debug(f"Mongo persist nodes failed: {e}")

        # Broadcast a batch update for native clients
        await manager.broadcast({
            "type": "metrics_update",
            "data": [n.model_dump() for n in simulator.nodes.values()],
        })
        # And per-node updates for the UI that expects 'node_update'
        for n in simulator.nodes.values():
            await manager.broadcast({
                "type": "node_update",
                "data": node_to_frontend(n),
            })


@app.on_event("startup")
async def on_startup() -> None:
    await db_state.init()
    simulator.init_nodes()
    asyncio.create_task(metrics_loop())
    asyncio.create_task(ai_monitor_loop())
    logger.info("CyberGuard backend started")


@app.get("/")
async def root() -> Dict[str, str]:
    return {"status": "ok", "service": "cyberguard-backend"}


@app.get("/health")
async def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "services": {
            "mongodb": db_state.mongo_ok,
            "qdrant": db_state.qdrant_ok,
        },
        "nodes": len(simulator.nodes),
        "uptime": time.time() - server_started,
    }


@app.get("/nodes", response_model=List[models.NodeStatus])
async def list_nodes() -> List[models.NodeStatus]:
    return list(simulator.nodes.values())


@app.get("/nodes/{node_id}", response_model=models.NodeStatus)
async def get_node(node_id: str) -> models.NodeStatus:
    node = simulator.nodes.get(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node


# ------- Compatibility REST API for frontend -------
@app.get("/api/nodes")
async def api_nodes() -> Dict[str, Any]:
    return {"nodes": [node_to_frontend(n) for n in simulator.nodes.values()]}


@app.get("/api/events")
async def api_events() -> Dict[str, Any]:
    return {"events": [event_to_frontend(e) for e in simulator.recent_events()]}


@app.post("/api/quarantine/{node_id}")
async def api_quarantine(node_id: str, request: Request) -> Dict[str, Any]:
    rate_limit_or_429(request)
    if node_id not in simulator.nodes:
        raise HTTPException(status_code=404, detail="Node not found")
    quarantined_nodes.add(node_id)
    await manager.broadcast({
        "type": "security_event",
        "data": {
            "id": f"q-{int(time.time()*1000)}",
            "node_id": node_id,
            "type": "quarantine",
            "severity": "medium",
            "message": "Node quarantined",
            "timestamp": time.time(),
        },
    })
    # Inform UI immediately
    await manager.broadcast({"type": "node_update", "data": node_to_frontend(simulator.nodes[node_id])})
    return {"status": "ok"}


@app.post("/api/release/{node_id}")
async def api_release(node_id: str, request: Request) -> Dict[str, Any]:
    rate_limit_or_429(request)
    if node_id not in simulator.nodes:
        raise HTTPException(status_code=404, detail="Node not found")
    quarantined_nodes.discard(node_id)
    await manager.broadcast({
        "type": "security_event",
        "data": {
            "id": f"r-{int(time.time()*1000)}",
            "node_id": node_id,
            "type": "release",
            "severity": "low",
            "message": "Node released",
            "timestamp": time.time(),
        },
    })
    await manager.broadcast({"type": "node_update", "data": node_to_frontend(simulator.nodes[node_id])})
    return {"status": "ok"}


@app.post("/api/attack/{node_id}/{kind}")
async def api_attack(node_id: str, kind: str, request: Request) -> Dict[str, Any]:
    rate_limit_or_429(request)
    # Support 'random' for convenience
    if node_id == "random" and simulator.nodes:
        node_id = next(iter(simulator.nodes.keys()))
    if node_id not in simulator.nodes:
        raise HTTPException(status_code=404, detail="Node not found")
    kind = kind.lower()
    if kind == "ddos":
        # Reuse demo ddos path
        simulator.simulate_ddos(node_id)
        metrics.start_ddos_demo(node_id)
        await manager.broadcast({
            "type": "security_event",
            "data": {
                "id": f"demo-{int(time.time()*1000)}",
                "node_id": node_id,
                "type": "ddos_simulation",
                "severity": "medium",
                "message": "DDoS demo started",
                "timestamp": time.time(),
            },
        })
        return {"status": "started", "node_id": node_id}
    # Map to simulate_threat for other kinds
    severity = {
        "exfiltration": "high",
        "degradation": "medium",
        "anomaly": "medium",
    }.get(kind, "medium")
    body = models.SimulateThreatBody(node_id=node_id, type=kind, severity=severity)  # type: ignore[arg-type]
    evt = simulator.simulate_threat(node_id=node_id, body=body)
    if db_state.mongo_ok and db_state.db is not None:
        try:
            db_state.db["events"].insert_one(evt.model_dump())
        except Exception as e:
            logger.debug(f"Mongo insert event failed: {e}")
    await manager.broadcast({"type": "security_event", "data": evt.model_dump()})
    return {"status": "ok", "event": event_to_frontend(evt)}


@app.post("/simulate-threat/{node_id}", response_model=models.SecurityEvent)
async def simulate_threat(node_id: str, request: Request, body: models.SimulateThreatBody | None = None) -> models.SecurityEvent:
    rate_limit_or_429(request)
    evt = simulator.simulate_threat(node_id=node_id, body=body)
    # persist event if possible
    if db_state.mongo_ok and db_state.db is not None:
        try:
            db_state.db["events"].insert_one(evt.model_dump())
        except Exception as e:
            logger.debug(f"Mongo insert event failed: {e}")
    await manager.broadcast({"type": "security_event", "data": evt.model_dump()})
    return evt


# Backwards-compatible endpoint used earlier
@app.post("/threats/simulate", response_model=models.SecurityEvent)
async def simulate_threat_compat(request: Request, body: models.SimulateThreatBody) -> models.SecurityEvent:
    node_id = body.node_id or "random"
    return await simulate_threat(node_id=node_id, request=request, body=body)


@app.get("/threats", response_model=List[models.SecurityEvent])
async def list_threats() -> List[models.SecurityEvent]:
    return simulator.recent_events()


@app.get("/analytics", response_model=models.AnalyticsSummary)
async def analytics() -> models.AnalyticsSummary:
    return simulator.analytics(uptime=time.time() - server_started)


@app.get("/metrics")
async def claim_metrics() -> Dict[str, object]:
    """Performance statistics aligned with presentation claims."""
    p = metrics.to_payload()
    return p


@app.get("/metrics.csv")
async def claim_metrics_csv() -> Response:
    payload = metrics.to_payload()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["metric", "baseline", "optimized", "improvement_pct"])
    writer.writerow([
        "workflow_exec_ms",
        payload["workflow_exec_ms"]["baseline"],
        payload["workflow_exec_ms"]["optimized"],
        payload["workflow_exec_ms"]["improvement_pct"],
    ])
    writer.writerow(["error_rate_per_hour", payload["error_rate_per_hour"]["baseline"], payload["error_rate_per_hour"]["optimized"], payload["error_rate_per_hour"]["reduction_pct"]])
    return Response(content=output.getvalue(), media_type="text/csv")


# Compatibility pass-through for frontend
@app.get("/api/metrics")
async def api_metrics() -> Dict[str, object]:
    return await claim_metrics()


@app.get("/api/metrics.csv")
async def api_metrics_csv() -> Response:
    return await claim_metrics_csv()


async def ai_monitor_loop() -> None:
    """Background loop for continuous AI monitoring."""
    interval = max(2.0, engine.monitor_interval_sec)
    while True:
        await asyncio.sleep(interval)
        for node in list(simulator.nodes.values()):
            analysis = engine.maybe_analyze(node)
            if analysis is None:
                continue
            # Persist as an event for visibility
            try:
                if db_state.mongo_ok and db_state.db is not None:
                    db_state.db["events"].insert_one(
                        {
                            "id": f"ai-{int(time.time()*1000)}",
                            "node_id": analysis.node_id,
                            "type": "ai_detection",
                            "severity": analysis.severity,
                            "message": f"AI: {', '.join(analysis.anomalies)} -> {analysis.actions}",
                            "timestamp": analysis.timestamp,
                            "reasoning": analysis.reasoning,
                        }
                    )
            except Exception as e:
                logger.debug(f"Mongo insert AI event failed: {e}")

            # Broadcast both a decision and a security_event for UI compatibility
            await manager.broadcast({"type": "ai_decision", "data": analysis.model_dump()})
            await manager.broadcast(
                {
                    "type": "security_event",
                    "data": {
                        "id": f"ai-{int(time.time()*1000)}",
                        "node_id": analysis.node_id,
                        "type": "ai_detection",
                        "severity": analysis.severity,
                        "message": f"AI decision: {', '.join(analysis.actions)} ({'; '.join(analysis.anomalies)}) - conf {int(analysis.confidence*100)}%",
                        "timestamp": time.time(),
                    },
                }
            )

            # Scenario hooks: record detection time for ddos demo and auto redistribute
            if analysis.node_id in metrics.demo_ddos_started:
                started = metrics.demo_ddos_started[analysis.node_id]
                det = max(0.0, time.time() - started)
                metrics.record_detection(analysis.node_id, det)
                # Auto load balancing for zero downtime claim
                simulator.redistribute_load(analysis.node_id)
                await manager.broadcast({"type": "load_redistributed", "data": {"node_id": analysis.node_id}})


@app.post("/demo/ddos/{node_id}")
async def demo_ddos(node_id: str, request: Request) -> Dict[str, object]:
    rate_limit_or_429(request)
    if node_id not in simulator.nodes and node_id != "random":
        raise HTTPException(status_code=404, detail="Node not found")
    if node_id == "random":
        node_id = next(iter(simulator.nodes.keys()))
    simulator.simulate_ddos(node_id)
    metrics.start_ddos_demo(node_id)
    await manager.broadcast({
        "type": "security_event",
        "data": {
            "id": f"demo-{int(time.time()*1000)}",
            "node_id": node_id,
            "type": "ddos_simulation",
            "severity": "medium",
            "message": "DDoS demo started",
            "timestamp": time.time(),
        },
    })
    return {"status": "started", "node_id": node_id}


@app.post("/demo/reset")
async def demo_reset(request: Request) -> Dict[str, object]:
    rate_limit_or_429(request)
    metrics.reset()
    simulator.init_nodes()
    await manager.broadcast({
        "type": "security_event",
        "data": {
            "id": f"demo-{int(time.time()*1000)}",
            "node_id": "all",
            "type": "reset",
            "severity": "low",
            "message": "Demo state reset",
            "timestamp": time.time(),
        },
    })
    return {"status": "reset"}


@app.post("/redistribute-load/{node_id}")
async def redistribute_load(node_id: str, request: Request) -> Dict[str, object]:
    rate_limit_or_429(request)
    if node_id not in simulator.nodes:
        raise HTTPException(status_code=404, detail="Node not found")
    simulator.redistribute_load(node_id)
    await manager.broadcast({"type": "load_redistributed", "data": {"node_id": node_id}})
    await manager.broadcast({
        "type": "metrics_update",
        "data": [n.model_dump() for n in simulator.nodes.values()],
    })
    return {"status": "ok"}


@app.post("/ai-analyze/{node_id}", response_model=models.AIAnalysisResult)
async def ai_analyze(node_id: str) -> models.AIAnalysisResult:
    node = simulator.nodes.get(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    # Run both rule engine and workflow quickly; prefer engine result with workflow as corroboration
    res = engine.analyze_node(node)
    if res is None:
        # Provide a low-severity baseline using workflow
        res = run_workflow(node)
    # Broadcast and persist similar to the monitor
    await manager.broadcast({"type": "ai_decision", "data": res.model_dump()})
    if db_state.mongo_ok and db_state.db is not None:
        try:
            db_state.db["events"].insert_one(
                {
                    "id": f"ai-{int(time.time()*1000)}",
                    "node_id": res.node_id,
                    "type": "ai_detection",
                    "severity": res.severity,
                    "message": f"AI: {', '.join(res.anomalies)} -> {res.actions}",
                    "timestamp": res.timestamp,
                    "reasoning": res.reasoning,
                }
            )
        except Exception as e:
            logger.debug(f"Mongo insert AI event failed: {e}")
    return res


@app.get("/config")
async def get_config() -> Dict[str, object]:
    return app_settings.model_dump()


class UpdateAppSettings(BaseModel):
    refresh_rate_sec: float | None = None
    alert_sound: bool | None = None
    alert_volume: float | None = None
    presentation_mode_default: bool | None = None
    mobile_nav_collapsed_default: bool | None = None


@app.post("/config")
async def update_config(body: UpdateAppSettings) -> Dict[str, object]:
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(app_settings, k, v)
    return app_settings.model_dump()


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await manager.connect(ws)
    try:
        await ws.send_json({"type": "init", "data": [n.model_dump() for n in simulator.nodes.values()], "event": "init"})
        # Bootstrap UI clients with initial per-node updates
        for n in simulator.nodes.values():
            await ws.send_json({"type": "node_update", "event": "node_update", "data": node_to_frontend(n)})
        while True:
            _ = await ws.receive_text()  # simple keep-alive compat
            await ws.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception:
        manager.disconnect(ws)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
