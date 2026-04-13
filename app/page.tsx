'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import TaskPicker from './components/TaskPicker';
import TaskTimer from './components/TaskTimer';
import { getDailyTasks, loadDailyPick, saveDailyPick, type DailyTask } from '@/lib/dailyTasks';
import { useCoins } from '@/lib/useCoins';

interface TodayData {
  compliment: string | null;
}

interface StreakData {
  current: number;
  longest: number;
  lastCompletedDate: string;
  history: string[];
}

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

function loadStreak(): StreakData {
  try {
    const raw = localStorage.getItem('bliep:streak');
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...parsed, history: parsed.history || [] };
    }
  } catch { /* ignore */ }
  return { current: 0, longest: 0, lastCompletedDate: '', history: [] };
}

function saveStreak(streak: StreakData) {
  localStorage.setItem('bliep:streak', JSON.stringify(streak));
}

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = window.atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

function launchConfetti(container: HTMLElement) {
  const colors = ['#FF6B35', '#34C759', '#007AFF', '#AF52DE', '#FF3B30', '#FFA03D', '#00C7BE'];
  for (let i = 0; i < 50; i++) {
    const el = document.createElement('div');
    const size = Math.random() * 8 + 4;
    const isCircle = Math.random() > 0.5;
    el.style.cssText = `
      position: fixed; width: ${size}px; height: ${isCircle ? size : size * 2.5}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      border-radius: ${isCircle ? '50%' : '2px'}; pointer-events: none; z-index: 9999;
      left: 50%; top: 50%; opacity: 1;
    `;
    container.appendChild(el);
    const angle = (Math.random() * 360) * (Math.PI / 180);
    const velocity = Math.random() * 400 + 200;
    el.animate([
      { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${Math.cos(angle) * velocity}px, ${Math.sin(angle) * velocity + 400}px) rotate(${Math.random() * 720 - 360}deg)`, opacity: 0 },
    ], { duration: Math.random() * 800 + 800, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' }).onfinish = () => el.remove();
  }
}

function Heatmap({ history }: { history: string[] }) {
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
  const historySet = new Set(history);
  const cells: { date: string; active: boolean; isToday: boolean }[] = [];
  for (let i = 48; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    cells.push({ date: dateStr, active: historySet.has(dateStr), isToday: i === 0 });
  }
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div className="flex gap-[3px]">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-[3px]">
          {week.map((cell) => (
            <div
              key={cell.date}
              className={`w-[14px] h-[14px] rounded-[3px] transition-colors ${
                cell.active
                  ? 'bg-green'
                  : cell.isToday
                    ? 'bg-accent/20 ring-1 ring-accent/40'
                    : 'bg-subtle'
              }`}
              title={cell.date}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    { emoji: '👋', title: 'Welkom bij Bliep', text: 'Een dagelijkse challenge waar focus echt iets oplevert.' },
    { emoji: '⏱', title: '1 opdracht per dag', text: 'Kies uit 3 opdrachten en houd Bliep open tot de timer afloopt — de timer pauzeert als je de app verlaat.' },
    { emoji: '🏰', title: 'Bouw je stad', text: 'Met de coins die je verdient bouw en upgrade je je eigen stad.' },
  ];
  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[100] bg-white flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        <div className="text-5xl mb-6 animate-fade-up">{current.emoji}</div>
        <h2 className="font-serif text-2xl text-ink italic mb-3 animate-fade-up" style={{ animationDelay: '80ms' }}>{current.title}</h2>
        <p className="text-muted text-sm leading-relaxed mb-10 animate-fade-up" style={{ animationDelay: '160ms' }}>{current.text}</p>
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-accent' : 'w-2 bg-text-tertiary/30'}`} />
          ))}
        </div>
        <button
          onClick={() => isLast ? onComplete() : setStep(step + 1)}
          className="w-full bg-accent text-white font-semibold py-3.5 rounded-2xl transition-transform active:scale-[0.98] glow-accent text-sm"
        >
          {isLast ? 'Aan de slag!' : 'Volgende'}
        </button>
        {!isLast && (
          <button onClick={onComplete} className="mt-4 text-faint text-xs hover:text-muted transition-colors">Overslaan</button>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<TodayData | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [notifStatus, setNotifStatus] = useState('');
  const [installPrompt, setInstallPrompt] = useState(false);
  const [streak, setStreak] = useState<StreakData>({ current: 0, longest: 0, lastCompletedDate: '', history: [] });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tasks] = useState<DailyTask[]>(() => getDailyTasks());
  const [pick, setPick] = useState(() => loadDailyPick());
  const [attackToast, setAttackToast] = useState(false);
  const confettiRef = useRef<HTMLDivElement>(null);
  const { coins, award } = useCoins();

  const greeting = getGreeting();
  const chosenTask = pick.chosenId ? tasks.find(t => t.id === pick.chosenId) ?? null : null;

  useEffect(() => {
    fetch('/api/today').then(r => r.json()).then(setData).catch(console.error);
    setStreak(loadStreak());
    if (!localStorage.getItem('bliep:onboarded')) setShowOnboarding(true);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => { if (sub) setSubscribed(true); });
      });
    }
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (!isStandalone && /iPhone|iPad/.test(navigator.userAgent)) setInstallPrompt(true);
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
  }, []);

  const completeStreak = useCallback(() => {
    const s = loadStreak();
    const today = getToday();
    if (s.lastCompletedDate === today) return;
    const isConsecutive = s.lastCompletedDate === getYesterday();
    const newCurrent = isConsecutive ? s.current + 1 : 1;
    const updated: StreakData = {
      current: newCurrent,
      longest: Math.max(s.longest, newCurrent),
      lastCompletedDate: today,
      history: [...(s.history || []), today],
    };
    saveStreak(updated);
    setStreak(updated);
    if (confettiRef.current) launchConfetti(confettiRef.current);
  }, []);

  function handlePick(task: DailyTask) {
    const next = { date: pick.date, chosenId: task.id, completed: false };
    saveDailyPick(next);
    setPick(next);
  }

  function handleClaim(coinAmount: number) {
    award(coinAmount);
    const next = { ...pick, completed: true };
    saveDailyPick(next);
    setPick(next);
    completeStreak();
  }

  function handleAbort() {
    // Allow re-pick for the day (relaxed for prototype). Keep date so streak
    // logic can still gate to "1 per day" later.
    const next = { date: pick.date, chosenId: null, completed: false };
    saveDailyPick(next);
    setPick(next);
  }

  function showAttackToast() {
    setAttackToast(true);
    window.setTimeout(() => setAttackToast(false), 2200);
  }

  async function subscribe() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Installeer de app eerst via Safari → Deel → Zet op beginscherm');
      return;
    }
    if ('Notification' in window && Notification.permission === 'denied') {
      alert('Je hebt notificaties geblokkeerd. Ga naar je instellingen om dit te wijzigen.');
      return;
    }
    setSubscribing(true);
    setNotifStatus('Toestemming vragen...');
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') { setNotifStatus(''); setSubscribing(false); return; }
      }
      setNotifStatus('Activeren...');
      const reg = await navigator.serviceWorker.ready;
      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        await existingSub.unsubscribe();
        await fetch('/api/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: existingSub.endpoint }) }).catch(() => {});
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim()) as BufferSource,
      });
      const res = await fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) });
      if (res.ok) {
        setSubscribed(true);
        setNotifStatus('Test versturen...');
        await fetch('/api/test-push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) });
        setNotifStatus('');
        if (confettiRef.current) launchConfetti(confettiRef.current);
      }
    } catch (err) {
      console.error('Subscribe error:', err);
      alert('Kon notificaties niet activeren.');
      setNotifStatus('');
    } finally {
      setSubscribing(false);
    }
  }

  function handleOnboardingComplete() {
    localStorage.setItem('bliep:onboarded', 'true');
    setShowOnboarding(false);
  }

  const dateStr = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' });

  return (
    <div className="min-h-dvh bg-surface relative">
      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
      <div ref={confettiRef} className="fixed inset-0 pointer-events-none z-[9999]" />

      <main className="relative z-10 pt-14 pb-8 max-w-[560px] mx-auto">
        <header className="px-5 mb-6 animate-fade-up">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-serif text-2xl text-ink italic tracking-tight">{greeting}</h1>
              <p className="text-muted text-[13px] mt-0.5">{dateStr}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-[#E8B84A]/15 rounded-full px-3 py-1.5">
                <span className="text-xs">🪙</span>
                <span className="text-[#8a6320] text-xs font-bold tabular-nums">{coins}</span>
              </div>
              {streak.current > 0 && (
                <div className="flex items-center gap-1 bg-accent/8 rounded-full px-3 py-1.5">
                  <span className="text-xs">🔥</span>
                  <span className="text-accent text-xs font-bold">{streak.current}</span>
                </div>
              )}
              <Link href="/settings" className="w-9 h-9 rounded-full bg-subtle flex items-center justify-center text-faint hover:text-ink hover:bg-text-tertiary/10 transition-colors active:scale-95">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
            </div>
          </div>
        </header>

        {/* Phase A: pick task */}
        {!chosenTask && !pick.completed && (
          <TaskPicker tasks={tasks} onPick={handlePick} />
        )}

        {/* Phase B: timer + dashboard */}
        {chosenTask && !pick.completed && (
          <div className="px-5 space-y-4">
            <TaskTimer task={chosenTask} onClaim={handleClaim} onAbort={handleAbort} />
            <DashboardActions onAttack={showAttackToast} />
          </div>
        )}

        {/* Phase C: completed for today */}
        {pick.completed && (
          <div className="px-5 space-y-4">
            <section className="card-elevated p-6 text-center animate-fade-up">
              <div className="text-3xl mb-2">🎉</div>
              <h2 className="font-serif text-xl text-ink italic">Klaar voor vandaag</h2>
              <p className="text-muted text-sm mt-1">Je opdracht is afgerond. Kom morgen terug voor een nieuwe.</p>
            </section>
            <DashboardActions onAttack={showAttackToast} />
          </div>
        )}

        <div className="px-5 mt-6 space-y-4">
          {data?.compliment && (
            <section className="animate-fade-up card p-6" style={{ animationDelay: '160ms' }}>
              <p className="text-accent text-[10px] font-semibold uppercase tracking-wider mb-3">Dagelijkse quote</p>
              <p className="font-serif text-ink text-lg leading-snug italic">&ldquo;{data.compliment}&rdquo;</p>
            </section>
          )}

          {streak.history.length > 0 && (
            <section className="animate-fade-up card p-5" style={{ animationDelay: '180ms' }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-muted text-[11px] font-semibold uppercase tracking-wider">Je voortgang</p>
                <p className="text-faint text-[11px]">{streak.current} {streak.current === 1 ? 'dag' : 'dagen'} streak</p>
              </div>
              <Heatmap history={streak.history} />
            </section>
          )}

          {!subscribed && (
            <section className="animate-fade-up card p-5" style={{ animationDelay: '240ms' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-accent/10 flex items-center justify-center shrink-0">
                  <span className="text-lg">🔔</span>
                </div>
                <div>
                  <h3 className="text-ink font-semibold text-[15px]">Mis geen dag</h3>
                  <p className="text-muted text-[12px]">Ontvang elke ochtend en avond een Bliep</p>
                </div>
              </div>
              {installPrompt && (
                <div className="bg-subtle rounded-xl p-3 mb-3 text-[11px] text-muted">
                  <p className="text-ink font-medium mb-1">Eerst installeren:</p>
                  <p>Safari → deel-icoon → &quot;Zet op beginscherm&quot;</p>
                </div>
              )}
              <button
                onClick={subscribe}
                disabled={subscribing}
                className="w-full bg-accent text-white font-semibold py-3 rounded-xl transition-transform active:scale-[0.98] disabled:opacity-50 glow-accent text-sm"
              >
                {subscribing ? (notifStatus || 'Activeren...') : 'Notificaties aanzetten'}
              </button>
            </section>
          )}
        </div>

        {attackToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-[#3a2a18] text-white px-4 py-2 rounded-full text-sm shadow-lg pointer-events-none">
            ⚔️ Aanvallen komt later (Fase 5)
          </div>
        )}

        <footer className="mt-12 pb-4 text-center">
          <p className="text-[10px] text-faint tracking-[0.2em] uppercase font-medium">Bliep</p>
        </footer>
      </main>
    </div>
  );
}

function DashboardActions({ onAttack }: { onAttack: () => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 animate-fade-up" style={{ animationDelay: '140ms' }}>
      <Link
        href="/stad"
        className="rounded-3xl overflow-hidden relative active:scale-[0.98] transition-transform"
      >
        <div className="relative h-28 bg-gradient-to-br from-[#6BA368] via-[#8BC17E] to-[#E8B84A] p-4 flex flex-col justify-between">
          <p className="relative text-white/90 text-[10px] font-semibold uppercase tracking-wider">Naar je stad</p>
          <div className="relative flex items-center justify-between">
            <p className="font-serif text-xl text-white italic drop-shadow">Bouwen →</p>
            <span className="text-2xl drop-shadow">🏰</span>
          </div>
        </div>
      </Link>
      <button
        onClick={onAttack}
        className="rounded-3xl overflow-hidden relative active:scale-[0.98] transition-transform text-left"
      >
        <div className="relative h-28 bg-gradient-to-br from-[#7A2E1A] via-[#C75B3D] to-[#E8B84A] p-4 flex flex-col justify-between">
          <p className="relative text-white/90 text-[10px] font-semibold uppercase tracking-wider">Aanvallen</p>
          <div className="relative flex items-center justify-between">
            <p className="font-serif text-xl text-white italic drop-shadow">Strijden →</p>
            <span className="text-2xl drop-shadow">⚔️</span>
          </div>
        </div>
      </button>
    </div>
  );
}
