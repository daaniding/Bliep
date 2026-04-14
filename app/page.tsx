'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import TaskTimer from './components/TaskTimer';
import GameShell from './components/GameShell';
import DashboardHero from './components/DashboardHero';
import DailyPickerModal from './components/DailyPickerModal';
import SideRail from './components/SideRail';
import KnightHerald from './components/KnightHerald';
import DailyQuestStrip from './components/DailyQuestStrip';
import FreeChestModal from './components/FreeChestModal';
import MailModal from './components/MailModal';
import { isReady as chestIsReady, loadFreeChest } from '@/lib/freeChest';
import { getDailyTasks, loadDailyPick, saveDailyPick, TIER_CONFIG, type DailyTask } from '@/lib/dailyTasks';
import { useCoins } from '@/lib/useCoins';
import { useTrophies } from '@/lib/useTrophies';
import { trophiesForTier } from '@/lib/trophies';
import { sfxClaim, sfxFail, sfxTap } from '@/lib/sound';

function getToday(): string {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })).toISOString().split('T')[0];
}

function getYesterday(): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function loadStreakLS() {
  try {
    const raw = localStorage.getItem('bliep:streak');
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...parsed, history: parsed.history || [] };
    }
  } catch { /* ignore */ }
  return { current: 0, longest: 0, lastCompletedDate: '', history: [] };
}

function saveStreakLS(streak: { current: number; longest: number; lastCompletedDate: string; history: string[] }) {
  localStorage.setItem('bliep:streak', JSON.stringify(streak));
}

