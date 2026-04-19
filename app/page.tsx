'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import TaskTimer from './components/TaskTimer';
import GameShell from './components/GameShell';
import CityPreview from './components/CityPreview';
import BookPicker from './components/BookPicker';
import { vibrate } from '@/lib/juice';
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
  const { coins, award } = useCoins();
  const { trophies, awardTrophies } = useTrophies();
  const [streak, setStreak] = useState(0);

  const chosenTask = pick.chosenId ? tasks.find(t => t.id === pick.chosenId) ?? null : null;
  const showPickerModal = !chosenTask && !pick.completed;

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
    setStreak(loadStreakLS().current || 0);
  }, []);

  const completeStreak = useCallback(() => {
    const s = loadStreakLS();
    const today = getToday();
    if (s.lastCompletedDate === today) return;
    const isConsec = s.lastCompletedDate === getYesterday();
    const newCur = isConsec ? s.current + 1 : 1;
    saveStreakLS({ current: newCur, longest: Math.max(s.longest, newCur), lastCompletedDate: today, history: [...(s.history || []), today] });
    setStreak(newCur);
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

  const level = 2;
  const xp = 46;
  const xpMax = 100;
  const xpPct = (xp / xpMax) * 100;
  const opdrachtDisabled = !chosenTask || pick.completed;

  return (
    <GameShell hideTopBar hideNav>
      <div ref={confettiRef} className="fixed inset-0 pointer-events-none z-[9999]" />
      {showPickerModal && <BookPicker tasks={tasks} onPick={handlePick} />}

      <div className="bh-home">

        {/* STAGE — full-bleed live city (Pixi handles its own sky + clouds) */}
        <Link href="/stad" className="bh-stage" aria-label="Open je stad" onClick={() => vibrate(15)}>
          <CityPreview bare />
          {/* blends to dark under topbar */}
          <div className="bh-stage-top-fade" />
          {/* blends to dark above base panel */}
          <div className="bh-stage-bot-fade" />
        </Link>

        {/* TOP BAR — player chip + coins + trophies */}
        <div className="bh-topbar">
          <div className="bh-player-chip">
            <div className="bh-avatar" aria-label={`Niveau ${level}`}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
                <path d="M7 8 Q7 3 14 3 Q21 3 21 8 L21 16 Q21 20 18 21 L18 25 L10 25 L10 21 Q7 20 7 16 Z"
                  fill="#d0dae4" stroke="#1A0A02" strokeWidth="1.4" strokeLinejoin="round" />
                <rect x="8.5" y="12" width="11" height="2.5" fill="#1A0A02" />
                <path d="M10.5 12.5 L10.5 9 M12.5 12.5 L12.5 9 M14.5 12.5 L14.5 9 M16.5 12.5 L16.5 9"
                  stroke="#1A0A02" strokeWidth="1" />
                <path d="M14 3 Q17 0 19 1 Q17 3 16 5 Z" fill="#d43b2a" stroke="#1A0A02" strokeWidth="1" strokeLinejoin="round" />
              </svg>
              <div className="bh-lvl">{level}</div>
            </div>
            <div className="bh-name-xp">
              <div className="bh-pname">DAAN</div>
              <div className="bh-xp-track">
                <div className="bh-xp-fill" style={{ width: `${xpPct}%` }} />
                <div className="bh-xp-label">{xp} / {xpMax}</div>
              </div>
            </div>
          </div>

          <div className="bh-stat">
            <span className="bh-coin" />
            <span>{coins.toLocaleString('nl-NL')}</span>
          </div>

          <Link href="/league" className="bh-stat bh-stat-link" onClick={() => vibrate(10)}>
            <svg className="bh-trophy" viewBox="0 0 20 20" aria-hidden>
              <path d="M5 3 L15 3 L15 9 Q15 13 10 14 Q5 13 5 9 Z" fill="#F5C842" stroke="#1A0A02" strokeWidth="1.3" />
              <path d="M5 5 Q2 5 2 8 Q2 10 5 10 M15 5 Q18 5 18 8 Q18 10 15 10" fill="none" stroke="#1A0A02" strokeWidth="1.3" />
              <rect x="8" y="14" width="4" height="3" fill="#C8882A" stroke="#1A0A02" strokeWidth="1" />
              <rect x="6" y="17" width="8" height="2" fill="#8e5a18" stroke="#1A0A02" strokeWidth="1" />
            </svg>
            <span>{trophies}</span>
          </Link>
        </div>

        {/* SIDE RAIL — streak, settings, meer */}
        <div className="bh-rail">
          <button className="bh-rail-btn" aria-label="Streak" onClick={() => vibrate(10)}>
            <svg width="22" height="26" viewBox="0 0 22 26" fill="none" aria-hidden>
              <path d="M11 2 Q12 7 14 8 Q18 10 18 15 Q18 21 11 22 Q4 21 4 15 Q4 11 6 9 Q8 11 8 13 Q9 8 11 2 Z"
                fill="#e05a3a" stroke="#1A0A02" strokeWidth="1.3" strokeLinejoin="round" />
              <path d="M11 11 Q12 14 13 15 Q14 16 14 17 Q14 19 11 19 Q8 19 8 17 Q8 16 9 15 Q10 14 11 11 Z"
                fill="#F5C842" />
            </svg>
            {streak > 0 && <span className="bh-notif">{streak}</span>}
          </button>
          <Link href="/settings" className="bh-rail-btn" aria-label="Instellingen" onClick={() => vibrate(10)}>
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
              <circle cx="13" cy="13" r="4" fill="#F5C842" stroke="#1A0A02" strokeWidth="1.5" />
              <path d="M13 1 L13 5 M13 21 L13 25 M1 13 L5 13 M21 13 L25 13 M4.5 4.5 L7.3 7.3 M18.7 18.7 L21.5 21.5 M4.5 21.5 L7.3 18.7 M18.7 7.3 L21.5 4.5"
                stroke="#E8D5A3" strokeWidth="2" strokeLinecap="round" />
              <circle cx="13" cy="13" r="2" fill="#1A0A02" />
            </svg>
          </Link>
          <Link href="/meer" className="bh-rail-btn" aria-label="Inbox" onClick={() => vibrate(10)}>
            <svg width="24" height="20" viewBox="0 0 24 20" fill="none" aria-hidden>
              <path d="M3 4 L21 4 L21 17 L3 17 Z" fill="#E8D5A3" stroke="#1A0A02" strokeWidth="1.3" />
              <path d="M3 4 L12 12 L21 4" fill="none" stroke="#1A0A02" strokeWidth="1.3" />
              <path d="M3 17 L9 11 M21 17 L15 11" stroke="#1A0A02" strokeWidth="1" />
            </svg>
          </Link>
        </div>

        {/* BASE — dark stone panel: opdracht hero + chests + tabs */}
        <div className="bh-base">
          <span className="bh-rivet" style={{ top: 8, left: 10 }} />
          <span className="bh-rivet" style={{ top: 8, right: 10 }} />

          {/* Opdracht hero */}
          <div className="bh-opdracht-wrap">
            <motion.button
              type="button"
              className="bh-opdracht"
              disabled={opdrachtDisabled}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 520, damping: 22 }}
              onClick={() => {
                if (opdrachtDisabled) return;
                vibrate(25);
                setShowTimerModal(true);
              }}
              aria-label="Opdracht starten"
            >
              <div className="bh-chain bh-chain-l" />
              <div className="bh-chain bh-chain-r" />
              <div className="bh-opdracht-inner">
                <div className="bh-rays" />
                <div className="bh-seal" aria-hidden>
                  <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                    <path d="M6 5 L17 5 Q20 5 20 8 L20 20 Q20 23 17 23 L6 23 Q3 23 3 20 L3 8 Q3 5 6 5 Z"
                      fill="#E8D5A3" stroke="#1A0A02" strokeWidth="1.3" />
                    <path d="M20 5 Q22 5 22 8 Q22 10 20 10" fill="none" stroke="#1A0A02" strokeWidth="1.2" />
                    <path d="M7 10 L16 10 M7 13 L16 13 M7 16 L14 16" stroke="#8a6a3b" strokeWidth="1" strokeLinecap="round" />
                    <path d="M18 3 L24 8 L21 11 L15 6 Z" fill="#d43b2a" stroke="#1A0A02" strokeWidth="1.1" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="bh-opdracht-text">
                  <span className="bh-opdracht-title">
                    {pick.completed ? 'Klaar' : 'Opdracht'}
                  </span>
                  <span className="bh-opdracht-sub">
                    {pick.completed
                      ? (pick.outcome === 'won' ? 'De dag is gewonnen 🏆'
                          : pick.outcome === 'gave-up' ? 'Dag is voorbij 💤'
                          : 'Dag is voorbij ⚔️')
                      : (chosenTask ? `${chosenTask.durationMin} min · ${chosenTask.coins} 🪙` : 'Kies je opdracht')}
                  </span>
                </div>
                <div className="bh-opdracht-chevron">▶</div>
                <div className="bh-shine" />
              </div>
            </motion.button>
          </div>

          {/* Schatkamer strip */}
          <div className="bh-chests-wrap">
            <div className="bh-chests-header">
              <span className="bh-chests-title">SCHATKAMER</span>
              <span className="bh-chests-subtitle">4 / 4 slots</span>
            </div>
            <div className="bh-chests">
              {/* READY (placeholder — wire to free chest state later) */}
              <button className="bh-chest-slot bh-chest-active" aria-label="Houten kist gereed">
                <div className="bh-chest-icon">
                  <svg width="42" height="38" viewBox="0 0 42 38" fill="none" aria-hidden>
                    <path d="M3 14 L39 14 L39 34 L3 34 Z" fill="#7a4320" stroke="#1A0A02" strokeWidth="1.5" />
                    <path d="M3 14 Q3 6 11 6 L31 6 Q39 6 39 14" fill="#c98c1a" stroke="#1A0A02" strokeWidth="1.5" />
                    <rect x="3" y="18" width="36" height="3" fill="#F5C842" stroke="#1A0A02" strokeWidth=".8" />
                    <rect x="17" y="14" width="8" height="12" fill="#F5C842" stroke="#1A0A02" strokeWidth=".8" />
                    <circle cx="21" cy="21" r="1.4" fill="#1A0A02" />
                    <path d="M21 2 L22 4 L24 5 L22 6 L21 8 L20 6 L18 5 L20 4 Z" fill="#F5C842" stroke="#1A0A02" strokeWidth=".6" />
                  </svg>
                </div>
                <span className="bh-chest-status bh-chest-ready">OPEN</span>
              </button>
              <button className="bh-chest-slot bh-chest-active" aria-label="Zilveren kist">
                <div className="bh-chest-icon">
                  <svg width="42" height="38" viewBox="0 0 42 38" fill="none" aria-hidden>
                    <path d="M3 14 L39 14 L39 34 L3 34 Z" fill="#4a5a6a" stroke="#1A0A02" strokeWidth="1.5" />
                    <path d="M3 14 Q3 6 11 6 L31 6 Q39 6 39 14" fill="#9aaab8" stroke="#1A0A02" strokeWidth="1.5" />
                    <rect x="3" y="18" width="36" height="3" fill="#d0dae4" stroke="#1A0A02" strokeWidth=".8" />
                    <rect x="17" y="14" width="8" height="12" fill="#d0dae4" stroke="#1A0A02" strokeWidth=".8" />
                    <circle cx="21" cy="21" r="1.4" fill="#1A0A02" />
                  </svg>
                </div>
                <span className="bh-chest-status bh-chest-timer">2:14:38</span>
                <span className="bh-chest-count">2</span>
              </button>
              <button className="bh-chest-slot bh-chest-active" aria-label="Gouden kist">
                <div className="bh-chest-icon">
                  <svg width="42" height="38" viewBox="0 0 42 38" fill="none" aria-hidden>
                    <path d="M3 14 L39 14 L39 34 L3 34 Z" fill="#C8882A" stroke="#1A0A02" strokeWidth="1.5" />
                    <path d="M3 14 Q3 6 11 6 L31 6 Q39 6 39 14" fill="#F5C842" stroke="#1A0A02" strokeWidth="1.5" />
                    <rect x="3" y="18" width="36" height="3" fill="#ffe07a" stroke="#1A0A02" strokeWidth=".8" />
                    <rect x="17" y="14" width="8" height="12" fill="#ffe07a" stroke="#1A0A02" strokeWidth=".8" />
                    <circle cx="21" cy="21" r="1.4" fill="#1A0A02" />
                    <circle cx="21" cy="10" r="1.8" fill="#d43b2a" stroke="#1A0A02" strokeWidth=".6" />
                  </svg>
                </div>
                <span className="bh-chest-status bh-chest-timer">8:00:00</span>
              </button>
              <button className="bh-chest-slot bh-chest-empty" aria-label="Leeg slot">
                <div className="bh-chest-icon">
                  <svg width="42" height="38" viewBox="0 0 42 38" fill="none" aria-hidden>
                    <path d="M3 14 L39 14 L39 34 L3 34 Z" fill="none" stroke="#5a3a22" strokeWidth="1.3" strokeDasharray="3 3" />
                    <path d="M3 14 Q3 6 11 6 L31 6 Q39 6 39 14" fill="none" stroke="#5a3a22" strokeWidth="1.3" strokeDasharray="3 3" />
                    <path d="M18 18 L24 24 M24 18 L18 24" stroke="#5a3a22" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <span className="bh-chest-status">LEEG</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="bh-tabs">
            <button className="bh-tab bh-tab-active" aria-label="Home">
              <svg viewBox="0 0 26 26" fill="none" aria-hidden>
                <path d="M4 13 L13 4 L22 13 L22 22 L16 22 L16 16 L10 16 L10 22 L4 22 Z"
                  fill="#F5C842" stroke="#1A0A02" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M11 4 L13 2 L15 4" fill="#F5C842" stroke="#1A0A02" strokeWidth="1.3" strokeLinejoin="round" />
              </svg>
              <span>HOME</span>
            </button>
            <Link href="/stad" className="bh-tab" aria-label="Stad" onClick={() => vibrate(10)}>
              <svg viewBox="0 0 26 26" fill="none" aria-hidden>
                <path d="M6 4 L20 4 Q22 4 22 6 L22 22 Q22 24 20 24 L6 24 Q4 24 4 22 L4 6 Q4 4 6 4 Z"
                  fill="#8a6a3b" stroke="#1A0A02" strokeWidth="1.5" />
                <path d="M8 12 L18 12 M8 15 L18 15 M8 18 L14 18" stroke="#1A0A02" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <span>STAD</span>
            </Link>
            <Link href="/aanvallen" className="bh-tab" aria-label="Battle" onClick={() => vibrate(10)}>
              <svg viewBox="0 0 26 26" fill="none" aria-hidden>
                <path d="M5 12 Q3 10 4 7 Q6 5 9 6 L13 9 L18 7 Q22 7 22 12 L22 17 Q22 20 19 21 L16 22 L11 22 L7 20 Q4 18 5 15 Z"
                  fill="#8a6a3b" stroke="#1A0A02" strokeWidth="1.5" strokeLinejoin="round" />
                <circle cx="10" cy="12" r="1.3" fill="#1A0A02" />
              </svg>
              <span>BATTLE</span>
            </Link>
            <Link href="/league" className="bh-tab" aria-label="League" onClick={() => vibrate(10)}>
              <svg viewBox="0 0 26 26" fill="none" aria-hidden>
                <path d="M13 3 L22 5 L22 13 Q22 20 13 23 Q4 20 4 13 L4 5 Z"
                  fill="#8a6a3b" stroke="#1A0A02" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M8 13 L13 18 L18 13" fill="none" stroke="#1A0A02" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>LEAGUE</span>
            </Link>
          </div>
        </div>
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

      <style jsx global>{`
        /* ============ Bliep Home (bh-*) ============ */
        .bh-home {
          position: fixed;
          inset: 0;
          overflow: hidden;
          font-family: 'Philosopher', serif;
          background: #0a1018;
        }

        /* STAGE — live city fills viewport; Pixi renders its own sky & clouds */
        .bh-stage {
          position: absolute;
          inset: 0;
          z-index: 1;
          display: block;
          overflow: hidden;
        }
        .bh-stage > div:first-child { width: 100%; height: 100%; }
        /* color-blend fades: top → dark under topbar, bottom → dark into base */
        .bh-stage-top-fade {
          position: absolute; left: 0; right: 0; top: 0; height: 140px;
          background: linear-gradient(180deg, rgba(10,16,24,.75) 0%, rgba(10,16,24,.25) 55%, transparent 100%);
          pointer-events: none;
          z-index: 2;
        }
        .bh-stage-bot-fade {
          position: absolute; left: 0; right: 0; bottom: 0; height: 160px;
          background: linear-gradient(180deg, transparent 0%, rgba(10,18,28,.75) 60%, rgba(10,18,28,.95) 100%);
          pointer-events: none;
          z-index: 2;
        }

        /* TOPBAR */
        .bh-topbar {
          position: absolute; top: max(12px, env(safe-area-inset-top, 12px));
          left: 10px; right: 10px; z-index: 20;
          display: flex; align-items: center; gap: 6px;
          padding: 6px;
          border-radius: 14px;
          background: linear-gradient(180deg, rgba(14,24,36,.6) 0%, rgba(14,24,36,.4) 100%);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          box-shadow:
            inset 0 0 0 1px rgba(245,200,66,.35),
            inset 0 0 0 2px rgba(10,18,24,.6),
            0 2px 8px rgba(0,0,0,.5);
        }
        .bh-player-chip {
          position: relative; flex: 1;
          display: flex; align-items: center; gap: 8px;
          padding: 4px 8px 4px 4px;
          border-radius: 10px;
          background: linear-gradient(180deg, rgba(106,58,28,.45) 0%, rgba(26,10,2,.45) 100%);
          box-shadow: inset 0 0 0 1px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,210,150,.12);
          min-width: 0;
        }
        .bh-avatar {
          position: relative; width: 40px; height: 40px; flex: none;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #6fa8d8, #2a5a8a 60%, #152a4a 100%);
          box-shadow:
            inset 0 0 0 2px #8e5a18,
            inset 0 0 0 3px #1a0a02,
            inset 0 0 0 4.5px #F5C842,
            inset 0 0 0 5.5px #4a2a08,
            0 2px 4px rgba(0,0,0,.6);
          display: grid; place-items: center; overflow: hidden;
        }
        .bh-lvl {
          position: absolute; bottom: -4px; right: -6px;
          width: 22px; height: 22px; border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, #ffe07a, #C8882A 55%, #6a3a0a 100%);
          box-shadow:
            inset 0 0 0 1.5px #2a1608,
            inset 0 1px 0 rgba(255,255,220,.6),
            inset 0 -1px 0 rgba(74,43,8,.6),
            0 2px 3px rgba(0,0,0,.6);
          display: grid; place-items: center;
          font-family: 'Cinzel', serif; font-weight: 900; font-size: 12px;
          color: #2a1608; z-index: 2;
        }
        .bh-name-xp { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .bh-pname {
          font-family: 'Cinzel', serif; font-weight: 800; font-size: 12px;
          color: #fff6d0; line-height: 1; letter-spacing: .1em;
          text-shadow: 0 1px 1px rgba(0,0,0,.9);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .bh-xp-track {
          position: relative; height: 10px; border-radius: 999px;
          background: linear-gradient(180deg, #0a0400 0%, #1a0a02 100%);
          box-shadow:
            inset 0 1px 2px rgba(0,0,0,.9),
            inset 0 0 0 1px rgba(0,0,0,.7),
            0 1px 0 rgba(255,220,170,.12);
          overflow: hidden;
        }
        .bh-xp-fill {
          position: absolute; inset: 1px 0 1px 1px; border-radius: 999px;
          background: linear-gradient(180deg, #8fd4ff 0%, #3a8fd4 45%, #1a5080 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.55), inset 0 -1px 0 rgba(0,0,0,.35);
          transition: width .4s ease;
        }
        .bh-xp-label {
          position: absolute; inset: 0; display: grid; place-items: center;
          font-family: 'Cinzel', serif; font-weight: 800; font-size: 9px;
          color: #fff; text-shadow: 0 1px 1px rgba(0,0,0,.9); letter-spacing: .05em;
        }

        .bh-stat {
          position: relative;
          display: flex; align-items: center; gap: 6px;
          padding: 5px 10px 5px 5px;
          border-radius: 999px;
          background: linear-gradient(180deg, #6a3a1c 0%, #3a1e0a 55%, #1a0a02 100%);
          box-shadow:
            inset 0 0 0 1px #0d0502,
            inset 0 1px 0 rgba(255,210,150,.2),
            inset 0 -1px 0 rgba(0,0,0,.5),
            0 2px 0 rgba(0,0,0,.5);
          font-family: 'Cinzel', serif; font-weight: 900;
          color: #fff6d0; font-size: 13px;
          text-shadow: 0 1px 1px rgba(0,0,0,.9);
          flex: none; text-decoration: none;
        }
        .bh-stat-link:active { transform: translateY(1px); }
        .bh-coin {
          width: 20px; height: 20px; border-radius: 50%;
          background: radial-gradient(circle at 30% 25%, #ffe07a, #C8882A 55%, #6a3a0a 100%);
          box-shadow:
            inset 0 0 0 1.5px #2a1608,
            inset 0 1px 0 rgba(255,255,220,.6),
            inset 0 -1.5px 0 rgba(74,43,8,.5);
          flex: none; position: relative;
        }
        .bh-coin::before {
          content: ""; position: absolute; inset: 4px; border-radius: 50%;
          box-shadow: inset 0 0 0 1px rgba(74,43,8,.65);
        }
        .bh-coin::after {
          content: "$"; position: absolute; inset: 0;
          display: grid; place-items: center;
          font-family: 'Cinzel', serif; font-weight: 900; font-size: 9px;
          color: #4a2a08; text-shadow: 0 1px 0 rgba(255,240,180,.6);
        }
        .bh-trophy { width: 20px; height: 20px; flex: none; }

        /* SIDE RAIL */
        .bh-rail {
          position: absolute; right: 10px; top: 130px; z-index: 15;
          display: flex; flex-direction: column; gap: 12px;
        }
        .bh-rail-btn {
          position: relative; width: 54px; height: 54px;
          border: none; cursor: pointer;
          border-radius: 12px;
          background: linear-gradient(180deg, #7a4320 0%, #3a1e0a 55%, #1a0a02 100%);
          box-shadow:
            inset 0 0 0 1.5px #0d0502,
            inset 0 0 0 3px rgba(245,200,66,.55),
            inset 0 0 0 4px #4a2a08,
            inset 0 2px 0 rgba(255,210,150,.25),
            0 3px 0 rgba(0,0,0,.5),
            0 6px 10px rgba(0,0,0,.5);
          display: grid; place-items: center;
          color: #E8D5A3;
          text-decoration: none;
        }
        .bh-rail-btn:active { transform: translateY(2px); box-shadow:
          inset 0 0 0 1.5px #0d0502,
          inset 0 0 0 3px rgba(245,200,66,.55),
          inset 0 0 0 4px #4a2a08,
          0 1px 0 rgba(0,0,0,.5); }
        .bh-rail-btn svg { display: block; filter: drop-shadow(0 1px 0 rgba(0,0,0,.5)); }
        .bh-notif {
          position: absolute; top: -6px; right: -6px;
          min-width: 20px; height: 20px; padding: 0 5px;
          border-radius: 999px;
          background: linear-gradient(180deg, #e05a3a, #8a2a1a);
          color: #fff; font-family: 'Cinzel', serif; font-weight: 900; font-size: 11px;
          display: grid; place-items: center;
          box-shadow:
            inset 0 1px 0 rgba(255,200,180,.5),
            inset 0 -1px 0 rgba(0,0,0,.4),
            0 2px 3px rgba(0,0,0,.7),
            0 0 0 2px #1A0A02;
          z-index: 4;
          text-shadow: 0 1px 1px rgba(0,0,0,.6);
        }

        /* BASE panel */
        .bh-base {
          position: absolute; left: 0; right: 0; bottom: 0; z-index: 30;
          padding: 14px 12px max(22px, env(safe-area-inset-bottom, 22px));
          background:
            url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='.9' numOctaves='2' seed='2'/><feColorMatrix values='0 0 0 0 .1  0 0 0 0 .14  0 0 0 0 .2  0 0 0 .14 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"),
            radial-gradient(120% 80% at 50% 0%, rgba(90,120,160,.28) 0%, transparent 60%),
            linear-gradient(180deg, #2a3a50 0%, #1a2838 45%, #0e1824 100%);
          box-shadow:
            inset 0 0 0 1.5px #050a12,
            inset 0 2px 0 rgba(140,170,210,.22),
            inset 0 -3px 0 rgba(0,0,0,.5),
            0 -8px 24px rgba(0,0,0,.55);
          border-top-left-radius: 18px;
          border-top-right-radius: 18px;
        }
        .bh-base > * { position: relative; z-index: 2; }
        .bh-base::before {
          content: ""; position: absolute; top: 4px; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent 0%, #8e5a18 4%, #F5C842 50%, #8e5a18 96%, transparent 100%);
          box-shadow: 0 1px 0 rgba(0,0,0,.6);
          z-index: 1;
        }
        .bh-base::after {
          content: ""; position: absolute; top: 9px; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent 0%, rgba(142,90,24,.55) 8%, rgba(245,200,66,.8) 50%, rgba(142,90,24,.55) 92%, transparent 100%);
          z-index: 1;
        }
        .bh-rivet {
          position: absolute;
          width: 8px; height: 8px; border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, #ffe07a, #C8882A 60%, #6a3a0a 100%);
          box-shadow:
            inset 0 0 0 1px #2a1608,
            inset 0 1px 0 rgba(255,255,220,.6),
            0 1px 1px rgba(0,0,0,.6);
          z-index: 1;
        }

        /* OPDRACHT hero */
        .bh-opdracht-wrap { position: relative; padding: 0 4px 8px; }
        .bh-opdracht {
          position: relative; display: block; width: 100%;
          border: none; cursor: pointer; padding: 0;
          background: transparent;
          animation: bhBob 2.6s ease-in-out infinite;
        }
        .bh-opdracht:disabled { cursor: default; animation: none; opacity: .78; }
        @keyframes bhBob { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-2px);} }
        .bh-opdracht-inner {
          position: relative;
          border-radius: 16px;
          height: 64px;
          overflow: hidden;
          background:
            url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence baseFrequency='.9' numOctaves='2' seed='4'/><feColorMatrix values='0 0 0 0 .3  0 0 0 0 .18  0 0 0 0 .08  0 0 0 .18 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"),
            linear-gradient(180deg, #fbecc4 0%, #E8D5A3 55%, #c9ac74 100%);
          box-shadow:
            inset 0 0 0 2px #4a2a08,
            inset 0 0 0 4px #F5C842,
            inset 0 0 0 5px #8e5a18,
            inset 0 0 0 7px #F5C842,
            inset 0 0 0 8px #4a2a08,
            inset 0 4px 0 rgba(255,255,220,.5),
            inset 0 -4px 0 rgba(138,106,59,.4),
            0 5px 0 #1A0A02,
            0 10px 18px rgba(0,0,0,.55);
          display: flex; align-items: center; gap: 14px;
          padding-left: 14px;
        }
        .bh-rays {
          position: absolute; inset: 0;
          background: conic-gradient(from 0deg at 50% 50%,
            rgba(255,255,220,0) 0deg, rgba(255,255,220,.22) 15deg, rgba(255,255,220,0) 30deg,
            rgba(255,255,220,0) 60deg, rgba(255,255,220,.22) 75deg, rgba(255,255,220,0) 90deg,
            rgba(255,255,220,0) 120deg, rgba(255,255,220,.22) 135deg, rgba(255,255,220,0) 150deg,
            rgba(255,255,220,0) 180deg, rgba(255,255,220,.22) 195deg, rgba(255,255,220,0) 210deg,
            rgba(255,255,220,0) 240deg, rgba(255,255,220,.22) 255deg, rgba(255,255,220,0) 270deg,
            rgba(255,255,220,0) 300deg, rgba(255,255,220,.22) 315deg, rgba(255,255,220,0) 330deg);
          animation: bhSpin 16s linear infinite;
          opacity: .55;
          mix-blend-mode: overlay;
        }
        @keyframes bhSpin { to { transform: rotate(360deg); } }
        .bh-shine {
          position: absolute; top: 0; bottom: 0; width: 80px;
          background: linear-gradient(100deg,
            transparent 0%, rgba(255,255,220,0) 40%, rgba(255,255,220,.85) 50%, rgba(255,255,220,0) 60%, transparent 100%);
          transform: skewX(-18deg);
          animation: bhShine 3.2s ease-in-out infinite;
          pointer-events: none; z-index: 3;
        }
        @keyframes bhShine {
          0% { left: -100px; }
          60% { left: calc(100% + 60px); }
          100% { left: calc(100% + 60px); }
        }
        .bh-seal {
          width: 46px; height: 46px; flex: none;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #d84a2a, #8a1e0a 60%, #4a0a00 100%);
          box-shadow:
            inset 0 0 0 2px #F5C842,
            inset 0 0 0 3.5px #4a2a08,
            inset 0 2px 2px rgba(255,200,180,.5),
            0 2px 4px rgba(0,0,0,.5);
          display: grid; place-items: center;
          position: relative; z-index: 2;
        }
        .bh-opdracht-text {
          position: relative; z-index: 2;
          display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
          min-width: 0; flex: 1;
        }
        .bh-opdracht-title {
          font-family: 'Cinzel', serif; font-weight: 900;
          font-size: 22px; letter-spacing: .04em;
          color: #2a1608; line-height: 1;
          text-shadow: 0 1px 0 rgba(255,240,200,.7), 0 2px 0 rgba(255,240,200,.35);
        }
        .bh-opdracht-sub {
          font-family: 'Philosopher', serif; font-style: italic;
          font-size: 11.5px; color: #5a3a22; letter-spacing: .02em;
          text-shadow: 0 1px 0 rgba(255,240,200,.5);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
        }
        .bh-opdracht-chevron {
          padding-right: 18px;
          font-family: 'Cinzel', serif; font-weight: 900; font-size: 20px;
          color: #8e5a18;
          text-shadow: 0 1px 0 rgba(255,240,200,.5);
          z-index: 2;
        }
        .bh-chain {
          position: absolute; top: -12px; width: 10px; height: 16px;
          background: radial-gradient(circle at 30% 30%, #ffe07a, #C8882A 60%, #6a3a0a 100%);
          border-radius: 5px 5px 3px 3px;
          box-shadow: inset 0 0 0 1px #2a1608, inset 0 1px 0 rgba(255,255,220,.5), 0 1px 2px rgba(0,0,0,.6);
          z-index: 2;
        }
        .bh-chain-l { left: 18%; }
        .bh-chain-r { right: 18%; }
        .bh-chain::before {
          content: ""; position: absolute; top: -14px; left: 50%; transform: translateX(-50%);
          width: 2px; height: 14px;
          background: linear-gradient(180deg, #8e5a18, #C8882A);
        }

        /* CHESTS */
        .bh-chests-wrap { padding: 4px 4px 8px; }
        .bh-chests-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 4px 6px;
        }
        .bh-chests-title {
          font-family: 'Cinzel', serif; font-weight: 900;
          font-size: 10px; letter-spacing: .22em;
          color: #F5C842;
          text-shadow: 0 1px 1px rgba(0,0,0,.9), 0 0 6px rgba(245,200,66,.3);
        }
        .bh-chests-subtitle {
          font-family: 'Philosopher', serif; font-style: italic;
          font-size: 10px; color: #c9ac74;
          text-shadow: 0 1px 1px rgba(0,0,0,.9);
        }
        .bh-chests {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;
        }
        .bh-chest-slot {
          position: relative;
          border: none; cursor: pointer;
          padding: 6px 4px 16px;
          border-radius: 10px;
          background:
            radial-gradient(80% 60% at 50% 0%, rgba(140,170,210,.15) 0%, transparent 70%),
            linear-gradient(180deg, #15202e 0%, #08101a 100%);
          box-shadow:
            inset 0 0 0 1.5px #050a12,
            inset 0 0 0 2.5px rgba(245,200,66,.4),
            inset 0 0 0 3px rgba(10,20,30,.9),
            inset 0 1px 0 rgba(140,170,210,.18),
            0 2px 0 rgba(0,0,0,.55);
          display: flex; flex-direction: column; align-items: center; gap: 3px;
          min-height: 72px;
        }
        .bh-chest-icon {
          width: 40px; height: 36px; display: grid; place-items: center;
          filter: drop-shadow(0 2px 2px rgba(0,0,0,.5));
        }
        .bh-chest-status {
          position: absolute; bottom: 3px; left: 4px; right: 4px;
          padding: 3px 4px; border-radius: 4px;
          font-family: 'Cinzel', serif; font-weight: 900;
          font-size: 9px; letter-spacing: .08em; text-align: center;
          background: linear-gradient(180deg, #050a12, #020408);
          box-shadow: inset 0 0 0 1px rgba(245,200,66,.4);
          color: #F5C842;
          text-shadow: 0 1px 1px rgba(0,0,0,.9);
        }
        .bh-chest-timer { color: #fff6d0; }
        .bh-chest-ready {
          background: linear-gradient(180deg, #3da83e, #1a5a1a);
          box-shadow:
            inset 0 0 0 1px rgba(255,255,220,.5),
            inset 0 1px 0 rgba(255,255,220,.6),
            inset 0 -1px 0 rgba(0,0,0,.4);
          color: #fff;
          animation: bhReady 1.6s ease-in-out infinite;
        }
        @keyframes bhReady {
          0%,100% { box-shadow: inset 0 0 0 1px rgba(255,255,220,.5), inset 0 1px 0 rgba(255,255,220,.6), inset 0 -1px 0 rgba(0,0,0,.4), 0 0 0 rgba(61,168,62,0); }
          50% { box-shadow: inset 0 0 0 1px rgba(255,255,220,.5), inset 0 1px 0 rgba(255,255,220,.6), inset 0 -1px 0 rgba(0,0,0,.4), 0 0 12px rgba(61,168,62,.7); }
        }
        .bh-chest-empty .bh-chest-icon { opacity: .3; filter: grayscale(1); }
        .bh-chest-empty .bh-chest-status {
          color: #5a3a22; background: transparent;
          box-shadow: inset 0 0 0 1px rgba(90,58,34,.4);
        }
        .bh-chest-count {
          position: absolute; top: -6px; right: -6px;
          min-width: 20px; height: 20px; padding: 0 5px;
          border-radius: 999px;
          background: linear-gradient(180deg, #e05a3a, #8a1e0a);
          box-shadow:
            inset 0 1px 0 rgba(255,200,180,.5),
            inset 0 -1px 0 rgba(0,0,0,.4),
            0 2px 3px rgba(0,0,0,.7),
            0 0 0 2px #1A0A02;
          color: #fff; font-family: 'Cinzel', serif; font-weight: 900;
          font-size: 11px; display: grid; place-items: center;
          text-shadow: 0 1px 1px rgba(0,0,0,.6);
          z-index: 3;
        }
        .bh-chest-active {
          background:
            radial-gradient(80% 60% at 50% 30%, rgba(245,200,66,.22) 0%, rgba(245,200,66,0) 70%),
            linear-gradient(180deg, #1e2c3e 0%, #0a1420 100%);
          box-shadow:
            inset 0 0 0 1.5px #050a12,
            inset 0 0 0 2.5px rgba(245,200,66,.7),
            inset 0 0 0 3px rgba(10,20,30,.9),
            inset 0 1px 0 rgba(255,220,160,.3),
            0 2px 0 rgba(0,0,0,.55),
            0 0 18px rgba(245,200,66,.28);
        }

        /* TABS */
        .bh-tabs {
          position: relative;
          padding: 10px 4px 2px;
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 4px;
          margin-top: 6px;
          border-top: 1px solid rgba(140,170,210,.15);
          box-shadow: 0 -1px 0 rgba(0,0,0,.5);
        }
        .bh-tab {
          position: relative;
          border: none; cursor: pointer;
          padding: 4px 2px 2px;
          display: flex; flex-direction: column; align-items: center; gap: 3px;
          background: transparent;
          font-family: 'Cinzel', serif; font-weight: 800;
          font-size: 9px; letter-spacing: .14em;
          color: #6a8aa8;
          text-shadow: 0 1px 1px rgba(0,0,0,.8);
          text-decoration: none;
        }
        .bh-tab svg { display: block; width: 26px; height: 26px; }
        .bh-tab-active { color: #F5C842; text-shadow: 0 1px 1px rgba(0,0,0,.8), 0 0 8px rgba(245,200,66,.5); }
        .bh-tab-active::before {
          content: ""; position: absolute;
          top: -12px; left: 14%; right: 14%; height: 3px;
          background: linear-gradient(90deg, transparent, #F5C842, transparent);
          box-shadow: 0 0 8px #F5C842;
          border-radius: 2px;
        }
      `}</style>
    </GameShell>
  );
}
