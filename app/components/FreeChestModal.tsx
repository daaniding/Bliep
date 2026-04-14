'use client';

import { useEffect, useState } from 'react';
import { claimFreeChest, loadFreeChest, isReady as chestIsReady } from '@/lib/freeChest';
import { addMailItem } from '@/lib/mailbox';
import { sfxClaim, sfxBattleStart } from '@/lib/sound';

interface Props {
  onClose: () => void;
  onOpenMail: () => void;
}

type Phase = 'closed' | 'opening' | 'revealed' | 'flying';

// Full-screen popup that presents the free chest with a dramatic
// reveal. Tap the chest → opening animation (lid lifts + glow burst)
// → reward number flies up → chest shrinks → fly-to-mail animation →
// auto-opens the mail modal.
export default function FreeChestModal({ onClose, onOpenMail }: Props) {
  const [phase, setPhase] = useState<Phase>('closed');
  const [reward, setReward] = useState<number | null>(null);

  useEffect(() => {
    // If not actually ready (race), show a stub and close on tap
    if (!chestIsReady(loadFreeChest())) {
      // can't claim, bail out
      setTimeout(onClose, 200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleOpenChest() {
    if (phase !== 'closed') return;
    sfxBattleStart();
    setPhase('opening');
    window.setTimeout(() => {
      const result = claimFreeChest();
      if (!result) {
        onClose();
        return;
      }
      sfxClaim();
      setReward(result.reward);
      // Drop the reward into the mailbox
      addMailItem({
        type: 'chest',
        title: 'Gratis kist geopend',
        body: `Je hebt ${result.reward} coins gevonden in de gratis kist.`,
        coins: result.reward,
      });
      setPhase('revealed');
    }, 650);
  }

  function handleContinue() {
    setPhase('flying');
    window.setTimeout(() => {
      onClose();
      onOpenMail();
    }, 850);
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-6"
      style={{
        background:
          'radial-gradient(ellipse 70% 60% at 50% 45%, rgba(80, 50, 10, 0.7), transparent 70%), ' +
          'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(240, 184, 64, 0.2), transparent 60%), ' +
          'linear-gradient(180deg, rgba(10, 6, 4, 0.85), rgba(0, 0, 0, 0.95))',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={phase === 'closed' ? undefined : phase === 'revealed' ? handleContinue : undefined}
    >
      {/* Close button (only when not animating away) */}
      {phase !== 'flying' && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute top-12 right-5 font-display active:scale-90 transition-transform"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'linear-gradient(180deg, #4a3020 0%, #1a0f05 100%)',
            border: '2px solid #0d0a06',
            color: '#fdd069',
            fontSize: 18,
            boxShadow: 'inset 0 1px 0 rgba(240, 184, 64, 0.5), 0 2px 0 #0d0a06, 0 4px 10px rgba(0, 0, 0, 0.7)',
          }}
        >
          ×
        </button>
      )}

      {/* Title */}
      {phase === 'closed' && (
        <div className="absolute top-24 left-0 right-0 text-center animate-fade-up">
          <p className="font-display" style={{ fontSize: 11, color: '#fdd069', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>
            Dagelijkse beloning
          </p>
          <h1
            className="font-display"
            style={{
              fontSize: 30,
              color: '#fff6dc',
              WebkitTextStroke: '2.5px #0d0a06',
              paintOrder: 'stroke fill',
              textShadow: '0 3px 0 #0d0a06, 0 0 28px rgba(255, 200, 80, 0.7)',
              letterSpacing: '0.04em',
            }}
          >
            Gratis Kist
          </h1>
          <p className="font-body mt-2" style={{ fontSize: 13, color: '#f4e6b8' }}>
            Tik op de kist om hem te openen
          </p>
        </div>
      )}

      {/* Chest stage */}
      <div
        className="relative flex items-center justify-center"
        style={{
          width: 220,
          height: 220,
          transform: phase === 'flying' ? 'translate(120px, -260px) scale(0.22)' : undefined,
          opacity: phase === 'flying' ? 0.2 : 1,
          transition: phase === 'flying' ? 'transform 850ms cubic-bezier(0.32, 0, 0.67, 0), opacity 850ms ease-in' : undefined,
        }}
      >
        {/* Radial glow behind the chest, stronger when opening */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              phase === 'revealed' || phase === 'opening'
                ? 'radial-gradient(circle at 50% 55%, rgba(255, 240, 160, 0.95) 0%, rgba(255, 180, 60, 0.6) 25%, transparent 65%)'
                : 'radial-gradient(circle at 50% 55%, rgba(255, 200, 80, 0.3) 0%, transparent 65%)',
            filter: 'blur(6px)',
            transition: 'background 300ms ease-out',
            animation: phase === 'revealed' ? 'chestBurst 1.4s ease-out' : undefined,
          }}
        />

        {/* Chest SVG */}
        <button
          onClick={handleOpenChest}
          disabled={phase !== 'closed'}
          className="relative"
          style={{
            background: 'transparent',
            border: 0,
            padding: 0,
            cursor: phase === 'closed' ? 'pointer' : 'default',
            filter: 'drop-shadow(0 10px 18px rgba(0, 0, 0, 0.75)) drop-shadow(0 0 30px rgba(255, 200, 80, 0.4))',
            animation: phase === 'closed' ? 'chestIdleBob 2.4s ease-in-out infinite' : undefined,
          }}
        >
          <svg width="200" height="200" viewBox="0 0 200 200">
            <defs>
              <linearGradient id="chestBody2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#c68e52" />
                <stop offset="0.5" stopColor="#7a4f2a" />
                <stop offset="1" stopColor="#2a1505" />
              </linearGradient>
              <linearGradient id="chestLid2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#d19a5c" />
                <stop offset="0.6" stopColor="#8a5a24" />
                <stop offset="1" stopColor="#3a1f08" />
              </linearGradient>
              <linearGradient id="chestGold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fff6dc" />
                <stop offset="0.35" stopColor="#fdd069" />
                <stop offset="1" stopColor="#8a5a10" />
              </linearGradient>
              <radialGradient id="chestGlow" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stopColor="#fff8c0" />
                <stop offset="0.5" stopColor="#ffc040" />
                <stop offset="1" stopColor="rgba(255,180,60,0)" />
              </radialGradient>
            </defs>

            {/* Chest body (bottom half) */}
            <rect x="22" y="90" width="156" height="86" rx="4" fill="url(#chestBody2)" stroke="#0d0a06" strokeWidth="5" />

            {/* Wood grain stripes on body */}
            <g stroke="#1a0f05" strokeWidth="1.4" opacity="0.55">
              <line x1="30" y1="110" x2="170" y2="110" />
              <line x1="30" y1="130" x2="170" y2="130" />
              <line x1="30" y1="150" x2="170" y2="150" />
            </g>

            {/* Iron band on body */}
            <rect x="18" y="120" width="164" height="14" fill="#3a2a18" stroke="#0d0a06" strokeWidth="3" />
            <rect x="20" y="122" width="160" height="3" fill="rgba(255,255,255,0.25)" />

            {/* Bottom rivets */}
            <circle cx="30" cy="168" r="4" fill="url(#chestGold)" stroke="#0d0a06" strokeWidth="1.5" />
            <circle cx="100" cy="168" r="4" fill="url(#chestGold)" stroke="#0d0a06" strokeWidth="1.5" />
            <circle cx="170" cy="168" r="4" fill="url(#chestGold)" stroke="#0d0a06" strokeWidth="1.5" />

            {/* Lid — lifts up when opening/revealed */}
            <g
              style={{
                transformOrigin: '100px 92px',
                transform:
                  phase === 'closed'
                    ? 'rotate(0deg)'
                    : 'rotate(-42deg) translateY(-6px)',
                transition: 'transform 650ms cubic-bezier(0.32, 1.4, 0.4, 1)',
              }}
            >
              {/* Gold lip */}
              <rect x="18" y="86" width="164" height="10" fill="url(#chestGold)" stroke="#0d0a06" strokeWidth="3" />
              {/* Lid dome */}
              <path
                d="M22 90 Q22 30 100 30 Q178 30 178 90 Z"
                fill="url(#chestLid2)"
                stroke="#0d0a06"
                strokeWidth="5"
                strokeLinejoin="round"
              />
              {/* Lid bands */}
              <path
                d="M22 90 Q22 30 100 30 Q178 30 178 90"
                fill="none"
                stroke="#0d0a06"
                strokeWidth="1.5"
                opacity="0.6"
              />
              <line x1="100" y1="30" x2="100" y2="90" stroke="#0d0a06" strokeWidth="2" opacity="0.6" />
              {/* Iron band top */}
              <rect x="18" y="56" width="164" height="10" fill="#3a2a18" stroke="#0d0a06" strokeWidth="2.5" />
              {/* Gold rivets on lid */}
              <circle cx="30" cy="45" r="4" fill="url(#chestGold)" stroke="#0d0a06" strokeWidth="1.5" />
              <circle cx="100" cy="38" r="4" fill="url(#chestGold)" stroke="#0d0a06" strokeWidth="1.5" />
              <circle cx="170" cy="45" r="4" fill="url(#chestGold)" stroke="#0d0a06" strokeWidth="1.5" />
            </g>

            {/* Lock plate (hidden when open) */}
            {phase === 'closed' && (
              <g>
                <rect x="92" y="80" width="16" height="22" rx="2" fill="url(#chestGold)" stroke="#0d0a06" strokeWidth="2" />
                <circle cx="100" cy="88" r="2" fill="#0d0a06" />
                <rect x="99" y="88" width="2" height="7" fill="#0d0a06" />
              </g>
            )}

            {/* Glow burst from inside the open chest */}
            {(phase === 'revealed' || phase === 'opening') && (
              <>
                <ellipse cx="100" cy="95" rx="70" ry="28" fill="url(#chestGlow)" opacity="0.9">
                  <animate attributeName="ry" values="20;36;28" dur="0.9s" repeatCount="1" />
                </ellipse>
                <ellipse cx="100" cy="95" rx="40" ry="16" fill="#fff8c0" opacity="0.85" />
              </>
            )}
          </svg>
        </button>

        {/* Reward text pops up above chest */}
        {phase === 'revealed' && reward != null && (
          <div
            className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
            style={{
              top: 0,
              fontFamily: 'Lilita One, sans-serif',
              fontSize: 48,
              color: '#fdd069',
              WebkitTextStroke: '3px #0d0a06',
              paintOrder: 'stroke fill',
              textShadow: '0 4px 0 #0d0a06, 0 0 32px rgba(255, 200, 80, 0.9)',
              animation: 'rewardPop 1.6s cubic-bezier(0.16, 1, 0.3, 1) both',
              whiteSpace: 'nowrap',
            }}
          >
            +{reward} 🪙
          </div>
        )}
      </div>

      {/* Continue button after reveal */}
      {phase === 'revealed' && (
        <button
          onClick={handleContinue}
          className="absolute bottom-16 left-1/2 -translate-x-1/2 btn-gold-3d animate-fade-up"
          style={{ padding: '14px 32px', fontSize: 16 }}
        >
          Naar post →
        </button>
      )}
    </div>
  );
}
