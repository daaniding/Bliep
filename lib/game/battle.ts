/**
 * Battle system types. Simulation runs in CityCanvas ticker; state here is
 * only what UI needs to read.
 */

export type EnemyKind = 'orc' | 'skeleton' | 'samurai' | 'soldier' | 'swordsman' | 'warrior';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface BattleHUDState {
  phase: 'idle' | 'active' | 'won' | 'lost';
  wave: number;
  castleHp: number;
  castleMaxHp: number;
  enemiesLeft: number;
}

export const BATTLE_START_EVENT = 'bliep:battle-start';
export const BATTLE_END_EVENT = 'bliep:battle-end';
export const BATTLE_HUD_EVENT = 'bliep:battle-hud';

export interface BattleStartDetail {
  wave: number;
  difficulty: Difficulty;
}

export interface BattleEndDetail {
  won: boolean;
  wave: number;
}

/** Enemies per wave + difficulty. */
export function waveSize(wave: number, diff: Difficulty): number {
  const base = 4 + wave * 2;
  if (diff === 'easy') return Math.max(3, Math.floor(base * 0.7));
  if (diff === 'hard') return Math.floor(base * 1.4);
  return base;
}

/** Enemy HP multiplier per difficulty. */
export function diffHpMultiplier(diff: Difficulty): number {
  if (diff === 'easy') return 0.7;
  if (diff === 'hard') return 1.5;
  return 1.0;
}
