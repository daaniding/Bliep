'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getDisplayName, setDisplayName, getMyLeagues, forgetLeague } from '@/lib/league';
import { useTrophies } from '@/lib/useTrophies';
import { useCoins } from '@/lib/useCoins';
import { useUser, apiLogout, apiUpdateDisplayName } from '@/lib/useUser';
import { useRouter } from 'next/navigation';
import { useXp } from '@/lib/useXp';
import { isSfxEnabled, setSfxEnabled, sfxTap } from '@/lib/sound';
import BHNav from '../components/BHNav';

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
  const router = useRouter();
  const { user, refresh } = useUser();
  const { trophies } = useTrophies();
  const { coins } = useCoins();
  const { xp, info: levelInfo } = useXp();
  const [sfxOn, setSfxOn] = useState(true);
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
    setSfxOn(isSfxEnabled());
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
        body: JSON.stringify({ endpoint, settings: { ...settings, morningTime: '07:00', eveningTime: '19:00' } }),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } catch (e) { console.error('Save failed:', e); }
    setSaving(false);
  }

  async function handleSaveDisplayName() {
    setDisplayName(displayName.trim());
    if (user) {
      try { await apiUpdateDisplayName(displayName.trim()); refresh(); } catch { /* ignore */ }
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleLogout() {
    await apiLogout();
    router.push('/');
    router.refresh();
  }

  function handleResetAll() {
    const prefixes = [
      'bliep:quest:claimed:', 'bliep:quest:proof:',
      'bliep:pass:claimed:', 'bliep:pass:premium:',
    ];
    const exactKeys = [
      'bliep:city:v1', 'bliep:city:v2', 'bliep:trophies:v1', 'bliep:dailypick:v1',
      'bliep:timer:v1', 'bliep:streak', 'bliep:my-leagues',
      'bliep:displayName', 'bliep:taskdone', 'bliep:woordje',
      'bliep:onboarded', 'bliep:pve:v1', 'bliep:clientId',
      'bliep:sfx',
    ];
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (prefixes.some(p => k.startsWith(p))) localStorage.removeItem(k);
      }
    } catch { /* ignore */ }
    exactKeys.forEach(k => localStorage.removeItem(k));
    location.href = '/';
  }

  function handleLeaveLeague(code: string) {
    forgetLeague(code);
    setLeagues(getMyLeagues());
  }

  if (loading) return (
    <div className="game-shell flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-4 border-[#fdd069]/30 border-t-[#fdd069] animate-spin" />
    </div>
  );

  return (
    <div className="game-shell" style={{ paddingBottom: 'calc(130px + env(safe-area-inset-bottom, 0px))' }}>
      <main className="relative z-10 px-4 pt-12 max-w-[520px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 340, damping: 26 }}
          className="flex items-center justify-between mb-6"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 game-pill"
            style={{ padding: '6px 12px', fontSize: 11, letterSpacing: '0.15em' }}
          >
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            TERUG
          </Link>
        </motion.div>

        <motion.div
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="mb-6"
        >
          <p className="game-section-label">Instellingen</p>
          <h1 className="game-h1 mt-1">Jouw koninkrijk</h1>
        </motion.div>

        <div className="flex flex-col gap-4">

          {/* Stats panel */}
          <Section label="Stats" index={0}>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <StatPill icon="🛡" value={String(levelInfo.level)} label="Level" tint="#fdd069" />
              <StatPill icon="⚡" value={String(xp)} label="XP" tint="#c0e8ff" />
              <StatPill icon="🏆" value={String(trophies)} label="Trofeeën" tint="#c9a0ff" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatPill icon="🪙" value={String(coins)} label="Coins" tint="#fdd069" small />
              <StatPill icon="🔥" value={String(streak.current)} label="Streak" tint="#ff9a5a" small />
              <StatPill icon="📅" value={String(streak.history.length)} label="Dagen" tint="#c9a970" small />
            </div>
          </Section>

          {/* Account */}
          <Section label="Account" index={1}>
            {user ? (
              <>
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: 'rgba(40,28,16,0.55)',
                    border: '1.5px solid rgba(253,208,105,0.25)',
                    marginBottom: 10,
                  }}
                >
                  <p className="font-display" style={{ fontSize: 15, color: '#fff6dc', textShadow: '0 1px 0 #0d0a06' }}>
                    {user.displayName}
                  </p>
                  <p style={{ fontSize: 11, color: '#a08560', fontFamily: 'var(--font-philosopher), serif', fontStyle: 'italic', marginTop: 2 }}>
                    @{user.username}
                  </p>
                </div>
                <button onClick={handleLogout} className="game-btn-dark w-full text-sm">
                  UITLOGGEN
                </button>
              </>
            ) : (
              <>
                <p className="game-body-italic text-xs mb-3 leading-relaxed">
                  Maak een account zodat je trofeeën en league-stand op elk apparaat hetzelfde zijn.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/login" className="game-btn-dark text-center text-sm">
                    INLOGGEN
                  </Link>
                  <Link href="/signup" className="game-btn-gold text-center text-sm">
                    ACCOUNT MAKEN
                  </Link>
                </div>
              </>
            )}
          </Section>

          {/* Display name */}
          <Section label="League naam" index={2}>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayNameState(e.target.value)}
              placeholder="Bijv. Daan"
              maxLength={24}
              className="game-pill-input"
            />
            <p className="game-body-italic text-xs mt-2 mb-3">
              Hoe je verschijnt op de ranglijst van vrienden.
            </p>
            <button
              onClick={handleSaveDisplayName}
              disabled={!displayName.trim()}
              className="game-btn-gold w-full text-sm"
            >
              {saved ? '✓ OPGESLAGEN' : 'OPSLAAN'}
            </button>
          </Section>

          {/* Leagues */}
          {leagues.length > 0 && (
            <Section label="Jouw leagues" index={3}>
              <div className="flex flex-col gap-2">
                {leagues.map(code => (
                  <div
                    key={code}
                    className="flex items-center justify-between"
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: 'rgba(40,28,16,0.55)',
                      border: '1.5px solid rgba(253,208,105,0.22)',
                    }}
                  >
                    <Link
                      href="/league"
                      className="font-mono tabular-nums"
                      style={{ fontSize: 14, color: '#fdd069', letterSpacing: '0.18em', fontWeight: 700 }}
                    >
                      {code}
                    </Link>
                    <button
                      onClick={() => handleLeaveLeague(code)}
                      style={{ fontSize: 11, color: '#e07260', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Verlaten
                    </button>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Notifications */}
          {endpoint && (
            <Section label="Meldingen" index={4}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-display" style={{ fontSize: 14, color: '#fff6dc', textShadow: '0 1px 0 #0d0a06' }}>
                    Dagelijkse Bliep
                  </p>
                  <p className="game-body-italic text-[11px] mt-0.5">
                    Herinner me aan mijn opdracht
                  </p>
                </div>
                <Toggle
                  on={settings.notifications}
                  onToggle={() => setSettings(s => ({ ...s, notifications: !s.notifications }))}
                />
              </div>
              <input
                type="text"
                value={settings.name}
                onChange={e => setSettings(s => ({ ...s, name: e.target.value }))}
                placeholder="Naam voor begroeting (optioneel)"
                className="game-pill-input"
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="game-btn-gold w-full text-sm mt-3"
              >
                {saving ? 'OPSLAAN…' : 'OPSLAAN'}
              </button>
            </Section>
          )}

          {/* Sound */}
          <Section label="Geluid" index={5}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display" style={{ fontSize: 14, color: '#fff6dc', textShadow: '0 1px 0 #0d0a06' }}>
                  Geluidseffecten
                </p>
                <p className="game-body-italic text-[11px] mt-0.5">
                  Tap, claim, win chimes
                </p>
              </div>
              <Toggle
                on={sfxOn}
                onToggle={() => {
                  const next = !sfxOn;
                  setSfxEnabled(next);
                  setSfxOn(next);
                  if (next) sfxTap();
                }}
              />
            </div>
          </Section>

          {/* Danger zone */}
          <Section label="Gevaar" index={6} danger>
            <p className="game-body-italic text-xs mb-3 leading-relaxed">
              Wist alles op dit apparaat: stad, coins, trofeeën, streak, quests, pass-claims en leagues. Niet ongedaan te maken.
            </p>
            {!confirmReset ? (
              <button
                onClick={() => setConfirmReset(true)}
                className="game-btn-dark w-full text-sm"
                style={{ color: '#e07260', borderColor: '#7a2e1a' }}
              >
                RESET ALLES
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={handleResetAll} className="game-btn-blood flex-1 text-sm">
                  JA, WISSEN
                </button>
                <button onClick={() => setConfirmReset(false)} className="game-btn-dark flex-1 text-sm">
                  ANNULEER
                </button>
              </div>
            )}
          </Section>

        </div>
      </main>
      <BHNav />
    </div>
  );
}

// ---------- sub-components ----------

function Section({ label, children, index, danger }: { label: string; children: React.ReactNode; index: number; danger?: boolean }) {
  return (
    <motion.section
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26, delay: 0.1 + index * 0.04 }}
      className="game-panel game-panel-corners"
      style={{
        padding: 14,
        ...(danger ? { borderColor: '#7a2e1a' } : null),
      }}
    >
      <p className="game-section-label mb-2" style={danger ? { color: '#e07260' } : undefined}>
        {label}
      </p>
      {children}
    </motion.section>
  );
}

