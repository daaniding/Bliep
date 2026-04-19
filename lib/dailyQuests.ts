'use client';

import { loadCity } from './cityStore';
import { loadDailyPick, getTodayDateString } from './dailyTasks';
import { loadTrophies } from './trophies';
import type { ChestKind } from './chests';

// Daily sidequests. Two proof types:
// - 'auto': completion detected from existing state (task done, building built…)
// - 'photo': user has to upload a photo to prove they did it.
// Both get claimable-once-per-day rewards.

export interface QuestReward {
  coins: number;
  xp: number;
  chest?: ChestKind;
}

export type QuestProofType = 'auto' | 'photo';

export interface DailyQuest {
  id: string;
  title: string;
  /** Short one-line explanation of what to do. */
  description: string;
  icon: string;
  proof: QuestProofType;
  /** True when the proof condition is met (auto-detected or photo submitted). */
  done: boolean;
  /** Present when proof='photo' and user has uploaded. */
  photoDataUrl?: string;
  reward: QuestReward;
  claimed: boolean;
}

const CLAIM_KEY_PREFIX = 'bliep:quest:claimed';
const PROOF_KEY_PREFIX = 'bliep:quest:proof';
export const QUESTS_CHANGED_EVENT = 'bliep:quests-changed';

function claimKey(date: string, id: string): string {
  return `${CLAIM_KEY_PREFIX}:${date}:${id}`;
}
function proofKey(date: string, id: string): string {
  return `${PROOF_KEY_PREFIX}:${date}:${id}`;
}

export function isQuestClaimed(id: string, date = getTodayDateString()): boolean {
  try {
    return localStorage.getItem(claimKey(date, id)) === '1';
  } catch {
    return false;
  }
}

export function getQuestPhoto(id: string, date = getTodayDateString()): string | undefined {
  try {
    return localStorage.getItem(proofKey(date, id)) ?? undefined;
  } catch {
    return undefined;
  }
}

export function submitQuestPhoto(id: string, dataUrl: string, date = getTodayDateString()): void {
  try {
    localStorage.setItem(proofKey(date, id), dataUrl);
    window.dispatchEvent(new CustomEvent(QUESTS_CHANGED_EVENT));
  } catch { /* quota exceeded — photo too large */ }
}

export function removeQuestPhoto(id: string, date = getTodayDateString()): void {
  try {
    localStorage.removeItem(proofKey(date, id));
    window.dispatchEvent(new CustomEvent(QUESTS_CHANGED_EVENT));
  } catch { /* ignore */ }
}

export function markQuestClaimed(id: string, date = getTodayDateString()): void {
  try {
    localStorage.setItem(claimKey(date, id), '1');
    window.dispatchEvent(new CustomEvent(QUESTS_CHANGED_EVENT));
  } catch { /* ignore */ }
}

/** Claim a quest's reward. Returns the reward if successful, null otherwise. */
export function claimQuest(id: string): QuestReward | null {
  const quests = getDailyQuests();
  const q = quests.find(x => x.id === id);
  if (!q || !q.done || q.claimed) return null;
  markQuestClaimed(id);
  return q.reward;
}

export function hasClaimableQuests(): boolean {
  return getDailyQuests().some(q => q.done && !q.claimed);
}

// Rotation pool — 3 auto-quests (always present) + 2 photo-sidequests
// picked deterministically by day-of-year.
const PHOTO_POOL: Array<Omit<DailyQuest, 'done' | 'photoDataUrl' | 'claimed'>> = [
  {
    id: 'photo:water',
    title: 'Drink een groot glas water',
    description: 'Foto van je volle glas water als bewijs.',
    icon: '💧',
    proof: 'photo',
    reward: { coins: 70, xp: 20 },
  },
  {
    id: 'photo:clean',
    title: 'Ruim je bureau op',
    description: 'Foto van je opgeruimde werkplek.',
    icon: '🧹',
    proof: 'photo',
    reward: { coins: 90, xp: 25, chest: 'wood' },
  },
  {
    id: 'photo:walk',
    title: 'Ga 10 minuten buiten',
    description: 'Foto van buiten — lucht, straat, park, maakt niet uit.',
    icon: '🚶',
    proof: 'photo',
    reward: { coins: 110, xp: 30, chest: 'bronze' },
  },
  {
    id: 'photo:meal',
    title: 'Eet iets gezonds',
    description: 'Foto van je maaltijd — groente, fruit, salade, soep.',
    icon: '🥗',
    proof: 'photo',
    reward: { coins: 100, xp: 25, chest: 'wood' },
  },
  {
    id: 'photo:read',
    title: 'Lees 10 pagina\u2019s in een boek',
    description: 'Foto van de bladzijde waar je bent.',
    icon: '📖',
    proof: 'photo',
    reward: { coins: 80, xp: 25 },
  },
  {
    id: 'photo:stretch',
    title: 'Doe 5 minuten stretchen',
    description: 'Foto van de houding waar je mee eindigde.',
    icon: '🧘',
    proof: 'photo',
    reward: { coins: 85, xp: 25 },
  },
];

function dayOfYear(dateStr: string): number {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function pickPhotoQuests(date: string, count: number): typeof PHOTO_POOL {
  const seed = dayOfYear(date);
  const pool = [...PHOTO_POOL];
  const out: typeof PHOTO_POOL = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = (seed * 31 + i * 17) % pool.length;
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

export function getDailyQuests(): DailyQuest[] {
  const city = loadCity();
  const pick = loadDailyPick();
  const trophies = loadTrophies();
  const today = getTodayDateString();

  const buildingsToday = city.buildings.length >= 2;
  const taskDoneToday = pick.completed && pick.outcome === 'won' && pick.date === today;
  const trophyCount = trophies.count;

  const autoQuests: Array<Omit<DailyQuest, 'claimed'>> = [
    {
      id: 'focus',
      title: 'Voltooi een focus taak',
      description: 'Klaar als je taak van vandaag gewonnen is.',
      icon: '⏱',
      proof: 'auto',
      done: taskDoneToday,
      reward: { coins: 80, xp: 15, chest: 'bronze' },
    },
    {
      id: 'build',
      title: 'Bouw iets in je stad',
      description: 'Klaar als je minstens 2 gebouwen hebt.',
      icon: '🏰',
      proof: 'auto',
      done: buildingsToday,
      reward: { coins: 50, xp: 10 },
    },
    {
      id: 'trophy',
      title: 'Verdien een trofee',
      description: 'Klaar als je ooit een trofee hebt gehaald.',
      icon: '🏆',
      proof: 'auto',
      done: trophyCount >= 1,
      reward: { coins: 60, xp: 15 },
    },
  ];

  const photoQuests: Array<Omit<DailyQuest, 'claimed'>> = pickPhotoQuests(today, 2).map(q => {
    const photo = getQuestPhoto(q.id, today);
    return { ...q, done: Boolean(photo), photoDataUrl: photo };
  });

  return [...autoQuests, ...photoQuests].map(q => ({ ...q, claimed: isQuestClaimed(q.id, today) }));
}

// ---------- Photo helpers ----------

/** Downsize + compress an image file to a dataURL that fits comfortably
 * in localStorage (roughly <100KB per photo). Max width 480px, JPEG q=0.72. */
export async function compressPhotoFile(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const maxW = 480;
  const scale = Math.min(1, maxW / bitmap.width);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.72);
}
