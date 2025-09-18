"use client";

import React from 'react';
import { BACKEND_HTTP_URL } from '@/lib/config';

type MetricsPayload = {
  workflow_exec_ms: { baseline: number; optimized: number; improvement_pct: number };
  error_rate_per_hour: { baseline: number; optimized: number; reduction_pct: number };
  threat_detection: { last_seconds?: number | null; avg_seconds?: number | null; claim_target_seconds: number };
};

export default function DemoSummaryCard() {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [data, setData] = React.useState<MetricsPayload | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_HTTP_URL}/metrics`, { cache: 'no-store' });
      const j = await res.json();
      setData(j);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const exportPDF = async () => {
    if (!ref.current) return;
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);
    const canvas = await html2canvas(ref.current);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 48;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.text('CyberGuard Demo Summary', 24, 28);
    pdf.addImage(imgData, 'PNG', 24, 40, imgWidth, Math.min(imgHeight, pageHeight - 80));
    pdf.save('cyberguard-demo-summary.pdf');
  };

  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 p-4">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Before/After Demo Summary</h3>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={exportPDF} className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800">Export PDF</button>
          <a href={`${BACKEND_HTTP_URL}/metrics.csv`} target="_blank" className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800">Export CSV</a>
        </div>
      </div>
      <div ref={ref} className="grid grid-cols-3 gap-3 text-xs">
        <div className="rounded-md bg-white/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-3">
          <div className="font-medium text-slate-600">Workflow Exec Time (ms)</div>
          <div className="mt-1 flex items-end gap-2">
            <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{data?.workflow_exec_ms.baseline ?? '-'}</div>
            <div className="text-slate-500">baseline</div>
          </div>
          <div className="mt-1 flex items-end gap-2">
            <div className="text-lg font-bold text-emerald-600">{data?.workflow_exec_ms.optimized ?? '-'}</div>
            <div className="text-slate-500">optimized</div>
          </div>
          <div className="mt-2 text-emerald-700 font-semibold">{data?.workflow_exec_ms.improvement_pct ?? 0}% faster</div>
        </div>

        <div className="rounded-md bg-white/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-3">
          <div className="font-medium text-slate-600">Error Rate (per hour)</div>
          <div className="mt-1 flex items-end gap-2">
            <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{data?.error_rate_per_hour.baseline ?? '-'}</div>
            <div className="text-slate-500">baseline</div>
          </div>
          <div className="mt-1 flex items-end gap-2">
            <div className="text-lg font-bold text-emerald-600">{data?.error_rate_per_hour.optimized ?? '-'}</div>
            <div className="text-slate-500">optimized</div>
          </div>
          <div className="mt-2 text-emerald-700 font-semibold">{data?.error_rate_per_hour.reduction_pct ?? 0}% fewer errors</div>
        </div>

        <div className="rounded-md bg-white/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-3">
          <div className="font-medium text-slate-600">Threat Detection</div>
          <div className="mt-1 text-slate-700 dark:text-slate-200">Last: <span className="font-semibold">{data?.threat_detection.last_seconds ? data.threat_detection.last_seconds.toFixed(1) : '-'}s</span></div>
          <div className="text-slate-700 dark:text-slate-200">Average: <span className="font-semibold">{data?.threat_detection.avg_seconds ? data.threat_detection.avg_seconds.toFixed(1) : '-'}s</span></div>
          <div className="mt-2 text-sky-700 font-semibold">Target: &lt; {data?.threat_detection.claim_target_seconds ?? 60}s</div>
        </div>
      </div>
      {loading && <div className="mt-2 text-[11px] text-slate-500">Refreshing...</div>}
    </div>
  );
}

