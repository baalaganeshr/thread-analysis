"use client";

import React, { useEffect, useState } from 'react';
import { BACKEND_HTTP_URL } from '@/lib/config';
import { useSettings } from '@/lib/settings';

type Analytics = {
  node_count: number;
  avg_cpu: number;
  avg_memory: number;
  threats_total: number;
  threats_active: number;
  uptime: number;
};

export default function MetricsBar() {
  const { settings } = useSettings();
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<{ mongodb: boolean; qdrant: boolean } | null>(null);

  async function fetchIt() {
    try {
      const r = await fetch(`${BACKEND_HTTP_URL}/analytics`);
      if (!r.ok) throw new Error(String(r.status));
      setData(await r.json());
      setError(null);
    } catch (e) {
      setError('unavailable');
    }
    try {
      const h = await fetch(`${BACKEND_HTTP_URL}/health`);
      if (h.ok) {
        const j = await h.json();
        setHealth(j.services);
      }
    } catch {}
  }

  useEffect(() => {
    fetchIt();
    const id = setInterval(fetchIt, Math.max(1000, settings.refresh_rate_sec * 1000));
    return () => clearInterval(id);
  }, [settings.refresh_rate_sec]);

  return (
    <div className="metrics-grid">
      <MetricCard 
        title="Active Nodes" 
        value={data?.node_count ?? 0} 
        loading={!data && !error} 
        subtitle="Connected devices"
        icon="🌐"
        trend={data?.node_count && data.node_count > 10 ? 'up' : 'stable'}
      />
      <MetricCard 
        title="Active Threats" 
        value={data?.threats_active ?? 0} 
        loading={!data && !error} 
        subtitle="Current incidents"
        icon="🚨"
        type="danger"
        isAlert={!!(data && data.threats_active > 0)}
      />
      <MetricCard 
        title="CPU Usage" 
        value={`${data?.avg_cpu ?? 0}%`} 
        loading={!data && !error} 
        subtitle="System load"
        icon="⚡"
        type={!!(data && data.avg_cpu > 80) ? 'warning' : 'normal'}
        progress={data?.avg_cpu ?? 0}
      />
      <MetricCard 
        title="System Uptime" 
        value={formatUptime(data?.uptime ?? 0)} 
        loading={!data && !error} 
        subtitle="Operational time"
        icon="⏱️"
        type="success"
      />

      {health && (
        <div className="health-status">
          <div className="health-header">
            <h3>🔧 Service Health</h3>
          </div>
          <div className="health-indicators">
            <HealthIndicator 
              service="MongoDB" 
              status={health.mongodb} 
              description="Document Database"
            />
            <HealthIndicator 
              service="Qdrant" 
              status={health.qdrant} 
              description="Vector Database"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ 
  title, 
  value, 
  loading, 
  subtitle, 
  icon,
  type = 'normal',
  isAlert = false,
  trend,
  progress
}: { 
  title: string; 
  value: React.ReactNode; 
  loading?: boolean;
  subtitle?: string;
  icon?: string;
  type?: 'normal' | 'success' | 'warning' | 'danger';
  isAlert?: boolean;
  trend?: 'up' | 'down' | 'stable';
  progress?: number;
}) {
  const cardClass = `metric-card ${type} ${isAlert ? 'alert-pulse' : ''}`;
  
  return (
    <div className={cardClass}>
      <div className="metric-header">
        <div className="metric-icon">{icon}</div>
        {loading && <div className="loading-indicator">⚡</div>}
        {trend && <TrendIndicator trend={trend} />}
      </div>
      
      <div className="metric-title">{title}</div>
      
      <div className="metric-value">
        {loading ? '—' : value}
      </div>
      
      {progress !== undefined && (
        <div className="metric-progress">
          <div 
            className="progress-bar" 
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
      
      {subtitle && (
        <div className="metric-subtitle">{subtitle}</div>
      )}
    </div>
  );
}

function TrendIndicator({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  const icons = {
    up: '📈',
    down: '📉',
    stable: '➖'
  };
  
  return (
    <span className={`trend-indicator ${trend}`}>
      {icons[trend]}
    </span>
  );
}

function HealthIndicator({ 
  service, 
  status, 
  description 
}: { 
  service: string; 
  status: boolean; 
  description: string;
}) {
  return (
    <div className={`health-indicator ${status ? 'online' : 'offline'}`}>
      <div className="health-status-dot" />
      <div className="health-info">
        <div className="health-service">{service}</div>
        <div className="health-desc">{description}</div>
      </div>
      <div className="health-status-text">
        {status ? 'Online' : 'Offline'}
      </div>
    </div>
  );
}

function formatUptime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
}

