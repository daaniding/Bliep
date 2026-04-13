import tasksData from '@/data/tasks.json';

export type TaskTier = 'easy' | 'medium' | 'hard';

export interface DailyTask {
  id: string;
  text: string;
  durationMin: number;
  coins: number;
  tier: TaskTier;
}

export const TIER_CONFIG: Record<TaskTier, { durationMin: number; coins: number; label: string; emoji: string }> = {
  easy: { durationMin: 15, coins: 50, label: 'Makkelijk', emoji: '🟢' },
  medium: { durationMin: 30, coins: 130, label: 'Medium', emoji: '🟠' },
  hard: { durationMin: 60, coins: 300, label: 'Lastig', emoji: '🔴' },
};

const TIERS: TaskTier[] = ['easy', 'medium', 'hard'];

export function getTodayDateString(): string {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }))
    .toISOString()
    .split('T')[0];
}

function dayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// Deterministic LCG seeded by day-of-year so all 3 tasks (and their tier
// mapping) are stable for the whole day but rotate from day to day.
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function getDailyTasks(): DailyTask[] {
  const day = dayOfYear();
  const rand = seededRandom(day + 1);
  const date = getTodayDateString();
  const total = (tasksData as string[]).length;

  // Pick 3 distinct task indices
  const indices = new Set<number>();
  while (indices.size < 3) {
    indices.add(Math.floor(rand() * total));
  }
  const idxArr = Array.from(indices);

  // Shuffle tier assignment so the same task isn't always 'easy'
  const tierOrder = [...TIERS];
  for (let i = tierOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [tierOrder[i], tierOrder[j]] = [tierOrder[j], tierOrder[i]];
  }

  return idxArr.map((idx, i) => {
    const tier = tierOrder[i];
    const cfg = TIER_CONFIG[tier];
    return {
      id: `${date}-${idx}-${tier}`,
      text: (tasksData as string[])[idx],
      durationMin: cfg.durationMin,
      coins: cfg.coins,
      tier,
    };
  });
}

// --- Persistence: which task is picked today, and whether it's claimed ---

const PICK_KEY = 'bliep:dailypick:v1';

export type DayOutcome = 'won' | 'gave-up' | 'failed-locked' | null;

export interface DailyPick {
  date: string;
  chosenId: string | null;
  completed: boolean;
  outcome: DayOutcome;
}

export function loadDailyPick(): DailyPick {
  const today = getTodayDateString();
  const empty: DailyPick = { date: today, chosenId: null, completed: false, outcome: null };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = localStorage.getItem(PICK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DailyPick>;
      if (parsed.date !== today) return empty;
      return {
        date: today,
        chosenId: parsed.chosenId ?? null,
        completed: parsed.completed ?? false,
        outcome: (parsed.outcome as DayOutcome) ?? null,
      };
    }
  } catch { /* ignore */ }
  return empty;
}

export function saveDailyPick(pick: DailyPick) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PICK_KEY, JSON.stringify(pick));
}
