"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShieldAlert, BarChart3, Settings } from "lucide-react";

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const Item = ({ href, label, Icon }: { href: string; label: string; Icon: any }) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        onClick={onClose}
        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors
          ${active ? "bg-slate-200 text-slate-900" : "text-slate-600 hover:bg-slate-100"}`}
      >
        <Icon size={16} /> {label}
      </Link>
    );
  };

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 p-4 z-40 transition-transform
          ${open ? "translate-x-0" : "-translate-x-full"} lg:static lg:translate-x-0`}
      >
        <div className="mb-4">
          <div className="text-sm font-semibold text-slate-700">CyberGuard</div>
          <div className="text-xs text-slate-500">Security Platform</div>
        </div>
        <nav className="space-y-1">
          <Item href="/" label="Dashboard" Icon={LayoutDashboard} />
          <Item href="/threats" label="Threats" Icon={ShieldAlert} />
          <Item href="/analytics" label="Analytics" Icon={BarChart3} />
          <Item href="/settings" label="Settings" Icon={Settings} />
        </nav>
        <div className="mt-6 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            System Online
          </span>
        </div>
      </aside>
    </>
  );
}
