'use client';

const STORAGE_KEY = 'bliep:pve:v1';

export type EnemySpriteKey = 'light-bandit' | 'heavy-bandit' | 'wolf' | 'bear' | 'boar';

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface PveCamp {
  id: string;
  name: string;
  emoji: string;
  description: string;
  defense: number;
  hireCost: number;
  rewardCoins: number;
  rewardTrophies: number;
  cooldownMs: number;
  spriteKey: EnemySpriteKey;
  spriteCount: number;
  spriteScale?: number;
}

/** Multipliers per difficulty level. */
export const DIFFICULTY_MULT: Record<Difficulty, { enemyCount: number; enemyHp: number; cost: number; reward: number; label: string; color: string }> = {
  easy:   { enemyCount: 1.0, enemyHp: 1.0, cost: 1.0, reward: 1.0, label: 'Makkelijk', color: '#6BA368' },
  normal: { enemyCount: 1.5, enemyHp: 1.4, cost: 1.5, reward: 2.0, label: 'Normaal',   color: '#E8B84A' },
  hard:   { enemyCount: 2.0, enemyHp: 2.0, cost: 2.5, reward: 3.5, label: 'Moeilijk',  color: '#C75B3D' },
};

export const CAMPS: PveCamp[] = [
  {
    id: 'bandiet',
    name: 'Bandiet kamp',
    emoji: '🏕️',
    description: 'Een handjevol bandieten op een open plek in het bos.',
    defense: 5,
    hireCost: 20,
    rewardCoins: 60,
    rewardTrophies: 2,
    cooldownMs: 60 * 60_000, // 1u
    spriteKey: 'light-bandit',
    spriteCount: 2,
  },
  {
    id: 'wolven',
    name: 'Wolven hol',
    emoji: '🐺',
    description: 'Een roedel hongerige wolven verdedigt zijn hol.',
    defense: 12,
    hireCost: 50,
    rewardCoins: 150,
    rewardTrophies: 4,
    cooldownMs: 2 * 60 * 60_000, // 2u
    spriteKey: 'wolf',
    spriteCount: 3,
  },
  {
    id: 'fort',
    name: 'Verlaten fort',
    emoji: '🏚️',
    description: 'Verovert door avonturiers — kan rijke buit bevatten.',
    defense: 25,
    hireCost: 120,
    rewardCoins: 350,
    rewardTrophies: 8,
    cooldownMs: 4 * 60 * 60_000, // 4u
    spriteKey: 'heavy-bandit',
    spriteCount: 3,
  },
  {
    id: 'goblin',
    name: 'Goblin grot',
    emoji: '👹',
    description: 'Slimme en talrijke goblins met krappe tunnels.',
    defense: 50,
    hireCost: 250,
    rewardCoins: 750,
    rewardTrophies: 15,
    cooldownMs: 8 * 60 * 60_000, // 8u
    spriteKey: 'light-bandit',
    spriteCount: 5,
  },
  {
    id: 'draak',
    name: 'Drakenhol',
    emoji: '🐉',
    description: 'Eén draak, één leven, één enorme schat.',
    defense: 100,
    hireCost: 600,
    rewardCoins: 2000,
    rewardTrophies: 30,
    cooldownMs: 24 * 60 * 60_000, // 24u
    spriteKey: 'bear',
    spriteCount: 1,
    spriteScale: 3,
  },
];

export function getCamp(id: string): PveCamp | null {
  return CAMPS.find(c => c.id === id) ?? null;
}

// --- Cooldown state ---

type PveState = Record<string, number>; // campId -> lastWonAt

export function loadPveState(): PveState {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PveState;
  } catch { /* ignore */ }
  return {};
}

export function savePveState(state: PveState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function cooldownRemainingMs(camp: PveCamp, state: PveState): number {
  const last = state[camp.id];
  if (!last) return 0;
  const elapsed = Date.now() - last;
  return Math.max(0, camp.cooldownMs - elapsed);
}

export function isOnCooldown(camp: PveCamp, state: PveState): boolean {
  return cooldownRemainingMs(camp, state) > 0;
}

// --- Battle resolution ---

export interface BattleResult {
  won: boolean;
  rolledChance: number;
  rolledOutcome: number;
  coinsGained: number;     // 0 on loss
  trophiesDelta: number;   // negative on loss
  refunded: number;        // coins returned on loss thanks to walls
}

// Walls reduce coin loss. Each wall level point gives 5% refund of hire cost,
// capped at 80% so there's still a sting. Total wall level = sum of levels.
export function wallRefundFraction(totalWallLevel: number): number {
  return Math.min(0.8, totalWallLevel * 0.05);
}

export function winChance(camp: PveCamp, kazerneLvl: number): number {
  // Chance scales with kazerne level. Lvl 0 (no kazerne) is unwinnable for
  // the higher tiers, lvl 3 makes the dragon a real fight.
  const offense = 20 + kazerneLvl * 18;
  const raw = offense / (camp.defense + offense);
  return Math.max(0.05, Math.min(0.95, raw));
}

export function resolveBattle(camp: PveCamp, kazerneLvl: number, totalWallLevel: number = 0): BattleResult {
  const chance = winChance(camp, kazerneLvl);
  const roll = Math.random();
  const won = roll < chance;
  const refunded = won ? 0 : Math.floor(camp.hireCost * wallRefundFraction(totalWallLevel));
  return {
    won,
    rolledChance: chance,
    rolledOutcome: roll,
    coinsGained: won ? camp.rewardCoins : 0,
    trophiesDelta: won ? camp.rewardTrophies : -3,
    refunded,
  };
}
