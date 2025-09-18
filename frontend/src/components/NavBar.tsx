"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavBar() {
  const pathname = usePathname();
  const Item = ({ href, label }: { href: string; label: string }) => (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-md text-sm ${pathname === href ? 'bg-slate-200 text-slate-900' : 'text-slate-600 hover:bg-slate-100'}`}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex items-center gap-2">
      <Item href="/" label="Dashboard" />
      <Item href="/threats" label="Threats" />
      <Item href="/analytics" label="Analytics" />
      <Item href="/settings" label="Settings" />
    </div>
  );
}
