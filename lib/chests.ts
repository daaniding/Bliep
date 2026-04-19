'use client';

export type ChestKind = 'wood' | 'bronze' | 'gold' | 'magic';

export type SlotState = 'empty' | 'waiting' | 'unlocking' | 'ready';

export interface ChestSlot {
  id: string;
  kind: ChestKind;
  state: SlotState;
  /** Timestamp (ms) when unlocking started */
  unlockStartedAt?: number;
  /** Total unlock duration (ms) */
  unlockMs?: number;
}

export interface ChestInventory {
  /** Up to 4 slots */
  slots: ChestSlot[];
}

const KEY = 'bliep:chests:v1';
export const CHESTS_CHANGED = 'bliep:chests-changed';
export const MAX_SLOTS = 4;

// Per-tier unlock durations (Clash-style time gates)
export const UNLOCK_MS: Record<ChestKind, number> = {
  wood:   1  * 60 * 60 * 1000, // 1h
  bronze: 3  * 60 * 60 * 1000, // 3h
  gold:   8  * 60 * 60 * 1000, // 8h
  magic:  12 * 60 * 60 * 1000, // 12h
};

// Gems cost to instantly finish the current unlock (Clash-style)
export const INSTANT_UNLOCK_COST: Record<ChestKind, number> = {
  wood:   4,
  bronze: 12,
  gold:   30,
  magic:  60,
};

// Labels
export const KIND_LABEL: Record<ChestKind, string> = {
  wood:   'Houten Kist',
  bronze: 'Bronzen Kist',
  gold:   'Gouden Kist',
  magic:  'Magische Kist',
};

// Sprite sheet row per tier (2 rows per tier = 10-frame animation)
export const KIND_ROW: Record<ChestKind, number> = {
  wood:   0,
  bronze: 2,
  gold:   4,
  magic:  6,
};

export const KIND_COLOR: Record<ChestKind, string> = {
  wood:   '#c98c1a',
  bronze: '#a86a10',
  gold:   '#ffe07a',
  magic:  '#6fd4f0',
};

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function emptyInventory(): ChestInventory {
  return { slots: [] };
}

function dispatch(inv: ChestInventory) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHESTS_CHANGED, { detail: inv }));
}

export function loadInventory(): ChestInventory {
  if (typeof window === 'undefined') return emptyInventory();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ChestInventory;
      if (Array.isArray(parsed.slots)) return parsed;
    }
  } catch { /* ignore */ }
  // Seed first install with 4 chests, one of each tier, all waiting
  const seeded: ChestInventory = {
    slots: [
      { id: uid(), kind: 'wood',   state: 'waiting' },
      { id: uid(), kind: 'bronze', state: 'waiting' },
      { id: uid(), kind: 'gold',   state: 'waiting' },
      { id: uid(), kind: 'magic',  state: 'waiting' },
    ],
  };
  saveInventory(seeded);
  return seeded;
}

export function saveInventory(inv: ChestInventory) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(KEY, JSON.stringify(inv)); } catch { /* ignore */ }
  dispatch(inv);
}

/** Refresh in-memory state: flip 'unlocking' → 'ready' when timer elapsed. */
export function tickInventory(inv: ChestInventory, now = Date.now()): ChestInventory {
  let changed = false;
  const next: ChestInventory = {
    slots: inv.slots.map((s) => {
      if (s.state === 'unlocking' && s.unlockStartedAt && s.unlockMs) {
        if (now - s.unlockStartedAt >= s.unlockMs) {
          changed = true;
          return { ...s, state: 'ready' as const };
        }
      }
      return s;
    }),
  };
  return changed ? next : inv;
}

export function remainingMs(slot: ChestSlot, now = Date.now()): number {
  if (slot.state !== 'unlocking' || !slot.unlockStartedAt || !slot.unlockMs) return 0;
  return Math.max(0, slot.unlockStartedAt + slot.unlockMs - now);
}

export function isUnlocking(inv: ChestInventory): boolean {
  return inv.slots.some((s) => s.state === 'unlocking');
}

/** Start unlocking a chest (Clash rule: only one at a time). */
export function startUnlock(inv: ChestInventory, slotId: string): { ok: boolean; inv: ChestInventory; reason?: string } {
  if (isUnlocking(inv)) return { ok: false, inv, reason: 'Er is al een kist aan het ontgrendelen' };
  const slots = inv.slots.map((s) =>
    s.id === slotId && s.state === 'waiting'
      ? { ...s, state: 'unlocking' as const, unlockStartedAt: Date.now(), unlockMs: UNLOCK_MS[s.kind] }
      : s,
  );
  const next = { slots };
  saveInventory(next);
  return { ok: true, inv: next };
}

/** Skip the remaining unlock time (caller handles gem cost). */
export function finishUnlock(inv: ChestInventory, slotId: string): ChestInventory {
  const slots = inv.slots.map((s) =>
    s.id === slotId ? { ...s, state: 'ready' as const } : s,
  );
  const next = { slots };
  saveInventory(next);
  return next;
}

/** Remove a chest from the inventory (after it's been claimed). */
export function consumeChest(inv: ChestInventory, slotId: string): ChestInventory {
  const next = { slots: inv.slots.filter((s) => s.id !== slotId) };
  saveInventory(next);
  return next;
}

/** Add a new chest to inventory (stops at MAX_SLOTS). */
export function grantChest(inv: ChestInventory, kind: ChestKind): { ok: boolean; inv: ChestInventory } {
  if (inv.slots.length >= MAX_SLOTS) return { ok: false, inv };
  const next: ChestInventory = {
    slots: [...inv.slots, { id: uid(), kind, state: 'waiting' }],
  };
  saveInventory(next);
  return { ok: true, inv: next };
}

export function formatRemaining(ms: number): string {
  if (ms <= 0) return '0:00';
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
