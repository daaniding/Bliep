'use client';

import { sfxTap, sfxClaim, sfxFail, sfxBattleStart } from './sound';

const SETTINGS_KEY = 'bliep:juice:v1';

export interface JuiceSettings {
  audio: boolean;
  haptics: boolean;
  particles: boolean;
}

const DEFAULTS: JuiceSettings = { audio: true, haptics: true, particles: true };

export function getJuiceSettings(): JuiceSettings {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULTS;
}

export function setJuiceSettings(next: Partial<JuiceSettings>) {
  if (typeof window === 'undefined') return;
  const merged = { ...getJuiceSettings(), ...next };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent('bliep:juice-settings', { detail: merged }));
}

// ---- Sound wrappers ----

export type SfxName = 'tap' | 'claim' | 'fail' | 'battle' | 'build' | 'collect' | 'chest';

export function playSfx(name: SfxName) {
  if (!getJuiceSettings().audio) return;
  switch (name) {
    case 'tap': return sfxTap();
    case 'claim': return sfxClaim();
    case 'fail': return sfxFail();
    case 'battle': return sfxBattleStart();
    case 'build': return sfxClaim();
    case 'collect': return sfxTap();
    case 'chest': return sfxClaim();
  }
}

// ---- Haptics ----

export function vibrate(pattern: number | number[]) {
  if (!getJuiceSettings().haptics) return;
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch { /* ignore */ }
}

// ---- DOM coin floater (for use outside Pixi) ----

export function spawnCoinFloater(host: HTMLElement, text: string, color = '#fdd069') {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `
    position: fixed; left: 50%; top: 45%;
    transform: translate(-50%, -50%);
    font-family: var(--font-lilita), 'Lilita One', sans-serif;
    font-size: 40px; color: ${color};
    -webkit-text-stroke: 2px #0d0a06;
    paint-order: stroke fill;
    text-shadow: 0 3px 0 #0d0a06, 0 0 24px ${color};
    pointer-events: none; z-index: 9999;
    will-change: transform, opacity;
  `;
  host.appendChild(el);
  el.animate([
    { transform: 'translate(-50%, -50%) scale(0.5)', opacity: 0 },
    { transform: 'translate(-50%, -120%) scale(1.1)', opacity: 1, offset: 0.3 },
    { transform: 'translate(-50%, -180%) scale(1)', opacity: 0 },
  ], { duration: 1500, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }).onfinish = () => el.remove();
}
