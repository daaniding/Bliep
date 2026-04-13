// Focus-aware timer: only counts down while document is visible AND focused.
// 10-second grace period when you blur — long enough for a notification swipe,
// short enough to fail you when you actually leave the app.

const TIMER_KEY = 'bliep:timer:v1';
export const GRACE_PERIOD_MS = 10_000;

export type TimerStatus = 'idle' | 'running' | 'grace' | 'failed' | 'done';

export interface TimerState {
  taskId: string;
  durationMs: number;
  accumulatedMs: number;
  status: TimerStatus;
  resumedAt: number | null;     // wall-clock of last resume; null when not running
  blurredAt: number | null;     // wall-clock of last blur; only set while in grace
}

function emptyState(): TimerState {
  return {
    taskId: '',
    durationMs: 0,
    accumulatedMs: 0,
    status: 'idle',
    resumedAt: null,
    blurredAt: null,
  };
}

export function loadTimer(): TimerState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as TimerState;
      // Refresh while running: we don't know how long the user was away,
      // so demote to grace and let the next focus event decide.
      if (parsed.status === 'running') {
        parsed.status = 'grace';
        parsed.blurredAt = Date.now();
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
    blurredAt: null,
  };
  saveTimer(s);
  return s;
}

// Called when the document blurs while we're running.
export function enterGrace(state: TimerState): TimerState {
  if (state.status !== 'running' || state.resumedAt == null) return state;
  const elapsed = Date.now() - state.resumedAt;
  const next: TimerState = {
    ...state,
    accumulatedMs: state.accumulatedMs + elapsed,
    status: 'grace',
    resumedAt: null,
    blurredAt: Date.now(),
  };
  saveTimer(next);
  return next;
}

// Called when the document focuses while we're in grace.
export function exitGrace(state: TimerState): TimerState {
  if (state.status !== 'grace') return state;
  const awayMs = state.blurredAt != null ? Date.now() - state.blurredAt : 0;
  if (awayMs > GRACE_PERIOD_MS) {
    return failTimer(state);
  }
  const next: TimerState = {
    ...state,
    status: 'running',
    resumedAt: Date.now(),
    blurredAt: null,
  };
  saveTimer(next);
  return next;
}

// Called from a tick while in grace, in case the user never refocuses.
export function enforceGraceLimit(state: TimerState): TimerState {
  if (state.status !== 'grace' || state.blurredAt == null) return state;
  const awayMs = Date.now() - state.blurredAt;
  if (awayMs > GRACE_PERIOD_MS) return failTimer(state);
  return state;
}

export function failTimer(state: TimerState): TimerState {
  const next: TimerState = {
    ...state,
    status: 'failed',
    resumedAt: null,
    blurredAt: null,
  };
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

export function graceRemainingMs(state: TimerState): number {
  if (state.status !== 'grace' || state.blurredAt == null) return 0;
  return Math.max(0, GRACE_PERIOD_MS - (Date.now() - state.blurredAt));
}
