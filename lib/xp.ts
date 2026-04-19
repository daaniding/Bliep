/**
 * Player XP & Level system for Bliep.
 *
 * Trophies blijven de battle-ranking metric (league + season score).
 * XP is een aparte progressie-lijn die voedt uit taken, battles en quests.
 * Level-up triggert een LevelUpModal + chest-reward.
 */

/** XP required to go from level (L) to level (L+1). */
function xpForLevel(level: number): number {
  // Level 1→2 = 80 XP, daarna +30 per level (lichte curve).
  return 80 + Math.max(0, level - 1) * 30;
}

export interface LevelInfo {
  level: number;
  /** Total XP at start of current level. */
  base: number;
  /** Total XP needed to reach next level. */
  next: number;
  /** XP progress within current level (0..next-base). */
  progress: number;
}

export function levelForXp(totalXp: number): LevelInfo {
  let level = 1;
  let base = 0;
  // Cap at level 200 for safety.
  while (level < 200) {
    const need = xpForLevel(level);
    if (totalXp < base + need) break;
    base += need;
    level += 1;
  }
  const next = base + xpForLevel(level);
  return { level, base, next, progress: totalXp - base };
}

/** XP amounts per source — single source of truth. */
export const XP_SOURCES = {
  taskEasy: 20,
  taskMedium: 45,
  taskHard: 100,
  battleWinEasy: 30,
  battleWinNormal: 60,
  battleWinHard: 120,
  questClaim: 15,
} as const;

export type XpSource = keyof typeof XP_SOURCES;
