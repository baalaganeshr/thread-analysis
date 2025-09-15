from typing import Literal, Optional, List
from pydantic import BaseModel, Field


NodeHealth = Literal["healthy", "warning", "critical", "offline"]


class NodeMetrics(BaseModel):
    cpu: float = Field(ge=0, le=100)
    memory: float = Field(ge=0, le=100)
    network_in: float
    network_out: float
    latency_ms: float


class NodeStatus(BaseModel):
    id: str
    name: str
    ip: str
    status: NodeHealth = Field(default="healthy")
    metrics: NodeMetrics
    last_update: float


class SecurityEvent(BaseModel):
    id: str
    node_id: str
    type: str
    severity: Literal["low", "medium", "high", "critical"]
    message: str
    timestamp: float


class SimulateThreatBody(BaseModel):
    node_id: Optional[str] = None
    type: str = Field(default="anomaly")
    severity: Literal["low", "medium", "high", "critical"] = "medium"
    message: Optional[str] = None


class AnalyticsSummary(BaseModel):
    node_count: int
    avg_cpu: float
    avg_memory: float
    threats_total: int
    threats_active: int
    uptime: float
    status_breakdown: dict[str, int]


class AIAnalysisResult(BaseModel):
    node_id: str
    severity: Literal["low", "medium", "high", "critical"]
    anomalies: List[str]
    actions: List[str]
    reasoning: str
    timestamp: float
    confidence: float = Field(default=0.9, ge=0.0, le=1.0)
