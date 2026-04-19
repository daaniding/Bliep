'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();
  const [clientId, setClientId] = useState('');
  const [displayName, setName] = useState('');
  const [view, setView] = useState<View>('menu');
  const [myLeagues, setMyLeagues] = useState<string[]>([]);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [activeLeague, setActiveLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

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
    // Deep-link: ?join=ABC123 → open join-form with code prefilled
    const joinParam = searchParams?.get('join');
    if (joinParam) {
      setJoinCode(joinParam.toUpperCase().slice(0, 6));
      setView('join');
    } else if (list.length > 0) {
      setActiveCode(list[0]);
      setView('view');
    }
  }, [user, searchParams]);

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

        {/* Display name setup */}
        {!displayName && (
          <section className="card-elevated p-5 mb-4">
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
              <div className="bg-accent/8 border border-accent/20 rounded-2xl p-4 mb-2">
                <p className="text-ink text-sm font-medium mb-1">👋 Eerste keer hier?</p>
                <p className="text-muted text-xs leading-relaxed">
                  Een Friend League is een klein groepje vrienden waar je trofeeën van iedereen kunt zien. Maak er één en stuur de 6-letter code naar je broer, vriendin of collega — dan zien jullie elkaars score op de ranglijst.
                </p>
              </div>
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
            {/* League header card */}
            <div className="card-elevated p-5 mb-4 relative overflow-hidden">
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none opacity-[0.08]"
                style={{
                  background: 'radial-gradient(ellipse at 80% 0%, #E8B84A 0%, transparent 60%)',
                }}
              />
              <div className="relative flex items-start justify-between mb-3">
                <div>
                  <p className="text-muted text-[11px] font-semibold uppercase tracking-wider">League</p>
                  <h2 className="font-serif text-xl text-ink italic">{activeLeague.name}</h2>
                  <p className="text-faint text-[11px] mt-1">{Object.keys(activeLeague.members).length} leden</p>
                </div>
                <div className="bg-accent/10 px-3 py-1.5 rounded-full">
                  <p className="font-mono text-accent font-bold text-sm tracking-widest">{activeLeague.code}</p>
                </div>
              </div>
              <div className="relative grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(activeLeague.code).catch(() => {});
                    setCopyFeedback(true);
                    window.setTimeout(() => setCopyFeedback(false), 1600);
                  }}
                  className="bg-subtle text-ink font-medium py-2.5 rounded-xl text-xs active:scale-[0.98] transition-transform"
                >
                  {copyFeedback ? '✓ Gekopieerd' : '📋 Code kopiëren'}
                </button>
                <button
                  onClick={() => {
                    const url = `${location.origin}/league?join=${encodeURIComponent(activeLeague.code)}`;
                    const nav = navigator as Navigator & { share?: (d: { url: string; title?: string; text?: string }) => Promise<void> };
                    if (nav.share) {
                      nav.share({ title: `Bliep: ${activeLeague.name}`, text: 'Speel met me mee!', url }).catch(() => {});
                    } else {
                      navigator.clipboard?.writeText(url).catch(() => {});
                      setCopyFeedback(true);
                      window.setTimeout(() => setCopyFeedback(false), 1600);
                    }
                  }}
                  className="bg-accent text-white font-medium py-2.5 rounded-xl text-xs active:scale-[0.98] transition-transform"
                >
                  🔗 Deel link
                </button>
              </div>
            </div>

            {/* Leaderboard */}
            <div className="card-elevated p-4 overflow-hidden">
              <div className="flex items-center justify-between mb-3 px-1">
                <p className="text-muted text-[11px] font-semibold uppercase tracking-wider">Ranglijst</p>
                <p className="text-faint text-[11px] tabular-nums">
                  {myRank >= 0 ? `Jij #${myRank + 1}` : ''}
                </p>
              </div>
              <motion.div className="flex flex-col gap-2" layout>
                <AnimatePresence initial={false}>
                  {sortedMembers.map((m, idx) => {
                    const isMe = m.clientId === clientId;
                    const rank = idx + 1;
                    const isTop3 = rank <= 3;
                    const rankColor = rank === 1 ? '#E8B84A' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : '#6a4f2e';
                    const firstLetter = (m.name || '?').charAt(0).toUpperCase();
                    return (
                      <motion.div
                        key={m.clientId}
                        layout="position"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 340, damping: 26 }}
                        className="relative flex items-center gap-3 p-3 rounded-xl"
                        style={{
                          background: isMe
                            ? 'linear-gradient(90deg, rgba(232,184,74,0.18) 0%, rgba(232,184,74,0.05) 100%)'
                            : isTop3
                              ? `linear-gradient(90deg, ${rankColor}18 0%, transparent 70%)`
                              : 'rgba(245,240,230,0.4)',
                          border: isMe ? '1.5px solid rgba(232,184,74,0.45)' : isTop3 ? `1px solid ${rankColor}40` : '1px solid transparent',
                          boxShadow: isTop3 ? `0 0 0 0 transparent, 0 2px 6px ${rankColor}22` : 'none',
                        }}
                      >
                        {/* Rank badge */}
                        <div
                          className="relative flex-shrink-0 flex items-center justify-center font-bold text-sm"
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: isTop3
                              ? `radial-gradient(circle at 30% 28%, #fff6dc 0%, ${rankColor} 60%, #3a2a18 100%)`
                              : 'rgba(120,90,50,0.15)',
                            color: isTop3 ? '#2a1a06' : '#6a4f2e',
                            border: isTop3 ? '1.5px solid #3a2a18' : '1px solid rgba(120,90,50,0.25)',
                            boxShadow: isTop3 ? 'inset 0 1px 0 rgba(255,255,255,0.35)' : 'none',
                            textShadow: isTop3 ? '0 1px 0 rgba(255,255,255,0.4)' : 'none',
                          }}
                        >
                          {rank}
                        </div>
                        {/* Avatar letter */}
                        <div
                          className="flex-shrink-0 flex items-center justify-center"
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            background: isMe
                              ? 'linear-gradient(180deg, #E8B84A, #8a6320)'
                              : `hsl(${(m.clientId.charCodeAt(0) * 17 + m.clientId.charCodeAt(m.clientId.length - 1)) % 360} 45% 60%)`,
                            color: '#fff',
                            fontWeight: 800,
                            fontSize: 14,
                            fontFamily: "'Lilita One', sans-serif",
                            border: '2px solid rgba(58,42,24,0.25)',
                            textShadow: '0 1px 0 rgba(0,0,0,0.3)',
                          }}
                        >
                          {firstLetter}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm truncate ${isMe ? 'text-ink' : 'text-muted'}`}>
                            {m.name}
                            {isMe && <span className="text-accent text-[10px] ml-1.5 font-bold">· JIJ</span>}
                          </p>
                          {isTop3 && (
                            <p className="text-[10px] font-bold tracking-wider" style={{ color: rankColor }}>
                              {rank === 1 ? '👑 LEIDER' : rank === 2 ? '⚔️ TWEEDE' : '🥉 DERDE'}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-sm font-bold text-[#7a2e1a] tabular-nums">
                          <motion.span
                            key={m.trophies}
                            initial={{ y: -4, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.3 }}
                          >
                            {m.trophies}
                          </motion.span>
                          <span>🏆</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
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
                {loading ? 'Vernieuwen...' : '↻ Vernieuwen'}
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
