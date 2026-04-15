'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import TaskTimer from './components/TaskTimer';
import GameShell from './components/GameShell';
import CityPreview from './components/CityPreview';
import KnightIntro from './components/KnightIntro';
import { getDailyTasks, loadDailyPick, saveDailyPick, type DailyTask } from '@/lib/dailyTasks';
import { useCoins } from '@/lib/useCoins';
import { loadCity, saveCity, addSpeedTokens } from '@/lib/cityStore';
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
    if (raw) { const p = JSON.parse(raw); return { ...p, history: p.history || [] }; }
  } catch { /* ignore */ }
  return { current: 0, longest: 0, lastCompletedDate: '', history: [] };
}
function saveStreakLS(s: { current: number; longest: number; lastCompletedDate: string; history: string[] }) {
  localStorage.setItem('bliep:streak', JSON.stringify(s));
}
function launchConfetti(container: HTMLElement) {
  const colors = ['#f0b840', '#fdd069', '#c0392b', '#5ea05c', '#8a4bbf', '#fff6dc'];
  for (let i = 0; i < 70; i++) {
    const el = document.createElement('div');
    const size = Math.random() * 12 + 6;
    const isCircle = Math.random() > 0.5;
    el.style.cssText = `position:fixed;width:${size}px;height:${isCircle ? size : size * 2.5}px;background:${colors[Math.floor(Math.random() * colors.length)]};border-radius:${isCircle ? '50%' : '2px'};pointer-events:none;z-index:9999;left:50%;top:40%;opacity:1;`;
    container.appendChild(el);
    const angle = Math.random() * Math.PI * 2;
    const v = Math.random() * 520 + 260;
    el.animate([
      { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${Math.cos(angle) * v}px,${Math.sin(angle) * v + 500}px) rotate(${Math.random() * 720 - 360}deg)`, opacity: 0 },
    ], { duration: Math.random() * 900 + 900, easing: 'cubic-bezier(0.25,0.46,0.45,0.94)' }).onfinish = () => el.remove();
  }
}

export default function Home() {
  const [tasks] = useState<DailyTask[]>(() => getDailyTasks());
  const [pick, setPick] = useState(() => loadDailyPick());
  const [showTimerModal, setShowTimerModal] = useState(false);
  const confettiRef = useRef<HTMLDivElement>(null);
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
    const isConsec = s.lastCompletedDate === getYesterday();
    const newCur = isConsec ? s.current + 1 : 1;
    saveStreakLS({ current: newCur, longest: Math.max(s.longest, newCur), lastCompletedDate: today, history: [...(s.history || []), today] });
    if (confettiRef.current) launchConfetti(confettiRef.current);
  }, []);

  function handlePick(task: DailyTask) {
    sfxTap();
    const next = { date: pick.date, chosenId: task.id, completed: false, outcome: null };
    saveDailyPick(next);
    setPick(next);
  }

  function showFloater(text: string, color: string) {
    if (!confettiRef.current) return;
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `position:fixed;left:50%;top:45%;transform:translate(-50%,-50%);font-family:'Lilita One',sans-serif;font-size:56px;color:${color};-webkit-text-stroke:3px #0d0a06;paint-order:stroke fill;text-shadow:0 4px 0 #0d0a06,0 0 32px ${color};pointer-events:none;z-index:9999;`;
    confettiRef.current.appendChild(el);
    el.animate([
      { transform: 'translate(-50%,-50%) scale(0.4)', opacity: 0 },
      { transform: 'translate(-50%,-130%) scale(1.15)', opacity: 1, offset: 0.3 },
      { transform: 'translate(-50%,-200%) scale(1)', opacity: 0 },
    ], { duration: 1700, easing: 'cubic-bezier(0.16,1,0.3,1)' }).onfinish = () => el.remove();
  }

  function handleClaim(coinAmount: number) {
    sfxClaim();
    award(coinAmount);
    saveCity(addSpeedTokens(loadCity(), 1));
    if (chosenTask) awardTrophies(trophiesForTier(chosenTask.tier), `Taak voltooid (${chosenTask.tier})`);
    const next = { ...pick, completed: true, outcome: 'won' as const };
    saveDailyPick(next); setPick(next); completeStreak(); setShowTimerModal(false);
    if (confettiRef.current) launchConfetti(confettiRef.current);
    if (chosenTask) {
      showFloater(`+${chosenTask.coins} 🪙`, '#fdd069');
      window.setTimeout(() => showFloater(`+${trophiesForTier(chosenTask.tier)} 🏆`, '#b080e0'), 350);
    }
  }
  function handleAbort() {
    sfxFail();
    const next = { ...pick, completed: true, outcome: 'gave-up' as const };
    saveDailyPick(next); setPick(next); setShowTimerModal(false);
  }
  function handleFailLock() {
    sfxFail();
    const next = { ...pick, completed: true, outcome: 'failed-locked' as const };
    saveDailyPick(next); setPick(next); setShowTimerModal(false);
  }

  return (
    <GameShell>
      <div ref={confettiRef} className="fixed inset-0 pointer-events-none z-[9999]" />
      {showPickerModal && <KnightIntro tasks={tasks} onPick={handlePick} />}

      <div className="cr-game-layout">

        {/* STAD — volledige achtergrond */}
        <div className="cr-city-bg">
          <CityPreview />
        </div>
        {/* bottom overlay removed — city fills full viewport */}

        {/* === Single big OPDRACHT button === */}
        <div className="cr-cta-row">
          <button
            type="button"
            className="cr-cta cr-cta-gold cr-cta-big"
            disabled={!chosenTask || pick.completed}
            onClick={() => chosenTask && !pick.completed && setShowTimerModal(true)}
          >
            {pick.completed ? '✓ Klaar' : 'Opdracht'}
          </button>
        </div>
        {pick.completed && (
          <div className="cr-city-done">
            {pick.outcome === 'won' && '🏆 De dag is gewonnen'}
            {pick.outcome === 'gave-up' && '💤 Dag is voorbij'}
            {pick.outcome === 'failed-locked' && '⚔️ Dag is voorbij'}
          </div>
        )}

      </div>

      {/* Timer modal */}
      {showTimerModal && chosenTask && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center p-4"
          style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(40,20,5,0.85), rgba(10,6,4,0.95))', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowTimerModal(false)}
        >
          <div className="max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="surface-floating p-5" style={{ background: 'linear-gradient(180deg, #fff6dc 0%, #fae6b6 60%, #d6b67a 100%)', border: '4px solid #1a0f05', boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.6), 0 10px 40px rgba(0,0,0,0.6), 0 0 0 3px #f0b840', borderRadius: 20 }}>
              <TaskTimer task={chosenTask} onClaim={handleClaim} onAbort={handleAbort} onFailLock={handleFailLock} />
            </div>
            <button onClick={() => setShowTimerModal(false)} className="mt-3 w-full text-center text-[var(--color-parch-200)] text-xs font-display uppercase tracking-wider py-2 hover:text-[var(--color-gold-100)] transition-colors">
              Sluiten
            </button>
          </div>
        </div>
      )}
    </GameShell>
  );
}
