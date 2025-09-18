"use client";
import React from 'react';
import PerformanceCharts from '@/components/PerformanceCharts';
import DemoSummaryCard from '@/components/DemoSummaryCard';

export default function AnalyticsPage(){
  return (
    <main className="min-h-screen">
      <div className="container py-6">
        <h1 className="text-[24px] font-semibold text-slate-900 mb-4">Analytics</h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-1 card"><DemoSummaryCard /></div>
          <div className="lg:col-span-2 card"><PerformanceCharts /></div>
        </div>
      </div>
    </main>
  );
}
