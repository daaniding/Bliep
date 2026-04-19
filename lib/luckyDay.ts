/** Deterministic "lucky day" check.
 *  Same date always yields the same result — no localStorage needed.
 *  On a lucky day, chests granted by task completion open instantly
 *  (no waiting timer, no gem cost). */

const LUCKY_CHANCE_PCT = 12;
const SALT = 'bliep-lucky-v1';

function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function isLuckyDay(dateStr: string): boolean {
  return hash(`${SALT}|${dateStr}`) % 100 < LUCKY_CHANCE_PCT;
}
