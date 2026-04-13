import complimentsData from '@/data/compliments.json';

export function getDailyCompliment(): string {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
  );
  return complimentsData[dayOfYear % complimentsData.length];
}
