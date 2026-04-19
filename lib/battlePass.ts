'use client';

import type { ChestKind } from './chests';

// Battle Pass — 25-tier season system. XP-driven (not trophies).
// Season = 4 weken. Claims reset per season via seasonId in localStorage key.

export type PassReward =
  | { kind: 'coins'; amount: number }
  | { kind: 'xp'; amount: number }
  | { kind: 'trophies'; amount: number }
  | { kind: 'speed'; amount: number }
  | { kind: 'chest'; chestKind: ChestKind }
  | { kind: 'title'; label: string };

export interface PassTier {
  tier: number;
  /** Cumulative XP needed to reach this tier. */
  xpRequired: number;
  free: PassReward;
  premium: PassReward;
}

function rewardCoins(amount: number): PassReward { return { kind: 'coins', amount }; }
function rewardSpeed(amount: number): PassReward { return { kind: 'speed', amount }; }
function rewardTrophies(amount: number): PassReward { return { kind: 'trophies', amount }; }
function rewardXp(amount: number): PassReward { return { kind: 'xp', amount }; }
function rewardChest(chestKind: ChestKind): PassReward { return { kind: 'chest', chestKind }; }
function rewardTitle(label: string): PassReward { return { kind: 'title', label }; }

// 25-tier ladder. Every 5th tier = chest on free + better chest on premium.
// XP required: gentle at start, ramps up at higher tiers.
function xpForPassTier(n: number): number {
  // cumulative: tier 1 = 30, tier 25 ≈ 1900
  let total = 0;
  for (let i = 1; i <= n; i++) {
    total += 30 + Math.floor(i * 5);
  }
  return total;
}

function freeReward(tier: number): PassReward {
  if (tier === 25) return rewardChest('magic');
  if (tier === 20) return rewardChest('gold');
  if (tier === 15) return rewardChest('bronze');
  if (tier === 10) return rewardChest('wood');
  if (tier === 5)  return rewardChest('wood');
  if (tier % 4 === 0) return rewardSpeed(1 + Math.floor(tier / 10));
  if (tier % 3 === 0) return rewardXp(20 + tier * 2);
  return rewardCoins(40 + tier * 15);
}

function premiumReward(tier: number): PassReward {
  if (tier === 25) return rewardTitle('Keizer');
  if (tier === 20) return rewardChest('magic');
  if (tier === 15) return rewardChest('gold');
  if (tier === 10) return rewardChest('gold');
  if (tier === 5)  return rewardChest('bronze');
  if (tier % 4 === 0) return rewardTrophies(4 + Math.floor(tier / 2));
  if (tier % 3 === 0) return rewardSpeed(2 + Math.floor(tier / 8));
  if (tier % 2 === 0) return rewardCoins(120 + tier * 30);
  return rewardXp(30 + tier * 4);
}

export const PASS_TIERS: PassTier[] = Array.from({ length: 25 }).map((_, i) => {
  const tier = i + 1;
  return {
    tier,
    xpRequired: xpForPassTier(tier),
    free: freeReward(tier),
    premium: premiumReward(tier),
  };
});

// ---- Season management ----

/** Base date of Season 1. ISO date. Update this when starting a new season
 * cycle, or compute rolling seasons from it. Each season = 4 weeks. */
const SEASON_BASE_ISO = '2026-04-07';
const SEASON_LENGTH_MS = 28 * 24 * 60 * 60 * 1000;

export interface SeasonInfo {
  id: number;
  startsAt: number;
  endsAt: number;
  msRemaining: number;
}

export function currentSeason(now = Date.now()): SeasonInfo {
  const base = new Date(SEASON_BASE_ISO).getTime();
  const elapsed = Math.max(0, now - base);
  const id = Math.floor(elapsed / SEASON_LENGTH_MS) + 1;
  const startsAt = base + (id - 1) * SEASON_LENGTH_MS;
  const endsAt = startsAt + SEASON_LENGTH_MS;
  return { id, startsAt, endsAt, msRemaining: Math.max(0, endsAt - now) };
}

export function formatRemaining(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin - days * 60 * 24) / 60);
  if (days > 0) return `${days}d ${hours}u`;
  const mins = totalMin - hours * 60;
  if (hours > 0) return `${hours}u ${mins}m`;
  return `${mins}m`;
}

// ---- Claim state (per-season) ----

function claimedKey(seasonId: number): string {
  return `bliep:pass:claimed:s${seasonId}`;
}
function premiumKey(seasonId: number): string {
  return `bliep:pass:premium:s${seasonId}`;
}

export function loadPassClaims(seasonId: number): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(claimedKey(seasonId)) || '{}');
  } catch {
    return {};
  }
}

export function savePassClaims(seasonId: number, claims: Record<string, boolean>): void {
  try {
    localStorage.setItem(claimedKey(seasonId), JSON.stringify(claims));
  } catch { /* ignore */ }
}

export function isPremiumUnlocked(seasonId: number): boolean {
  try {
    return localStorage.getItem(premiumKey(seasonId)) === '1';
  } catch {
    return false;
  }
}

export function unlockPremium(seasonId: number): void {
  try {
    localStorage.setItem(premiumKey(seasonId), '1');
  } catch { /* ignore */ }
}

// ---- Tier helpers ----

export function tierForXp(xp: number): number {
  let t = 0;
  for (const T of PASS_TIERS) {
    if (xp >= T.xpRequired) t = T.tier;
    else break;
  }
  return t;
}

export function nextPassTier(currentTier: number): PassTier | null {
  return PASS_TIERS.find(t => t.tier === currentTier + 1) ?? null;
}

export function rewardMeta(r: PassReward): { icon: string; label: string; tint: string; big?: boolean } {
  switch (r.kind) {
    case 'coins':    return { icon: '🪙', label: String(r.amount), tint: '#fdd069' };
    case 'xp':       return { icon: '⚡', label: `${r.amount} XP`, tint: '#c0e8ff' };
    case 'trophies': return { icon: '🏆', label: String(r.amount), tint: '#c9a0ff' };
    case 'speed':    return { icon: '⚡', label: String(r.amount), tint: '#6fd4f0' };
    case 'chest': {
      const labels: Record<ChestKind, string> = {
        wood: 'Hout', bronze: 'Brons', gold: 'Goud', magic: 'Magisch',
      };
      const tints: Record<ChestKind, string> = {
        wood: '#9c6838', bronze: '#c98a3d', gold: '#fdd069', magic: '#b080e0',
      };
      return { icon: '📦', label: labels[r.chestKind], tint: tints[r.chestKind], big: true };
    }
    case 'title':    return { icon: '👑', label: r.label, tint: '#e05a3a', big: true };
  }
}
