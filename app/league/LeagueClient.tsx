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
import StoneArchNav from '../components/StoneArchNav';

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
    <div className="game-shell" style={{ paddingBottom: 'calc(130px + env(safe-area-inset-bottom, 0px))' }}>
      <main className="relative z-10 pt-12 max-w-[520px] mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 340, damping: 26 }}
          className="flex items-center justify-between mb-5"
        >
          <Link
            href="/"
            className="game-pill"
            style={{ padding: '6px 12px', fontSize: 11, letterSpacing: '0.15em' }}
          >
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            TERUG
          </Link>
          <div className="game-pill" style={{ padding: '6px 12px' }}>
            <span style={{ fontSize: 13 }}>🏆</span>
            <span className="tabular-nums">{trophies}</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="mb-5"
        >
          <p className="game-section-label">Friend League</p>
          <h1 className="game-h1 mt-1">Ranglijst</h1>
          <p className="game-body-italic text-[13px] mt-1.5">
            Speel met een groepje vrienden op één ranglijst van trofeeën.
          </p>
        </motion.div>

        {!user && (
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="game-panel game-panel-corners mb-4 text-center"
            style={{ padding: '14px 14px 12px' }}
          >
            <p className="font-display" style={{ fontSize: 14, color: '#fff6dc', textShadow: '0 1px 0 #0d0a06' }}>
              📱 Cross-device account
            </p>
            <p className="game-body-italic text-[12px] mb-3 leading-relaxed mt-1">
              Zonder account ben je herkenbaar per apparaat. Met account zien je vrienden jou overal.
            </p>
            <Link href="/signup" className="game-btn-gold inline-flex" style={{ padding: '8px 16px', fontSize: 12 }}>
              ACCOUNT MAKEN
            </Link>
          </motion.div>
        )}

        {/* Display name setup */}
        {!displayName && (
          <motion.section
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="game-panel game-panel-corners mb-4"
            style={{ padding: 14 }}
          >
            <p className="game-section-label mb-2">Eerst even</p>
            <label className="block font-display mb-2" style={{ fontSize: 14, color: '#fff6dc', textShadow: '0 1px 0 #0d0a06' }}>
              Hoe wil je heten?
            </label>
            <input
              type="text"
              value={pendingDisplayName}
              onChange={e => setPendingDisplayName(e.target.value)}
              placeholder="Bijv. Daan"
              maxLength={24}
              className="game-pill-input mb-3"
            />
            <button
              onClick={handleSetName}
              disabled={!pendingDisplayName.trim()}
              className="game-btn-gold w-full text-sm"
            >
              OPSLAAN
            </button>
          </motion.section>
        )}

        {/* Tabs for switching league */}
        {displayName && myLeagues.length > 1 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {myLeagues.map(code => (
              <button
                key={code}
                onClick={() => { setActiveCode(code); setView('view'); }}
                className="shrink-0 font-display"
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: '2px solid #0d0a06',
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  cursor: 'pointer',
                  background: code === activeCode
                    ? 'linear-gradient(180deg, #ffe58a 0%, #fdd069 50%, #a3701a 100%)'
                    : 'linear-gradient(180deg, #3a2718 0%, #1c0f06 100%)',
                  color: code === activeCode ? '#0d0a06' : '#fdd069',
                  boxShadow: code === activeCode
                    ? 'inset 0 2px 0 rgba(255,255,255,0.45), 0 2px 0 #6e4c10'
                    : 'inset 0 2px 0 rgba(255,230,160,0.2), 0 2px 0 #0d0a06',
                }}
              >
                {code}
              </button>
            ))}
          </div>
        )}

        {/* Menu */}
        {displayName && view === 'menu' && (
          <section className="flex flex-col gap-3">
            {myLeagues.length === 0 && (
              <motion.div
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="game-panel game-panel-corners"
                style={{ padding: 14 }}
              >
                <p className="font-display" style={{ fontSize: 14, color: '#fff6dc', textShadow: '0 1px 0 #0d0a06' }}>
                  👋 Eerste keer hier?
                </p>
                <p className="game-body-italic text-[12px] leading-relaxed mt-1">
                  Een Friend League is een klein groepje vrienden waar je elkaars trofeeën ziet. Maak er één en stuur de 6-letter code naar vrienden.
                </p>
              </motion.div>
            )}
            <motion.button
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.14 }}
              onClick={() => { setError(null); setView('create'); }}
              className="game-panel game-panel-corners text-left"
              style={{ padding: 16, cursor: 'pointer' }}
            >
              <p className="game-h2">+ Nieuwe league</p>
              <p className="game-body-italic text-[12px] mt-1">
                Krijg een 6-letter code om met vrienden te delen.
              </p>
            </motion.button>
            <motion.button
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.18 }}
              onClick={() => { setError(null); setView('join'); }}
              className="game-panel game-panel-corners text-left"
              style={{ padding: 16, cursor: 'pointer' }}
            >
              <p className="game-h2">→ Joinen met code</p>
              <p className="game-body-italic text-[12px] mt-1">
                Heb je een code van een vriend? Vul hem hier in.
              </p>
            </motion.button>
          </section>
        )}

        {/* Create form */}
        {displayName && view === 'create' && (
          <section className="game-panel game-panel-corners" style={{ padding: 14 }}>
            <p className="game-section-label mb-2">Nieuwe league</p>
            <input
              type="text"
              value={createName}
              onChange={e => setCreateName(e.target.value)}
              placeholder="Naam (bv. 'De Bliepers')"
              maxLength={40}
              className="game-pill-input mb-3"
            />
            <button
              onClick={handleCreate}
              disabled={loading}
              className="game-btn-gold w-full text-sm mb-2"
            >
              {loading ? 'AANMAKEN…' : 'AANMAKEN'}
            </button>
            <button onClick={() => setView('menu')} className="w-full text-[11px] py-2" style={{ color: '#a08560', background: 'transparent', border: 'none', cursor: 'pointer', letterSpacing: '0.1em' }}>
              TERUG
            </button>
          </section>
        )}

        {/* Join form */}
        {displayName && view === 'join' && (
          <section className="game-panel game-panel-corners" style={{ padding: 14 }}>
            <p className="game-section-label mb-2">Joinen met code</p>
            <input
              type="text"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABCDEF"
              maxLength={6}
              className="game-pill-input mb-3"
              style={{ textAlign: 'center', fontFamily: 'monospace', letterSpacing: '0.3em', fontSize: 18, fontWeight: 700 }}
            />
            <button
              onClick={handleJoin}
              disabled={loading || joinCode.length < 6}
              className="game-btn-gold w-full text-sm mb-2"
            >
              {loading ? 'JOINEN…' : 'JOINEN'}
            </button>
            <button onClick={() => setView('menu')} className="w-full text-[11px] py-2" style={{ color: '#a08560', background: 'transparent', border: 'none', cursor: 'pointer', letterSpacing: '0.1em' }}>
              TERUG
            </button>
          </section>
        )}

        {error && (
          <p className="text-center mt-3" style={{ color: '#e07260', fontSize: 13, fontFamily: 'var(--font-philosopher), serif', fontStyle: 'italic' }}>{error}</p>
        )}

        {/* League view */}
        {displayName && view === 'view' && activeLeague && (
          <section>
            {/* League header card */}
            <div className="game-panel game-panel-corners mb-4 relative overflow-hidden" style={{ padding: 14 }}>
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none opacity-40"
                style={{
                  background: 'radial-gradient(ellipse at 80% 0%, rgba(253,208,105,0.35) 0%, transparent 60%)',
                }}
              />
              <div className="relative flex items-start justify-between mb-3">
                <div>
                  <p className="game-section-label">League</p>
                  <h2 className="game-h2 mt-1">{activeLeague.name}</h2>
                  <p className="game-body-italic text-[11px] mt-1">{Object.keys(activeLeague.members).length} leden</p>
                </div>
                <div className="game-pill" style={{ padding: '5px 12px', fontFamily: 'monospace', letterSpacing: '0.18em' }}>
                  {activeLeague.code}
                </div>
              </div>
              <div className="relative grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(activeLeague.code).catch(() => {});
                    setCopyFeedback(true);
                    window.setTimeout(() => setCopyFeedback(false), 1600);
                  }}
                  className="game-btn-dark text-xs"
                  style={{ padding: '8px 10px' }}
                >
                  {copyFeedback ? '✓ GEKOPIEERD' : '📋 CODE'}
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
                  className="game-btn-gold text-xs"
                  style={{ padding: '8px 10px' }}
                >
                  🔗 DEEL LINK
                </button>
              </div>
            </div>

            {/* Leaderboard */}
            <div className="game-panel game-panel-corners overflow-hidden" style={{ padding: 14 }}>
              <div className="flex items-center justify-between mb-3 px-1">
                <p className="game-section-label">Ranglijst</p>
                {myRank >= 0 && (
                  <p className="tabular-nums" style={{ fontSize: 11, color: '#fdd069', fontFamily: 'var(--font-lilita), sans-serif', letterSpacing: '0.08em' }}>
                    JIJ #{myRank + 1}
                  </p>
                )}
              </div>
              <motion.div className="flex flex-col gap-2" layout>
                <AnimatePresence initial={false}>
                  {sortedMembers.map((m, idx) => {
                    const isMe = m.clientId === clientId;
                    const rank = idx + 1;
                    const isTop3 = rank <= 3;
                    const rankColor = rank === 1 ? '#fdd069' : rank === 2 ? '#d8d8d8' : rank === 3 ? '#cd8a4a' : '#6a4f2e';
                    const firstLetter = (m.name || '?').charAt(0).toUpperCase();
                    const hue = (m.clientId.charCodeAt(0) * 17 + m.clientId.charCodeAt(m.clientId.length - 1)) % 360;
                    return (
                      <motion.div
                        key={m.clientId}
                        layout="position"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 340, damping: 26 }}
                        className="relative flex items-center gap-3"
                        style={{
                          padding: '10px 12px',
                          borderRadius: 12,
                          background: isMe
                            ? 'linear-gradient(90deg, rgba(253,208,105,0.28) 0%, rgba(253,208,105,0.06) 100%)'
                            : isTop3
                              ? `linear-gradient(90deg, ${rankColor}22 0%, rgba(26,15,5,0.6) 80%)`
                              : 'linear-gradient(180deg, rgba(40,28,16,0.55) 0%, rgba(26,16,8,0.75) 100%)',
                          border: isMe ? '2px solid #fdd069' : isTop3 ? `1.5px solid ${rankColor}66` : '1.5px solid rgba(253,208,105,0.18)',
                          boxShadow: isMe
                            ? 'inset 0 1px 0 rgba(255,255,255,0.15), 0 0 16px rgba(253,208,105,0.35)'
                            : isTop3 ? `0 0 12px ${rankColor}33` : 'inset 0 1px 0 rgba(255,255,255,0.05)',
                        }}
                      >
                        {/* Rank badge */}
                        <div
                          className="relative flex-shrink-0 flex items-center justify-center font-display"
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            background: isTop3
                              ? `radial-gradient(circle at 30% 28%, #fff6dc 0%, ${rankColor} 55%, #3a2a18 100%)`
                              : 'linear-gradient(180deg, #3a2718 0%, #1c0f06 100%)',
                            color: isTop3 ? '#2a1a06' : '#b69560',
                            border: '2px solid #0d0a06',
                            boxShadow: isTop3
                              ? 'inset 0 2px 0 rgba(255,255,255,0.35), 0 2px 0 #6e4c10'
                              : 'inset 0 2px 0 rgba(255,230,160,0.18), 0 2px 0 #0d0a06',
                            textShadow: isTop3 ? '0 1px 0 rgba(255,255,255,0.4)' : 'none',
                            fontSize: 14,
                          }}
                        >
                          {rank}
                        </div>
                        {/* Avatar letter */}
                        <div
                          className="flex-shrink-0 flex items-center justify-center font-display"
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: isMe
                              ? 'radial-gradient(circle at 30% 28%, #fff6dc 0%, #fdd069 40%, #a3701a 100%)'
                              : `radial-gradient(circle at 30% 28%, hsl(${hue} 55% 72%) 0%, hsl(${hue} 45% 50%) 60%, hsl(${hue} 40% 28%) 100%)`,
                            color: isMe ? '#2a1a06' : '#fff6dc',
                            fontSize: 15,
                            border: '2.5px solid #0d0a06',
                            boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.35), 0 2px 0 #0d0a06',
                            textShadow: isMe ? '0 1px 0 rgba(255,255,255,0.4)' : '0 1px 0 rgba(0,0,0,0.4)',
                          }}
                        >
                          {firstLetter}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className="truncate font-display"
                            style={{
                              fontSize: 14,
                              color: isMe ? '#fff6dc' : '#fff6dc',
                              textShadow: '0 1px 0 #0d0a06',
                              lineHeight: 1.2,
                            }}
                          >
                            {m.name}
                            {isMe && <span style={{ color: '#fdd069', fontSize: 10, marginLeft: 6, letterSpacing: '0.08em' }}>· JIJ</span>}
                          </p>
                          {isTop3 && (
                            <p
                              style={{
                                fontSize: 9,
                                fontFamily: 'var(--font-cinzel), serif',
                                letterSpacing: '0.18em',
                                fontWeight: 800,
                                color: rankColor,
                                textTransform: 'uppercase',
                                marginTop: 2,
                              }}
                            >
                              {rank === 1 ? '👑 Leider' : rank === 2 ? '⚔ Tweede' : '🥉 Derde'}
                            </p>
                          )}
                        </div>
                        <div
                          className="flex items-center gap-1 font-display tabular-nums"
                          style={{
                            color: '#fdd069',
                            fontSize: 15,
                            textShadow: '0 1px 0 #0d0a06',
                          }}
                        >
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
                <p className="game-body-italic text-center mt-3" style={{ fontSize: 11 }}>
                  Je staat nog niet in deze league als lid. Verlaat en join opnieuw met je naam.
                </p>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => activeCode && refreshLeague(activeCode)}
                disabled={loading}
                className="game-btn-dark flex-1 text-xs"
                style={{ padding: '8px 10px' }}
              >
                {loading ? 'VERNIEUWEN…' : '↻ VERNIEUW'}
              </button>
              <button
                onClick={() => setView('menu')}
                className="game-btn-dark flex-1 text-xs"
                style={{ padding: '8px 10px' }}
              >
                ANDERE
              </button>
              <button
                onClick={handleLeaveLeague}
                className="game-btn-dark flex-1 text-xs"
                style={{ padding: '8px 10px', color: '#e07260', borderColor: '#7a2e1a' }}
              >
                VERLATEN
              </button>
            </div>
          </section>
        )}

        {displayName && view === 'view' && !activeLeague && !loading && (
          <p className="game-body-italic text-center mt-8" style={{ fontSize: 13 }}>League laden…</p>
        )}
      </main>
      <StoneArchNav />
    </div>
  );
}
