import * as THREE from 'three';
import type { LightingMode } from './types';

export interface LightingModeOption {
  id: LightingMode;
  label: string;
  shortLabel: string;
  accentHex: string;
  presetHour: number | null;
}

export const LIGHTING_MODES: LightingModeOption[] = [
  {
    id: 'auto',
    label: 'Real-Time Lahore',
    shortLabel: 'Live PKT',
    accentHex: '#38bdf8',
    presetHour: null,
  },
  {
    id: 'dawn',
    label: 'Dawn',
    shortLabel: 'Dawn',
    accentHex: '#fb923c',
    presetHour: 6.25,
  },
  {
    id: 'day',
    label: 'Daylight',
    shortLabel: 'Day',
    accentHex: '#fbbf24',
    presetHour: 12.5,
  },
  {
    id: 'sunset',
    label: 'Golden Sunset',
    shortLabel: 'Sunset',
    accentHex: '#f97316',
    presetHour: 17.75,
  },
  {
    id: 'night',
    label: 'Lahore Night',
    shortLabel: 'Night',
    accentHex: '#818cf8',
    presetHour: 22.0,
  },
];

export interface DayNightState {
  hourDecimal: number;
  sky: THREE.Color;
  fog: THREE.Color;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  sunColor: THREE.Color;
  rimColor: THREE.Color;
  sunIntensity: number;
  hemiIntensity: number;
  rimIntensity: number;
  envIntensity: number;
  exposure: number;
  nightFactor: number;
  twilightBlend: number;
  goldenHourFactor: number;
  sunX: number;
  sunY: number;
  sunVisible: boolean;
  moonX: number;
  moonY: number;
  moonVisible: boolean;
  keyOffsetX: number;
  keyOffsetY: number;
  keyOffsetZ: number;
}

interface TimeKeyframe {
  hour: number;
  sky: number;
  fog: number;
  hemiSky: number;
  hemiGround: number;
  sunColor: number;
  rimColor: number;
  sunIntensity: number;
  hemiIntensity: number;
  rimIntensity: number;
  envIntensity: number;
  exposure: number;
  nightFactor: number;
  twilightBlend: number;
  goldenHourFactor: number;
}

