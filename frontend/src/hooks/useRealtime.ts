"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BACKEND_HTTP_URL, BACKEND_WS_URL } from '@/lib/config';
import type { NodeStatus, SecurityEvent, WSMessage } from '@/types';

interface UseRealtime {
  connected: boolean;
  nodes: NodeStatus[];
  events: SecurityEvent[];
  aiDecisions: Array<{ node_id: string; severity: 'low' | 'medium' | 'high' | 'critical'; anomalies: string[]; actions: string[]; reasoning: string; timestamp: number }>;
  highlightNodeId: string | null;
  busy: boolean;
  simulateThreat: (opts?: {
    nodeId?: string;
    type?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    message?: string;
  }) => Promise<void>;
  demoDdos: (nodeId?: string) => Promise<void>;
  demoReset: () => Promise<void>;
  redistribute: (nodeId: string) => Promise<void>;
}

export function useRealtime(): UseRealtime {
  const [connected, setConnected] = useState(false);
  const [nodes, setNodes] = useState<NodeStatus[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [aiDecisions, setAiDecisions] = useState<UseRealtime['aiDecisions']>([]);
  const [redistributed, setRedistributed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current) return;
    try {
      const ws = new WebSocket(BACKEND_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        // basic retry with backoff cap
        if (!reconnectTimer.current) {
          reconnectTimer.current = setTimeout(() => {
            reconnectTimer.current = null;
            connect();
          }, 1500);
        }
      };
      ws.onerror = () => {
        // handled by onclose for retry
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as WSMessage;
          if (msg.type === 'init' || msg.type === 'metrics_update') {
            setNodes(msg.data);
          } else if (msg.type === 'security_event') {
            setEvents((prev) => [msg.data, ...prev].slice(0, 50));
          } else if (msg.type === 'ai_decision') {
            setAiDecisions((prev) => [msg.data, ...prev].slice(0, 50));
          } else if (msg.type === 'load_redistributed') {
            setRedistributed(msg.data.node_id);
            setTimeout(() => setRedistributed(null), 3000);
          }
        } catch {
          // ignore malformed
        }
      };
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  const simulateThreat = useCallback(async (opts?: {
    nodeId?: string;
    type?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    message?: string;
  }) => {
    const nodeId = opts?.nodeId ?? 'random';
    const body = {
      node_id: opts?.nodeId,
      type: opts?.type ?? 'anomaly',
      severity: opts?.severity ?? 'medium',
      message: opts?.message,
    };
    try {
      setBusy(true);
      await fetch(`${BACKEND_HTTP_URL}/simulate-threat/${nodeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }, []);

  const demoDdos = useCallback(async (nodeId?: string) => {
    const id = nodeId ?? 'random';
    try {
      setBusy(true);
      await fetch(`${BACKEND_HTTP_URL}/demo/ddos/${id}`, { method: 'POST' });
    } catch {
    } finally {
      setBusy(false);
    }
  }, []);

  const demoReset = useCallback(async () => {
    try {
      setBusy(true);
      await fetch(`${BACKEND_HTTP_URL}/demo/reset`, { method: 'POST' });
    } catch {
    } finally {
      setBusy(false);
    }
  }, []);

  const redistribute = useCallback(async (nodeId: string) => {
    try {
      setBusy(true);
      await fetch(`${BACKEND_HTTP_URL}/redistribute-load/${nodeId}`, { method: 'POST' });
    } catch {
    } finally {
      setBusy(false);
    }
  }, []);

  return { connected, nodes, events, aiDecisions, highlightNodeId: redistributed, busy, simulateThreat, demoDdos, demoReset, redistribute };
}
