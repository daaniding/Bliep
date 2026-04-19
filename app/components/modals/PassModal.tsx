'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import BHModal from '../BHModal';
import { useCoins } from '@/lib/useCoins';
import { useTrophies } from '@/lib/useTrophies';
import { loadCity, saveCity, addSpeedTokens } from '@/lib/cityStore';
import { sfxClaim } from '@/lib/sound';

interface Props {
  open: boolean;
  onClose: () => void;
  trophies: number;
}

const cinzel = "var(--font-cinzel), 'Cinzel', serif";
const philosopher = "var(--font-philosopher), 'Philosopher', serif";

type Reward =
  | { kind: 'coins'; amount: number }
  | { kind: 'trophies'; amount: number }
  | { kind: 'speed'; amount: number }
  | { kind: 'title'; label: string };

interface Tier {
  tier: number;
  xpRequired: number;
  free: Reward;
  premium: Reward;
}

// xp per tier scales — trophies act as the season score for now
const TIERS: Tier[] = Array.from({ length: 10 }).map((_, i) => ({
  tier: i + 1,
  xpRequired: (i + 1) * 30,
  free: i % 3 === 2
    ? { kind: 'speed', amount: 1 }
    : { kind: 'coins', amount: 50 + i * 20 },
  premium: i === 9
    ? { kind: 'title', label: 'Grootmeester' }
    : i % 2 === 0
      ? { kind: 'coins', amount: 150 + i * 40 }
      : { kind: 'trophies', amount: 5 + i * 2 },
}));

const CLAIMED_KEY = 'bliep:pass:claimed:v1';
const PASS_PREMIUM_KEY = 'bliep:pass:premium:v1';

function loadClaimed(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(CLAIMED_KEY) || '{}'); } catch { return {}; }
}
function saveClaimed(m: Record<string, boolean>) {
  try { localStorage.setItem(CLAIMED_KEY, JSON.stringify(m)); } catch { /* ignore */ }
}

function rewardIcon(r: Reward): { icon: string; label: string; color: string } {
  if (r.kind === 'coins')    return { icon: '🪙', label: `${r.amount}`,  color: '#F5C842' };
  if (r.kind === 'trophies') return { icon: '🏆', label: `${r.amount}`,  color: '#b080e0' };
  if (r.kind === 'speed')    return { icon: '⚡', label: `${r.amount}`,  color: '#6fd4f0' };
  return { icon: '👑', label: r.label, color: '#e05a3a' };
}

