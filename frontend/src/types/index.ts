export type NodeHealth = 'healthy' | 'warning' | 'critical' | 'offline';

export interface NodeMetrics {
  cpu: number;
  memory: number;
  network_in: number;
  network_out: number;
  latency_ms: number;
}

export interface NodeStatus {
  id: string;
  name: string;
  ip?: string;
  status: NodeHealth;
  metrics: NodeMetrics;
  last_update: number;
}

export interface SecurityEvent {
  id: string;
  node_id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
}

export type WSMessage =
  | { type: 'init'; data: NodeStatus[] }
  | { type: 'metrics_update'; data: NodeStatus[] }
  | { type: 'security_event'; data: SecurityEvent }
  | { type: 'ai_decision'; data: {
      node_id: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      anomalies: string[];
      actions: string[];
      reasoning: string;
      timestamp: number;
      confidence: number;
    } }
  | { type: 'load_redistributed'; data: { node_id: string } };
