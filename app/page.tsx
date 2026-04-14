'use client';

import GameShell from './components/GameShell';
import GameDashboard from './components/GameDashboard';

export default function Home() {
  return (
    <GameShell>
      <GameDashboard />
    </GameShell>
  );
}
