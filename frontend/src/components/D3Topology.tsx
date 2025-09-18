"use client";

import * as d3 from 'd3';
import React, { useEffect, useRef } from 'react';
import type { NodeStatus } from '@/types';

function color(status: NodeStatus['status']) {
  switch (status) {
    case 'healthy':
      return '#10b981';
    case 'warning':
      return '#f59e0b';
    case 'critical':
      return '#e11d48';
    default:
      return '#94a3b8';
  }
}

export default function D3Topology({ nodes, highlightNodeId }: { nodes: NodeStatus[]; highlightNodeId?: string | null }) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll('*').remove();
    const width = 600;
    const height = 360;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    // build a ring topology for 5 nodes
    const R = Math.min(width, height) / 2 - 40;
    const cx = width / 2;
    const cy = height / 2;
    const positions = nodes.map((n, i) => {
      const a = (i / Math.max(1, nodes.length)) * 2 * Math.PI;
      return { id: n.id, x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), status: n.status };
    });
    const edges = positions.map((p, i) => ({
      source: p,
      target: positions[(i + 1) % positions.length],
    }));

    const edgeG = svg.append('g');
    const lines = edgeG
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y)
      .attr('stroke-width', 1.8)
      .attr('opacity', 0.85)
      .attr('stroke', (d: any) => {
        const a = d.source as any;
        const b = d.target as any;
        const isThreat = a.status === 'critical' || b.status === 'critical';
        const isRedistributing = !!highlightNodeId && (a.id === highlightNodeId || b.id === highlightNodeId);
        if (isThreat) return '#ef4444'; // red
        if (isRedistributing) return '#3b82f6'; // blue
        if (a.status === 'healthy' && b.status === 'healthy') return '#10b981'; // green
        return '#94a3b8';
      })
      .attr('stroke-dasharray', (d: any) => {
        const a = d.source as any;
        const b = d.target as any;
        const isThreat = a.status === 'critical' || b.status === 'critical';
        const isRedistributing = !!highlightNodeId && (a.id === highlightNodeId || b.id === highlightNodeId);
        return isThreat || isRedistributing ? '6 10' : null;
      });

    // Simple pulsing flow animation for active edges
    function animate() {
      lines
        .transition()
        .duration(1200)
        .ease(d3.easeLinear)
        .attr('stroke-dashoffset', 16)
        .transition()
        .duration(0)
        .attr('stroke-dashoffset', 0)
        .on('end', animate);
    }
    animate();

    const g = svg.append('g');
    const nodeG = g
      .selectAll('g.node')
      .data(positions)
      .join('g')
      .attr('class', 'node')
      .attr('transform', (d: any) => `translate(${d.x}, ${d.y})`);

    nodeG
      .append('circle')
      .attr('r', 16)
      .attr('fill', (d: any) => color(d.status))
      .attr('stroke', '#0ea5e9')
      .attr('stroke-width', 1.25)
      .append('title')
      .text((d: any) => d.id);

    nodeG
      .append('text')
      .text((d: any) => d.id.replace('node-', ''))
      .attr('text-anchor', 'middle')
      .attr('dy', 5)
      .attr('fill', '#0f172a')
      .attr('font-size', 10)
      .attr('font-weight', 700);
  }, [nodes, highlightNodeId]);

  return <svg ref={ref} className="w-full h-[360px] rounded-md bg-white/40 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800" />;
}
