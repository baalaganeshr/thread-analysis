from typing import Any, Dict, List, Optional

import models

try:
    from langgraph.graph import StateGraph  # type: ignore
except Exception:  # pragma: no cover
    StateGraph = None  # type: ignore


class AnalysisState(dict):
    """
    Simple mutable state for the workflow.
    Keys:
      node (NodeStatus), history (list[NodeMetrics]), anomalies (list[str]), severity (str), actions (list[str]), reasoning (str)
    """


def analyze_metrics(state: AnalysisState) -> AnalysisState:
    node: models.NodeStatus = state["node"]
    # basic feature extraction, could be extended
    state["features"] = {
        "cpu": node.metrics.cpu,
        "memory": node.metrics.memory,
        "traffic": node.metrics.network_in + node.metrics.network_out,
        "latency": node.metrics.latency_ms,
    }
    return state


def detect_anomalies(state: AnalysisState) -> AnalysisState:
    feats = state["features"]
    anomalies: List[str] = []
    if feats["cpu"] > 85:
        anomalies.append("cpu_spike")
    if feats["latency"] > 150:
        anomalies.append("high_latency")
    if feats["traffic"] > 20:
        anomalies.append("net_anomaly")
    state["anomalies"] = anomalies
    return state


def classify_threats(state: AnalysisState) -> AnalysisState:
    anomalies: List[str] = state.get("anomalies", [])
    if {"cpu_spike", "net_anomaly"}.issubset(anomalies):
        sev = "critical"
    elif "cpu_spike" in anomalies or "net_anomaly" in anomalies:
        sev = "medium"
    else:
        sev = "low"
    state["severity"] = sev
    return state


def recommend_actions(state: AnalysisState) -> AnalysisState:
    sev: str = state.get("severity", "low")
    anomalies: List[str] = state.get("anomalies", [])
    actions: List[str] = []
    if sev in ("high", "critical"):
        if "net_anomaly" in anomalies:
            actions.append("throttle_traffic")
        actions.append("quarantine")
        actions.append("deep_scan")
    elif sev == "medium":
        actions.append("deep_scan")
        actions.append("increase_monitoring")
    else:
        actions.append("observe")
    state["actions"] = actions
    return state


def build_security_graph():
    if StateGraph is None:
        return None
    graph = StateGraph(AnalysisState)
    graph.add_node("analyze_metrics", analyze_metrics)
    graph.add_node("detect_anomalies", detect_anomalies)
    graph.add_node("classify_threats", classify_threats)
    graph.add_node("recommend_actions", recommend_actions)
    graph.set_entry_point("analyze_metrics")
    graph.add_edge("analyze_metrics", "detect_anomalies")
    graph.add_edge("detect_anomalies", "classify_threats")
    graph.add_edge("classify_threats", "recommend_actions")
    return graph.compile()


def run_workflow(node: models.NodeStatus) -> models.AIAnalysisResult:
    """Convenience runner for environments without a persistent graph instance."""
    graph = build_security_graph()
    state = AnalysisState(node=node)
    if graph is None:
        # Fallback to a simple rule-based pass
        analyze_metrics(state)
        detect_anomalies(state)
        classify_threats(state)
        recommend_actions(state)
    else:
        state = graph.invoke(state)  # type: ignore[attr-defined]
    return models.AIAnalysisResult(
        node_id=node.id,
        severity=state.get("severity", "low"),  # type: ignore[arg-type]
        anomalies=state.get("anomalies", []),
        actions=state.get("actions", ["observe"]),
        reasoning="Workflow output based on current metrics",
        timestamp=node.last_update,
    )

