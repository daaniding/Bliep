'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Settings {
  name: string;
  city: string;
  lat: number;
  lon: number;
  morningTime: string;
  eveningTime: string;
  notifications: boolean;
}

interface StreakData {
  current: number;
  longest: number;
  lastCompletedDate: string;
  history: string[];
}

function loadStreak(): StreakData {
  try {
    const raw = localStorage.getItem('bliep:streak');
    if (raw) { const p = JSON.parse(raw); return { ...p, history: p.history || [] }; }
  } catch { /* ignore */ }
  return { current: 0, longest: 0, lastCompletedDate: '', history: [] };
}

// Mini heatmap for settings
function MiniHeatmap({ history }: { history: string[] }) {
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
  const historySet = new Set(history);
  const cells: { date: string; active: boolean }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    cells.push({ date: d.toISOString().split('T')[0], active: historySet.has(d.toISOString().split('T')[0]) });
  }
  return (
    <div className="flex gap-[2px] flex-wrap">
      {cells.map((cell) => (
        <div key={cell.date} className={`w-3 h-3 rounded-[2px] ${cell.active ? 'bg-green' : 'bg-subtle'}`} title={cell.date} />
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    name: '', city: 'Breukelen', lat: 52.1715, lon: 4.9927,
    morningTime: '07:00', eveningTime: '19:00', notifications: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [streak, setStreak] = useState<StreakData>({ current: 0, longest: 0, lastCompletedDate: '', history: [] });
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    setStreak(loadStreak());
    async function loadSettings() {
      if (!('serviceWorker' in navigator)) { setLoading(false); return; }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          setEndpoint(sub.endpoint);
          const res = await fetch(`/api/settings?endpoint=${encodeURIComponent(sub.endpoint)}`);
          if (res.ok) setSettings(await res.json());
        }
      } catch (e) { console.error('Failed to load settings:', e); }
      setLoading(false);
    }
    loadSettings();
  }, []);

  async function handleSave() {
    if (!endpoint) return;
    setSaving(true); setSaved(false);
    try {
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint, settings }) });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } catch (e) { console.error('Save failed:', e); }
    setSaving(false);
  }

  function handleResetStreak() {
    localStorage.removeItem('bliep:streak');
    setStreak({ current: 0, longest: 0, lastCompletedDate: '', history: [] });
    setShowResetConfirm(false);
  }

  if (loading) return (
    <div className="min-h-dvh flex items-center justify-center bg-surface">
      <div className="w-10 h-10 rounded-2xl bg-accent/20 animate-soft-pulse" />
    </div>
  );

  const inputClasses = "w-full bg-subtle border border-transparent rounded-xl px-4 py-3 text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/30 focus:bg-white transition-all text-sm";

  return (
    <div className="min-h-dvh bg-surface">
      <main className="relative z-10 px-5 pt-14 pb-10 max-w-[560px] mx-auto">
        <header className="mb-8 animate-fade-up">
          <Link href="/" className="inline-flex items-center gap-1.5 text-faint text-xs font-medium tracking-wider uppercase hover:text-ink transition-colors">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Terug
          </Link>
          <h1 className="font-serif text-3xl text-ink tracking-tight italic mt-4">Instellingen</h1>
        </header>

        <div className="space-y-4 stagger">
          {/* Streak Overview */}
          <section className="animate-fade-up card p-5">
            <p className="text-muted text-[11px] font-semibold uppercase tracking-wider mb-4">Je streak</p>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-serif text-ink">{streak.current}</p>
                <p className="text-[10px] text-faint mt-0.5">Huidig</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-serif text-ink">{streak.longest}</p>
                <p className="text-[10px] text-faint mt-0.5">Record</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-serif text-ink">{streak.history.length}</p>
                <p className="text-[10px] text-faint mt-0.5">Totaal</p>
              </div>
            </div>
            {streak.history.length > 0 && (
              <div className="mb-3">
                <MiniHeatmap history={streak.history} />
              </div>
            )}
            {!showResetConfirm ? (
              <button onClick={() => setShowResetConfirm(true)} className="text-[11px] text-faint hover:text-red transition-colors">
                Streak resetten
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button onClick={handleResetStreak} className="text-[11px] text-red font-medium">Ja, reset alles</button>
                <button onClick={() => setShowResetConfirm(false)} className="text-[11px] text-faint">Annuleer</button>
              </div>
            )}
          </section>

          {endpoint && (
            <>
              <section className="animate-fade-up card p-5">
                <label className="block text-muted text-[11px] font-semibold uppercase tracking-wider mb-3">Je naam</label>
                <input type="text" value={settings.name} onChange={e => setSettings(s => ({ ...s, name: e.target.value }))} placeholder="Bijv. Daan" className={inputClasses} />
                <p className="text-[11px] text-faint mt-2">Voor een persoonlijke begroeting</p>
              </section>

              <section className="animate-fade-up card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-ink text-sm font-medium">Notificaties</p>
                    <p className="text-[11px] text-faint mt-0.5">Ontvang dagelijks een Bliep</p>
                  </div>
                  <button
                    onClick={() => setSettings(s => ({ ...s, notifications: !s.notifications }))}
                    className={`relative w-12 h-7 rounded-full transition-all duration-300 ${settings.notifications ? 'bg-accent' : 'bg-text-tertiary/20'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${settings.notifications ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </section>

              <button
                onClick={handleSave}
                disabled={saving}
                className="animate-fade-up w-full bg-accent text-white font-semibold py-3.5 rounded-2xl transition-transform active:scale-[0.98] disabled:opacity-50 glow-accent text-sm"
              >
                {saving ? 'Opslaan...' : saved ? 'Opgeslagen!' : 'Opslaan'}
              </button>
            </>
          )}

          {!endpoint && (
            <section className="animate-fade-up card p-5 text-center">
              <p className="text-muted text-sm mb-1">Notificaties staan uit</p>
              <p className="text-[11px] text-faint">Zet notificaties aan op de homepagina voor meer instellingen.</p>
            </section>
          )}
        </div>

        <footer className="mt-14 pb-6 text-center">
          <p className="text-[10px] text-faint tracking-[0.2em] uppercase font-medium">Bliep v3</p>
        </footer>
      </main>
    </div>
  );
}
