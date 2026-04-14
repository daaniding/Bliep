'use client';

import { loadCity } from './cityStore';
import { loadDailyPick, getTodayDateString } from './dailyTasks';
import { loadTrophies } from './trophies';

// Compact daily quest list. Each quest is a short prompt + a boolean
// derived from existing state. No standalone tracking database —
// quests reference state we already have (city, daily pick, trophies).

export interface DailyQuest {
  id: string;
  title: string;
  icon: string;
  done: boolean;
}

export function getDailyQuests(): DailyQuest[] {
  const city = loadCity();
  const pick = loadDailyPick();
  const trophies = loadTrophies();
  const today = getTodayDateString();

  const buildingsToday = city.buildings.length >= 2; // >1 means user has built beyond starter
  const taskDoneToday = pick.completed && pick.outcome === 'won' && pick.date === today;
  const trophyCount = trophies.count;

  return [
    {
      id: 'focus',
      title: 'Voltooi een focus taak',
      icon: '⏱',
      done: taskDoneToday,
    },
    {
      id: 'build',
      title: 'Bouw iets in je stad',
      icon: '🏰',
      done: buildingsToday,
    },
    {
      id: 'trophy',
      title: 'Verdien een trofee',
      icon: '🏆',
      done: trophyCount >= 1,
    },
  ];
}
