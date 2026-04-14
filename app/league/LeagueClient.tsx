'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { getClientId } from '@/lib/clientId';
import {
  apiCreateLeague, apiGetLeague, apiJoinLeague, apiUpdateScore,
  getMyLeagues, rememberLeague, forgetLeague, getDisplayName, setDisplayName,
  type League,
} from '@/lib/league';
import { useTrophies } from '@/lib/useTrophies';
import { useUser } from '@/lib/useUser';

type View = 'menu' | 'create' | 'join' | 'view';

export default function LeagueClient() {
  const { trophies } = useTrophies();
  const { user } = useUser();
  const [clientId, setClientId] = useState('');
  const [displayName, setName] = useState('');
  const [view, setView] = useState<View>('menu');
  const [myLeagues, setMyLeagues] = useState<string[]>([]);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [activeLeague, setActiveLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [pendingDisplayName, setPendingDisplayName] = useState('');

  // Init — when logged in, use the server identity. Otherwise fall back to
  // the per-device clientId + locally stored display name.
  useEffect(() => {
    if (user) {
      setClientId(user.id);
      setName(user.displayName);
      setPendingDisplayName(user.displayName);
    } else {
      const id = getClientId();
      setClientId(id);
      const stored = getDisplayName();
      setName(stored);
      setPendingDisplayName(stored);
    }
    const list = getMyLeagues();
    setMyLeagues(list);
    if (list.length > 0) {
      setActiveCode(list[0]);
      setView('view');
    }
  }, [user]);

  // Load active league
  const refreshLeague = useCallback(async (code: string) => {
    setLoading(true);
    setError(null);
    try {
      const l = await apiGetLeague(code);
      setActiveLeague(l);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeCode) refreshLeague(activeCode);
  }, [activeCode, refreshLeague]);

  // Auto-sync trophy score to active league when it changes
  useEffect(() => {
    if (!activeCode || !clientId || !activeLeague) return;
    if (!activeLeague.members[clientId]) return;
    if (activeLeague.members[clientId].trophies === trophies) return;
    apiUpdateScore(activeCode, clientId, trophies)
      .then(setActiveLeague)
      .catch(() => { /* ignore network blips */ });
  }, [trophies, activeCode, clientId, activeLeague]);

  async function handleCreate() {
    if (!displayName) {
      setView('create');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const league = await apiCreateLeague(createName, clientId, displayName);
      rememberLeague(league.code);
      setMyLeagues(getMyLeagues());
      setActiveCode(league.code);
      setActiveLeague(league);
      setView('view');
      // Sync current trophies immediately
      if (trophies > 0) {
        await apiUpdateScore(league.code, clientId, trophies).then(setActiveLeague).catch(() => {});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kon league niet maken');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!displayName) {
      setView('join');
      return;
    }
    if (!joinCode) {
      setError('Vul een code in');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const code = joinCode.trim().toUpperCase();
      const league = await apiJoinLeague(code, clientId, displayName);
      rememberLeague(code);
      setMyLeagues(getMyLeagues());
      setActiveCode(code);
      setActiveLeague(league);
      setView('view');
      if (trophies > 0) {
        await apiUpdateScore(code, clientId, trophies).then(setActiveLeague).catch(() => {});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Joinen mislukt');
    } finally {
      setLoading(false);
    }
  }

  function handleSetName() {
    if (!pendingDisplayName.trim()) return;
    setDisplayName(pendingDisplayName.trim());
    setName(pendingDisplayName.trim());
  }

  function handleLeaveLeague() {
    if (!activeCode) return;
    if (!confirm(`Verlaat ${activeLeague?.name ?? activeCode}? Je trofeeën blijven, maar je staat niet meer in deze ranglijst voor jezelf.`)) return;
    forgetLeague(activeCode);
    const list = getMyLeagues();
    setMyLeagues(list);
    if (list.length > 0) {
      setActiveCode(list[0]);
      setView('view');
    } else {
      setActiveCode(null);
      setActiveLeague(null);
      setView('menu');
    }
  }

  const sortedMembers = activeLeague
    ? Object.values(activeLeague.members).sort((a, b) => b.trophies - a.trophies)
    : [];
  const myRank = sortedMembers.findIndex(m => m.clientId === clientId);

  return (
    <div className="min-h-dvh bg-surface relative pb-16">
      <main className="relative z-10 pt-14 max-w-[560px] mx-auto px-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="inline-flex items-center gap-1.5 text-faint text-xs font-medium tracking-wider uppercase hover:text-ink transition-colors">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Terug
          </Link>
          <div className="flex items-center gap-1 bg-[#7A2E1A]/10 rounded-full px-3 py-1.5">
            <span className="text-xs">🏆</span>
            <span className="text-[#7a2e1a] text-xs font-bold tabular-nums">{trophies}</span>
          </div>
        </div>

        <h1 className="font-serif text-3xl text-ink tracking-tight italic mb-1">Friend League</h1>
        <p className="text-muted text-sm mb-4">Speel met een groepje vrienden op een ranglijst van trofeeën.</p>

        {!user && (
          <div className="bg-accent/8 border border-accent/20 rounded-2xl p-4 mb-4 text-center">
            <p className="text-ink text-sm font-medium mb-1">📱 Maak een account voor cross-device</p>
            <p className="text-muted text-xs leading-relaxed mb-3">
              Zonder account word je herkend per apparaat. Met account zien je vrienden jou op elke telefoon en laptop.
            </p>
            <Link href="/signup" className="inline-block bg-accent text-white text-xs font-semibold px-4 py-2 rounded-full">
              Account maken
            </Link>
          </div>
        )}

        {/* Mock leaderboard preview — shown before any league setup */}
        {!displayName && <MockLeaderboardPreview hasAccount={!!user} />}

        {/* Display name setup */}
        {!displayName && (
          <section className="card-elevated p-5 mb-4 mt-4">
            <p className="text-muted text-[11px] font-semibold uppercase tracking-wider mb-3">Eerst even</p>
            <label className="block text-ink text-sm font-medium mb-2">Hoe wil je heten in de league?</label>
            <input
              type="text"
              value={pendingDisplayName}
              onChange={e => setPendingDisplayName(e.target.value)}
              placeholder="Bijv. Daan"
              maxLength={24}
              className="w-full bg-subtle border border-transparent rounded-xl px-4 py-3 text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/30 focus:bg-white transition-all text-sm mb-3"
            />
            <button
              onClick={handleSetName}
              disabled={!pendingDisplayName.trim()}
              className="w-full bg-accent text-white font-semibold py-3 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50 text-sm"
            >
              Opslaan
            </button>
          </section>
        )}

        {/* Tabs for switching league */}
        {displayName && myLeagues.length > 1 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {myLeagues.map(code => (
              <button
                key={code}
                onClick={() => { setActiveCode(code); setView('view'); }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  code === activeCode ? 'bg-accent text-white' : 'bg-subtle text-muted hover:text-ink'
                }`}
              >
                {code}
              </button>
            ))}
          </div>
        )}

        {/* Menu */}
        {displayName && view === 'menu' && (
          <section className="space-y-3">
            {myLeagues.length === 0 && (
              <>
                <div className="bg-accent/8 border border-accent/20 rounded-2xl p-4 mb-2">
                  <p className="text-ink text-sm font-medium mb-1">👋 Eerste keer hier?</p>
                  <p className="text-muted text-xs leading-relaxed">
                    Een Friend League is een klein groepje vrienden waar je trofeeën van iedereen kunt zien. Maak er één en stuur de 6-letter code naar je broer, vriendin of collega — dan zien jullie elkaars score op de ranglijst.
                  </p>
                </div>
                <MockLeaderboardPreview hasAccount={!!user} />
              </>
            )}
            <button
              onClick={() => { setError(null); setView('create'); }}
              className="w-full card-elevated p-5 text-left active:scale-[0.99] transition-transform"
            >
              <p className="font-serif text-lg text-ink italic">+ Nieuwe league maken</p>
              <p className="text-muted text-xs mt-1">Krijg een 6-letter code om met vrienden te delen</p>
            </button>
            <button
              onClick={() => { setError(null); setView('join'); }}
              className="w-full card-elevated p-5 text-left active:scale-[0.99] transition-transform"
            >
              <p className="font-serif text-lg text-ink italic">→ Joinen met code</p>
              <p className="text-muted text-xs mt-1">Heb je een code van een vriend? Vul hem hier in</p>
            </button>
          </section>
        )}

        {/* Create form */}
        {displayName && view === 'create' && (
          <section className="card-elevated p-5">
            <p className="text-muted text-[11px] font-semibold uppercase tracking-wider mb-3">Nieuwe league</p>
            <input
              type="text"
              value={createName}
              onChange={e => setCreateName(e.target.value)}
              placeholder="Naam (bv. 'De Bliepers')"
              maxLength={40}
              className="w-full bg-subtle rounded-xl px-4 py-3 text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/30 focus:bg-white transition-all text-sm mb-3"
            />
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full bg-accent text-white font-semibold py-3 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50 text-sm mb-2"
            >
              {loading ? 'Aanmaken...' : 'Aanmaken'}
            </button>
            <button onClick={() => setView('menu')} className="w-full text-faint text-xs font-medium py-2">Terug</button>
          </section>
        )}

        {/* Join form */}
        {displayName && view === 'join' && (
          <section className="card-elevated p-5">
            <p className="text-muted text-[11px] font-semibold uppercase tracking-wider mb-3">Joinen met code</p>
            <input
              type="text"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABCDEF"
              maxLength={6}
              className="w-full bg-subtle rounded-xl px-4 py-3 text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/30 focus:bg-white transition-all text-sm mb-3 font-mono tracking-widest text-center text-lg"
            />
            <button
              onClick={handleJoin}
              disabled={loading || joinCode.length < 6}
              className="w-full bg-accent text-white font-semibold py-3 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50 text-sm mb-2"
            >
              {loading ? 'Joinen...' : 'Joinen'}
            </button>
            <button onClick={() => setView('menu')} className="w-full text-faint text-xs font-medium py-2">Terug</button>
          </section>
        )}

        {error && (
          <p className="text-[#7a2e1a] text-sm text-center mt-3">{error}</p>
        )}

        {/* League view */}
        {displayName && view === 'view' && activeLeague && (
          <section>
            <div className="card-elevated p-5 mb-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-muted text-[11px] font-semibold uppercase tracking-wider">League</p>
                  <h2 className="font-serif text-xl text-ink italic">{activeLeague.name}</h2>
                </div>
                <div className="bg-accent/10 px-3 py-1.5 rounded-full">
                  <p className="font-mono text-accent font-bold text-sm tracking-widest">{activeLeague.code}</p>
                </div>
              </div>
              <p className="text-muted text-xs mb-3">
                Deel deze code met vrienden zodat ze kunnen joinen. Iedereen die in de league zit kan elkaars trofeeën zien.
              </p>
              <button
                onClick={() => navigator.clipboard?.writeText(activeLeague.code).catch(() => {})}
                className="w-full bg-subtle text-ink font-medium py-2.5 rounded-xl text-xs active:scale-[0.98] transition-transform"
              >
                Code kopiëren
              </button>
            </div>

            <div className="card-elevated p-5">
              <p className="text-muted text-[11px] font-semibold uppercase tracking-wider mb-3">Ranglijst</p>
              <div className="space-y-2">
                {sortedMembers.map((m, idx) => {
                  const isMe = m.clientId === clientId;
                  return (
                    <div
                      key={m.clientId}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                        isMe ? 'bg-accent/8 ring-1 ring-accent/30' : 'bg-subtle/40'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        idx === 0 ? 'bg-[#E8B84A] text-[#3a2a18]' :
                        idx === 1 ? 'bg-[#C0C0C0] text-[#3a2a18]' :
                        idx === 2 ? 'bg-[#CD7F32] text-white' :
                        'bg-subtle text-faint'
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm truncate ${isMe ? 'text-ink' : 'text-muted'}`}>
                          {m.name}{isMe && ' (jij)'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-sm font-bold text-[#7a2e1a]">
                        <span>{m.trophies}</span>
                        <span>🏆</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {myRank === -1 && (
                <p className="text-[11px] text-faint mt-3 text-center">
                  Je staat nog niet in deze league als lid. Verlaat en join opnieuw met je naam.
                </p>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => activeCode && refreshLeague(activeCode)}
                disabled={loading}
                className="flex-1 bg-subtle text-ink font-medium py-2.5 rounded-xl text-xs active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                {loading ? 'Vernieuwen...' : 'Vernieuwen'}
              </button>
              <button
                onClick={() => setView('menu')}
                className="flex-1 bg-subtle text-ink font-medium py-2.5 rounded-xl text-xs active:scale-[0.98] transition-transform"
              >
                Andere league
              </button>
              <button
                onClick={handleLeaveLeague}
                className="flex-1 text-[#7a2e1a] font-medium py-2.5 rounded-xl text-xs"
              >
                Verlaten
              </button>
            </div>
          </section>
        )}

        {displayName && view === 'view' && !activeLeague && !loading && (
          <p className="text-muted text-sm text-center mt-8">League laden...</p>
        )}
      </main>
    </div>
  );
}

// Mock leaderboard with blur overlay — shown to first-time visitors
// so they can SEE what League looks like before they sign up / pick
// a name. Names are obviously fictional.
const MOCK_ROWS: { name: string; trophies: number }[] = [
  { name: 'Tim',    trophies: 142 },
  { name: 'Lotte',  trophies: 98 },
  { name: 'Sven',   trophies: 76 },
  { name: 'Mira',   trophies: 54 },
  { name: 'Jasper', trophies: 31 },
];

function MockLeaderboardPreview({ hasAccount }: { hasAccount: boolean }) {
  return (
    <div className="relative mb-4 rounded-2xl overflow-hidden" style={{
      background: 'linear-gradient(180deg, #1a0f05 0%, #0d0a06 100%)',
      border: '2.5px solid #0d0a06',
      boxShadow:
        'inset 0 0 0 1.5px rgba(240, 184, 64, 0.55), ' +
        'inset 0 2px 0 rgba(255, 220, 150, 0.15), ' +
        '0 6px 16px rgba(0, 0, 0, 0.6)',
    }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <p className="font-display" style={{
          fontSize: 10, color: '#fdd069', letterSpacing: '0.18em', textTransform: 'uppercase',
          textShadow: '0 1px 0 rgba(0,0,0,0.7)',
        }}>
          Voorbeeld league
        </p>
        <p className="font-display" style={{
          fontSize: 10, color: '#f4e6b8', opacity: 0.6, letterSpacing: '0.06em',
        }}>
          De Bliepers
        </p>
      </div>

      {/* Mock rows */}
      <div className="px-2 pb-3 space-y-1">
        {MOCK_ROWS.map((row, i) => (
          <div
            key={row.name}
            className="flex items-center gap-3 px-3 py-2 rounded-lg"
            style={{
              background: i === 0
                ? 'linear-gradient(180deg, rgba(240,184,64,0.18) 0%, rgba(240,184,64,0.05) 100%)'
                : 'rgba(255, 246, 220, 0.04)',
              border: i === 0 ? '1.5px solid rgba(240, 184, 64, 0.55)' : '1px solid rgba(240, 184, 64, 0.18)',
            }}
          >
            <span className="font-display" style={{
              fontSize: 14, color: i === 0 ? '#fdd069' : '#f4e6b8', minWidth: 18, textAlign: 'center',
              textShadow: '0 1px 0 rgba(0,0,0,0.7)',
            }}>
              {i + 1}
            </span>
            <span className="font-body flex-1 truncate" style={{
              fontSize: 13, color: '#fff6dc', fontWeight: 600,
            }}>
              {row.name}
            </span>
            <span className="font-display" style={{
              fontSize: 13, color: '#fdd069', textShadow: '0 1px 0 rgba(0,0,0,0.7)',
            }}>
              {row.trophies} 🏆
            </span>
          </div>
        ))}
      </div>

      {/* Soft blur + CTA overlay */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-end pb-5 px-4"
        style={{
          background:
            'linear-gradient(180deg, rgba(13,10,6,0) 0%, rgba(13,10,6,0.05) 35%, rgba(13,10,6,0.78) 78%, rgba(13,10,6,0.96) 100%)',
          backdropFilter: 'blur(0.6px)',
          WebkitBackdropFilter: 'blur(0.6px)',
        }}
      >
        <p className="text-center font-body mb-3" style={{
          fontSize: 12, color: '#fff6dc', maxWidth: 280, lineHeight: 1.4,
        }}>
          Speel met een groepje vrienden op een ranglijst van trofeeën.
        </p>
        {!hasAccount ? (
          <Link
            href="/signup"
            className="inline-flex items-center justify-center font-display"
            style={{
              padding: '10px 22px',
              borderRadius: 999,
              background:
                'linear-gradient(180deg, #fff6dc 0%, #fdd069 18%, #f0b840 50%, #c8891e 100%)',
              border: '3px solid #0d0a06',
              boxShadow:
                'inset 0 1.5px 0 rgba(255,255,255,0.7), 0 3px 0 #6e4c10, 0 6px 14px rgba(0,0,0,0.6)',
              fontSize: 12,
              color: '#2a1505',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              textShadow: '0 1px 0 rgba(255,255,255,0.5)',
              minHeight: 44,
              textDecoration: 'none',
            }}
          >
            Account maken om mee te doen
          </Link>
        ) : (
          <p className="font-body text-center" style={{ fontSize: 11, color: '#fdd069', opacity: 0.85 }}>
            Maak hieronder je eigen league of join met een code ↓
          </p>
        )}
      </div>
    </div>
  );
}
