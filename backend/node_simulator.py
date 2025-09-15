import random
import time
from typing import Dict, List, Optional

import models


class NodeSimulator:
    def __init__(self, node_count: int = 5) -> None:
        self.node_count = node_count
        self.nodes: Dict[str, models.NodeStatus] = {}
        self._events: List[models.SecurityEvent] = []
        self._ddos_ramp: Dict[str, Dict[str, float]] = {}

    def init_nodes(self) -> None:
        now = time.time()
        for i in range(1, self.node_count + 1):
            node_id = f"node-{i}"
            ip = f"10.0.0.{i}"
            self.nodes[node_id] = models.NodeStatus(
                id=node_id,
                name=f"Node {i}",
                ip=ip,
                status="healthy",
                metrics=self._random_metrics(),
                last_update=now,
            )

    def _random_metrics(self) -> models.NodeMetrics:
        return models.NodeMetrics(
            cpu=round(random.uniform(5, 95), 2),
            memory=round(random.uniform(10, 90), 2),
            network_in=round(random.uniform(0.1, 20.0), 2),
            network_out=round(random.uniform(0.1, 20.0), 2),
            latency_ms=round(random.uniform(5, 200), 1),
        )

    def tick(self) -> None:
        now = time.time()
        for node in self.nodes.values():
            node.metrics = self._random_metrics()
            node.last_update = time.time()
            # degrade status probabilistically
            roll = random.random()
            if roll < 0.02:
                node.status = "warning"
            elif roll < 0.01:
                node.status = "critical"
            elif roll > 0.98:
                node.status = "healthy"
            # apply DDoS ramp if active
            ramp = self._ddos_ramp.get(node.id)
            if ramp:
                t = max(0.0, min(1.0, (now - ramp["start"]) / ramp["duration"]))
                factor = 1.0 + (ramp["factor"] - 1.0) * t
                node.metrics.network_in *= factor
                node.metrics.network_out *= factor
                node.metrics.cpu = min(99.0, node.metrics.cpu * (1.0 + 0.5 * t))
                node.status = "warning"

    def redistribute_load(self, from_node_id: str) -> None:
        """Simulate load balancing by reducing load on the attacked node and slightly increasing others."""
        if from_node_id not in self.nodes:
            return
        compromised = self.nodes[from_node_id]
        # reduce its network and cpu
        compromised.metrics.cpu = max(5.0, compromised.metrics.cpu * 0.6)
        compromised.metrics.network_in *= 0.5
        compromised.metrics.network_out *= 0.5
        compromised.status = "warning"
        # spread to other nodes
        for nid, node in self.nodes.items():
            if nid == from_node_id:
                continue
            node.metrics.cpu = min(95.0, node.metrics.cpu * 1.05)
            node.metrics.network_in *= 1.1
            node.metrics.network_out *= 1.1
            node.last_update = time.time()

    def simulate_ddos(self, node_id: str) -> None:
        """Gradual spike over ~45s to trigger detection <60s."""
        if node_id not in self.nodes:
            return
        self._ddos_ramp[node_id] = {
            "start": time.time(),
            "duration": 45.0,
            "factor": random.uniform(3.0, 6.0),
        }

    def simulate_threat(
        self, node_id: str, body: Optional[models.SimulateThreatBody]
    ) -> models.SecurityEvent:
        if node_id == "random" or node_id not in self.nodes:
            node_id = random.choice(list(self.nodes.keys()))

        b = body or models.SimulateThreatBody()
        sev = b.severity
        msg = b.message or f"Simulated {b.type} event"

        evt = models.SecurityEvent(
            id=f"evt-{int(time.time()*1000)}",
            node_id=node_id,
            type=b.type,
            severity=sev,
            message=msg,
            timestamp=time.time(),
        )
        self._events.insert(0, evt)
        self._events = self._events[:200]

        # reflect on node status
        node = self.nodes[node_id]
        if sev in ("high", "critical"):
            node.status = "critical"
        elif sev == "medium":
            node.status = "warning"
        else:
            node.status = "healthy"
        node.last_update = time.time()
        return evt

    def recent_events(self, limit: int = 50) -> List[models.SecurityEvent]:
        return self._events[:limit]

    def analytics(self, uptime: float) -> models.AnalyticsSummary:
        nodes = list(self.nodes.values())
        if not nodes:
            return models.AnalyticsSummary(
                node_count=0,
                avg_cpu=0.0,
                avg_memory=0.0,
                threats_total=len(self._events),
                threats_active=sum(1 for e in self._events if e.severity in ("high", "critical")),
                uptime=uptime,
                status_breakdown={},
            )
        avg_cpu = sum(n.metrics.cpu for n in nodes) / len(nodes)
        avg_memory = sum(n.metrics.memory for n in nodes) / len(nodes)
        breakdown: Dict[str, int] = {"healthy": 0, "warning": 0, "critical": 0, "offline": 0}
        for n in nodes:
            breakdown[n.status] = breakdown.get(n.status, 0) + 1
        return models.AnalyticsSummary(
            node_count=len(nodes),
            avg_cpu=round(avg_cpu, 2),
            avg_memory=round(avg_memory, 2),
            threats_total=len(self._events),
            threats_active=sum(1 for e in self._events if e.severity in ("high", "critical")),
            uptime=uptime,
            status_breakdown=breakdown,
        )
