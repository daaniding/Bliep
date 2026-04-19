import { Suspense } from 'react';
import LeagueClient from './LeagueClient';

export const metadata = {
  title: 'Friend League — Bliep',
};

export default function LeaguePage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-surface" />}>
      <LeagueClient />
    </Suspense>
  );
}
