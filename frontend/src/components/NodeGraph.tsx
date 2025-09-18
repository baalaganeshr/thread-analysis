"use client";

import React from 'react';
import type { NodeStatus } from '@/types';

function statusColor(status: NodeStatus['status']): string {
  switch (status) {
    case 'healthy':
      return 'bg-emerald-500';
    case 'warning':
      return 'bg-amber-500';
    case 'critical':
      return 'bg-rose-600';
    case 'offline':
      return 'bg-gray-400';
    default:
      return 'bg-slate-400';
  }
}

export function NodeGraph({
  nodes,
  onAction,
  highlightNodeId,
}: {
  nodes: NodeStatus[];
  onAction?: (action: 'quarantine' | 'scan' | 'details', nodeId: string) => void;
  highlightNodeId?: string | null;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {nodes.map((n) => (
        <div
          key={n.id}
          className={`rounded-lg border p-4 bg-white/50 dark:bg-slate-900/40 backdrop-blur ${
            highlightNodeId === n.id ? 'border-sky-500 shadow-[0_0_0_3px_rgba(14,165,233,0.3)] transition-all' : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${statusColor(n.status)}`} />
            <div className="font-medium">{n.name}</div>
            <div className="ml-auto text-xs text-slate-500">{n.ip ?? n.id}</div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Metric label="CPU" value={n.metrics.cpu} suffix="%" />
            <Metric label="Memory" value={n.metrics.memory} suffix="%" />
            <Metric label="In" value={n.metrics.network_in} suffix="MB/s" />
            <Metric label="Out" value={n.metrics.network_out} suffix="MB/s" />
            <Metric label="Latency" value={n.metrics.latency_ms} suffix="ms" />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              className="inline-flex items-center rounded bg-rose-600/90 text-white text-xs px-2 py-1 hover:bg-rose-700"
              onClick={() => onAction?.('quarantine', n.id)}
            >
              Quarantine
            </button>
            <button
              className="inline-flex items-center rounded bg-sky-600/90 text-white text-xs px-2 py-1 hover:bg-sky-700"
              onClick={() => onAction?.('scan', n.id)}
            >
              Deep Scan
            </button>
            <button
              className="inline-flex items-center rounded border border-slate-300 text-slate-700 dark:text-slate-200 text-xs px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => onAction?.('details', n.id)}
            >
              Details
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Metric({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div className="text-slate-500 text-xs">{label}</div>
        <div className="font-semibold">
          {value}
          {suffix ? ` ${suffix}` : ''}
        </div>
      </div>
      {label === 'CPU' || label === 'Memory' ? (
        <div className="mt-1 h-1.5 w-full rounded bg-slate-200 dark:bg-slate-800">
          <div
            className="h-1.5 rounded bg-sky-500"
            style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export default NodeGraph;
