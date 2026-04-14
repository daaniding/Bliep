'use client';

import { useEffect, useState } from 'react';
import { getDailyQuests, type DailyQuest } from '@/lib/dailyQuests';

export default function DailyQuestStrip() {
  const [quests, setQuests] = useState<DailyQuest[]>([]);

  useEffect(() => {
    setQuests(getDailyQuests());
    const id = window.setInterval(() => setQuests(getDailyQuests()), 3000);
    return () => clearInterval(id);
  }, []);

  const total = quests.length;
  const done = quests.filter(q => q.done).length;

  return (
    <div
      className="relative"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '8px 10px',
        borderRadius: 12,
        background: 'linear-gradient(180deg, rgba(26, 15, 5, 0.88) 0%, rgba(13, 10, 6, 0.92) 100%)',
        border: '2px solid #0d0a06',
        boxShadow: 'inset 0 1px 0 rgba(240, 184, 64, 0.25), 0 3px 0 #0d0a06, 0 6px 14px rgba(0,0,0,0.55)',
      }}
    >
      <div className="flex items-center justify-between">
        <p className="font-display" style={{ fontSize: 10, color: '#fdd069', letterSpacing: '0.14em', textTransform: 'uppercase', textShadow: '0 1px 0 rgba(0,0,0,0.6)' }}>
          Dagelijkse opdrachten
        </p>
        <p className="font-display" style={{ fontSize: 10, color: '#fff6dc', opacity: 0.85 }}>
          {done} / {total}
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        {quests.map(q => (
          <div
            key={q.id}
            className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-all"
            style={{
              background: q.done
                ? 'linear-gradient(180deg, #3d7a3f 0%, #1e4a26 100%)'
                : 'linear-gradient(180deg, rgba(60, 40, 22, 0.75) 0%, rgba(40, 26, 12, 0.85) 100%)',
              border: q.done ? '1.5px solid #5ea05c' : '1.5px solid rgba(240, 184, 64, 0.35)',
              boxShadow: q.done
                ? 'inset 0 1px 0 rgba(255,255,255,0.25), 0 0 12px rgba(94, 160, 92, 0.35)'
                : 'inset 0 1px 0 rgba(255,255,255,0.05)',
              minWidth: 0,
            }}
          >
            <span style={{ fontSize: 13, flexShrink: 0 }}>{q.done ? '✓' : q.icon}</span>
            <span
              className="font-body truncate"
              style={{
                fontSize: 9.5,
                color: q.done ? '#e5f9ec' : '#f4e6b8',
                fontWeight: 600,
                letterSpacing: '0.01em',
              }}
            >
              {q.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