function launchConfetti(container: HTMLElement) {
  const colors = ['#f0b840', '#fdd069', '#c0392b', '#5ea05c', '#8a4bbf', '#fff6dc'];
  for (let i = 0; i < 70; i++) {
    const el = document.createElement('div');
    const size = Math.random() * 12 + 6;
    const isCircle = Math.random() > 0.5;
    el.style.cssText = `
      position: fixed; width: ${size}px; height: ${isCircle ? size : size * 2.5}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      border-radius: ${isCircle ? '50%' : '2px'}; pointer-events: none; z-index: 9999;
      left: 50%; top: 40%; opacity: 1;
      box-shadow: 0 0 12px rgba(240, 184, 64, 0.6);
    `;
    container.appendChild(el);
    const angle = (Math.random() * 360) * (Math.PI / 180);
    const velocity = Math.random() * 520 + 260;
    el.animate([
      { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${Math.cos(angle) * velocity}px, ${Math.sin(angle) * velocity + 500}px) rotate(${Math.random() * 720 - 360}deg)`, opacity: 0 },
    ], { duration: Math.random() * 900 + 900, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' }).onfinish = () => el.remove();
  }
}

export default function Home() {
  const [tasks] = useState<DailyTask[]>(() => getDailyTasks());
  const [pick, setPick] = useState(() => loadDailyPick());
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [showChestModal, setShowChestModal] = useState(false);
  const [showMailModal, setShowMailModal] = useState(false);
  const [chestReady, setChestReady] = useState(() => typeof window !== 'undefined' ? chestIsReady(loadFreeChest()) : false);
  const confettiRef = useRef<HTMLDivElement>(null);

  // Auto-offer the free chest on first visit when it's ready. Polls
  // every second so the modal appears as soon as the cooldown expires
  // while the user is already on the page.
  useEffect(() => {
    const id = window.setInterval(() => {
      setChestReady(chestIsReady(loadFreeChest()));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  const { award } = useCoins();
  const { awardTrophies } = useTrophies();

  const chosenTask = pick.chosenId ? tasks.find(t => t.id === pick.chosenId) ?? null : null;
  const showPickerModal = !chosenTask && !pick.completed;

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
  }, []);

  const completeStreak = useCallback(() => {
    const s = loadStreakLS();
    const today = getToday();
    if (s.lastCompletedDate === today) return;
    const isConsecutive = s.lastCompletedDate === getYesterday();
    const newCurrent = isConsecutive ? s.current + 1 : 1;
    const updated = {
      current: newCurrent,
      longest: Math.max(s.longest, newCurrent),
      lastCompletedDate: today,
      history: [...(s.history || []), today],
    };
    saveStreakLS(updated);
    if (confettiRef.current) launchConfetti(confettiRef.current);
  }, []);

  function handlePick(task: DailyTask) {
    sfxTap();
    const next: typeof pick = { date: pick.date, chosenId: task.id, completed: false, outcome: null };
    saveDailyPick(next);
    setPick(next);
  }

  function handleClaim(coinAmount: number) {
    sfxClaim();
    award(coinAmount);
    if (chosenTask) {
      awardTrophies(trophiesForTier(chosenTask.tier), `Taak voltooid (${chosenTask.tier})`);
    }
    const next: typeof pick = { ...pick, completed: true, outcome: 'won' };
    saveDailyPick(next);
    setPick(next);
    completeStreak();
    setShowTimerModal(false);
    if (confettiRef.current) launchConfetti(confettiRef.current);
    if (chosenTask) {
      showFloater(`+${chosenTask.coins} 🪙`, '#fdd069');
      window.setTimeout(() => showFloater(`+${trophiesForTier(chosenTask.tier)} 🏆`, '#b080e0'), 350);
    }
  }

  function showFloater(text: string, color: string) {
    if (!confettiRef.current) return;
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `
      position: fixed; left: 50%; top: 45%;
      transform: translate(-50%, -50%);
      font-family: var(--font-lilita), 'Lilita One', sans-serif;
      font-weight: 400;
      font-size: 56px;
      color: ${color};
      -webkit-text-stroke: 3px #0d0a06;
      paint-order: stroke fill;
      text-shadow: 0 4px 0 #0d0a06, 0 0 32px ${color};
      pointer-events: none; z-index: 9999;
      will-change: transform, opacity;
      letter-spacing: 0.02em;
    `;
    confettiRef.current.appendChild(el);
    el.animate([
      { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 0 },
      { transform: 'translate(-50%, -130%) scale(1.15)', opacity: 1, offset: 0.3 },
      { transform: 'translate(-50%, -200%) scale(1)', opacity: 0 },
    ], { duration: 1700, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }).onfinish = () => el.remove();
  }

  function handleAbort() {
    sfxFail();
    const next: typeof pick = { ...pick, completed: true, outcome: 'gave-up' };
    saveDailyPick(next);
    setPick(next);
    setShowTimerModal(false);
  }

  function handleFailLock() {
    sfxFail();
    const next: typeof pick = { ...pick, completed: true, outcome: 'failed-locked' };
    saveDailyPick(next);
    setPick(next);
    setShowTimerModal(false);
  }

  function handleSwordTap() {
    if (!chosenTask || pick.completed) return;
    setShowTimerModal(true);
  }

  return (
    <GameShell>
      <div ref={confettiRef} className="fixed inset-0 pointer-events-none z-[9999]" />

      {showPickerModal && <DailyPickerModal tasks={tasks} onPick={handlePick} />}

      {/* Hero — animated castle scene fills all available space.
          SideRail sits right, widgets stack at bottom. */}
      <div className="hero-fill animate-fade-up relative">
        <DashboardHero />

        {/* Knight herald — character + speech scroll on the hero */}
        <KnightHerald
          chosenTaskTitle={chosenTask?.text ?? null}
          taskDone={pick.completed}
        />

        {/* Side rail: 4 icon buttons on the right edge, vertically centred */}
        <div
          className="absolute z-10 pointer-events-none"
          style={{ top: '48%', right: 8, transform: 'translateY(-50%)' }}
        >
          <SideRail onMailClick={() => setShowMailModal(true)} onChestClick={() => setShowChestModal(true)} />
        </div>

        {/* Chest pop-up CTA button floating above the daily quest strip,
            visible only when chest is ready */}
        {chestReady && (
          <div
            className="absolute left-0 right-0 flex justify-center z-20 pointer-events-none"
            style={{ bottom: 170 }}
          >
            <button
              onClick={() => { setShowChestModal(true); }}
              className="btn-gold-3d pointer-events-auto animate-fade-up"
              style={{
                padding: '12px 20px',
                fontSize: 14,
                animation: 'fadeUp 0.4s both, chestIdleBob 2.4s ease-in-out infinite 0.5s',
              }}
            >
              📦 Gratis kist claimen
            </button>
          </div>
        )}

        {/* Completed state — short overlay near the top */}
        {pick.completed && (
          <div
            className="absolute left-0 right-0 top-4 flex justify-center z-10 pointer-events-none animate-fade-up"
            style={{ animationDelay: '160ms' }}
          >
            <p className="font-display text-[15px] text-[var(--color-gold-100)] text-stroke-dark">
              {pick.outcome === 'won' && '🏆 De dag is gewonnen'}
              {pick.outcome === 'gave-up' && '💤 Dag is voorbij'}
              {pick.outcome === 'failed-locked' && '⚔️ Dag is voorbij'}
            </p>
          </div>
        )}

        {/* Bottom widget stack: daily quest strip (with featured start card) */}
        <div
          className="absolute left-0 right-0 px-3 z-10 flex flex-col gap-2 animate-fade-up"
          style={{ bottom: 10, animationDelay: '160ms' }}
        >
          <DailyQuestStrip
            chosenTask={chosenTask}
            taskDoneOrLocked={pick.completed}
            onStartTask={handleSwordTap}
          />
        </div>
      </div>

      {/* Free chest popup modal */}
      {showChestModal && (
        <FreeChestModal
          onClose={() => setShowChestModal(false)}
          onOpenMail={() => setShowMailModal(true)}
        />
      )}

      {/* Mail modal */}
      {showMailModal && <MailModal onClose={() => setShowMailModal(false)} />}

      {/* Timer modal — opens when user taps the sword */}
      {showTimerModal && chosenTask && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center p-4"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(40, 20, 5, 0.85), rgba(10, 6, 4, 0.95))',
            backdropFilter: 'blur(8px)',
          }}
          onClick={() => setShowTimerModal(false)}
        >
          <div className="max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="frame-gold-img">
             <div className="frame-inner" style={{ padding: '8px 10px' }}>
              <TaskTimer task={chosenTask} onClaim={handleClaim} onAbort={handleAbort} onFailLock={handleFailLock} />
             </div>
            </div>
            <button
              onClick={() => setShowTimerModal(false)}
              className="mt-3 w-full text-center text-[var(--color-parch-200)] text-xs font-display uppercase tracking-wider py-2 hover:text-[var(--color-gold-100)] transition-colors"
            >
              Sluiten
            </button>
          </div>
        </div>
      )}
    </GameShell>
  );
}
