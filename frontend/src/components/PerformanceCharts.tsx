"use client";

import React, { useEffect, useRef, useState } from 'react';
import { BACKEND_HTTP_URL } from '@/lib/config';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend);

type ClaimMetrics = {
  uptime: number;
  workflow_exec_ms: { baseline: number; optimized: number; improvement_pct: number };
  error_rate_per_hour: { baseline: number; optimized: number; reduction_pct: number };
  incidents_active: number;
  uptime_percent: number;
  downtime_events: number;
  thread_efficiency: number;
  autonomous_success_rate: number;
  health_score: number;
  threat_detection: { avg_seconds: number | null; samples: number; claim_target_seconds: number; last_seconds?: number | null; history?: number[] };
};

export default function PerformanceCharts() {
  const [m, setM] = useState<ClaimMetrics | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  async function fetchIt() {
    try {
      const r = await fetch(`${BACKEND_HTTP_URL}/metrics`);
      setM(await r.json());
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchIt();
    const id = setInterval(fetchIt, 3000);
    return () => clearInterval(id);
  }, []);

  if (!m) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="skeleton" style={{ height: 220 }} />
        <div className="skeleton" style={{ height: 220 }} />
        <div className="skeleton lg:col-span-2" style={{ height: 260 }} />
      </div>
    );
  }

  const barData = {
    labels: ['Baseline', 'Optimized'],
    datasets: [
      {
        label: 'Workflow Exec (ms)',
        data: [m.workflow_exec_ms.baseline, m.workflow_exec_ms.optimized],
        backgroundColor: ['#94a3b8', '#10b981'],
        borderRadius: 6,
      },
    ],
  } as const;

  const errorData = {
    labels: ['Baseline', 'Optimized'],
    datasets: [
      {
        label: 'Errors/hour',
        data: [m.error_rate_per_hour.baseline, m.error_rate_per_hour.optimized],
        backgroundColor: ['#f43f5e', '#6366f1'],
        borderRadius: 6,
      },
    ],
  } as const;

  // Timeline: detection history vs target
  const history = m.threat_detection.history ?? [];
  const timeline = {
    labels: history.map((_, i) => `T${i + 1}`),
    datasets: [
      {
        label: 'Detection (s)',
        data: history,
        borderColor: '#0ea5e9',
        backgroundColor: 'rgba(14,165,233,0.25)',
        tension: 0.25,
        pointRadius: 3,
      },
      {
        label: 'Target (s)',
        data: history.map(() => m.threat_detection.claim_target_seconds),
        borderColor: '#9ca3af',
        borderDash: [6, 6],
        pointRadius: 0,
      },
    ],
  } as const;

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(148,163,184,0.15)' } } },
  } as const;

  // Summary metrics
  const improvement = Math.round(m.workflow_exec_ms.improvement_pct);
  const errorReduction = Math.round(m.error_rate_per_hour.reduction_pct);
  const last = m.threat_detection.last_seconds ?? null;
  const target = m.threat_detection.claim_target_seconds;
  const pass = last !== null && last <= target;

  async function exportPDF() {
    if (!ref.current) return;
    const canvas = await html2canvas(ref.current, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('l', 'pt', 'a4');
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, w, h);
    pdf.save('cyberguard-metrics.pdf');
  }

  async function screenshot() {
    if (!ref.current) return;
    const canvas = await html2canvas(ref.current, { scale: 2 });
    const link = document.createElement('a');
    link.download = 'cyberguard-metrics.png';
    link.href = canvas.toDataURL();
    link.click();
  }

  return (
    <div ref={ref as any} className="performance-analytics-compact">
      {/* Key Metrics Row */}
      <div className="key-metrics-grid">
        <CompactMetric 
          icon="🎯" 
          label="Detection Speed" 
          value={last !== null ? `${last.toFixed(1)}s` : '—'} 
          status={pass ? 'success' : 'pending'}
          target={`≤ ${target}s`}
        />
        <CompactMetric 
          icon="⚡" 
          label="Performance" 
          value={`+${improvement}%`} 
          status="success"
          subtitle="Workflow Speed"
        />
        <CompactMetric 
          icon="🛡️" 
          label="Reliability" 
          value={`${m.uptime_percent}%`} 
          status={m.uptime_percent > 98 ? 'success' : 'warning'}
          subtitle="System Uptime"
        />
        <CompactMetric 
          icon="🔍" 
          label="Accuracy" 
          value={`${Math.round(m.autonomous_success_rate * 100)}%`} 
          status={m.autonomous_success_rate > 0.9 ? 'success' : 'warning'}
          subtitle="AI Success Rate"
        />
      </div>

      {/* Mini Charts */}
      <div className="mini-charts-grid">
        {/* Performance Trend */}
        <div className="mini-chart-card">
          <div className="mini-chart-header">
            <h5>📈 Performance Trends</h5>
            <span className="trend-indicator positive">+{improvement}%</span>
          </div>
          <div className="performance-bars">
            <PerformanceBar 
              label="Workflow" 
              baseline={m.workflow_exec_ms.baseline} 
              current={m.workflow_exec_ms.optimized}
              improvement={m.workflow_exec_ms.improvement_pct}
            />
            <PerformanceBar 
              label="Errors" 
              baseline={m.error_rate_per_hour.baseline} 
              current={m.error_rate_per_hour.optimized}
              improvement={m.error_rate_per_hour.reduction_pct}
              isReduction={true}
            />
          </div>
        </div>

        {/* Detection History */}
        <div className="mini-chart-card">
          <div className="mini-chart-header">
            <h5>⏱️ Detection History</h5>
            <span className={`status-badge ${pass ? 'success' : 'pending'}`}>
              {pass ? 'On Target' : 'Pending'}
            </span>
          </div>
          <div className="detection-timeline">
            {history.slice(-8).map((time, i) => (
              <div key={i} className="timeline-point">
                <div 
                  className={`timeline-bar ${time <= target ? 'success' : 'warning'}`}
                  style={{ 
                    height: `${Math.min(100, (time / (target * 2)) * 100)}%` 
                  }}
                />
                <span className="timeline-label">T{i+1}</span>
              </div>
            ))}
          </div>
          <div className="timeline-legend">
            <span className="legend-item">
              <div className="legend-line target" />
              Target: {target}s
            </span>
            <span className="legend-item">
              <div className="legend-line current" />
              Latest: {last?.toFixed(1) || '—'}s
            </span>
          </div>
        </div>
      </div>

      {/* Export Actions */}
      <div className="export-actions">
        <button onClick={exportPDF} className="export-btn">
          📄 Export PDF
        </button>
        <button onClick={screenshot} className="export-btn">
          📸 Screenshot
        </button>
        <a 
          className="export-btn" 
          href={`${BACKEND_HTTP_URL}/metrics.csv`} 
          target="_blank" 
          rel="noreferrer"
        >
          📊 Export CSV
        </a>
      </div>
    </div>
  );
}

