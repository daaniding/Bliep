'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  loadTimer, startTimer, abortTimer, enterGrace, exitGrace, enforceGraceLimit,
  tickIfRunning, elapsedMs, remainingMs, graceRemainingMs, isFocused,
  type TimerState,
} from '@/lib/focusTimer';
import { TIER_CONFIG, type DailyTask } from '@/lib/dailyTasks';
import GameButton from './GameButton';

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

  // Tick loop: runs while running OR in grace (so we can fail without a return)
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

  const ringColor =
    status === 'failed' ? '#C75B3D' :
    status === 'grace' ? '#E8B84A' :
    status === 'done' ? '#6BA368' :
    status === 'running' ? '#6BA368' : '#9A8470';

  const RADIUS = 92;
  const STROKE = 12;
  const C = 2 * Math.PI * RADIUS;

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between mb-3">
        <div className="inline-flex items-center gap-1.5 bg-[var(--color-night-700)] text-[var(--color-gold-100)] px-2.5 py-1 rounded-md text-[10px] font-display font-bold uppercase tracking-wider border-2 border-[var(--color-gold-400)]">
          <span>{cfg.emoji}</span>
          <span>{cfg.label}</span>
        </div>
        <div className="flex items-center gap-1 text-[var(--color-ink-900)] font-display font-bold text-sm">
          <span>{task.coins}</span>
          <span>🪙</span>
        </div>
      </div>
      <p className="text-[var(--color-ink-900)] text-[15px] leading-snug font-medium mb-4">{task.text}</p>

      <div className="flex items-center justify-center mb-4">
        <div className="relative">
          <svg width={RADIUS * 2 + STROKE * 2} height={RADIUS * 2 + STROKE * 2}>
            <defs>
              <filter id="ringGlow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <circle
              cx={RADIUS + STROKE}
              cy={RADIUS + STROKE}
              r={RADIUS}
              fill="rgba(0,0,0,0.08)"
              stroke="rgba(0,0,0,0.15)"
              strokeWidth={STROKE}
            />
            <circle
              cx={RADIUS + STROKE}
              cy={RADIUS + STROKE}
              r={RADIUS}
              fill="none"
              stroke={ringColor}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - Math.min(1, progress))}
              transform={`rotate(-90 ${RADIUS + STROKE} ${RADIUS + STROKE})`}
              style={{ transition: 'stroke-dashoffset 250ms linear' }}
              filter="url(#ringGlow)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {status === 'failed' ? (
              <>
                <p className="font-display-bold text-3xl text-[#7a2e1a]">Mislukt</p>
                <p className="text-[#7a2e1a] text-[10px] uppercase tracking-wider mt-1 font-display font-bold">Te lang weg</p>
              </>
            ) : (
              <>
                <p className="font-display-bold text-5xl text-[var(--color-ink-900)] tabular-nums">{fmt(remaining)}</p>
                {status === 'running' && <p className="text-[var(--color-forest-700)] text-[10px] uppercase tracking-wider mt-1 font-display font-bold">Bezig</p>}
                {status === 'grace' && (
                  <p className="text-[#8a6320] text-[10px] uppercase tracking-wider mt-1 tabular-nums font-display font-bold">
                    Kom terug · {Math.ceil(graceLeft / 1000)}s
                  </p>
                )}
                {status === 'done' && <p className="text-[var(--color-forest-700)] text-[10px] uppercase tracking-wider mt-1 font-display font-bold">Klaar!</p>}
                {status === 'idle' && <p className="text-[var(--color-ink-500)] text-[10px] uppercase tracking-wider mt-1 font-display font-bold">Klaar om te starten</p>}
              </>
            )}
          </div>
        </div>
      </div>

      {status === 'grace' && (
        <p className="text-center text-[12px] text-[#8a6320] mb-3 font-display font-bold">
          Open Bliep binnen {Math.ceil(graceLeft / 1000)} sec of de taak mislukt
        </p>
      )}

      {status === 'failed' && (
        <p className="text-center text-[12px] text-[#7a2e1a] mb-3 font-display font-semibold">
          Je was te lang weg. Geen coins en geen tweede kans vandaag.
        </p>
      )}

      {status === 'idle' && (
        <GameButton variant="xl" fullWidth onClick={handleStart}>
          Start
        </GameButton>
      )}

      {status === 'failed' && (
        <GameButton variant="blood" fullWidth onClick={handleAcceptFail}>
          Sluit
        </GameButton>
      )}

      {(status === 'running' || status === 'grace') && !confirmAbort && (
        <button
          onClick={() => setConfirmAbort(true)}
          className="w-full text-[var(--color-ink-500)] text-xs font-display font-bold uppercase tracking-wider py-2 hover:text-[var(--color-ink-700)] transition-colors"
        >
          Ik geef op
        </button>
      )}

      {confirmAbort && (
        <div className="flex items-center gap-2">
          <GameButton variant="blood" fullWidth onClick={handleAbort}>
            Ja, opgeven
          </GameButton>
          <GameButton variant="night" fullWidth onClick={() => setConfirmAbort(false)}>
            Annuleer
          </GameButton>
        </div>
      )}

      {status === 'done' && (
        <GameButton variant="xl" fullWidth onClick={handleClaim}>
          Klaim {task.coins} 🪙
        </GameButton>
      )}
    </div>
  );
}
