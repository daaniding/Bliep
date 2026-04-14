'use client';

import { useEffect, useState } from 'react';
import type { DailyTask } from '@/lib/dailyTasks';
import { TIER_CONFIG } from '@/lib/dailyTasks';
import { sfxTap } from '@/lib/sound';

// Clash-Royale-style central hero panel:
//   • Parchment scroll at top with task tier + text
//   • Knight character, BIG (~240px tall), centred
//   • One giant glowing START QUEST button below the knight
//   • Done-state: knight tilts, button becomes "KLAAR" badge

const IDLE_LINES = [
  'Sire, kies een opdracht!',
  'De koning wacht...',
  'Vandaag verdienen we glorie.',
  'Het rijk roept u, sire.',
];

interface Props {
  chosenTask: DailyTask | null;
  taskDoneOrLocked: boolean;
  outcome: 'won' | 'gave-up' | 'failed-locked' | null;
  onStartTask: () => void;
}

export default function HeroQuestPanel({
  chosenTask,
  taskDoneOrLocked,
  outcome,
  onStartTask,
}: Props) {
  const [lineIdx, setLineIdx] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setLineIdx(i => (i + 1) % IDLE_LINES.length);
    }, 6000);
    return () => clearInterval(id);
  }, []);

  const tierCfg = chosenTask ? TIER_CONFIG[chosenTask.tier] : null;
  const showStartButton = chosenTask && !taskDoneOrLocked;

  // Speech text — task if chosen, idle line otherwise
  const speech = taskDoneOrLocked
    ? outcome === 'won'
      ? 'Een glorieuze dag, sire!'
      : 'De dag is voorbij...'
    : chosenTask
      ? chosenTask.text
      : IDLE_LINES[lineIdx];

  function handleStart() {
    sfxTap();
    onStartTask();
  }

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        bottom: 90,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        zIndex: 20,
      }}
    >
      {/* === Painted scroll banner with task text ===
          The scroll PNG is 600×600. Square container + objectFit:contain
          renders it 1:1 so positions stay predictable. Parchment area
          measured from the asset: roughly center 56% horizontally,
          center 38% vertically. */}
      <div
        className="animate-fade-up"
        style={{
          position: 'relative',
          width: 260,
          height: 260,
          marginBottom: -65,
          marginTop: -30,
          filter: 'drop-shadow(0 10px 16px rgba(0,0,0,0.75))',
        }}
      >
        <img
          src="/assets/ui/scroll-banner.png"
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
        {/* Tier ribbon — sits across the top of the scroll */}
        {tierCfg && (
          <div
            style={{
              position: 'absolute',
              top: 50,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '3px 18px',
              background:
                'linear-gradient(180deg, #ff5a3a 0%, #c0392b 50%, #7a1f12 100%)',
              border: '2.5px solid #0d0a06',
              borderRadius: 6,
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.5), ' +
                '0 2px 0 #0d0a06, ' +
                '0 4px 8px rgba(0,0,0,0.6)',
              zIndex: 2,
              whiteSpace: 'nowrap',
            }}
          >
            <span
              className="font-display"
              style={{
                fontSize: 11,
                color: '#fff6dc',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                textShadow: '0 1px 0 rgba(0,0,0,0.7)',
                lineHeight: 1,
              }}
            >
              {tierCfg.emoji} {tierCfg.label}
            </span>
          </div>
        )}
        {/* Task text — over the parchment area of the painted scroll */}
        <div
          style={{
            position: 'absolute',
            top: 90,
            left: 60,
            right: 60,
            bottom: 95,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <p
            className="font-body"
            style={{
              margin: 0,
              fontSize: 12,
              lineHeight: 1.22,
              color: '#3a1f08',
              fontWeight: 800,
              textAlign: 'center',
              textShadow: '0 1px 0 rgba(255, 240, 200, 0.55)',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {speech}
          </p>
        </div>
      </div>

      {/* === Knight + START button row === */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginTop: -10,
          width: '100%',
        }}
      >
        {/* Huge knight */}
        <div
          style={{
            width: 200,
            height: 200,
            position: 'relative',
            animation: 'fadeUp 0.7s ease-out 0.3s both, knightBob 3s ease-in-out infinite 1s',
            filter: 'drop-shadow(0 14px 18px rgba(0,0,0,0.85)) drop-shadow(0 0 26px rgba(240,184,64,0.45))',
          }}
        >
          <img
            src="/assets/ui/knight.png"
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              transform: taskDoneOrLocked && outcome !== 'won' ? 'rotate(-6deg)' : undefined,
            }}
          />
        </div>

        {/* GIANT primary CTA — only when there's a chosen task and not done */}
        {showStartButton && (
          <button
            onClick={handleStart}
            className="pointer-events-auto active:scale-[0.96] transition-transform"
            style={{
              marginTop: -28,
              padding: '14px 44px',
              borderRadius: 16,
              background:
                'linear-gradient(180deg, #fff6dc 0%, #fdd069 12%, #f0b840 35%, #c8891e 75%, #8a5a10 100%)',
              border: '3.5px solid #0d0a06',
              boxShadow:
                'inset 0 2px 0 rgba(255,255,255,0.85), ' +
                'inset 0 -3px 0 rgba(90,45,0,0.5), ' +
                '0 4px 0 #6e4c10, ' +
                '0 8px 18px rgba(0,0,0,0.7), ' +
                '0 0 26px rgba(240,184,64,0.7)',
              cursor: 'pointer',
              animation: 'startPulse 1.6s ease-in-out infinite',
            }}
          >
            <span
              className="font-display"
              style={{
                fontSize: 22,
                color: '#2a1505',
                textShadow: '0 1.5px 0 rgba(255,255,255,0.55)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                lineHeight: 1,
              }}
            >
              ⚔ Start ⚔
            </span>
          </button>
        )}

        {/* Done badge */}
        {taskDoneOrLocked && (
          <div
            className="pointer-events-none"
            style={{
              marginTop: -22,
              padding: '10px 28px',
              borderRadius: 14,
              background:
                outcome === 'won'
                  ? 'linear-gradient(180deg, #b8e8b8 0%, #5ea05c 35%, #2e5c32 100%)'
                  : 'linear-gradient(180deg, #5a5a62 0%, #2a2a2e 100%)',
              border: '3px solid #0d0a06',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.5), ' +
                '0 3px 0 #0d0a06, ' +
                '0 6px 14px rgba(0,0,0,0.6)',
            }}
          >
            <span
              className="font-display"
              style={{
                fontSize: 16,
                color: '#fff6dc',
                textShadow: '0 1.5px 0 #0d0a06',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {outcome === 'won' ? '🏆 Klaar' : '⚔ Voorbij'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
