'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import TaskPicker from './components/TaskPicker';
import TaskTimer from './components/TaskTimer';
import GameShell from './components/GameShell';
import GameButton from './components/GameButton';
import HeroPanel from './components/HeroPanel';
import ChestSlots from './components/ChestSlots';
import TownScene from './components/TownScene';
import { getDailyTasks, loadDailyPick, saveDailyPick, type DailyTask } from '@/lib/dailyTasks';
import { useCoins } from '@/lib/useCoins';
import { useTrophies } from '@/lib/useTrophies';
import { trophiesForTier } from '@/lib/trophies';
import { useUser } from '@/lib/useUser';

function getGreeting(): string {
  const h = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })).getHours();
  if (h < 6) return 'Goedenacht';
  if (h < 12) return 'Goedemorgen';
  if (h < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

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
  const colors = ['#E8B84A', '#F5D068', '#C75B3D', '#6BA368', '#7A4ABF', '#FFE99A'];
  for (let i = 0; i < 60; i++) {
    const el = document.createElement('div');
    const size = Math.random() * 10 + 5;
    const isCircle = Math.random() > 0.5;
    el.style.cssText = `
      position: fixed; width: ${size}px; height: ${isCircle ? size : size * 2.5}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      border-radius: ${isCircle ? '50%' : '2px'}; pointer-events: none; z-index: 9999;
      left: 50%; top: 40%; opacity: 1;
      box-shadow: 0 0 8px rgba(232,184,74,0.4);
    `;
    container.appendChild(el);
    const angle = (Math.random() * 360) * (Math.PI / 180);
    const velocity = Math.random() * 500 + 250;
    el.animate([
      { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${Math.cos(angle) * velocity}px, ${Math.sin(angle) * velocity + 500}px) rotate(${Math.random() * 720 - 360}deg)`, opacity: 0 },
    ], { duration: Math.random() * 900 + 900, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' }).onfinish = () => el.remove();
  }
}

function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    { emoji: '👋', title: 'Welkom bij Bliep', text: 'Een dagelijkse focus-challenge waar volhouden iets echts oplevert.' },
    { emoji: '🎯', title: 'Kies één opdracht per dag', text: 'Elke dag drie keuzes — makkelijk, medium of lastig. Hoger tier = langere timer = meer beloning. Eén kans per dag.' },
    { emoji: '⏱', title: 'Houd Bliep open', text: 'Tijdens de timer mag je de app niet verlaten. Wegklikken? Je hebt 10 seconden om terug te komen, anders mislukt de taak.' },
    { emoji: '🏰', title: 'Bouw je stad', text: 'Voltooid? Coins en trofeeën komen binnen. Spendeer ze in je middeleeuwse stad — huizen, boerderijen, kazernes, muren.' },
    { emoji: '⚔️', title: 'Vecht en concurreer', text: 'Val NPC kampen aan voor extra coins. Maak een Friend League met een 6-letter code en zie wie de meeste trofeeën heeft.' },
  ];
  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-6"
      style={{ background: 'radial-gradient(circle at 50% 50%, #1b2a4e 0%, #0d1426 100%)' }}>
      <div className="max-w-sm w-full text-center">
        <div className="text-6xl mb-6 animate-fade-up drop-shadow-[0_0_24px_rgba(232,184,74,0.4)]">{current.emoji}</div>
        <h2 className="font-display font-bold text-3xl text-[var(--color-gold-100)] mb-3 animate-fade-up" style={{ animationDelay: '80ms' }}>{current.title}</h2>
        <p className="text-[var(--color-parchment-200)] text-sm leading-relaxed mb-10 animate-fade-up" style={{ animationDelay: '160ms' }}>{current.text}</p>
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-7 bg-[var(--color-gold-300)]' : 'w-1.5 bg-[var(--color-night-500)]'}`} />
          ))}
        </div>
        <GameButton fullWidth onClick={() => isLast ? onComplete() : setStep(step + 1)}>
          {isLast ? 'Aan de slag!' : 'Volgende'}
        </GameButton>
        {!isLast && (
          <button onClick={onComplete} className="mt-4 text-[var(--color-night-500)] text-xs font-display font-semibold uppercase tracking-wider hover:text-[var(--color-gold-300)] transition-colors">Overslaan</button>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tasks] = useState<DailyTask[]>(() => getDailyTasks());
  const [pick, setPick] = useState(() => loadDailyPick());
  const confettiRef = useRef<HTMLDivElement>(null);
  const { award } = useCoins();
  const { awardTrophies } = useTrophies();
  const { user } = useUser();

  const greeting = getGreeting();
  const chosenTask = pick.chosenId ? tasks.find(t => t.id === pick.chosenId) ?? null : null;

  useEffect(() => {
    if (!localStorage.getItem('bliep:onboarded')) setShowOnboarding(true);
  }, []);

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
    const next: typeof pick = { date: pick.date, chosenId: task.id, completed: false, outcome: null };
    saveDailyPick(next);
    setPick(next);
  }

  function handleClaim(coinAmount: number) {
    award(coinAmount);
    if (chosenTask) {
      awardTrophies(trophiesForTier(chosenTask.tier), `Taak voltooid (${chosenTask.tier})`);
    }
    const next: typeof pick = { ...pick, completed: true, outcome: 'won' };
    saveDailyPick(next);
    setPick(next);
    completeStreak();
    if (confettiRef.current) launchConfetti(confettiRef.current);
    if (chosenTask) {
      showFloater(`+${chosenTask.coins} 🪙`, 'var(--color-gold-300)');
      window.setTimeout(() => showFloater(`+${trophiesForTier(chosenTask.tier)} 🏆`, 'var(--color-magic-300)'), 350);
    }
  }

  function showFloater(text: string, color: string) {
    if (!confettiRef.current) return;
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `
      position: fixed; left: 50%; top: 45%;
      transform: translate(-50%, -50%);
      font-family: var(--font-cinzel), 'Cinzel', serif;
      font-weight: 800;
      font-size: 52px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: ${color};
      text-shadow: 0 4px 24px rgba(0,0,0,0.6), 0 0 40px ${color};
      pointer-events: none; z-index: 9999;
      will-change: transform, opacity;
      letter-spacing: -0.025em;
    `;
    confettiRef.current.appendChild(el);
    el.animate([
      { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 0 },
      { transform: 'translate(-50%, -130%) scale(1.15)', opacity: 1, offset: 0.3 },
      { transform: 'translate(-50%, -200%) scale(1)', opacity: 0 },
    ], { duration: 1700, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }).onfinish = () => el.remove();
  }

  function handleAbort() {
    const next: typeof pick = { ...pick, completed: true, outcome: 'gave-up' };
    saveDailyPick(next);
    setPick(next);
  }

  function handleOnboardingComplete() {
    localStorage.setItem('bliep:onboarded', 'true');
    setShowOnboarding(false);
  }

  return (
    <GameShell>
      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
      <div ref={confettiRef} className="fixed inset-0 pointer-events-none z-[9999]" />

      <div className="px-4 max-w-md mx-auto">
        {/* Town scene hero */}
        <div className="pt-2 pb-3 animate-fade-up">
          <TownScene />
        </div>

        {/* Compact greeting */}
        <p className="text-center text-[var(--color-gold-100)] text-[13px] font-display font-bold uppercase tracking-[0.15em] mb-2 animate-fade-up" style={{ animationDelay: '60ms' }}>
          {greeting}{user ? `, ${user.displayName}` : ''}
        </p>

        {/* Phase A: pick task */}
        {!chosenTask && !pick.completed && (
          <HeroPanel ribbonText="Vandaag">
            <TaskPicker tasks={tasks} onPick={handlePick} />
          </HeroPanel>
        )}

        {/* Phase B: timer + dashboard */}
        {chosenTask && !pick.completed && (
          <HeroPanel ribbonText="Bezig">
            <TaskTimer
              task={chosenTask}
              onClaim={handleClaim}
              onAbort={handleAbort}
              onFailLock={() => {
                const next: typeof pick = { ...pick, completed: true, outcome: 'failed-locked' };
                saveDailyPick(next);
                setPick(next);
              }}
            />
          </HeroPanel>
        )}

        {/* Phase C: completed for today */}
        {pick.completed && (
          <HeroPanel ribbonText="Vandaag">
            <div className="text-center py-2">
              <div className="text-6xl mb-3 drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)]">{pick.outcome === 'won' ? '🎉' : '💤'}</div>
              <h2 className="font-display-bold text-2xl text-[var(--color-ink-900)]">
                {pick.outcome === 'won' ? 'Klaar voor vandaag' : 'Dag voorbij'}
              </h2>
              <p className="text-[var(--color-ink-600)] text-sm mt-2">
                {pick.outcome === 'won' && 'Je hebt je opdracht volbracht. Kom morgen terug voor een nieuwe keuze.'}
                {pick.outcome === 'gave-up' && 'Je hebt opgegeven. Kom morgen terug.'}
                {pick.outcome === 'failed-locked' && 'Je was te lang weg van Bliep. Kom morgen terug.'}
              </p>
            </div>
          </HeroPanel>
        )}

        {/* Chest slots: live PvE camp status */}
        <div className="mt-5 animate-fade-up" style={{ animationDelay: '120ms' }}>
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-[var(--color-gold-200)]/80 text-[10px] font-display font-bold uppercase tracking-[0.2em]">Aanvallen</p>
            <Link href="/aanvallen" className="text-[var(--color-gold-200)]/60 text-[10px] font-display font-bold uppercase tracking-wider hover:text-[var(--color-gold-100)]">
              Alles →
            </Link>
          </div>
          <ChestSlots />
        </div>

        {/* Secondary actions */}
        <div className="mt-4">
          <DashboardActions />
        </div>
      </div>
    </GameShell>
  );
}