function StatPill({ icon, value, label, tint, small }: { icon: string; value: string; label: string; tint: string; small?: boolean }) {
  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{
        padding: small ? '8px 6px' : '10px 6px',
        borderRadius: 12,
        background: 'linear-gradient(180deg, rgba(60,40,22,0.65) 0%, rgba(30,18,10,0.85) 100%)',
        border: '2px solid #0d0a06',
        boxShadow: 'inset 0 2px 0 rgba(255,230,160,0.14), 0 2px 0 #0d0a06',
      }}
    >
      <div style={{ fontSize: small ? 18 : 22, lineHeight: 1, marginBottom: 3 }}>{icon}</div>
      <div
        className="font-display tabular-nums"
        style={{
          fontSize: small ? 15 : 19,
          color: tint,
          textShadow: '0 1px 0 #0d0a06',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-cinzel), serif',
          fontSize: 8,
          letterSpacing: '0.16em',
          color: '#8a6a3e',
          textTransform: 'uppercase',
          marginTop: 3,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="relative"
      style={{
        width: 52,
        height: 30,
        borderRadius: 999,
        border: '2.5px solid #0d0a06',
        background: on
          ? 'linear-gradient(180deg, #ffe58a 0%, #fdd069 50%, #a3701a 100%)'
          : 'linear-gradient(180deg, #3a2718 0%, #1c0f06 100%)',
        boxShadow: on
          ? 'inset 0 2px 0 rgba(255,255,255,0.5), 0 2px 0 #6e4c10, 0 0 14px rgba(253,208,105,0.45)'
          : 'inset 0 2px 6px rgba(0,0,0,0.55)',
        cursor: 'pointer',
        transition: 'background 200ms',
      }}
      aria-label="Toggle"
    >
      <motion.span
        animate={{ x: on ? 22 : 0 }}
        transition={{ type: 'spring', stiffness: 520, damping: 28 }}
        style={{
          position: 'absolute',
          top: 2,
          left: 2,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: on ? '#fff6dc' : '#b69560',
          border: '1.5px solid #0d0a06',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 3px rgba(0,0,0,0.4)',
        }}
      />
    </button>
  );
}
