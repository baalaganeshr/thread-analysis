"use client";

import React from 'react';
import { useSettings } from '@/lib/settings';

export default function SettingsPage() {
  const { settings, setSettings } = useSettings();
  const [local, setLocal] = React.useState(settings);

  React.useEffect(() => setLocal(settings), [settings]);

  function onChange<K extends keyof typeof local>(k: K, v: (typeof local)[K]) {
    setLocal((s) => ({ ...s, [k]: v }));
  }

  async function save() {
    await setSettings(local);
  }

  return (
    <main className="min-h-screen p-6 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <section className="rounded-md border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-600">Alerts</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={local.alert_sound} onChange={(e) => onChange('alert_sound', e.target.checked)} />
            Enable alert sound
          </label>
          <label className="block text-sm">Volume
            <input type="range" min={0} max={1} step={0.05} value={local.alert_volume} onChange={(e) => onChange('alert_volume', Number(e.target.value))} className="w-full" />
          </label>
        </section>

        <section className="rounded-md border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-600">Refresh</h2>
          <label className="block text-sm">Refresh rate (seconds)
            <input type="number" min={1} max={60} value={local.refresh_rate_sec} onChange={(e) => onChange('refresh_rate_sec', Math.max(1, Math.min(60, Number(e.target.value))))} className="mt-1 w-24 rounded border px-2 py-1 bg-white/70 dark:bg-slate-900/50" />
          </label>
        </section>

        <section className="rounded-md border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-600">Display</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={local.presentation_mode_default} onChange={(e) => onChange('presentation_mode_default', e.target.checked)} />
            Presentation mode by default
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={local.mobile_nav_collapsed_default} onChange={(e) => onChange('mobile_nav_collapsed_default', e.target.checked)} />
            Collapse nav on mobile
          </label>
        </section>

        <div className="flex gap-2">
          <button onClick={save} className="inline-flex items-center rounded bg-sky-600 text-white text-sm px-3 py-1.5 hover:bg-sky-700">Save Changes</button>
        </div>
      </div>
    </main>
  );
}

