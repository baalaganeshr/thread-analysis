"use client";

import React from 'react';
import Sidebar from './Sidebar';
import NavBar from '@/components/NavBar';
import { Menu } from 'lucide-react';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur">
        <div className="container py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
              className="lg:hidden inline-flex items-center justify-center rounded-md border px-2.5 py-1.5 hover:bg-slate-100"
            >
              <Menu size={18} />
            </button>
            <div className="hidden lg:block text-sm font-semibold text-slate-700">CyberGuard</div>
          </div>
          <div className="hidden lg:block">
            <NavBar />
          </div>
        </div>
      </header>

      <div className="flex">
        <div className="lg:w-64">
          <Sidebar open={open} onClose={() => setOpen(false)} />
        </div>
        <main className="flex-1">
          <div className="container py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