const KEYFRAMES: TimeKeyframe[] = [
  {
    hour: 0.0,
    sky: 0x070c1a,
    fog: 0x111a33,
    hemiSky: 0x3b4d82,
    hemiGround: 0x0b1020,
    sunColor: 0x93c5fd,
    rimColor: 0x60a5fa,
    sunIntensity: 0.68,
    hemiIntensity: 0.52,
    rimIntensity: 0.72,
    envIntensity: 0.44,
    exposure: 0.9,
    nightFactor: 1.0,
    twilightBlend: 1.0,
    goldenHourFactor: 0.0,
  },
  {
    hour: 4.75,
    sky: 0x0d1228,
    fog: 0x1b1e3f,
    hemiSky: 0x4b5896,
    hemiGround: 0x101326,
    sunColor: 0x93c5fd,
    rimColor: 0x818cf8,
    sunIntensity: 0.72,
    hemiIntensity: 0.56,
    rimIntensity: 0.7,
    envIntensity: 0.48,
    exposure: 0.92,
    nightFactor: 0.92,
    twilightBlend: 0.95,
    goldenHourFactor: 0.08,
  },
  {
    hour: 6.25,
    sky: 0xe68478,
    fog: 0xfdba74,
    hemiSky: 0xfed7aa,
    hemiGround: 0x4d3338,
    sunColor: 0xfde68a,
    rimColor: 0xfb923c,
    sunIntensity: 1.32,
    hemiIntensity: 0.76,
    rimIntensity: 0.78,
    envIntensity: 0.8,
    exposure: 1.02,
    nightFactor: 0.24,
    twilightBlend: 0.78,
    goldenHourFactor: 1.0,
  },
  {
    hour: 8.5,
    sky: 0x7ec8f4,
    fog: 0xdbeafe,
    hemiSky: 0xfef3c7,
    hemiGround: 0x6f4e37,
    sunColor: 0xfff5d6,
    rimColor: 0x93c5fd,
    sunIntensity: 1.52,
    hemiIntensity: 0.86,
    rimIntensity: 0.55,
    envIntensity: 1.0,
    exposure: 1.08,
    nightFactor: 0.0,
    twilightBlend: 0.08,
    goldenHourFactor: 0.12,
  },
  {
    hour: 12.5,
    sky: 0x8ccdf2,
    fog: 0xe6c89e,
    hemiSky: 0xfff3d6,
    hemiGround: 0x8d4e32,
    sunColor: 0xffe8b8,
    rimColor: 0x93c5fd,
    sunIntensity: 1.6,
    hemiIntensity: 0.88,
    rimIntensity: 0.52,
    envIntensity: 1.0,
    exposure: 1.08,
    nightFactor: 0.0,
    twilightBlend: 0.0,
    goldenHourFactor: 0.0,
  },
  {
    hour: 16.25,
    sky: 0x7cb9e8,
    fog: 0xf1cfa0,
    hemiSky: 0xfef3c7,
    hemiGround: 0x7c4630,
    sunColor: 0xffdf9e,
    rimColor: 0xfcd34d,
    sunIntensity: 1.46,
    hemiIntensity: 0.82,
    rimIntensity: 0.62,
    envIntensity: 0.94,
    exposure: 1.05,
    nightFactor: 0.04,
    twilightBlend: 0.22,
    goldenHourFactor: 0.35,
  },
  {
    hour: 17.75,
    sky: 0xd1685a,
    fog: 0xf97316,
    hemiSky: 0xfed7aa,
    hemiGround: 0x452828,
    sunColor: 0xfdba74,
    rimColor: 0xf472b6,
    sunIntensity: 1.34,
    hemiIntensity: 0.74,
    rimIntensity: 0.82,
    envIntensity: 0.78,
    exposure: 1.02,
    nightFactor: 0.26,
    twilightBlend: 0.82,
    goldenHourFactor: 1.0,
  },
  {
    hour: 19.25,
    sky: 0x1d1842,
    fog: 0x3b2254,
    hemiSky: 0x8b5cf6,
    hemiGround: 0x17142b,
    sunColor: 0xc084fc,
    rimColor: 0x60a5fa,
    sunIntensity: 0.8,
    hemiIntensity: 0.58,
    rimIntensity: 0.72,
    envIntensity: 0.52,
    exposure: 0.92,
    nightFactor: 0.82,
    twilightBlend: 0.94,
    goldenHourFactor: 0.14,
  },
  {
    hour: 20.75,
    sky: 0x080d1e,
    fog: 0x141d38,
    hemiSky: 0x3b4d82,
    hemiGround: 0x0b1020,
    sunColor: 0x93c5fd,
    rimColor: 0x60a5fa,
    sunIntensity: 0.68,
    hemiIntensity: 0.52,
    rimIntensity: 0.72,
    envIntensity: 0.44,
    exposure: 0.9,
    nightFactor: 1.0,
    twilightBlend: 1.0,
    goldenHourFactor: 0.0,
  },
];

const _colorB = new THREE.Color();

export function createDayNightState(): DayNightState {
  return {
    hourDecimal: 12,
    sky: new THREE.Color(),
    fog: new THREE.Color(),
    hemiSky: new THREE.Color(),
    hemiGround: new THREE.Color(),
    sunColor: new THREE.Color(),
    rimColor: new THREE.Color(),
    sunIntensity: 1.55,
    hemiIntensity: 0.85,
    rimIntensity: 0.55,
    envIntensity: 1.0,
    exposure: 1.08,
    nightFactor: 0,
    twilightBlend: 0,
    goldenHourFactor: 0,
    sunX: 16,
    sunY: 36,
    sunVisible: true,
    moonX: -28,
    moonY: -20,
    moonVisible: false,
    keyOffsetX: 14,
    keyOffsetY: 24,
    keyOffsetZ: 12,
  };
}

