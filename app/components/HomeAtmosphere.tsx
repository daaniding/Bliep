'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { loadFreeChest, msUntilReady, isReady } from '@/lib/freeChest';
import { useStreak } from '@/lib/useStreak';
import { loadMailbox, unreadCount, MAILBOX_CHANGED_EVENT } from '@/lib/mailbox';
import { loadCity } from '@/lib/cityStore';
import { getDailyQuests, type DailyQuest } from '@/lib/dailyQuests';
import { loadDailyPick } from '@/lib/dailyTasks';
import { CAMPS, loadPveState, cooldownRemainingMs } from '@/lib/pveCamps';
import { sfxTap } from '@/lib/sound';

function msUntilMidnight(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}

const FreeChestModal = dynamic(() => import('./FreeChestModal'), { ssr: false });
const MailModal = dynamic(() => import('./MailModal'), { ssr: false });

/**
 * HomeAtmosphere — ambient + interactive overlay on top of the video
 * hero. Turns the home from "wallpaper + button" into a living game
 * dashboard: live counters, progression bar, daily quests, mailbox,
 * PvE status, herald messages, drifting embers.
 *
 * Everything here reads from existing lib state — no new data layer.
 */

const EMBERS = Array.from({ length: 22 }, (_, i) => ({
  left: `${(i * 83 + 7) % 100}%`,
  size: 2 + ((i * 3) % 4),
  duration: 7 + ((i * 1.7) % 5),
  delay: -((i * 0.6) % 7),
  hue: i % 3 === 0 ? 'warm' : 'pale',
}));

const IDLE_LINES = [
  'Sire, uw rijk gedijt.',
  'De wacht houdt stand.',
  'Het volk wacht op uw bevel.',
  'De torens zijn stevig.',
  'De schatkist glinstert zacht.',
];

function formatMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}u ${m.toString().padStart(2, '0')}m`;
  const sec = s % 60;
  return `${m}m ${sec.toString().padStart(2, '0')}s`;
}

// Power → kingdom level: every 6 total building-levels is 1 kingdom
// level. 0 buildings = level 1 at 0% progress.
function deriveKingdom(totalLevels: number) {
  const STEP = 6;
  const level = 1 + Math.floor(totalLevels / STEP);
  const into = totalLevels % STEP;
  const pct = (into / STEP) * 100;
  return { level, pct, totalLevels };
}

export default function HomeAtmosphere() {
  const streak = useStreak();

  const [chestMs, setChestMs] = useState(0);
  const [chestReady, setChestReady] = useState(false);
  const [chestOpen, setChestOpen] = useState(false);

  const [unread, setUnread] = useState(0);
  const [mailOpen, setMailOpen] = useState(false);

  const [kingdom, setKingdom] = useState(() => deriveKingdom(0));
  const [quests, setQuests] = useState<DailyQuest[]>([]);
  const [pveReadyCount, setPveReadyCount] = useState(0);

  const [taskMs, setTaskMs] = useState(0);
  const [taskOpen, setTaskOpen] = useState(false); // has an unfinished task today

  const [lineIdx, setLineIdx] = useState(0);

  // Live tick: chest, mailbox, kingdom, quests, PvE. Everything
  // refreshes once a second — cheap because localStorage reads are
  // tiny and the values are memoised into state.
  useEffect(() => {
    const tick = () => {
      const chestState = loadFreeChest();
      setChestReady(isReady(chestState));
      setChestMs(msUntilReady(chestState));

      setUnread(unreadCount());

      const city = loadCity();
      const totalLevels = city.buildings.reduce((s, b) => s + b.level, 0);
      setKingdom(deriveKingdom(totalLevels));

      setQuests(getDailyQuests());

      const pve = loadPveState();
      const ready = CAMPS.filter((c) => cooldownRemainingMs(c, pve) === 0).length;
      setPveReadyCount(ready);

      const pick = loadDailyPick();
      setTaskOpen(!pick.completed);
      setTaskMs(msUntilMidnight());
    };
    tick();
    const id = window.setInterval(tick, 1000);

    // Instantly refresh when mailbox changes (e.g. after claiming chest)
    const onMail = () => setUnread(unreadCount());
    window.addEventListener(MAILBOX_CHANGED_EVENT, onMail);

    return () => {
      clearInterval(id);
      window.removeEventListener(MAILBOX_CHANGED_EVENT, onMail);
    };
  }, []);

  // Cycle idle herald lines every 7 seconds.
  useEffect(() => {
    const id = window.setInterval(() => {
      setLineIdx((i) => (i + 1) % IDLE_LINES.length);
    }, 7000);
    return () => clearInterval(id);
  }, []);

  // Priority order for the herald bubble.
  const taskUrgent = taskOpen && taskMs > 0 && taskMs < 3 * 3600_000;
  const heraldLine = chestReady
    ? '🎁 Een kist wacht op u, sire!'
    : taskUrgent
      ? `⏳ Uw opdracht vervalt in ${formatMs(taskMs)}!`
      : unread > 0
        ? `📜 ${unread} nieuw${unread === 1 ? '' : 'e'} bericht${unread === 1 ? '' : 'en'} voor u.`
        : pveReadyCount > 0
          ? '⚔️ Kampen zijn klaar voor aanval.'
          : streak.current >= 3
            ? `🔥 ${streak.current} dagen op rij — houd vol!`
            : IDLE_LINES[lineIdx];

  const questsDone = quests.filter((q) => q.done).length;
  const questsTotal = quests.length || 3;

  return (
    <div className="atmos">
      {/* ---- Embers ---- */}
      <div className="embers">
        {EMBERS.map((e, i) => (
          <span
            key={i}
            className={`ember ember-${e.hue}`}
            style={{
              left: e.left,
              width: e.size,
              height: e.size,
              animationDuration: `${e.duration}s`,
              animationDelay: `${e.delay}s`,
            }}
          />
        ))}
      </div>

      {/* ---- Kingdom power bar (under HUD) ---- */}
      <div className="power-wrap">
        <div className="power-label font-display">
          <span className="power-level">Lv {kingdom.level}</span>
          <span className="power-name">RIJK</span>
        </div>
        <div className="power-track">
          <div className="power-fill" style={{ width: `${kingdom.pct}%` }} />
          <div className="power-shine" />
        </div>
      </div>

      {/* ---- Right column: chest + mail stack ---- */}
      <div className="right-stack">
        <button
          type="button"
          className={`chest-chip ${chestReady ? 'ready' : 'waiting'}`}
          onClick={() => {
            if (chestReady) {
              sfxTap();
              setChestOpen(true);
            }
          }}
          disabled={!chestReady}
        >
          <span className="chest-icon">🎁</span>
          <span className="chest-label font-display">
            {chestReady ? 'KLAAR' : formatMs(chestMs)}
          </span>
        </button>

        <button
          type="button"
          className="mail-chip"
          onClick={() => {
            sfxTap();
            setMailOpen(true);
          }}
          aria-label="Open berichten"
        >
          <span className="mail-icon">📜</span>
          {unread > 0 && <span className="mail-badge">{unread > 9 ? '9+' : unread}</span>}
        </button>

        {pveReadyCount > 0 && (
          <div className="pve-chip">
            <span className="pve-icon">⚔️</span>
            <span className="pve-label font-display">
              {pveReadyCount} KAMP{pveReadyCount === 1 ? '' : 'EN'}
            </span>
          </div>
        )}
      </div>

      {/* ---- Herald bubble (bottom-left) ---- */}
      <div className="herald">
        <div className="herald-avatar" aria-hidden>
          🛡️
        </div>
        <div className="herald-bubble font-body">{heraldLine}</div>
      </div>

      {/* ---- Daily quest dots (just above CTA) ---- */}
      <div className="quest-dots">
        <span className="quest-label font-display">
          DAGQUESTS · {questsDone}/{questsTotal}
        </span>
        <div className="dot-row">
          {quests.map((q) => (
            <div
              key={q.id}
              className={`quest-dot ${q.done ? 'done' : ''}`}
              title={q.title}
            >
              <span className="quest-emoji">{q.icon}</span>
            </div>
          ))}
        </div>
        {taskOpen && (
          <div className={`task-expires ${taskUrgent ? 'urgent' : ''}`}>
            <span className="task-expires-icon">⏳</span>
            <span className="task-expires-label font-display">
              VERVALT IN {formatMs(taskMs)}
            </span>
          </div>
        )}
      </div>

      {/* ---- Modals ---- */}
      {chestOpen && (
        <FreeChestModal
          onClose={() => setChestOpen(false)}
          onOpenMail={() => {
            setChestOpen(false);
            setMailOpen(true);
          }}
        />
      )}
      {mailOpen && <MailModal onClose={() => setMailOpen(false)} />}

      <style jsx>{`
        .atmos {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 5;
        }

        /* ---- Embers ---- */
        .embers {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }
        .ember {
          position: absolute;
          bottom: -10px;
          border-radius: 50%;
          filter: blur(0.5px);
          animation-name: emberRise;
          animation-iteration-count: infinite;
          animation-timing-function: ease-out;
          will-change: transform, opacity;
        }
        .ember-warm {
          background: radial-gradient(circle, #ffd27a 0%, rgba(255, 120, 40, 0.7) 50%, rgba(255, 80, 20, 0) 100%);
          box-shadow: 0 0 6px rgba(255, 160, 60, 0.8);
        }
        .ember-pale {
          background: radial-gradient(circle, #fff6dc 0%, rgba(255, 220, 140, 0.6) 50%, rgba(255, 200, 100, 0) 100%);
          box-shadow: 0 0 5px rgba(255, 220, 140, 0.6);
        }
        @keyframes emberRise {
          0%   { transform: translate(0, 0)      scale(0.6); opacity: 0; }
          15%  { opacity: 0.95; }
          60%  { opacity: 0.8; transform: translate(12px, -180px) scale(1); }
          100% { transform: translate(-8px, -360px) scale(0.4); opacity: 0; }
        }

        /* ---- Kingdom power bar ---- */
        .power-wrap {
          position: absolute;
          top: calc(env(safe-area-inset-top, 0px) + 84px);
          left: 12px;
          right: 96px; /* leave room for the right chip stack */
          display: flex;
          flex-direction: column;
          gap: 4px;
          animation: chipFadeIn 500ms ease-out both;
          pointer-events: none;
        }
        .power-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #fdd069;
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.7);
        }
        .power-level {
          padding: 2px 6px;
          border-radius: 4px;
          background: linear-gradient(180deg, #fdd069, #c8891e);
          color: #2a1505;
          text-shadow: none;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 1px 0 #6e4c10;
        }
        .power-name { opacity: 0.85; }
        .power-count {
          margin-left: auto;
          opacity: 0.7;
          font-size: 9px;
        }
        .power-track {
          position: relative;
          height: 7px;
          border-radius: 4px;
          background: rgba(10, 5, 0, 0.85);
          border: 1.5px solid #6e4c10;
          overflow: hidden;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
        }
        .power-fill {
          position: absolute;
          inset: 0 auto 0 0;
          background: linear-gradient(90deg, #7a1e0a 0%, #c0392b 30%, #f0b840 80%, #fff6dc 100%);
          border-right: 1px solid rgba(255, 246, 220, 0.5);
          transition: width 600ms ease-out;
        }
        .power-shine {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.25) 0%,
            rgba(255, 255, 255, 0) 50%
          );
          pointer-events: none;
        }

        /* ---- Right stack (chest / mail / pve) ---- */
        .right-stack {
          position: absolute;
          top: calc(env(safe-area-inset-top, 0px) + 116px);
          right: 10px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
          animation: chipFadeIn 600ms ease-out 150ms both;
        }

        .chest-chip {
          pointer-events: auto;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 6px 11px 6px 8px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(40, 20, 5, 0.92) 0%, rgba(22, 10, 2, 0.92) 100%);
          border: 2px solid #6e4c10;
          color: #fdd069;
          font: inherit;
          cursor: default;
          box-shadow:
            inset 0 1px 0 rgba(255, 220, 140, 0.25),
            0 3px 0 #2a1a0a,
            0 6px 14px rgba(0, 0, 0, 0.6);
        }
        .chest-chip.ready {
          cursor: pointer;
          background: linear-gradient(180deg, #fff6dc 0%, #fdd069 25%, #f0b840 60%, #c8891e 100%);
          color: #2a1505;
          border-color: #0d0a06;
          box-shadow:
            inset 0 1.5px 0 rgba(255, 255, 255, 0.85),
            inset 0 -2px 0 rgba(90, 45, 0, 0.55),
            0 3px 0 #6e4c10,
            0 8px 18px rgba(240, 184, 64, 0.55),
            0 0 24px rgba(240, 184, 64, 0.7);
          animation: chestReadyPulse 1.5s ease-in-out infinite;
        }
        .chest-chip.ready:active { transform: scale(0.96); }
        .chest-icon { font-size: 15px; line-height: 1; }
        .chest-label {
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.5);
        }
        .chest-chip.ready .chest-label { text-shadow: 0 1px 0 rgba(255, 255, 255, 0.6); }

        @keyframes chestReadyPulse {
          0%, 100% { transform: scale(1);    filter: drop-shadow(0 0 10px rgba(240,184,64,0.6)); }
          50%      { transform: scale(1.06); filter: drop-shadow(0 0 18px rgba(240,184,64,1)); }
        }

        .mail-chip {
          pointer-events: auto;
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(180deg, rgba(40, 20, 5, 0.92) 0%, rgba(22, 10, 2, 0.92) 100%);
          border: 2px solid #6e4c10;
          box-shadow:
            inset 0 1px 0 rgba(255, 220, 140, 0.25),
            0 3px 0 #2a1a0a,
            0 6px 12px rgba(0, 0, 0, 0.55);
          cursor: pointer;
        }
        .mail-chip:active { transform: scale(0.95); }
        .mail-icon { font-size: 16px; }
        .mail-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 999px;
          background: linear-gradient(180deg, #e67260, #7a1e0a);
          border: 2px solid #0d0a06;
          color: #fff6dc;
          font-size: 10px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 6px rgba(192, 57, 43, 0.7);
          animation: badgePulse 1.8s ease-in-out infinite;
        }
        @keyframes badgePulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.12); }
        }

        .pve-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px 5px 8px;
          border-radius: 999px;
          background: linear-gradient(180deg, #7a1e0a 0%, #3d0a00 100%);
          border: 2px solid #0d0a06;
          color: #fff6dc;
          box-shadow: inset 0 1px 0 rgba(255, 150, 120, 0.5), 0 3px 0 #1a0503, 0 6px 12px rgba(0, 0, 0, 0.6), 0 0 18px rgba(192, 57, 43, 0.55);
          animation: pveThrob 1.8s ease-in-out infinite;
        }
        .pve-icon { font-size: 14px; }
        .pve-label {
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.55);
        }
        @keyframes pveThrob {
          0%, 100% { box-shadow: inset 0 1px 0 rgba(255,150,120,0.5), 0 3px 0 #1a0503, 0 6px 12px rgba(0,0,0,0.6), 0 0 14px rgba(192,57,43,0.5); }
          50%      { box-shadow: inset 0 1px 0 rgba(255,150,120,0.5), 0 3px 0 #1a0503, 0 6px 12px rgba(0,0,0,0.6), 0 0 26px rgba(230,114,96,0.9); }
        }

        /* ---- Herald bubble ---- */
        .herald {
          position: absolute;
          left: 12px;
          bottom: calc(env(safe-area-inset-bottom, 0px) + 260px);
          display: flex;
          align-items: flex-end;
          gap: 8px;
          animation: heraldFloat 4.5s ease-in-out infinite, chipFadeIn 800ms ease-out 400ms both;
          pointer-events: none;
          max-width: 70%;
        }
        .herald-avatar {
          flex: 0 0 auto;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #5c3a1e, #1a0f05 80%);
          border: 2px solid #6e4c10;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.7);
        }
        .herald-bubble {
          position: relative;
          padding: 7px 11px;
          background: linear-gradient(180deg, rgba(40, 20, 5, 0.95) 0%, rgba(22, 10, 2, 0.95) 100%);
          border: 2px solid #6e4c10;
          border-radius: 10px;
          color: #fdd069;
          font-size: 11.5px;
          line-height: 1.25;
          max-width: 220px;
          box-shadow: inset 0 1px 0 rgba(255, 220, 140, 0.2), 0 4px 10px rgba(0, 0, 0, 0.6);
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6);
        }
        .herald-bubble::before {
          content: '';
          position: absolute;
          left: -8px;
          bottom: 11px;
          width: 0;
          height: 0;
          border-top: 6px solid transparent;
          border-bottom: 6px solid transparent;
          border-right: 8px solid #6e4c10;
        }
        .herald-bubble::after {
          content: '';
          position: absolute;
          left: -5px;
          bottom: 12px;
          width: 0;
          height: 0;
          border-top: 5px solid transparent;
          border-bottom: 5px solid transparent;
          border-right: 6px solid rgba(30, 14, 3, 0.95);
        }
        @keyframes heraldFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-3px); }
        }

        /* ---- Quest dots ---- */
        .quest-dots {
          position: absolute;
          left: 0;
          right: 0;
          bottom: calc(env(safe-area-inset-bottom, 0px) + 214px);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          animation: chipFadeIn 700ms ease-out 300ms both;
          pointer-events: none;
        }
        .quest-label {
          font-size: 9px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #fdd069;
          opacity: 0.85;
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.7);
        }
        .dot-row { display: flex; gap: 8px; }
        .quest-dot {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: linear-gradient(180deg, rgba(40, 20, 5, 0.92) 0%, rgba(22, 10, 2, 0.92) 100%);
          border: 2px solid #6e4c10;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          box-shadow: inset 0 1px 0 rgba(255, 220, 140, 0.2), 0 3px 0 #1a0f05, 0 4px 8px rgba(0, 0, 0, 0.55);
          filter: grayscale(1) brightness(0.7);
          transition: filter 400ms ease;
        }
        .quest-dot.done {
          background: linear-gradient(180deg, #fff6dc 0%, #fdd069 30%, #f0b840 70%, #c8891e 100%);
          border-color: #0d0a06;
          filter: none;
          box-shadow:
            inset 0 1.5px 0 rgba(255, 255, 255, 0.75),
            inset 0 -2px 0 rgba(90, 45, 0, 0.5),
            0 3px 0 #6e4c10,
            0 0 14px rgba(240, 184, 64, 0.6);
        }
        .quest-emoji { filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.5)); }

        /* ---- Task expires countdown ---- */
        .task-expires {
          margin-top: 4px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 11px 4px 8px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(40, 20, 5, 0.92) 0%, rgba(22, 10, 2, 0.92) 100%);
          border: 1.5px solid #6e4c10;
          box-shadow: inset 0 1px 0 rgba(255, 220, 140, 0.2), 0 3px 0 #1a0f05, 0 4px 10px rgba(0, 0, 0, 0.55);
          color: #fdd069;
        }
        .task-expires.urgent {
          background: linear-gradient(180deg, #c0392b 0%, #7a1e0a 100%);
          border-color: #3d0a00;
          color: #fff6dc;
          box-shadow: inset 0 1px 0 rgba(255, 150, 120, 0.6), 0 3px 0 #1a0503, 0 4px 12px rgba(192, 57, 43, 0.6), 0 0 20px rgba(230, 114, 96, 0.6);
          animation: urgentThrob 1.3s ease-in-out infinite;
        }
        .task-expires-icon { font-size: 12px; }
        .task-expires-label {
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.55);
        }
        @keyframes urgentThrob {
          0%, 100% { transform: scale(1);     filter: drop-shadow(0 0 8px rgba(230,114,96,0.4)); }
          50%      { transform: scale(1.035); filter: drop-shadow(0 0 14px rgba(230,114,96,0.9)); }
        }

        /* ---- Shared ---- */
        @keyframes chipFadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .ember, .herald, .chest-chip, .chest-chip.ready, .mail-badge, .pve-chip, .power-fill, .quest-dot {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