function DashboardActions() {
  return (
    <div className="grid grid-cols-2 gap-3 animate-fade-up" style={{ animationDelay: '140ms' }}>
      <Link
        href="/stad"
        className="rounded-2xl overflow-hidden relative active:scale-[0.96] transition-transform"
        style={{
          background: 'linear-gradient(180deg, var(--color-forest-300) 0%, var(--color-forest-500) 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(0,0,0,0.25), 0 4px 0 var(--color-forest-900), 0 6px 12px rgba(0,0,0,0.4)',
          border: '2px solid var(--color-forest-900)',
        }}
      >
        <div className="relative h-28 p-4 flex flex-col justify-between">
          <p className="relative text-white/90 text-[10px] font-display font-bold uppercase tracking-[0.15em]" style={{ textShadow: '0 1px 0 rgba(0,0,0,0.3)' }}>Naar je stad</p>
          <div className="relative flex items-center justify-between">
            <p className="font-display-bold text-xl text-white" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.4)' }}>Bouwen</p>
            <span className="text-3xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">🏰</span>
          </div>
        </div>
      </Link>
      <Link
        href="/aanvallen"
        className="rounded-2xl overflow-hidden relative active:scale-[0.96] transition-transform"
        style={{
          background: 'linear-gradient(180deg, var(--color-blood-300) 0%, var(--color-blood-500) 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(0,0,0,0.3), 0 4px 0 var(--color-blood-900), 0 6px 12px rgba(0,0,0,0.4)',
          border: '2px solid var(--color-blood-900)',
        }}
      >
        <div className="relative h-28 p-4 flex flex-col justify-between">
          <p className="relative text-white/90 text-[10px] font-display font-bold uppercase tracking-[0.15em]" style={{ textShadow: '0 1px 0 rgba(0,0,0,0.3)' }}>Aanvallen</p>
          <div className="relative flex items-center justify-between">
            <p className="font-display-bold text-xl text-white" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.4)' }}>Strijden</p>
            <span className="text-3xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">⚔️</span>
          </div>
        </div>
      </Link>
    </div>
  );
}