export function getLocalHourDecimal(date = new Date()): number {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

const lahoreTimeFormatter =
  typeof Intl !== 'undefined'
    ? new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Karachi',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      })
    : null;

/**
 * Returns Lahore local time (Asia/Karachi, UTC+5) as a 0..24 decimal hour.
 */
export function getLahoreHourDecimal(date = new Date()): number {
  if (lahoreTimeFormatter) {
    try {
      const parts = lahoreTimeFormatter.formatToParts(date);
      let h = 0;
      let m = 0;
      let s = 0;
      for (const part of parts) {
        if (part.type === 'hour') h = Number(part.value) % 24;
        else if (part.type === 'minute') m = Number(part.value);
        else if (part.type === 'second') s = Number(part.value);
      }
      if (!Number.isNaN(h) && !Number.isNaN(m) && !Number.isNaN(s)) {
        return h + m / 60 + s / 3600;
      }
    } catch {
      // Fallback to UTC+5 calculation below
    }
  }
  const utcHours =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  return (utcHours + 5) % 24;
}

export function getHourForLightingMode(mode: LightingMode, date = new Date()): number {
  const found = LIGHTING_MODES.find((opt) => opt.id === mode);
  if (found && found.presetHour !== null) {
    return found.presetHour;
  }
  return getLahoreHourDecimal(date);
}

export function getTimePhaseLabel(hourDecimal: number): string {
  const h = ((hourDecimal % 24) + 24) % 24;
  if (h >= 5.0 && h < 7.75) return 'Dawn';
  if (h >= 7.75 && h < 16.5) return 'Daylight';
  if (h >= 16.5 && h < 19.25) return 'Golden Sunset';
  return 'Lahore Night';
}

export function formatLahoreClockAndPhase(
  mode: LightingMode,
  date = new Date(),
): { clockText: string; livePhaseLabel: string; effectivePhaseLabel: string } {
  const liveHour = getLahoreHourDecimal(date);
  const wholeHours = Math.floor(liveHour) % 24;
  const minutes = Math.floor((liveHour - Math.floor(liveHour)) * 60) % 60;
  const period = wholeHours >= 12 ? 'PM' : 'AM';
  const hour12 = wholeHours % 12 === 0 ? 12 : wholeHours % 12;
  const clockText = `${hour12}:${String(minutes).padStart(2, '0')} ${period} PKT`;
  const effectiveHour = getHourForLightingMode(mode, date);
  return {
    clockText,
    livePhaseLabel: getTimePhaseLabel(liveHour),
    effectivePhaseLabel: getTimePhaseLabel(effectiveHour),
  };
}

export function sampleDayNightState(hourDecimal: number, out: DayNightState): void {
  const h = ((hourDecimal % 24) + 24) % 24;
  out.hourDecimal = h;

  let prev = KEYFRAMES[KEYFRAMES.length - 1];
  let next = KEYFRAMES[0];
  let prevHour = prev.hour - 24;
  let nextHour = next.hour + 24;

  for (let i = 0; i < KEYFRAMES.length; i++) {
    const kf = KEYFRAMES[i];
    const kfNext = KEYFRAMES[(i + 1) % KEYFRAMES.length];
    const startH = kf.hour;
    const endH = i === KEYFRAMES.length - 1 ? kfNext.hour + 24 : kfNext.hour;
    if (h >= startH && h <= endH) {
      prev = kf;
      next = kfNext;
      prevHour = startH;
      nextHour = endH;
      break;
    }
  }

  const span = Math.max(0.001, nextHour - prevHour);
  const rawT = THREE.MathUtils.clamp((h - prevHour) / span, 0, 1);
  // Smoothstep for organic twilight & dawn easing
  const t = rawT * rawT * (3 - 2 * rawT);

  out.sky.setHex(prev.sky).lerp(_colorB.setHex(next.sky), t);
  out.fog.setHex(prev.fog).lerp(_colorB.setHex(next.fog), t);
  out.hemiSky.setHex(prev.hemiSky).lerp(_colorB.setHex(next.hemiSky), t);
  out.hemiGround.setHex(prev.hemiGround).lerp(_colorB.setHex(next.hemiGround), t);
  out.sunColor.setHex(prev.sunColor).lerp(_colorB.setHex(next.sunColor), t);
  out.rimColor.setHex(prev.rimColor).lerp(_colorB.setHex(next.rimColor), t);

  out.sunIntensity = THREE.MathUtils.lerp(prev.sunIntensity, next.sunIntensity, t);
  out.hemiIntensity = THREE.MathUtils.lerp(prev.hemiIntensity, next.hemiIntensity, t);
  out.rimIntensity = THREE.MathUtils.lerp(prev.rimIntensity, next.rimIntensity, t);
  out.envIntensity = THREE.MathUtils.lerp(prev.envIntensity, next.envIntensity, t);
  out.exposure = THREE.MathUtils.lerp(prev.exposure, next.exposure, t);
  out.nightFactor = THREE.MathUtils.lerp(prev.nightFactor, next.nightFactor, t);
  out.twilightBlend = THREE.MathUtils.lerp(prev.twilightBlend, next.twilightBlend, t);
  out.goldenHourFactor = THREE.MathUtils.lerp(prev.goldenHourFactor, next.goldenHourFactor, t);

  // Sun celestial arc across the forward horizon (approx 05:45 -> 18:15 Lahore time)
  const dayT = (h - 5.75) / 12.5;
  if (dayT >= -0.05 && dayT <= 1.05) {
    const clampedDay = THREE.MathUtils.clamp(dayT, 0, 1);
    const arc = Math.sin(clampedDay * Math.PI);
    out.sunX = THREE.MathUtils.lerp(-42, 42, clampedDay);
    out.sunY = -4 + arc * 46;
    out.sunVisible = out.sunY > -3.5 && out.nightFactor < 0.9;
  } else {
    out.sunX = 0;
    out.sunY = -20;
    out.sunVisible = false;
  }

  // Moon celestial arc across the forward horizon (approx 17:45 -> 06:15 Lahore time)
  const nightHours = h >= 17.75 ? h - 17.75 : h + 6.25;
  const nightT = nightHours / 12.5;
  if (nightT >= 0 && nightT <= 1) {
    const arc = Math.sin(nightT * Math.PI);
    out.moonX = THREE.MathUtils.lerp(-36, 36, nightT);
    out.moonY = 2 + arc * 38;
    out.moonVisible = out.nightFactor > 0.15;
  } else {
    out.moonX = 0;
    out.moonY = -20;
    out.moonVisible = false;
  }

  // Key directional light sweeps low at sunrise/sunset for dramatic long shadows,
  // rises high at solar noon, and settles to cool elevated moonlight at night
  const dayArcT = THREE.MathUtils.clamp(dayT, 0, 1);
  const sunElevation = Math.sin(dayArcT * Math.PI);
  const dayKeyX = THREE.MathUtils.lerp(-27, 27, dayArcT);
  const dayKeyY = 5.8 + Math.pow(sunElevation, 0.72) * 23.0;
  const dayKeyZ = THREE.MathUtils.lerp(13.5, 8.0, sunElevation);
  const nightKeyX = -11;
  const nightKeyY = 22;
  const nightKeyZ = 10;

  out.keyOffsetX = THREE.MathUtils.lerp(dayKeyX, nightKeyX, out.nightFactor);
  out.keyOffsetY = THREE.MathUtils.lerp(dayKeyY, nightKeyY, out.nightFactor);
  out.keyOffsetZ = THREE.MathUtils.lerp(dayKeyZ, nightKeyZ, out.nightFactor);
}
