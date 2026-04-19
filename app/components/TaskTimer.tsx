'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  loadTimer, startTimer, abortTimer, enterGrace, exitGrace, enforceGraceLimit,
  tickIfRunning, elapsedMs, remainingMs, graceRemainingMs, isFocused,
  type TimerState,
} from '@/lib/focusTimer';
import { TIER_CONFIG, type DailyTask } from '@/lib/dailyTasks';

interface Props {
  task: DailyTask;
  onClaim: (coins: number) => void;
  onAbort: () => void;
  onFailLock: () => void;
}

function emptyState(): TimerState {
  return { taskId: '', durationMs: 0, accumulatedMs: 0, status: 'idle', resumedAt: null, blurredAt: null };
}

function fmt(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function TaskTimer({ task, onClaim, onAbort, onFailLock }: Props) {
  const [state, setState] = useState<TimerState>(() => loadTimer());
  const [, forceTick] = useState(0);
  const [confirmAbort, setConfirmAbort] = useState(false);
  const tickRef = useRef<number | null>(null);

  // Reset if loaded state belongs to another task
  useEffect(() => {
    if (state.taskId && state.taskId !== task.id && state.status !== 'done') {
      abortTimer();
      setState(emptyState());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  // Visibility/focus handlers — drive grace period
  useEffect(() => {
    function onVisibility() {
      setState(prev => {
        if (prev.status === 'running' && !isFocused()) return enterGrace(prev);
        if (prev.status === 'grace' && isFocused()) return exitGrace(prev);
        return prev;
      });
    }
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    window.addEventListener('blur', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
      window.removeEventListener('blur', onVisibility);
    };
  }, []);

  // Tick loop: runs while running OR in grace
  useEffect(() => {
    if (state.status !== 'running' && state.status !== 'grace') {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    tickRef.current = window.setInterval(() => {
      setState(prev => {
        if (prev.status === 'running') return tickIfRunning(prev);
        if (prev.status === 'grace') return enforceGraceLimit(prev);
        return prev;
      });
      forceTick(t => t + 1);
    }, 250);
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [state.status]);

  const handleStart = useCallback(() => {
    const s = startTimer(task.id, task.durationMin * 60_000);
    setState(s);
  }, [task.id, task.durationMin]);

  const handleClaim = useCallback(() => {
    abortTimer();
    setState(emptyState());
    onClaim(task.coins);
  }, [onClaim, task.coins]);

  const handleAbort = useCallback(() => {
    abortTimer();
    setState(emptyState());
    setConfirmAbort(false);
    onAbort();
  }, [onAbort]);

  const handleAcceptFail = useCallback(() => {
    abortTimer();
    setState(emptyState());
    onFailLock();
  }, [onFailLock]);

  const cfg = TIER_CONFIG[task.tier];
  const isOurs = state.taskId === task.id;
  const status = isOurs ? state.status : 'idle';
  const remaining = isOurs ? remainingMs(state) : task.durationMin * 60_000;
  const elapsed = isOurs ? elapsedMs(state) : 0;
  const progress = task.durationMin * 60_000 > 0 ? elapsed / (task.durationMin * 60_000) : 0;
  const graceLeft = isOurs ? graceRemainingMs(state) : 0;

  // Ring colors per state
  const ringPalette = {
    idle:    { primary: '#a08560', secondary: '#6a4f2e', glow: 'rgba(253,208,105,0.25)' },
    running: { primary: '#fdd069', secondary: '#a3701a', glow: 'rgba(253,208,105,0.65)' },
    grace:   { primary: '#ff9a3a', secondary: '#b85a10', glow: 'rgba(255,154,58,0.75)' },
    done:    { primary: '#7ad18c', secondary: '#2a6a3a', glow: 'rgba(122,209,140,0.7)' },
    failed:  { primary: '#e07260', secondary: '#7a1e0a', glow: 'rgba(224,114,96,0.55)' },
  }[status];

  const RADIUS = 96;
  const STROKE = 12;
  const C = 2 * Math.PI * RADIUS;

  return (
    <div>
      {/* Tier badge + coin reward pill */}
      <div className="flex items-center justify-between mb-3">
        <div
          className="inline-flex items-center gap-1.5 font-display"
          style={{
            padding: '4px 10px',
            borderRadius: 999,
            background: 'linear-gradient(180deg, #3a2718 0%, #1c0f06 100%)',
            border: '2px solid #0d0a06',
            boxShadow: 'inset 0 2px 0 rgba(255,230,160,0.25), 0 2px 0 #0d0a06',
            fontSize: 10,
            color: '#fdd069',
            letterSpacing: '0.12em',
            textShadow: '0 1px 0 #0d0a06',
          }}
        >
          <span style={{ fontSize: 12 }}>{cfg.emoji}</span>
          <span>{cfg.label.toUpperCase()}</span>
        </div>
        <div
          className="flex items-center gap-1.5 font-display tabular-nums"
          style={{
            padding: '4px 10px',
            borderRadius: 999,
            background: 'linear-gradient(180deg, #3a2718 0%, #1c0f06 100%)',
            border: '2px solid #0d0a06',
            boxShadow: 'inset 0 2px 0 rgba(255,230,160,0.25), 0 2px 0 #0d0a06',
            fontSize: 13,
            color: '#fdd069',
            textShadow: '0 1px 0 #0d0a06',
          }}
        >
          <span>{task.coins}</span>
          <span style={{ fontSize: 12 }}>🪙</span>
        </div>
      </div>

      {/* Task description */}
      <p
        className="mb-4"
        style={{
          fontFamily: 'var(--font-philosopher), serif',
          fontStyle: 'italic',
          fontSize: 14,
          color: '#e0c890',
          lineHeight: 1.4,
          letterSpacing: '0.01em',
          textAlign: 'center',
        }}
      >
        {task.text}
      </p>

      {/* The ring */}
      <div className="flex items-center justify-center mb-5" style={{ height: (RADIUS + STROKE) * 2 + 10 }}>
        <div className="relative" style={{ width: (RADIUS + STROKE) * 2, height: (RADIUS + STROKE) * 2 }}>
          {/* Outer glow ring (pulse when running/grace) */}
          {(status === 'running' || status === 'grace') && (
            <motion.div
              aria-hidden
              animate={{ scale: [1, 1.08, 1], opacity: [0.8, 0.3, 0.8] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute rounded-full pointer-events-none"
              style={{
                inset: -4,
                border: `3px solid ${ringPalette.primary}`,
                boxShadow: `0 0 28px ${ringPalette.glow}`,
              }}
            />
          )}
          <svg width={(RADIUS + STROKE) * 2} height={(RADIUS + STROKE) * 2}>
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fff6dc" />
                <stop offset="50%" stopColor={ringPalette.primary} />
                <stop offset="100%" stopColor={ringPalette.secondary} />
              </linearGradient>
              <filter id="ringGlow">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* Track */}
            <circle
              cx={RADIUS + STROKE}
              cy={RADIUS + STROKE}
              r={RADIUS}
              fill="rgba(0,0,0,0.55)"
              stroke="rgba(0,0,0,0.7)"
              strokeWidth={STROKE + 4}
            />
            {/* Inner shadow ring */}
            <circle
              cx={RADIUS + STROKE}
              cy={RADIUS + STROKE}
              r={RADIUS}
              fill="none"
              stroke="rgba(255,230,160,0.12)"
              strokeWidth={STROKE}
            />
            {/* Progress fill */}
            <circle
              cx={RADIUS + STROKE}
              cy={RADIUS + STROKE}
              r={RADIUS}
              fill="none"
              stroke="url(#ringGrad)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - Math.min(1, progress))}
              transform={`rotate(-90 ${RADIUS + STROKE} ${RADIUS + STROKE})`}
              style={{ transition: 'stroke-dashoffset 300ms linear' }}
              filter="url(#ringGlow)"
            />
            {/* Tick marks every 25% */}
            {[0.25, 0.5, 0.75].map(t => {
              const a = -Math.PI / 2 + t * Math.PI * 2;
              const cx = RADIUS + STROKE + Math.cos(a) * (RADIUS + STROKE / 2 + 2);
              const cy = RADIUS + STROKE + Math.sin(a) * (RADIUS + STROKE / 2 + 2);
              return (
                <circle
                  key={t}
                  cx={cx}
                  cy={cy}
                  r={2}
                  fill="rgba(253,208,105,0.35)"
                />
              );
            })}
          </svg>
          {/* Center display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {status === 'failed' ? (
              <>
                <p
                  className="font-display"
                  style={{
                    fontSize: 38,
                    color: '#e07260',
                    textShadow: '0 2px 0 #0d0a06, 0 0 14px rgba(224,114,96,0.5)',
                    letterSpacing: '0.04em',
                    lineHeight: 1,
                  }}
                >
                  MISLUKT
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-cinzel), serif',
                    fontSize: 10,
                    color: '#c98a80',
                    letterSpacing: '0.22em',
                    marginTop: 8,
                    textTransform: 'uppercase',
                  }}
                >
                  Te lang weg
                </p>
              </>
            ) : (
              <>
                <motion.p
                  key={fmt(remaining)}
                  initial={{ scale: 0.94, opacity: 0.7 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="font-display tabular-nums"
                  style={{
                    fontSize: 56,
                    color: '#fff6dc',
                    textShadow: `0 3px 0 #0d0a06, 0 0 22px ${ringPalette.glow}`,
                    letterSpacing: '0.04em',
                    lineHeight: 1,
                  }}
                >
                  {fmt(remaining)}
                </motion.p>
                <div
                  style={{
                    fontFamily: 'var(--font-cinzel), serif',
                    fontSize: 10,
                    letterSpacing: '0.22em',
                    marginTop: 10,
                    textTransform: 'uppercase',
                  }}
                >
                  {status === 'running' && <span style={{ color: ringPalette.primary, textShadow: '0 1px 0 #0d0a06' }}>● Bezig</span>}
                  {status === 'grace' && (
                    <span className="tabular-nums" style={{ color: ringPalette.primary, textShadow: '0 1px 0 #0d0a06' }}>
                      ⚠ Kom terug · {Math.ceil(graceLeft / 1000)}s
                    </span>
                  )}
                  {status === 'done' && <span style={{ color: ringPalette.primary, textShadow: '0 1px 0 #0d0a06' }}>✓ Klaar!</span>}
                  {status === 'idle' && <span style={{ color: '#a08560' }}>Klaar om te starten</span>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Status message bars */}
      <AnimatePresence>
        {status === 'grace' && (
          <motion.p
            initial={{ y: -6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center mb-3 font-display"
            style={{
              fontSize: 12,
              color: '#ff9a3a',
              letterSpacing: '0.06em',
              textShadow: '0 1px 0 #0d0a06',
            }}
          >
            Open Bliep binnen {Math.ceil(graceLeft / 1000)} sec of de taak mislukt
          </motion.p>
        )}
      </AnimatePresence>

      {status === 'failed' && (
        <p
          className="text-center mb-3"
          style={{
            fontFamily: 'var(--font-philosopher), serif',
            fontStyle: 'italic',
            fontSize: 12,
            color: '#c98a80',
          }}
        >
          Je was te lang weg. Geen coins en geen tweede kans vandaag.
        </p>
      )}

      {/* Action buttons */}
      {status === 'idle' && (
        <button onClick={handleStart} className="game-btn-gold w-full" style={{ padding: '14px 16px', fontSize: 15 }}>
          ⚔ START TIMER
        </button>
      )}

      {status === 'failed' && (
        <button onClick={handleAcceptFail} className="game-btn-dark w-full" style={{ padding: '12px 16px', fontSize: 13 }}>
          SLUIT
        </button>
      )}

      {(status === 'running' || status === 'grace') && !confirmAbort && (
        <button
          onClick={() => setConfirmAbort(true)}
          className="w-full py-2"
          style={{
            fontFamily: 'var(--font-lilita), sans-serif',
            fontSize: 11,
            color: '#8a6a3e',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            letterSpacing: '0.14em',
          }}
        >
          IK GEEF OP
        </button>
      )}

      {confirmAbort && (
        <div className="flex items-center gap-2">
          <button onClick={handleAbort} className="game-btn-blood flex-1" style={{ padding: '10px 12px', fontSize: 12 }}>
            JA, OPGEVEN
          </button>
          <button onClick={() => setConfirmAbort(false)} className="game-btn-dark flex-1" style={{ padding: '10px 12px', fontSize: 12 }}>
            ANNULEER
          </button>
        </div>
      )}

      {status === 'done' && (
        <motion.button
          initial={{ scale: 0.95 }}
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          onClick={handleClaim}
          className="game-btn-gold w-full"
          style={{ padding: '14px 16px', fontSize: 15 }}
        >
          CLAIM {task.coins} 🪙
        </motion.button>
      )}
    </div>
  );
}
