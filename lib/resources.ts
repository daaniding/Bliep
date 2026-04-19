'use client';

// Flexible resource ledger for non-currency materials.
// Coins, trophies and speed tokens already live in their own stores;
// everything else (gems, keys, scrolls, etc.) funnels through here.

export type ResourceKey =
  | 'gems'         // premium currency 💎
  | 'keys'         // open locked chests 🗝️
  | 'scrolls'      // unlock lore / side-quests 📜
  | 'potions'      // buff next task 🧪
  | 'magicDust'    // refresh daily tasks ✨
  | 'shards'       // crafting material 🔷
  | 'wood'         // building material 🪵
  | 'stone'        // building material 🪨
  | 'iron'         // army upgrade ⚔️
  | 'banners';     // cosmetic flag 🚩

export type ResourceLedger = Partial<Record<ResourceKey, number>>;

export interface ResourceMeta {
  key: ResourceKey;
  icon: string;
  label: string;
  color: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  description: string;
}

export const RESOURCE_META: Record<ResourceKey, ResourceMeta> = {
  gems:      { key: 'gems',      icon: '💎', label: 'Edelstenen',    color: '#6fd4f0', rarity: 'epic',      description: 'Premium valuta' },
  keys:      { key: 'keys',      icon: '🗝️', label: 'Sleutels',      color: '#F5C842', rarity: 'rare',      description: 'Open een beschermde kist' },
  scrolls:   { key: 'scrolls',   icon: '📜', label: 'Boekrollen',    color: '#c9ac74', rarity: 'rare',      description: 'Onthul verborgen verhalen' },
  potions:   { key: 'potions',   icon: '🧪', label: 'Toverdrankjes', color: '#8a4bbf', rarity: 'epic',      description: 'Verdubbel coins op je volgende taak' },
  magicDust: { key: 'magicDust', icon: '✨', label: 'Toverstof',     color: '#b080e0', rarity: 'rare',      description: 'Ververs je dagelijkse opdrachten' },
  shards:    { key: 'shards',    icon: '🔷', label: 'Scherven',      color: '#6fd4f0', rarity: 'common',    description: 'Combineer tot upgrades' },
  wood:      { key: 'wood',      icon: '🪵', label: 'Hout',          color: '#7a4320', rarity: 'common',    description: 'Basis bouwmateriaal' },
  stone:     { key: 'stone',     icon: '🪨', label: 'Steen',         color: '#8a97a5', rarity: 'common',    description: 'Voor sterkere muren' },
  iron:      { key: 'iron',      icon: '⚔️', label: 'IJzer',         color: '#9aaab8', rarity: 'rare',      description: 'Wapens en bepantsering' },
  banners:   { key: 'banners',   icon: '🚩', label: 'Banieren',      color: '#d43b2a', rarity: 'legendary', description: 'Cosmetische vlag' },
};

const KEY = 'bliep:resources:v1';
export const RESOURCES_CHANGED_EVENT = 'bliep:resources-changed';

function dispatch(ledger: ResourceLedger) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(RESOURCES_CHANGED_EVENT, { detail: ledger }));
}

export function loadResources(): ResourceLedger {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as ResourceLedger;
  } catch { /* ignore */ }
  return {};
}

export function saveResources(ledger: ResourceLedger) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(KEY, JSON.stringify(ledger)); } catch { /* ignore */ }
  dispatch(ledger);
}

export function addResource(key: ResourceKey, amount: number): ResourceLedger {
  const ledger = loadResources();
  const next: ResourceLedger = { ...ledger, [key]: (ledger[key] ?? 0) + amount };
  saveResources(next);
  return next;
}

export function addResources(delta: ResourceLedger): ResourceLedger {
  const ledger = loadResources();
  const next: ResourceLedger = { ...ledger };
  for (const k of Object.keys(delta) as ResourceKey[]) {
    next[k] = (next[k] ?? 0) + (delta[k] ?? 0);
  }
  saveResources(next);
  return next;
}

export function spendResource(key: ResourceKey, amount: number): boolean {
  const ledger = loadResources();
  const have = ledger[key] ?? 0;
  if (have < amount) return false;
  saveResources({ ...ledger, [key]: have - amount });
  return true;
}

export function hasResource(key: ResourceKey, amount: number): boolean {
  return (loadResources()[key] ?? 0) >= amount;
}

export function resourceCount(key: ResourceKey): number {
  return loadResources()[key] ?? 0;
}