export default function PassModal({ open, onClose, trophies }: Props) {
  const [claimed, setClaimed] = useState<Record<string, boolean>>({});
  const [premium, setPremium] = useState(false);
  const { award } = useCoins();
  const { awardTrophies } = useTrophies();

  useEffect(() => {
    if (!open) return;
    setClaimed(loadClaimed());
    try { setPremium(localStorage.getItem(PASS_PREMIUM_KEY) === '1'); } catch { /* ignore */ }
  }, [open]);

  const currentTier = useMemo(() => {
    let t = 0;
    for (const T of TIERS) if (trophies >= T.xpRequired) t = T.tier;
    return t;
  }, [trophies]);

  function claim(tier: number, track: 'free' | 'premium') {
    const key = `${tier}:${track}`;
    if (claimed[key]) return;
    if (track === 'premium' && !premium) return;
    const T = TIERS.find((x) => x.tier === tier);
    if (!T) return;
    if (tier > currentTier) return;
    const r = track === 'free' ? T.free : T.premium;
    sfxClaim();
    if (r.kind === 'coins') award(r.amount);
    else if (r.kind === 'trophies') awardTrophies(r.amount, `Pass tier ${tier}`);
    else if (r.kind === 'speed') saveCity(addSpeedTokens(loadCity(), r.amount));
    const next = { ...claimed, [key]: true };
    setClaimed(next);
    saveClaimed(next);
  }

  function unlockPremium() {
    setPremium(true);
    try { localStorage.setItem(PASS_PREMIUM_KEY, '1'); } catch { /* ignore */ }
  }

  const nextTierData = TIERS.find((t) => t.tier === currentTier + 1);
  const pct = nextTierData
    ? Math.min(100, Math.round(((trophies - (TIERS.find((t) => t.tier === currentTier)?.xpRequired ?? 0)) /
        (nextTierData.xpRequired - (TIERS.find((t) => t.tier === currentTier)?.xpRequired ?? 0))) * 100))
    : 100;

  return (
    <BHModal open={open} onClose={onClose} title="Battle Pass" subtitle={`Tier ${currentTier} · Seizoen 1`} accent="#d43b2a">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* progress */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: cinzel, fontSize: 11, color: '#3a2312', marginBottom: 4 }}>
            <span>Tier {currentTier}</span>
            {nextTierData && <span>Volgende: Tier {nextTierData.tier}</span>}
          </div>
          <div style={{ position: 'relative', height: 12, borderRadius: 999, background: 'rgba(42,22,8,0.22)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', inset: '1px 1px 1px 1px', width: `calc(${pct}% - 2px)`,
              borderRadius: 999,
              background: 'linear-gradient(180deg, #ff9a5a, #d43b2a 60%, #8a1e0a 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,200,180,.5)',
              transition: 'width .4s ease',
            }} />
          </div>
        </div>

        {/* Premium lock */}
        {!premium && (
          <button
            onClick={unlockPremium}
            style={{
              padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(180deg, #ffd24a 0%, #d43b2a 70%, #7a1608 100%)',
              boxShadow: 'inset 0 0 0 1.5px #4a2a08, inset 0 1px 0 rgba(255,255,220,.5), 0 3px 0 rgba(0,0,0,.5)',
              color: '#fff6d0',
              fontFamily: cinzel, fontWeight: 900, fontSize: 13, letterSpacing: '0.08em',
              textShadow: '0 1px 1px rgba(0,0,0,0.6)',
            }}
          >
            👑 ONTGRENDEL PREMIUM TRACK
          </button>
        )}

        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr', gap: 6, fontFamily: cinzel, fontWeight: 900, fontSize: 9, letterSpacing: '0.18em', color: '#5a3a22', padding: '0 2px' }}>
          <span />
          <span style={{ textAlign: 'center' }}>GRATIS</span>
          <span style={{ textAlign: 'center' }}>PREMIUM 👑</span>
        </div>

        {/* Rows — scroll */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 260, overflowY: 'auto', paddingRight: 2 }}>
          {TIERS.map((T) => {
            const unlocked = T.tier <= currentTier;
            const freeClaimed = claimed[`${T.tier}:free`];
            const premClaimed = claimed[`${T.tier}:premium`];
            const freeR = rewardIcon(T.free);
            const premR = rewardIcon(T.premium);
            return (
              <div key={T.tier} style={{
                display: 'grid', gridTemplateColumns: '36px 1fr 1fr', gap: 6, alignItems: 'center',
                padding: '4px 2px', borderRadius: 8,
                background: unlocked ? 'rgba(245,200,66,0.1)' : 'rgba(42,22,8,0.05)',
                opacity: unlocked ? 1 : 0.65,
              }}>
                <span style={{
                  width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center',
                  background: unlocked
                    ? 'radial-gradient(circle at 30% 30%, #ffe07a, #C8882A 55%, #6a3a0a 100%)'
                    : 'linear-gradient(180deg, #3a1e0a, #1a0a02)',
                  boxShadow: unlocked
                    ? 'inset 0 0 0 1.5px #2a1608, inset 0 1px 0 rgba(255,255,220,.5)'
                    : 'inset 0 0 0 1px #0a0400',
                  fontFamily: cinzel, fontWeight: 900, fontSize: 12,
                  color: unlocked ? '#2a1608' : '#5a3a22',
                }}>{T.tier}</span>
                <RewardCell r={freeR} locked={!unlocked} claimed={!!freeClaimed} onClick={() => claim(T.tier, 'free')} />
                <RewardCell r={premR} locked={!unlocked || !premium} claimed={!!premClaimed} onClick={() => claim(T.tier, 'premium')} premium />
              </div>
            );
          })}
        </div>
      </div>
    </BHModal>
  );
}

function RewardCell({
  r, locked, claimed, onClick, premium = false,
}: {
  r: { icon: string; label: string; color: string };
  locked: boolean;
  claimed: boolean;
  onClick: () => void;
  premium?: boolean;
}) {
  const canClaim = !locked && !claimed;
  return (
    <motion.button
      onClick={canClaim ? onClick : undefined}
      whileTap={canClaim ? { scale: 0.94 } : undefined}
      disabled={!canClaim}
      style={{
        position: 'relative',
        padding: '6px 4px',
        borderRadius: 8,
        border: 'none', cursor: canClaim ? 'pointer' : 'default',
        background: claimed
          ? 'rgba(61,168,62,0.22)'
          : locked
            ? 'rgba(42,22,8,0.08)'
            : `${r.color}22`,
        boxShadow: claimed
          ? 'inset 0 0 0 1.5px rgba(61,168,62,0.65)'
          : locked
            ? 'inset 0 0 0 1px rgba(42,22,8,0.3)'
            : `inset 0 0 0 1.5px ${r.color}aa`,
        textAlign: 'center',
        minHeight: 52,
      }}
    >
      {premium && !claimed && !locked && (
        <span style={{
          position: 'absolute', top: -6, right: 6,
          fontSize: 11, padding: '1px 5px',
          background: 'linear-gradient(180deg, #d43b2a, #7a1608)',
          color: '#fff6d0', borderRadius: 4,
          fontFamily: cinzel, fontWeight: 900, letterSpacing: '0.06em',
          boxShadow: '0 0 0 1px #1a0a02',
        }}>👑</span>
      )}
      <div style={{ fontSize: 20, lineHeight: 1 }}>{r.icon}</div>
      <div style={{ fontFamily: cinzel, fontWeight: 800, fontSize: 11, color: '#2a1608', lineHeight: 1, marginTop: 2 }}>
        {r.label}
      </div>
      <div style={{ fontFamily: philosopher, fontSize: 9, color: claimed ? '#1a5a1a' : '#5a3a22', marginTop: 3 }}>
        {claimed ? '✓ opgehaald' : locked ? '🔒' : 'tik om te claimen'}
      </div>
    </motion.button>
  );
}
