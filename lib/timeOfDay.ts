// Compute time-of-day from real local clock (Europe/Amsterdam).
// Returns interpolated values for sky, darkness and whether torches
// should be visibly lit.

export interface TimeOfDay {
  phase: 'dawn' | 'day' | 'dusk' | 'night';
  /** 0 = midnight, 1 = noon. Used to tint skies and hide/show stars. */
  daylight: number;
  /** Amsterdam-local hour 0-23.999... */
  hour: number;
  /** Sky gradient stops */
  skyTop: string;
  skyMid: string;
  skyLow: string;
  skyBottom: string;
  /** Overall darkness multiplier for stars/fireflies */
  darkness: number;
  /** Torches visibly lit (dusk/night/dawn) */
  torchesLit: boolean;
  /** Sun visible */
  sunVisible: boolean;
  /** Moon visible */
  moonVisible: boolean;
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(a: string, b: string, t: number): string {
  const ah = parseInt(a.slice(1), 16);
  const bh = parseInt(b.slice(1), 16);
  const ar = (ah >> 16) & 0xff;
  const ag = (ah >> 8) & 0xff;
  const ab = ah & 0xff;
  const br = (bh >> 16) & 0xff;
  const bg = (bh >> 8) & 0xff;
  const bb = bh & 0xff;
  const r = Math.round(lerp(ar, br, t));
  const g = Math.round(lerp(ag, bg, t));
  const bl = Math.round(lerp(ab, bb, t));
  return '#' + [r, g, bl].map(v => v.toString(16).padStart(2, '0')).join('');
}

export function getTimeOfDay(date = new Date()): TimeOfDay {
  // Amsterdam-local hour
  const ams = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
  const hour = ams.getHours() + ams.getMinutes() / 60;

  // Daylight curve: 0 at midnight, ramps to 1 around noon, back to 0
  // after sunset. Use a cosine for smoothness.
  // Sunrise ~6, solar noon 12, sunset ~20 (generous to keep the app warm).
  let daylight: number;
  if (hour < 6) {
    daylight = 0;
  } else if (hour < 9) {
    daylight = (hour - 6) / 3; // sunrise 6→9
  } else if (hour < 17) {
    daylight = 1; // full day
  } else if (hour < 20) {
    daylight = 1 - (hour - 17) / 3; // sunset 17→20
  } else {
    daylight = 0; // night
  }
  daylight = clamp(daylight);

  // Phase label
  let phase: TimeOfDay['phase'];
  if (hour < 6 || hour >= 20) phase = 'night';
  else if (hour < 9) phase = 'dawn';
  else if (hour < 17) phase = 'day';
  else phase = 'dusk';

  // Sky palette — warm medieval throughout, just darker at night.
  // Day:   deep gold at top, warm orange mid, dark warm at bottom
  // Dusk:  same style but more red
  // Night: deep navy top, warm red-brown glow at horizon, black bottom
  // Dawn:  purple→orange transition
  let skyTop: string, skyMid: string, skyLow: string, skyBottom: string;

  if (phase === 'day') {
    skyTop = '#ffd97a';
    skyMid = '#ff9a3a';
    skyLow = '#c0431c';
    skyBottom = '#2a0f04';
  } else if (phase === 'dusk') {
    const t = (hour - 17) / 3; // 0 at 17, 1 at 20
    skyTop = lerpColor('#ffd97a', '#3a1650', t);
    skyMid = lerpColor('#ff9a3a', '#c03020', t);
    skyLow = lerpColor('#c0431c', '#5a100a', t);
    skyBottom = lerpColor('#2a0f04', '#0a0206', t);
  } else if (phase === 'dawn') {
    const t = (hour - 6) / 3; // 0 at 6, 1 at 9
    skyTop = lerpColor('#3a1650', '#ffd97a', t);
    skyMid = lerpColor('#7a2040', '#ff9a3a', t);
    skyLow = lerpColor('#3a1410', '#c0431c', t);
    skyBottom = lerpColor('#0a0206', '#2a0f04', t);
  } else {
    // night
    skyTop = '#0d0a2e';
    skyMid = '#1a0f3a';
    skyLow = '#1a0608';
    skyBottom = '#030204';
  }

  const darkness = 1 - daylight;
  const torchesLit = phase !== 'day';
  const sunVisible = phase === 'day' || phase === 'dusk' || phase === 'dawn';
  const moonVisible = phase === 'night' || phase === 'dawn' || phase === 'dusk';

  return {
    phase,
    daylight,
    hour,
    skyTop,
    skyMid,
    skyLow,
    skyBottom,
    darkness,
    torchesLit,
    sunVisible,
    moonVisible,
  };
}

export function useTimeOfDay(): TimeOfDay {
  // Recompute at module load — for real-time updates we'd need a
  // useEffect + interval, but the sky only changes over hours so a
  // simple sync call suffices per render.
  return getTimeOfDay();
}
