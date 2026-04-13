import tasksData from '@/data/tasks.json';

export function getDailyTask(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  const index = dayOfYear % tasksData.length;
  return tasksData[index];
}
