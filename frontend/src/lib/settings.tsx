"use client";

import React from 'react';
import { BACKEND_HTTP_URL } from './config';

export type AppSettings = {
  refresh_rate_sec: number;
  alert_sound: boolean;
  alert_volume: number; // 0..1
  presentation_mode_default: boolean;
  mobile_nav_collapsed_default: boolean;
};

const Defaults: AppSettings = {
  refresh_rate_sec: 3,
  alert_sound: true,
  alert_volume: 0.6,
  presentation_mode_default: false,
  mobile_nav_collapsed_default: true,
};

type SettingsCtx = {
  settings: AppSettings;
  setSettings: (s: Partial<AppSettings>) => Promise<void>;
};

const Ctx = React.createContext<SettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettingsState] = React.useState<AppSettings>(Defaults);

  const fetchSettings = React.useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND_HTTP_URL}/config`, { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        setSettingsState((prev) => ({ ...prev, ...j }));
      }
    } catch {}
  }, []);

  React.useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const setSettings = React.useCallback(async (patch: Partial<AppSettings>) => {
    setSettingsState((prev) => ({ ...prev, ...patch }));
    try {
      await fetch(`${BACKEND_HTTP_URL}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
    } catch {}
  }, []);

  return <Ctx.Provider value={{ settings, setSettings }}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('SettingsProvider not found');
  return ctx;
}

