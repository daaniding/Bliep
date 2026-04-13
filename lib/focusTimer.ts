// Focus-aware timer: only counts down while document is visible AND focused.
// Persists accumulated focus-ms to localStorage so refresh keeps progress.

const TIMER_KEY = 'bliep:timer:v1';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'done';

export interface TimerState {
  taskId: string;
  durationMs: number;
  accumulatedMs: number;
  status: TimerStatus;
  // wall-clock timestamp of the last resume; null when paused
  resumedAt: number | null;
}

function emptyState(): TimerState {
  return { taskId: '', durationMs: 0, accumulatedMs: 0, status: 'idle', resumedAt: null };
}

export function loadTimer(): TimerState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as TimerState;
      // If the saved state was 'running' but we don't know how long the user
      // had the app open since then, conservatively pause it. The user has
      // to click resume.
      if (parsed.status === 'running') {
        parsed.status = 'paused';
        parsed.resumedAt = null;
      }
      return parsed;
    }
  } catch { /* ignore */ }
  return emptyState();
}

export function saveTimer(state: TimerState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TIMER_KEY, JSON.stringify(state));
}

export function clearTimer() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TIMER_KEY);
}

export function isFocused(): boolean {
  if (typeof document === 'undefined') return false;
  return document.visibilityState === 'visible' && document.hasFocus();
}

export function startTimer(taskId: string, durationMs: number): TimerState {
  const s: TimerState = {
    taskId,
    durationMs,
    accumulatedMs: 0,
    status: 'running',
    resumedAt: Date.now(),
  };
  saveTimer(s);
  return s;
}

export function pauseTimer(state: TimerState): TimerState {
  if (state.status !== 'running' || state.resumedAt == null) return state;
  const elapsed = Date.now() - state.resumedAt;
  const next: TimerState = {
    ...state,
    accumulatedMs: state.accumulatedMs + elapsed,
    status: 'paused',
    resumedAt: null,
  };
  saveTimer(next);
  return next;
}

export function resumeTimer(state: TimerState): TimerState {
  if (state.status !== 'paused') return state;
  const next: TimerState = { ...state, status: 'running', resumedAt: Date.now() };
  saveTimer(next);
  return next;
}

export function abortTimer(): TimerState {
  clearTimer();
  return emptyState();
}

export function tickIfRunning(state: TimerState): TimerState {
  if (state.status !== 'running' || state.resumedAt == null) return state;
  const elapsed = Date.now() - state.resumedAt;
  const total = state.accumulatedMs + elapsed;
  if (total >= state.durationMs) {
    const next: TimerState = {
      ...state,
      accumulatedMs: state.durationMs,
      status: 'done',
      resumedAt: null,
    };
    saveTimer(next);
    return next;
  }
  return state;
}

export function elapsedMs(state: TimerState): number {
  if (state.status === 'running' && state.resumedAt != null) {
    return Math.min(state.durationMs, state.accumulatedMs + (Date.now() - state.resumedAt));
  }
  return Math.min(state.durationMs, state.accumulatedMs);
}

export function remainingMs(state: TimerState): number {
  return Math.max(0, state.durationMs - elapsedMs(state));
}
