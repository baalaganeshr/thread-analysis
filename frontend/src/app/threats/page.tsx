"use client";
import React from 'react';
import { useRealtime } from '@/hooks/useRealtime';
import AlertToaster from '@/components/AlertToaster';
import NodeGraph from '@/components/NodeGraph';

export default function ThreatsPage(){
  const { nodes, events, aiDecisions } = useRealtime();
  return (
    <main className="min-h-screen">
      <div className="container py-6">
        <h1 className="text-[24px] font-semibold text-slate-900 mb-4">Threats</h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card">
            <div className="card-header"><h2 className="card-title">Nodes</h2></div>
            <NodeGraph nodes={nodes} />
          </div>
          <div className="card">
            <div className="card-header"><h2 className="card-title">Security Alerts</h2></div>
            <AlertToaster events={events} ai={aiDecisions} />
          </div>
        </div>
      </div>
    </main>
  );
}
