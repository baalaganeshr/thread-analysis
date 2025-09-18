"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useRealtime } from '@/hooks/useRealtime';
import { BACKEND_HTTP_URL } from '@/lib/config';

export default function ScenarioPanel() {
  const { nodes, demoDdos, demoReset, redistribute } = useRealtime();
  const [running, setRunning] = useState<null | { nodeId: string; started: number }>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const duration = useMemo(() => {
    if (!running) return null;
    return Math.max(0, (now - running.started) / 1000);
  }, [now, running]);

  async function startDdos() {
    const id = nodes[0]?.id ?? 'random';
    setRunning({ nodeId: id, started: Date.now() });
    await demoDdos(id);
  }

  async function reset() {
    setRunning(null);
    await demoReset();
  }

  return (
    <div className="scenario-panel">
      <div className="scenario-header">
        <h4>⚡ Threat Simulation</h4>
        <span className="scenario-subtitle">Test system responses</span>
      </div>
      
      <div className="scenario-actions">
        <button 
          onClick={startDdos} 
          className="action-btn primary scenario-btn"
          disabled={!!running}
        >
          {running ? '🔄 Running...' : '🚀 Start DDoS Demo'}
        </button>
        <button 
          onClick={() => {
            if (confirm('Reset demo? This will clear metrics.')) reset();
          }} 
          className="action-btn secondary scenario-btn"
        >
          🔄 Reset System
        </button>
      </div>

      <div className="scenario-status">
        <div className="status-item">
          <span className="status-label">⏱️ Detection Timer:</span>
          <span className="status-value">
            {duration ? `${duration.toFixed(1)}s` : '—'}
          </span>
        </div>
        <div className="status-item">
          <span className="status-label">⏳ Countdown:</span>
          <span className="status-value countdown">
            {duration ? `${Math.max(0, 60 - duration).toFixed(1)}s` : '60.0s'}
          </span>
        </div>
      </div>

      <DetectionSummary />

      {nodes.length > 0 && (
        <div className="node-actions">
          <div className="node-actions-title">🌐 Node Operations</div>
          <div className="node-buttons">
            {nodes.slice(0, 4).map((n) => (
              <button 
                key={n.id} 
                onClick={() => redistribute(n.id)} 
                className="node-btn"
                title={`Redistribute traffic from ${n.id}`}
              >
                📊 {n.id}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DetectionSummary() {
  const [m, setM] = useState<any>(null);
  useEffect(() => {
    const run = async () => {
      try {
        const r = await fetch(`${BACKEND_HTTP_URL}/metrics`);
        setM(await r.json());
      } catch {}
    };
    run();
    const id = setInterval(run, 2000);
    return () => clearInterval(id);
  }, []);
  
  if (!m) return null;
  
  const last = m.threat_detection?.last_seconds as number | undefined;
  
  return (
    <div className="detection-summary">
      {typeof last === 'number' ? (
        <div className="detection-result success">
          <div className="detection-icon">✅</div>
          <div className="detection-info">
            <span className="detection-text">Threat detected in {last.toFixed(1)} seconds</span>
            <span className="detection-samples">• {m.threat_detection?.samples} samples</span>
          </div>
        </div>
      ) : (
        <div className="detection-result waiting">
          <div className="detection-icon">⏳</div>
          <div className="detection-info">
            <span className="detection-text">No detections yet</span>
            <span className="detection-samples">• Start demo to measure</span>
          </div>
        </div>
      )}
    </div>
  );
}
