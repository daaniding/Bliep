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

type View = 'menu' | 'create' | 'join' | 'view';

export default function LeagueClient() {
  const { trophies } = useTrophies();
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

  // Init
  useEffect(() => {
    const id = getClientId();
    setClientId(id);
    const stored = getDisplayName();
    setName(stored);
    setPendingDisplayName(stored);
    const list = getMyLeagues();
    setMyLeagues(list);
    if (list.length > 0) {
      setActiveCode(list[0]);
      setView('view');
    }
  }, []);

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
        <p className="text-muted text-sm mb-6">Speel met een groepje vrienden op een ranglijst van trofeeën.</p>

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
