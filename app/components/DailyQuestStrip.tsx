'use client';

import { useEffect, useState } from 'react';
import { getDailyQuests, type DailyQuest } from '@/lib/dailyQuests';
import { loadDailyPick, TIER_CONFIG, type DailyTask } from '@/lib/dailyTasks';
import { sfxTap } from '@/lib/sound';

interface Props {
  chosenTask: DailyTask | null;
  taskDoneOrLocked: boolean;
  onStartTask: () => void;
}

// Featured quest card (primary: the focus task) + two secondary
// chips (build city / earn trophy). Replaces the sword CTA — the
// primary quest IS the "start task" entry point now.

export default function DailyQuestStrip({ chosenTask, taskDoneOrLocked, onStartTask }: Props) {
  const [quests, setQuests] = useState<DailyQuest[]>([]);

  useEffect(() => {
    setQuests(getDailyQuests());
    const id = window.setInterval(() => setQuests(getDailyQuests()), 3000);
    return () => clearInterval(id);
  }, []);

  const focusDone = quests.find(q => q.id === 'focus')?.done ?? false;
  const buildDone = quests.find(q => q.id === 'build')?.done ?? false;
  const trophyDone = quests.find(q => q.id === 'trophy')?.done ?? false;

  const totalDone = [focusDone, buildDone, trophyDone].filter(Boolean).length;

  // Force-sync with real pick state
  void loadDailyPick;

  function handleStart() {
    sfxTap();
    onStartTask();
  }

  const tierCfg = chosenTask ? TIER_CONFIG[chosenTask.tier] : null;

  return (
    <div className="panel-wood-img relative">
     <div className="panel-inner flex flex-col gap-2">
      <div className="flex items-center justify-between px-2">
        <p
          className="font-display"
          style={{
            fontSize: 10,
            color: '#fdd069',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            textShadow: '0 1px 0 rgba(0, 0, 0, 0.7)',
          }}
        >
          Dagelijkse opdrachten
        </p>
        <p
          className="font-display"
          style={{
            fontSize: 10,
            color: totalDone === 3 ? '#8bc17e' : '#fff6dc',
            opacity: 0.95,
            textShadow: '0 1px 0 rgba(0, 0, 0, 0.7)',
          }}
        >
          {totalDone} / 3
        </p>
      </div>

      {/* Primary quest — featured card on parchment */}
      <button
        onClick={handleStart}
        disabled={!chosenTask || taskDoneOrLocked}
        className="panel-parchment relative text-left active:scale-[0.985] transition-transform disabled:opacity-70"
        style={{
          padding: '10px 12px 10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: chosenTask && !taskDoneOrLocked ? 'pointer' : 'default',
        }}
      >
        {/* Quest icon in a gold medallion */}
        <div
          className="flex-shrink-0 flex items-center justify-center"
          style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            background: focusDone
              ? 'radial-gradient(circle at 32% 28%, #b8e8b8 0%, #5ea05c 35%, #2e5c32 100%)'
              : 'radial-gradient(circle at 32% 28%, #fff6dc 0%, #fdd069 22%, #c8891e 70%, #6e4c10 100%)',
            border: '2.5px solid #0d0a06',
            boxShadow:
              'inset 0 2px 0 rgba(255, 255, 255, 0.65), ' +
              'inset 0 -3px 0 rgba(0, 0, 0, 0.35), ' +
              '0 2px 0 #6e4c10, ' +
              '0 4px 8px rgba(0, 0, 0, 0.5)',
          }}
        >
          <span style={{ fontSize: 20, filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.3))' }}>
            {focusDone ? '✓' : '⚔️'}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            className="font-display"
            style={{
              fontSize: 10,
              color: '#7a4f2a',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              lineHeight: 1.1,
            }}
          >
            {chosenTask ? tierCfg?.label ?? 'Opdracht' : 'Opdracht'}
          </p>
          <p
            className="font-body"
            style={{
              fontSize: 13,
              color: '#2a1505',
              fontWeight: 700,
              lineHeight: 1.25,
              letterSpacing: 0,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {chosenTask ? chosenTask.text : 'Kies eerst een opdracht voor vandaag'}
          </p>
        </div>

        {/* Right side: Start button OR check if done */}
        {focusDone ? (
          <div
            className="flex-shrink-0 font-display"
            style={{
              fontSize: 11,
              color: '#2e5c32',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              padding: '4px 8px',
            }}
          >
            Klaar
          </div>
        ) : chosenTask && !taskDoneOrLocked ? (
          <div
            className="flex-shrink-0"
            style={{
              padding: '6px 14px',
              borderRadius: 10,
              background:
                'linear-gradient(180deg, #fff6dc 0%, #fdd069 15%, #f0b840 40%, #c8891e 80%, #8a5a10 100%)',
              border: '2px solid #0d0a06',
              boxShadow:
                'inset 0 1px 0 rgba(255, 255, 255, 0.7), ' +
                'inset 0 -2px 0 rgba(90, 45, 0, 0.4), ' +
                '0 2px 0 #6e4c10, ' +
                '0 4px 8px rgba(0, 0, 0, 0.5)',
            }}
          >
            <span
              className="font-display"
              style={{
                fontSize: 12,
                color: '#2a1505',
                textShadow: '0 1px 0 rgba(255, 255, 255, 0.5)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Start
            </span>
          </div>
        ) : null}
      </button>

      {/* Secondary quests — 2 compact chips */}
      <div className="flex gap-2">
        <SecondaryChip icon="🏰" title="Bouw iets in je stad" done={buildDone} />
        <SecondaryChip icon="🏆" title="Verdien een trofee" done={trophyDone} />
      </div>
     </div>
    </div>
  );
}

function SecondaryChip({ icon, title, done }: { icon: string; title: string; done: boolean }) {
  return (
    <div
      className="flex-1 flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all"
      style={{
        background: done
          ? 'linear-gradient(180deg, #5ea05c 0%, #2e5c32 100%)'
          : 'linear-gradient(180deg, rgba(60, 40, 22, 0.85) 0%, rgba(26, 15, 5, 0.95) 100%)',
        border: done ? '2px solid #0d0a06' : '2px solid #0d0a06',
        boxShadow: done
          ? 'inset 0 1px 0 rgba(255, 255, 255, 0.45), ' +
            'inset 0 -2px 0 rgba(0, 0, 0, 0.35), ' +
            '0 2px 0 #0d0a06, ' +
            '0 0 10px rgba(94, 160, 92, 0.6)'
          : 'inset 0 0 0 1px rgba(240, 184, 64, 0.45), ' +
            'inset 0 1px 0 rgba(255, 220, 150, 0.15), ' +
            'inset 0 -2px 0 rgba(0, 0, 0, 0.55), ' +
            '0 2px 0 #0d0a06',
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 14, flexShrink: 0, filter: done ? 'saturate(1.3)' : undefined }}>
        {done ? '✓' : icon}
      </span>
      <span
        className="font-body truncate"
        style={{
          fontSize: 10.5,
          color: done ? '#f0fff0' : '#f4e6b8',
          fontWeight: 700,
          letterSpacing: 0,
        }}
      >
        {title}
      </span>
    </div>
  );
}
