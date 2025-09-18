"use client";

import React from 'react';
import type { SecurityEvent, WSMessage } from '@/types';
import { AlertTriangle, Brain } from 'lucide-react';
import { useSettings } from '@/lib/settings';

type AIDecision = Extract<WSMessage, { type: 'ai_decision' }>['data'];

export default function AlertToaster({ events, ai }: { events: SecurityEvent[]; ai?: Partial<AIDecision>[] }) {
  const { settings } = useSettings();
  const [query, setQuery] = React.useState('');
  const [levels, setLevels] = React.useState<{ low: boolean; medium: boolean; high: boolean; critical: boolean }>({ low: true, medium: true, high: true, critical: true });

  // simple chime on new important alerts
  const counts = React.useRef({ e: 0, a: 0 });
  React.useEffect(() => {
    const important = (s: string | undefined) => s === 'high' || s === 'critical';
    const eNew = events.length > counts.current.e && events.slice(0, 3).some((x) => important(x.severity));
    const aNew = (ai?.length ?? 0) > counts.current.a && (ai ?? []).slice(0, 3).some((x) => important(x.severity));
    if ((eNew || aNew) && settings.alert_sound) {
      try {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(880, ctx.currentTime);
          o.connect(g);
          g.connect(ctx.destination);
          g.gain.value = Math.min(1, Math.max(0, settings.alert_volume)) * 0.05;
          o.start();
          setTimeout(() => { o.stop(); ctx.close(); }, 220);
        }
      } catch {}
    }
    counts.current = { e: events.length, a: ai?.length ?? 0 };
  }, [events, ai, settings.alert_sound, settings.alert_volume]);

  const match = (txt: string) => !query || txt.toLowerCase().includes(query.toLowerCase());
  const eFiltered = events.filter((e) => levels[e.severity] && match(`${e.type} ${e.message} ${e.node_id}`));
  const aFiltered = (ai ?? []).filter((d) => d.severity && levels[d.severity as keyof typeof levels] && match(`${d.reasoning ?? ''} ${(d.anomalies ?? []).join(' ')}`));

  if (!events.length && !ai?.length) {
    return (
      <div className="empty-alerts">
        <div className="empty-icon">🛡️</div>
        <p>All systems secure</p>
        <span>No active threats detected</span>
      </div>
    );
  }

  return (
    <div className="alert-container">
      <div className="alert-controls">
        <input 
          value={query} 
          onChange={(e) => setQuery(e.target.value)} 
          placeholder="🔍 Search alerts..." 
          className="alert-search" 
        />
        <div className="alert-filters">
          {(['low','medium','high','critical'] as const).map((k) => (
            <label key={k} className="filter-item">
              <input 
                type="checkbox" 
                checked={levels[k]} 
                onChange={(e) => setLevels((s) => ({ ...s, [k]: e.target.checked }))} 
              />
              <span className={`severity-label ${k}`}>{k}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="alerts-list">
        {aFiltered.slice(0, 3).map((d, i) => (
          <div key={`ai-${i}`} className="ai-decision-card">
            <div className="ai-header">
              <Brain className="ai-icon" />
              <div className="ai-title">🤖 AI Analysis</div>
              <div className={`severity-badge ${d.severity || 'info'}`}>
                {(d.severity ?? 'info').toString().toUpperCase()}
              </div>
            </div>
            <div className="ai-reasoning">
              {d.reasoning || 'AI analysis in progress...'}
            </div>
            <div className="ai-details">
              <div className="ai-detail-item">
                <strong>Anomalies:</strong> {(d.anomalies ?? []).join(', ') || 'None'}
              </div>
              <div className="ai-detail-item">
                <strong>Actions:</strong> {(d.actions ?? []).join(', ') || 'None'}
              </div>
              <div className="ai-detail-item">
                <strong>Confidence:</strong> {d.confidence ? Math.round(d.confidence * 100) : 0}%
              </div>
            </div>
          </div>
        ))}

        {eFiltered.slice(0, 10).map((e) => (
          <div key={e.id} className={`alert-card severity-${e.severity}`}>
            <div className="alert-header">
              <AlertTriangle className="alert-icon" />
              <div className="alert-title">{e.type}</div>
              <div className="alert-time">
                {new Date(e.timestamp * 1000).toLocaleTimeString()}
              </div>
            </div>
            <div className="alert-message">{e.message}</div>
            <div className="alert-footer">
              <span className="alert-node">📍 Node: {e.node_id}</span>
              <span className={`alert-severity ${e.severity}`}>
                {e.severity.toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function sevColor(sev: 'low' | 'medium' | 'high' | 'critical'): string {
  switch (sev) {
    case 'low': return 'text-emerald-600';
    case 'medium': return 'text-amber-600';
    case 'high':
    case 'critical': return 'text-rose-600';
    default: return 'text-slate-600';
  }
}
