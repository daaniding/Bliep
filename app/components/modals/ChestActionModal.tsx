'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import BHModal from '../BHModal';
import {
  type ChestSlot,
  KIND_LABEL, KIND_ROW, KIND_COLOR,
  UNLOCK_MS, INSTANT_UNLOCK_COST,
  remainingMs, formatRemaining,
  loadInventory, startUnlock, finishUnlock, dismissChest,
} from '@/lib/chests';
import { addResource, resourceCount } from '@/lib/resources';
import { sfxTap, sfxClaim, sfxFail } from '@/lib/sound';

interface Props {
  open: boolean;
  onClose: () => void;
  slot: ChestSlot | null;
  /** Called when the slot becomes ready — lets parent open ChestOpenModal */
  onReady: () => void;
}

const cinzel = "var(--font-cinzel), 'Cinzel', serif";
const philosopher = "var(--font-philosopher), 'Philosopher', serif";

export default function ChestActionModal({ open, onClose, slot, onReady }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [gems, setGems] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmDismiss, setConfirmDismiss] = useState(false);

  useEffect(() => {
    if (!open) return;
    setGems(resourceCount('gems'));
    setError(null);
    setConfirmDismiss(false);
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [open, slot?.id]);

  if (!slot) return null;

  const color = KIND_COLOR[slot.kind];
  const label = KIND_LABEL[slot.kind];
  const row = KIND_ROW[slot.kind];
  const unlockDuration = UNLOCK_MS[slot.kind];
  const gemCost = INSTANT_UNLOCK_COST[slot.kind];
  const remaining = remainingMs(slot, now);

  function handleStart() {
    if (!slot) return;
    sfxTap();
    const { ok, reason } = startUnlock(loadInventory(), slot.id);
    if (!ok) {
      sfxFail();
      setError(reason ?? 'Kan niet starten');
      return;
    }
    onClose();
  }

  function handleDismiss() {
    if (!slot) return;
    if (!confirmDismiss) {
      setConfirmDismiss(true);
      return;
    }
    sfxTap();
    dismissChest(loadInventory(), slot.id);
    onClose();
  }

  function handleSkip() {
    if (!slot) return;
    if (gems < gemCost) {
      sfxFail();
      setError(`Je hebt ${gemCost} 💎 nodig (je hebt ${gems})`);
      return;
    }
    sfxClaim();
    addResource('gems', -gemCost);
    finishUnlock(loadInventory(), slot.id);
    onReady();
  }

  return (
    <BHModal open={open} onClose={onClose} title={label} subtitle={subtitleFor(slot)} accent={color}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
        {/* big chest sprite */}
        <motion.div
          initial={{ scale: 0.85, y: 6 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 20 }}
          style={{
            width: 48 * 3.5,
            height: 32 * 3.5,
            backgroundImage: 'url(/assets/chests/chests.png)',
            backgroundSize: `${240 * 3.5}px ${256 * 3.5}px`,
            backgroundPosition: `0px -${row * 32 * 3.5}px`,
            backgroundRepeat: 'no-repeat',
            imageRendering: 'pixelated',
            transform: `translateX(${3 * 3.5}px)`,
            filter: `drop-shadow(0 8px 12px rgba(0,0,0,0.55)) drop-shadow(0 0 18px ${color}88)`,
          }}
        />

        {/* info card */}
        <div style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 10,
          background: 'rgba(42,22,8,0.1)',
          boxShadow: 'inset 0 0 0 1px rgba(42,22,8,0.3)',
          fontFamily: philosopher, fontSize: 13, color: '#3a2312',
          textAlign: 'center',
        }}>
          {slot.state === 'waiting' && (
            <>
              Deze kist duurt <b>{formatRemaining(unlockDuration)}</b> om te ontgrendelen.
            </>
          )}
          {slot.state === 'unlocking' && (
            <>
              Nog <b>{formatRemaining(remaining)}</b> tot gereed.
            </>
          )}
          {slot.state === 'ready' && <>Je kist is klaar! Tik om te openen.</>}
        </div>

        {/* progress bar when unlocking */}
        {slot.state === 'unlocking' && slot.unlockStartedAt && slot.unlockMs && (
          <div style={{
            width: '100%', height: 12, borderRadius: 999,
            background: 'rgba(42,22,8,0.25)',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
            overflow: 'hidden',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', inset: '1px 0 1px 1px',
              width: `${Math.min(100, ((slot.unlockMs - remaining) / slot.unlockMs) * 100)}%`,
              borderRadius: 999,
              background: `linear-gradient(180deg, ${color}, ${color}88)`,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,.4), 0 0 12px ${color}88`,
              transition: 'width .4s ease',
            }} />
          </div>
        )}

        {/* actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          {slot.state === 'waiting' && (
            <>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleStart}
                style={bigButton(false)}
              >
                START ONTGRENDELEN
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleDismiss}
                style={secondaryButton(confirmDismiss ? '#8a2a1a' : undefined)}
              >
                {confirmDismiss ? '⚠️ BEVESTIG WEGGOOIEN' : 'WEGGOOIEN'}
              </motion.button>
            </>
          )}
          {slot.state === 'unlocking' && remaining > 0 && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleSkip}
              disabled={gems < gemCost}
              style={bigButton(gems < gemCost)}
            >
              💎 NU OPENEN · {gemCost}
            </motion.button>
          )}
          {slot.state === 'unlocking' && remaining <= 0 && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onReady}
              style={bigButton(false)}
            >
              OPENEN
            </motion.button>
          )}
          {slot.state === 'ready' && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onReady}
              style={bigButton(false)}
            >
              OPENEN
            </motion.button>
          )}
        </div>

        {error && (
          <div style={{ fontFamily: philosopher, fontSize: 12, color: '#8a2a1a', fontStyle: 'italic', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <div style={{ fontFamily: cinzel, fontSize: 10, color: '#5a3a22', letterSpacing: '0.2em' }}>
          💎 {gems}
        </div>
      </div>
    </BHModal>
  );
}

function subtitleFor(slot: ChestSlot): string {
  if (slot.state === 'waiting')   return 'Wacht om te ontgrendelen';
  if (slot.state === 'unlocking') return 'Aan het ontgrendelen…';
  if (slot.state === 'ready')     return 'Klaar om te openen';
  return '';
}

function bigButton(disabled: boolean): React.CSSProperties {
  return {
    padding: '12px 14px',
    borderRadius: 12,
    border: 'none',
    cursor: disabled ? 'default' : 'pointer',
    background: disabled
      ? 'linear-gradient(180deg, #5a3a22, #2a1608)'
      : 'linear-gradient(180deg, #ffe07a 0%, #d99b22 45%, #a86a10 100%)',
    boxShadow: disabled
      ? 'inset 0 0 0 1.5px #1a0a02'
      : 'inset 0 0 0 1.5px #4a2a08, inset 0 0 0 2.5px rgba(255,240,150,.5), inset 0 2px 0 rgba(255,255,220,.55), 0 3px 0 rgba(0,0,0,.5)',
    color: disabled ? '#c9ac74' : '#3a2108',
    fontFamily: cinzel,
    fontWeight: 900,
    fontSize: 14,
    letterSpacing: '0.1em',
  };
}

function secondaryButton(accent?: string): React.CSSProperties {
  return {
    padding: '9px 14px',
    borderRadius: 10,
    border: 'none',
    cursor: 'pointer',
    background: 'rgba(42,22,8,0.08)',
    boxShadow: accent
      ? `inset 0 0 0 1.5px ${accent}`
      : 'inset 0 0 0 1px rgba(42,22,8,0.35)',
    color: accent ?? '#5a3a22',
    fontFamily: cinzel,
    fontWeight: 800,
    fontSize: 12,
    letterSpacing: '0.08em',
  };
}
