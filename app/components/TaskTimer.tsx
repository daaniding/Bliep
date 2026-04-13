'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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

export default function TaskTimer({ task, onClaim, onAbort }: Props) {
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

  const handleRetry = useCallback(() => {
    abortTimer();
    setState(emptyState());
  }, []);

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

  const RADIUS = 100;
  const STROKE = 10;
  const C = 2 * Math.PI * RADIUS;

  return (
    <section className="card-elevated p-6 animate-fade-up" style={{ animationDelay: '120ms' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span>{cfg.emoji}</span>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink">{cfg.label}</p>
        </div>
        <div className="flex items-center gap-1 text-ink font-bold text-sm">
          <span>{task.coins}</span>
          <span>🪙</span>
        </div>
      </div>
      <p className="text-ink text-[15px] leading-relaxed mb-5">{task.text}</p>

      <div className="flex items-center justify-center mb-5">
        <div className="relative">
          <svg width={RADIUS * 2 + STROKE} height={RADIUS * 2 + STROKE}>
            <circle
              cx={RADIUS + STROKE / 2}
              cy={RADIUS + STROKE / 2}
              r={RADIUS}
              fill="none"
              stroke="#00000010"
              strokeWidth={STROKE}
            />
            <circle
              cx={RADIUS + STROKE / 2}
              cy={RADIUS + STROKE / 2}
              r={RADIUS}
              fill="none"
              stroke={ringColor}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - Math.min(1, progress))}
              transform={`rotate(-90 ${RADIUS + STROKE / 2} ${RADIUS + STROKE / 2})`}
              style={{ transition: 'stroke-dashoffset 250ms linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {status === 'failed' ? (
              <>
                <p className="font-serif text-3xl text-[#C75B3D]">Mislukt</p>
                <p className="text-[#C75B3D] text-[10px] uppercase tracking-wider mt-1">Te lang weg</p>
              </>
            ) : (
              <>
                <p className="font-serif text-4xl text-ink tabular-nums">{fmt(remaining)}</p>
                {status === 'running' && <p className="text-faint text-[10px] uppercase tracking-wider mt-1">Bezig</p>}
                {status === 'grace' && (
                  <p className="text-[#a87320] text-[10px] uppercase tracking-wider mt-1 tabular-nums">
                    Kom terug · {Math.ceil(graceLeft / 1000)}s
                  </p>
                )}
                {status === 'done' && <p className="text-[#3a6a3a] text-[10px] uppercase tracking-wider mt-1">Klaar!</p>}
                {status === 'idle' && <p className="text-faint text-[10px] uppercase tracking-wider mt-1">Klaar om te starten</p>}
              </>
            )}
          </div>
        </div>
      </div>

      {status === 'grace' && (
        <p className="text-center text-[12px] text-[#8a6320] mb-3 font-medium">
          Open Bliep binnen {Math.ceil(graceLeft / 1000)} sec of de taak mislukt
        </p>
      )}

      {status === 'failed' && (
        <p className="text-center text-[12px] text-[#7a2e1a] mb-3">
          Je was te lang weg van Bliep. Geen coins deze keer — je kunt het opnieuw proberen.
        </p>
      )}

      {status === 'idle' && (
        <button
          onClick={handleStart}
          className="w-full bg-accent text-white font-semibold py-3.5 rounded-2xl glow-accent active:scale-[0.98] transition-transform text-sm"
        >
          Start timer ({task.durationMin} min)
        </button>
      )}

      {status === 'failed' && (
        <button
          onClick={handleRetry}
          className="w-full bg-accent text-white font-semibold py-3.5 rounded-2xl active:scale-[0.98] transition-transform text-sm"
        >
          Probeer opnieuw
        </button>
      )}

      {(status === 'running' || status === 'grace') && !confirmAbort && (
        <button
          onClick={() => setConfirmAbort(true)}
          className="w-full text-faint text-xs font-medium py-2 hover:text-muted transition-colors"
        >
          Ik geef op
        </button>
      )}

      {confirmAbort && (
        <div className="flex items-center gap-2">
          <button
            onClick={handleAbort}
            className="flex-1 bg-[#C75B3D] text-white font-semibold py-3 rounded-xl active:scale-[0.98] transition-transform text-sm"
          >
            Ja, geef op
          </button>
          <button
            onClick={() => setConfirmAbort(false)}
            className="flex-1 bg-subtle text-ink font-semibold py-3 rounded-xl active:scale-[0.98] transition-transform text-sm"
          >
            Annuleer
          </button>
        </div>
      )}

      {status === 'done' && (
        <button
          onClick={handleClaim}
          className="w-full bg-[#6BA368] text-white font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-transform text-sm flex items-center justify-center gap-2 shadow-lg"
        >
          Klaim {task.coins} 🪙
        </button>
      )}
    </section>
  );
}
