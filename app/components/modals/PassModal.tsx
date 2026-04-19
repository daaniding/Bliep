'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BHModal from '../BHModal';
import { useCoins } from '@/lib/useCoins';
import { useTrophies } from '@/lib/useTrophies';
import { loadCity, saveCity, addSpeedTokens, addXp } from '@/lib/cityStore';
import { grantChest, loadInventory } from '@/lib/chests';
import { useXp } from '@/lib/useXp';
import { sfxClaim } from '@/lib/sound';
import {
  PASS_TIERS,
  currentSeason,
  formatRemaining,
  loadPassClaims,
  savePassClaims,
  isPremiumUnlocked,
  unlockPremium,
  tierForXp,
  nextPassTier,
  rewardMeta,
  type PassReward,
  type PassTier,
} from '@/lib/battlePass';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Unused for backwards-compat; pass stays here for API stability. */
  trophies?: number;
}

const cinzel = "var(--font-cinzel), 'Cinzel', serif";
const philosopher = "var(--font-philosopher), 'Philosopher', serif";

export default function PassModal({ open, onClose }: Props) {
  const { xp } = useXp();
  const [season] = useState(() => currentSeason());
  const [claims, setClaims] = useState<Record<string, boolean>>({});
  const [premium, setPremium] = useState(false);
  const [burstKey, setBurstKey] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const { award } = useCoins();
  const { awardTrophies } = useTrophies();
  const rowsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setClaims(loadPassClaims(season.id));
    setPremium(isPremiumUnlocked(season.id));
    const id = window.setInterval(() => setNowTick(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, [open, season.id]);

  const currentTier = useMemo(() => tierForXp(xp), [xp]);
  const nextTier = useMemo(() => nextPassTier(currentTier), [currentTier]);

  // Scroll current tier into view when opening
  useEffect(() => {
    if (!open || !rowsRef.current) return;
    const target = rowsRef.current.querySelector(`[data-tier="${Math.max(1, currentTier)}"]`);
    if (target) {
      window.setTimeout(() => {
        (target as HTMLElement).scrollIntoView({ behavior: 'auto', block: 'center' });
      }, 80);
    }
  }, [open, currentTier]);

  const { progressPct } = useMemo(() => {
    const prevXp = currentTier > 0 ? PASS_TIERS[currentTier - 1].xpRequired : 0;
    const nextXp = nextTier ? nextTier.xpRequired : prevXp;
    const span = Math.max(1, nextXp - prevXp);
    const pct = Math.max(0, Math.min(1, (xp - prevXp) / span));
    return { progressPct: pct };
  }, [xp, currentTier, nextTier]);

  const msRemaining = Math.max(0, season.endsAt - nowTick);

  function applyReward(r: PassReward) {
    if (r.kind === 'coins') award(r.amount);
    else if (r.kind === 'trophies') awardTrophies(r.amount, `Pass Seizoen ${season.id}`);
    else if (r.kind === 'speed') saveCity(addSpeedTokens(loadCity(), r.amount));
    else if (r.kind === 'xp') saveCity(addXp(loadCity(), r.amount).state);
    else if (r.kind === 'chest') grantChest(loadInventory(), r.chestKind);
    // 'title' is cosmetic — future: store on profile
  }

  function claim(tier: number, track: 'free' | 'premium') {
    const key = `${tier}:${track}`;
    if (claims[key]) return;
    if (track === 'premium' && !premium) return;
    if (tier > currentTier) return;
    const T = PASS_TIERS.find(x => x.tier === tier);
    if (!T) return;
    const r = track === 'free' ? T.free : T.premium;
    sfxClaim();
    applyReward(r);
    const next = { ...claims, [key]: true };
    setClaims(next);
    savePassClaims(season.id, next);
    setBurstKey(key);
    window.setTimeout(() => setBurstKey(null), 700);
  }

  function handleUnlockPremium() {
    unlockPremium(season.id);
    setPremium(true);
  }

  return (
    <BHModal open={open} onClose={onClose} title="" accent="#fdd069">
      <div className="relative" style={{ paddingTop: 2 }}>
        {/* Season header */}
        <SeasonHeader seasonId={season.id} msRemaining={msRemaining} currentTier={currentTier} />

        {/* XP progress to next tier */}
        <div style={{ marginTop: 10, padding: '0 2px' }}>
          <div
            className="flex items-center justify-between mb-1.5"
            style={{ fontFamily: cinzel, fontSize: 9, letterSpacing: '0.18em', color: '#b69560' }}
          >
            <span>TIER {currentTier}</span>
            {nextTier ? <span>NAAR {nextTier.tier}</span> : <span>MAX</span>}
          </div>
          <div
            className="relative overflow-hidden"
            style={{
              height: 14,
              borderRadius: 999,
              background: 'linear-gradient(180deg, #0d0a06 0%, #1a0f05 100%)',
              border: '2px solid #0d0a06',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)',
            }}
          >
            <motion.div
              animate={{ width: `${progressPct * 100}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              style={{
                height: '100%',
                background: 'linear-gradient(180deg, #fff6dc 0%, #fdd069 30%, #d19225 65%, #a3701a 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -2px 0 rgba(0,0,0,0.22)',
              }}
            />
            <div
              className="absolute inset-0 flex items-center justify-center font-display tabular-nums"
              style={{
                fontSize: 9,
                color: '#fff6dc',
                textShadow: '0 1px 0 #0d0a06, 0 0 4px rgba(0,0,0,0.6)',
                letterSpacing: '0.05em',
              }}
            >
              {xp} XP
            </div>
          </div>
        </div>

        {/* Premium unlock */}
        {!premium && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleUnlockPremium}
            className="w-full flex items-center justify-center gap-2 mt-3"
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              border: '2.5px solid #0d0a06',
              background: 'linear-gradient(180deg, #ffd56a 0%, #d43b2a 60%, #7a1608 100%)',
              boxShadow: 'inset 0 2px 0 rgba(255,255,220,0.5), 0 3px 0 #0d0a06, 0 0 16px rgba(212,59,42,0.5)',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 16 }}>👑</span>
            <span
              className="font-display"
              style={{
                fontSize: 13,
                color: '#fff6d0',
                letterSpacing: '0.1em',
                textShadow: '0 1px 1px rgba(0,0,0,0.6)',
              }}
            >
              ONTGRENDEL PREMIUM
            </span>
          </motion.button>
        )}

        {/* Column headers */}
        <div
          className="mt-3 mb-1 grid gap-2 items-end px-1"
          style={{
            gridTemplateColumns: '42px 1fr 1fr',
            fontFamily: cinzel,
            fontSize: 9,
            letterSpacing: '0.2em',
            color: '#8a6a3e',
          }}
        >
          <span />
          <span style={{ textAlign: 'center' }}>GRATIS</span>
          <span style={{ textAlign: 'center' }}>
            PREMIUM {premium ? '👑' : '🔒'}
          </span>
        </div>

        {/* Rows */}
        <div
          ref={rowsRef}
          className="flex flex-col"
          style={{
            maxHeight: 380,
            overflowY: 'auto',
            paddingRight: 3,
            scrollbarWidth: 'thin',
            position: 'relative',
          }}
        >
          {PASS_TIERS.map((T, idx) => (
            <TierRow
              key={T.tier}
              tier={T}
              isCurrent={T.tier === currentTier}
              isUnlocked={T.tier <= currentTier}
              isLast={idx === PASS_TIERS.length - 1}
              freeClaimed={!!claims[`${T.tier}:free`]}
              premClaimed={!!claims[`${T.tier}:premium`]}
              premiumUnlocked={premium}
              burstKey={burstKey}
              onClaim={(track) => claim(T.tier, track)}
            />
          ))}
        </div>
      </div>
    </BHModal>
  );
}

// ------------------------------------------------------------------

function SeasonHeader({ seasonId, msRemaining, currentTier }: { seasonId: number; msRemaining: number; currentTier: number }) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        borderRadius: 14,
        padding: '14px 14px 12px',
        background: 'linear-gradient(180deg, rgba(255,232,160,0.15) 0%, rgba(26,15,5,0.8) 100%), linear-gradient(180deg, #3a2718 0%, #1c0f06 100%)',
        border: '3px solid #0d0a06',
        boxShadow: 'inset 0 2px 0 rgba(255,230,160,0.3), 0 3px 0 #0d0a06',
      }}
    >
      {/* Decorative radial glow */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 0%, rgba(253,208,105,0.35) 0%, transparent 60%)',
        }}
      />
      <div className="relative flex items-center justify-between">
        <div>
          <div
            style={{
              fontFamily: cinzel,
              fontSize: 9,
              letterSpacing: '0.22em',
              color: '#b69560',
              textTransform: 'uppercase',
            }}
          >
            Seizoen {seasonId}
          </div>
          <div
            className="font-display mt-0.5"
            style={{
              fontSize: 22,
              color: '#fdd069',
              textShadow: '0 2px 0 #0d0a06, 0 0 14px rgba(253,208,105,0.45)',
              lineHeight: 1,
            }}
          >
            Battle Pass
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div
            style={{
              fontFamily: cinzel,
              fontSize: 8,
              letterSpacing: '0.2em',
              color: '#a88858',
              textTransform: 'uppercase',
              marginBottom: 1,
            }}
          >
            Tier
          </div>
          <div
            className="font-display tabular-nums"
            style={{
              fontSize: 22,
              color: '#fff6dc',
              textShadow: '0 2px 0 #0d0a06',
              lineHeight: 1,
            }}
          >
            {currentTier}
            <span style={{ color: '#8a6a3e', fontSize: 14 }}>/25</span>
          </div>
        </div>
      </div>
      <div
        className="relative mt-2 flex items-center gap-1.5"
        style={{
          fontFamily: philosopher,
          fontSize: 11,
          color: '#c9a970',
          fontStyle: 'italic',
          letterSpacing: '0.02em',
        }}
      >
        <span style={{ fontSize: 10 }}>⏳</span>
        <span>
          Seizoen eindigt over <span style={{ color: '#fdd069', fontStyle: 'normal', fontWeight: 700 }}>{formatRemaining(msRemaining)}</span>
        </span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------

interface TierRowProps {
  tier: PassTier;
  isCurrent: boolean;
  isUnlocked: boolean;
  isLast: boolean;
  freeClaimed: boolean;
  premClaimed: boolean;
  premiumUnlocked: boolean;
  burstKey: string | null;
  onClaim: (track: 'free' | 'premium') => void;
}

function TierRow({ tier, isCurrent, isUnlocked, isLast, freeClaimed, premClaimed, premiumUnlocked, burstKey, onClaim }: TierRowProps) {
  const freeMeta = rewardMeta(tier.free);
  const premMeta = rewardMeta(tier.premium);
  const isMilestone = tier.tier % 5 === 0;

  return (
    <div
      data-tier={tier.tier}
      className="relative grid gap-2 items-stretch py-1"
      style={{
        gridTemplateColumns: '42px 1fr 1fr',
      }}
    >
      {/* Connecting vertical line (except after last) */}
      {!isLast && (
        <div
          aria-hidden
          className="absolute"
          style={{
            left: 20,
            top: '50%',
            width: 2,
            height: '100%',
            background: isUnlocked
              ? 'linear-gradient(180deg, #fdd069 0%, rgba(253,208,105,0.3) 100%)'
              : 'rgba(60,40,22,0.55)',
            zIndex: 0,
          }}
        />
      )}

      {/* Tier node */}
      <div className="relative z-10 flex items-center justify-center">
        <div
          className="flex items-center justify-center"
          style={{
            width: isMilestone ? 38 : 32,
            height: isMilestone ? 38 : 32,
            borderRadius: '50%',
            background: isUnlocked
              ? 'radial-gradient(circle at 30% 28%, #fff6dc 0%, #fdd069 35%, #a3701a 100%)'
              : 'radial-gradient(circle at 30% 28%, #3a2718 0%, #1c0f06 70%, #0d0a06 100%)',
            border: '2.5px solid #0d0a06',
            boxShadow: isUnlocked
              ? `inset 0 2px 0 rgba(255,255,255,0.45), 0 2px 0 #6e4c10, ${isCurrent ? '0 0 18px rgba(253,208,105,0.85)' : ''}`
              : 'inset 0 2px 0 rgba(255,230,160,0.12), 0 2px 0 #0d0a06',
            fontFamily: cinzel,
            fontWeight: 900,
            fontSize: isMilestone ? 13 : 11,
            color: isUnlocked ? '#2a1a06' : '#6a4f2e',
            textShadow: isUnlocked ? '0 1px 0 rgba(255,255,255,0.45)' : 'none',
          }}
        >
          {tier.tier}
        </div>
        {isCurrent && (
          <motion.div
            aria-hidden
            animate={{ scale: [1, 1.3, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 52,
              height: 52,
              border: '2px solid #fdd069',
            }}
          />
        )}
      </div>

      <RewardSlot
        meta={freeMeta}
        claimed={freeClaimed}
        locked={!isUnlocked}
        premium={false}
        milestone={isMilestone}
        onClick={() => onClaim('free')}
        burst={burstKey === `${tier.tier}:free`}
      />
      <RewardSlot
        meta={premMeta}
        claimed={premClaimed}
        locked={!isUnlocked || !premiumUnlocked}
        premium
        premiumAvailable={premiumUnlocked}
        milestone={isMilestone}
        onClick={() => onClaim('premium')}
        burst={burstKey === `${tier.tier}:premium`}
      />
    </div>
  );
}

// ------------------------------------------------------------------

interface RewardSlotProps {
  meta: ReturnType<typeof rewardMeta>;
  claimed: boolean;
  locked: boolean;
  premium: boolean;
  premiumAvailable?: boolean;
  milestone: boolean;
  burst: boolean;
  onClick: () => void;
}

function RewardSlot({ meta, claimed, locked, premium, premiumAvailable, milestone, burst, onClick }: RewardSlotProps) {
  const canClaim = !locked && !claimed;
  const dim = locked && !claimed;

  return (
    <motion.button
      type="button"
      onClick={canClaim ? onClick : undefined}
      whileTap={canClaim ? { scale: 0.95 } : undefined}
      disabled={!canClaim}
      className="relative"
      style={{
        padding: milestone ? '10px 8px' : '8px 6px',
        borderRadius: 10,
        border: claimed
          ? '2px solid #2a6a3a'
          : canClaim
            ? premium
              ? '2px solid #d43b2a'
              : '2px solid #fdd069'
            : milestone
              ? '2px dashed rgba(253,208,105,0.35)'
              : '1.5px solid rgba(253,208,105,0.18)',
        background: claimed
          ? 'linear-gradient(180deg, rgba(50,90,55,0.55) 0%, rgba(20,40,24,0.8) 100%)'
          : milestone
            ? `linear-gradient(180deg, rgba(60,40,20,0.8) 0%, rgba(40,26,10,0.95) 100%)`
            : 'linear-gradient(180deg, rgba(30,20,12,0.7) 0%, rgba(16,10,6,0.9) 100%)',
        boxShadow: canClaim
          ? premium
            ? 'inset 0 1px 0 rgba(255,200,180,0.2), 0 0 16px rgba(212,59,42,0.45)'
            : 'inset 0 1px 0 rgba(255,255,255,0.18), 0 0 14px rgba(253,208,105,0.45)'
          : 'inset 0 1px 0 rgba(255,255,255,0.04)',
        cursor: canClaim ? 'pointer' : 'default',
        opacity: dim ? 0.68 : 1,
        textAlign: 'center',
        minHeight: milestone ? 76 : 62,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        transition: 'all 200ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {premium && !claimed && !locked && premiumAvailable && (
        <span
          className="absolute"
          style={{
            top: -7,
            right: 6,
            fontSize: 9,
            padding: '1px 6px',
            background: 'linear-gradient(180deg, #d43b2a, #7a1608)',
            color: '#fff6d0',
            borderRadius: 5,
            fontFamily: cinzel,
            fontWeight: 900,
            letterSpacing: '0.06em',
            border: '1px solid #0d0a06',
          }}
        >
          👑
        </span>
      )}

      <div
        style={{
          fontSize: milestone ? 28 : 22,
          lineHeight: 1,
          filter: dim ? 'grayscale(0.4)' : 'none',
        }}
      >
        {meta.icon}
      </div>
      <div
        className="font-display tabular-nums"
        style={{
          fontSize: milestone ? 12 : 11,
          color: claimed ? '#a8d8b4' : meta.tint,
          textShadow: '0 1px 0 #0d0a06',
          letterSpacing: '0.02em',
          lineHeight: 1,
        }}
      >
        {meta.label}
      </div>
      <div
        style={{
          fontFamily: cinzel,
          fontSize: 8,
          letterSpacing: '0.15em',
          color: claimed ? '#7ab48a' : canClaim ? '#fdd069' : '#6a4f2e',
          textTransform: 'uppercase',
          marginTop: 1,
        }}
      >
        {claimed ? '✓ OPGEHAALD' : canClaim ? 'CLAIM' : locked ? '🔒' : ''}
      </div>

      {/* Burst on claim */}
      <AnimatePresence>
        {burst && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1.05 }}
            exit={{ opacity: 0, scale: 1.25 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 pointer-events-none"
            style={{
              borderRadius: 10,
              boxShadow: premium
                ? '0 0 26px 6px rgba(212,59,42,0.85)'
                : '0 0 26px 6px rgba(253,208,105,0.85)',
            }}
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
}
