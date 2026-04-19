'use client';

// Lightweight sound effects using the Web Audio API — no audio files,
// no third-party libraries. Each SFX is a short envelope-shaped tone.
// If the browser has no audio context or the user hasn't interacted
// yet, calls are silently ignored.

const SFX_KEY = 'bliep:sfx';

export function isSfxEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(SFX_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setSfxEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SFX_KEY, enabled ? '1' : '0');
  } catch { /* ignore */ }
}

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new C();
    } catch {
      return null;
    }
  }
  // Resume the context on first user gesture (browsers autoplay policy)
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

function playTone(
  frequency: number,
  durationMs: number,
  opts: { type?: OscillatorType; startGain?: number; endGain?: number; detune?: number } = {},
) {
  if (!isSfxEnabled()) return;
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = opts.type ?? 'triangle';
  osc.frequency.value = frequency;
  if (opts.detune) osc.detune.value = opts.detune;
  const startG = opts.startGain ?? 0.0001;
  const peakG = 0.15;
  const endG = opts.endGain ?? 0.0001;
  gain.gain.setValueAtTime(startG, now);
  gain.gain.exponentialRampToValueAtTime(peakG, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(endG, now + durationMs / 1000);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(now);
  osc.stop(now + durationMs / 1000 + 0.02);
}

/** Soft click / tap feedback — short high-mid triangle chirp. */
export function sfxTap() {
  playTone(900, 60, { type: 'triangle' });
  setTimeout(() => playTone(1200, 40, { type: 'triangle' }), 30);
}

/** Reward / claim chime — ascending three-note arpeggio. */
export function sfxClaim() {
  playTone(523, 160, { type: 'triangle' });                           // C5
  setTimeout(() => playTone(659, 160, { type: 'triangle' }), 100);    // E5
  setTimeout(() => playTone(784, 200, { type: 'triangle' }), 200);    // G5
  setTimeout(() => playTone(1047, 260, { type: 'triangle' }), 300);   // C6
}

/** Sword / battle start — deeper resonant hit. */
export function sfxBattleStart() {
  playTone(180, 220, { type: 'sawtooth', detune: -20 });
  setTimeout(() => playTone(260, 180, { type: 'triangle' }), 60);
}

/** Fail / abort — descending two-note minor. */
export function sfxFail() {
  playTone(440, 180, { type: 'triangle' });
  setTimeout(() => playTone(330, 260, { type: 'triangle' }), 140);
}
