'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDisplayName, setDisplayName, getMyLeagues, forgetLeague } from '@/lib/league';
import { useTrophies } from '@/lib/useTrophies';
import { useCoins } from '@/lib/useCoins';

interface Settings {
  name: string;
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

export default function SettingsPage() {
  const { trophies } = useTrophies();
  const { coins } = useCoins();
  const [settings, setSettings] = useState<Settings>({ name: '', notifications: true });
  const [displayName, setDisplayNameState] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [streak, setStreak] = useState<StreakData>({ current: 0, longest: 0, lastCompletedDate: '', history: [] });
  const [leagues, setLeagues] = useState<string[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    setStreak(loadStreak());
    setDisplayNameState(getDisplayName());
    setLeagues(getMyLeagues());
    async function loadSettings() {
      if (!('serviceWorker' in navigator)) { setLoading(false); return; }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          setEndpoint(sub.endpoint);
          const res = await fetch(`/api/settings?endpoint=${encodeURIComponent(sub.endpoint)}`);
          if (res.ok) {
            const data = await res.json();
            setSettings({ name: data.name ?? '', notifications: data.notifications ?? true });
          }
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
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, settings: { ...settings, city: 'Breukelen', lat: 52.1715, lon: 4.9927, morningTime: '07:00', eveningTime: '19:00' } }),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } catch (e) { console.error('Save failed:', e); }
    setSaving(false);
  }

  function handleSaveDisplayName() {
    setDisplayName(displayName.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleResetAll() {
    const keys = [
      'bliep:city:v1', 'bliep:trophies:v1', 'bliep:dailypick:v1',
      'bliep:timer:v1', 'bliep:streak', 'bliep:my-leagues',
      'bliep:displayName', 'bliep:taskdone', 'bliep:woordje',
      'bliep:onboarded', 'bliep:pve:v1', 'bliep:clientId',
    ];
    keys.forEach(k => localStorage.removeItem(k));
    location.href = '/';
  }

  function handleLeaveLeague(code: string) {
    forgetLeague(code);
    setLeagues(getMyLeagues());
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
          {/* Stats */}
          <section className="animate-fade-up card p-5">
            <p className="text-muted text-[11px] font-semibold uppercase tracking-wider mb-4">Jouw stats</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-2xl font-serif text-ink">{coins}</p>
                <p className="text-[10px] text-faint mt-0.5">🪙 Coins</p>
              </div>
              <div>
                <p className="text-2xl font-serif text-ink">{trophies}</p>
                <p className="text-[10px] text-faint mt-0.5">🏆 Trofeeën</p>
              </div>
              <div>
                <p className="text-2xl font-serif text-ink">{streak.current}</p>
                <p className="text-[10px] text-faint mt-0.5">🔥 Streak</p>
              </div>
              <div>
                <p className="text-2xl font-serif text-ink">{streak.history.length}</p>
                <p className="text-[10px] text-faint mt-0.5">Totaal</p>
              </div>
            </div>
          </section>

          {/* Display name for league */}
          <section className="animate-fade-up card p-5">
            <label className="block text-muted text-[11px] font-semibold uppercase tracking-wider mb-3">Naam in Friend League</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayNameState(e.target.value)}
              placeholder="Bijv. Daan"
              maxLength={24}
              className={inputClasses}
            />
            <p className="text-[11px] text-faint mt-2">Hoe je verschijnt op de ranglijst van vrienden</p>
            <button
              onClick={handleSaveDisplayName}
              disabled={!displayName.trim()}
              className="mt-3 w-full bg-accent text-white font-semibold py-2.5 rounded-xl text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {saved ? 'Opgeslagen!' : 'Opslaan'}
            </button>
          </section>

          {/* My leagues */}
          {leagues.length > 0 && (
            <section className="animate-fade-up card p-5">
              <p className="text-muted text-[11px] font-semibold uppercase tracking-wider mb-3">Jouw leagues</p>
              <div className="space-y-2">
                {leagues.map(code => (
                  <div key={code} className="flex items-center justify-between bg-subtle rounded-xl px-4 py-2.5">
                    <Link href="/league" className="font-mono font-bold text-sm text-ink tracking-widest">
                      {code}
                    </Link>
                    <button onClick={() => handleLeaveLeague(code)} className="text-[#7a2e1a] text-xs font-medium">
                      Verlaat
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Notifications */}
          {endpoint && (
            <section className="animate-fade-up card p-5">
              <div className="flex items-center justify-between mb-3">
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
              <input
                type="text"
                value={settings.name}
                onChange={e => setSettings(s => ({ ...s, name: e.target.value }))}
                placeholder="Naam voor begroeting (optioneel)"
                className={inputClasses}
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="mt-3 w-full bg-accent text-white font-semibold py-2.5 rounded-xl text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                {saving ? 'Opslaan...' : 'Opslaan'}
              </button>
            </section>
          )}

          {!endpoint && (
            <section className="animate-fade-up card p-5 text-center">
              <p className="text-muted text-sm mb-1">Notificaties staan uit</p>
              <p className="text-[11px] text-faint">Zet ze aan op de homepagina voor meer instellingen.</p>
            </section>
          )}

          {/* Danger zone */}
          <section className="animate-fade-up card p-5 border border-[#C75B3D]/20">
            <p className="text-[#7a2e1a] text-[11px] font-semibold uppercase tracking-wider mb-2">Reset</p>
            <p className="text-muted text-xs mb-3">Wist alles op dit apparaat: stad, coins, trofeeën, streak, league memberships. Niet ongedaan te maken.</p>
            {!confirmReset ? (
              <button
                onClick={() => setConfirmReset(true)}
                className="w-full bg-[#C75B3D]/10 text-[#7a2e1a] font-semibold py-2.5 rounded-xl text-sm active:scale-[0.98] transition-transform"
              >
                Reset alles
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetAll}
                  className="flex-1 bg-[#C75B3D] text-white font-semibold py-2.5 rounded-xl text-sm active:scale-[0.98] transition-transform"
                >
                  Ja, alles wissen
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="flex-1 bg-subtle text-ink font-semibold py-2.5 rounded-xl text-sm active:scale-[0.98] transition-transform"
                >
                  Annuleer
                </button>
              </div>
            )}
          </section>
        </div>

        <footer className="mt-14 pb-6 text-center">
          <p className="text-[10px] text-faint tracking-[0.2em] uppercase font-medium">Bliep · prototype</p>
        </footer>
      </main>
    </div>
  );
}