function CompactMetric({ 
  icon, 
  label, 
  value, 
  status, 
  target, 
  subtitle 
}: { 
  icon: string; 
  label: string; 
  value: string; 
  status: 'success' | 'warning' | 'pending';
  target?: string;
  subtitle?: string;
}) {
  return (
    <div className={`compact-metric ${status}`}>
      <div className="metric-icon">{icon}</div>
      <div className="metric-content">
        <div className="metric-value">{value}</div>
        <div className="metric-label">{label}</div>
        {target && <div className="metric-target">{target}</div>}
        {subtitle && <div className="metric-subtitle">{subtitle}</div>}
      </div>
      <div className={`status-dot ${status}`} />
    </div>
  );
}

function PerformanceBar({ 
  label, 
  baseline, 
  current, 
  improvement,
  isReduction = false
}: { 
  label: string; 
  baseline: number; 
  current: number; 
  improvement: number;
  isReduction?: boolean;
}) {
  const percentage = Math.min(100, Math.max(0, improvement));
  const isPositive = improvement > 0;
  
  return (
    <div className="performance-bar-container">
      <div className="performance-bar-header">
        <span className="bar-label">{label}</span>
        <span className={`improvement-badge ${isPositive ? 'positive' : 'neutral'}`}>
          {isReduction ? '-' : '+'}{percentage.toFixed(1)}%
        </span>
      </div>
      <div className="performance-comparison">
        <div className="comparison-item">
          <div className="comparison-label">Before</div>
          <div className="comparison-value">{baseline}</div>
        </div>
        <div className="comparison-arrow">→</div>
        <div className="comparison-item">
          <div className="comparison-label">After</div>
          <div className="comparison-value improved">{current}</div>
        </div>
      </div>
      <div className="improvement-bar">
        <div 
          className={`improvement-fill ${isPositive ? 'positive' : 'neutral'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
