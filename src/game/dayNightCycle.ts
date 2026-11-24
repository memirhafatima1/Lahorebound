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
    label: 'Dynamic Cycle',
    shortLabel: 'Dynamic',
    accentHex: '#38bdf8',
    presetHour: null,
  },
  {
    id: 'dawn',
    label: 'Sunrise',
    shortLabel: 'Sunrise',
    accentHex: '#fb923c',
    presetHour: 6.15,
  },
  {
    id: 'day',
    label: 'High Noon',
    shortLabel: 'Noon',
    accentHex: '#fbbf24',
    presetHour: 12.5,
  },
  {
    id: 'sunset',
    label: 'Golden Dusk',
    shortLabel: 'Dusk',
    accentHex: '#f97316',
    presetHour: 17.85,
  },
  {
    id: 'night',
    label: 'Lahore Night',
    shortLabel: 'Night',
    accentHex: '#818cf8',
    presetHour: 22.0,
  },
];

export const SUNSET_TWILIGHT_START_HOUR = 17.45;
export const DEEP_INDIGO_TWILIGHT_HOUR = 20.65;
export const TWILIGHT_DISTANCE_SPAN_METERS = 1080;

export interface DayNightState {
  hourDecimal: number;
  skyZenith: THREE.Color;
  skyMid: THREE.Color;
  sky: THREE.Color;
  fog: THREE.Color;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  sunColor: THREE.Color;
  sunGlowColor: THREE.Color;
  sunGlowStrength: number;
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
  skyZenith: number;
  skyMid: number;
  sky: number;
  fog: number;
  hemiSky: number;
  hemiGround: number;
  sunColor: number;
  sunGlowColor: number;
  sunGlowStrength: number;
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
    skyZenith: 0x030714,
    skyMid: 0x0b1030,
    sky: 0x0a1329,
    fog: 0x111a33,
    hemiSky: 0x3b4d82,
    hemiGround: 0x0b1020,
    sunColor: 0x93c5fd,
    sunGlowColor: 0x1e3a8a,
    sunGlowStrength: 0.0,
    rimColor: 0x60a5fa,
    sunIntensity: 0.58,
    hemiIntensity: 0.48,
    rimIntensity: 0.74,
    envIntensity: 0.42,
    exposure: 0.88,
    nightFactor: 1.0,
    twilightBlend: 1.0,
    goldenHourFactor: 0.0,
  },
  {
    hour: 4.5,
    skyZenith: 0x090f26,
    skyMid: 0x1a1a46,
    sky: 0x1a1e42,
    fog: 0x262148,
    hemiSky: 0x4b5896,
    hemiGround: 0x101326,
    sunColor: 0x93c5fd,
    sunGlowColor: 0xf472b6,
    sunGlowStrength: 0.16,
    rimColor: 0x818cf8,
    sunIntensity: 0.68,
    hemiIntensity: 0.54,
    rimIntensity: 0.72,
    envIntensity: 0.48,
    exposure: 0.92,
    nightFactor: 0.88,
    twilightBlend: 0.92,
    goldenHourFactor: 0.18,
  },
  {
    hour: 6.15,
    skyZenith: 0x3666a6,
    skyMid: 0x9a7598,
    sky: 0xf08c6e,
    fog: 0xfdba74,
    hemiSky: 0xfed7aa,
    hemiGround: 0x5c3638,
    sunColor: 0xfde68a,
    sunGlowColor: 0xfb923c,
    sunGlowStrength: 0.92,
    rimColor: 0xfb923c,
    sunIntensity: 1.28,
    hemiIntensity: 0.76,
    rimIntensity: 0.82,
    envIntensity: 0.82,
    exposure: 1.03,
    nightFactor: 0.18,
    twilightBlend: 0.84,
    goldenHourFactor: 1.0,
  },
  {
    hour: 8.75,
    skyZenith: 0x2c78d6,
    skyMid: 0x5eaee8,
    sky: 0x89cff6,
    fog: 0xdbeafe,
    hemiSky: 0xfef3c7,
    hemiGround: 0x6f4e37,
    sunColor: 0xfff5d6,
    sunGlowColor: 0xfef08a,
    sunGlowStrength: 0.35,
    rimColor: 0x93c5fd,
    sunIntensity: 1.56,
    hemiIntensity: 0.88,
    rimIntensity: 0.56,
    envIntensity: 0.98,
    exposure: 1.08,
    nightFactor: 0.0,
    twilightBlend: 0.16,
    goldenHourFactor: 0.15,
  },
  {
    hour: 12.5,
    skyZenith: 0x1d68cf,
    skyMid: 0x5ab1ef,
    sky: 0x9bd8fa,
    fog: 0xe6d2ab,
    hemiSky: 0xfff8e6,
    hemiGround: 0x8d5234,
    sunColor: 0xfff3d4,
    sunGlowColor: 0xfef9c3,
    sunGlowStrength: 0.22,
    rimColor: 0x93c5fd,
    sunIntensity: 1.78,
    hemiIntensity: 0.95,
    rimIntensity: 0.5,
    envIntensity: 1.08,
    exposure: 1.12,
    nightFactor: 0.0,
    twilightBlend: 0.0,
    goldenHourFactor: 0.0,
  },
  {
    hour: 16.0,
    skyZenith: 0x3572be,
    skyMid: 0x679fd2,
    sky: 0x8bc2eb,
    fog: 0xf2d1a0,
    hemiSky: 0xfef3c7,
    hemiGround: 0x7c4630,
    sunColor: 0xffdf9e,
    sunGlowColor: 0xfcd34d,
    sunGlowStrength: 0.45,
    rimColor: 0xfcd34d,
    sunIntensity: 1.48,
    hemiIntensity: 0.84,
    rimIntensity: 0.66,
    envIntensity: 0.94,
    exposure: 1.06,
    nightFactor: 0.04,
    twilightBlend: 0.28,
    goldenHourFactor: 0.42,
  },
  {
    hour: 17.45,
    skyZenith: 0x5a2554,
    skyMid: 0xd9483b,
    sky: 0xf97316,
    fog: 0xfb923c,
    hemiSky: 0xfed7aa,
    hemiGround: 0x5c2c24,
    sunColor: 0xfdba74,
    sunGlowColor: 0xf97316,
    sunGlowStrength: 1.0,
    rimColor: 0xfb923c,
    sunIntensity: 1.28,
    hemiIntensity: 0.76,
    rimIntensity: 0.88,
    envIntensity: 0.8,
    exposure: 1.02,
    nightFactor: 0.18,
    twilightBlend: 0.78,
    goldenHourFactor: 1.0,
  },
  {
    hour: 18.35,
    skyZenith: 0x341c59,
    skyMid: 0x933368,
    sky: 0xe85d3f,
    fog: 0xf47245,
    hemiSky: 0xfecdd3,
    hemiGround: 0x452232,
    sunColor: 0xfb923c,
    sunGlowColor: 0xf43f5e,
    sunGlowStrength: 0.86,
    rimColor: 0xf472b6,
    sunIntensity: 1.1,
    hemiIntensity: 0.68,
    rimIntensity: 0.86,
    envIntensity: 0.7,
    exposure: 0.98,
    nightFactor: 0.42,
    twilightBlend: 0.88,
    goldenHourFactor: 0.78,
  },
  {
    hour: 19.45,
    skyZenith: 0x1b1448,
    skyMid: 0x4c287a,
    sky: 0x6d3b7d,
    fog: 0x5b357a,
    hemiSky: 0xa78bfa,
    hemiGround: 0x1f163b,
    sunColor: 0xc084fc,
    sunGlowColor: 0xec4899,
    sunGlowStrength: 0.36,
    rimColor: 0x818cf8,
    sunIntensity: 0.78,
    hemiIntensity: 0.58,
    rimIntensity: 0.78,
    envIntensity: 0.54,
    exposure: 0.92,
    nightFactor: 0.76,
    twilightBlend: 0.96,
    goldenHourFactor: 0.25,
  },
  {
    hour: 20.65,
    skyZenith: 0x090826,
    skyMid: 0x1e1b5e,
    sky: 0x282672,
    fog: 0x312e81,
    hemiSky: 0x6366f1,
    hemiGround: 0x111033,
    sunColor: 0x93c5fd,
    sunGlowColor: 0x4f46e5,
    sunGlowStrength: 0.14,
    rimColor: 0x818cf8,
    sunIntensity: 0.66,
    hemiIntensity: 0.52,
    rimIntensity: 0.76,
    envIntensity: 0.46,
    exposure: 0.9,
    nightFactor: 0.94,
    twilightBlend: 1.0,
    goldenHourFactor: 0.0,
  },
  {
    hour: 22.0,
    skyZenith: 0x04071a,
    skyMid: 0x11143e,
    sky: 0x131942,
    fog: 0x1a1f4b,
    hemiSky: 0x434f8e,
    hemiGround: 0x0b1020,
    sunColor: 0x93c5fd,
    sunGlowColor: 0x1e3a8a,
    sunGlowStrength: 0.04,
    rimColor: 0x60a5fa,
    sunIntensity: 0.6,
    hemiIntensity: 0.48,
    rimIntensity: 0.74,
    envIntensity: 0.42,
    exposure: 0.88,
    nightFactor: 1.0,
    twilightBlend: 1.0,
    goldenHourFactor: 0.0,
  },
];

const _colorB = new THREE.Color();

export function createDayNightState(): DayNightState {
  return {
    hourDecimal: SUNSET_TWILIGHT_START_HOUR,
    skyZenith: new THREE.Color(0x5a2554),
    skyMid: new THREE.Color(0xd9483b),
    sky: new THREE.Color(0xf97316),
    fog: new THREE.Color(0xfb923c),
    hemiSky: new THREE.Color(0xfed7aa),
    hemiGround: new THREE.Color(0x5c2c24),
    sunColor: new THREE.Color(0xfdba74),
    sunGlowColor: new THREE.Color(0xf97316),
    sunGlowStrength: 1.0,
    rimColor: new THREE.Color(0xfb923c),
    sunIntensity: 1.28,
    hemiIntensity: 0.76,
    rimIntensity: 0.88,
    envIntensity: 0.8,
    exposure: 1.02,
    nightFactor: 0.18,
    twilightBlend: 0.78,
    goldenHourFactor: 1.0,
    sunX: 38.5,
    sunY: 8.05,
    sunVisible: true,
    moonX: -38,
    moonY: 2,
    moonVisible: true,
    keyOffsetX: 22.6,
    keyOffsetY: 14.5,
    keyOffsetZ: 10.6,
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

/**
 * Computes normalized [0..1] skybox transition progress from Sunset Orange (0)
 * at 0m to Deep Indigo Twilight (1) as the runner accumulates distance across
 * Lahore's landmarks (0m Delhi Gate -> 1080m+ Liberty Chowk & beyond).
 */
export function computeDistanceSkyboxProgress(
  distanceMeters: number,
  elapsedRunSeconds = 0,
): number {
  const safeDist = Number.isFinite(distanceMeters) ? Math.max(0, distanceMeters) : 0;
  const safeTime = Number.isFinite(elapsedRunSeconds) ? Math.max(0, elapsedRunSeconds) : 0;
  const effectiveMeters = safeDist + safeTime * 0.45;
  const raw = THREE.MathUtils.clamp(effectiveMeters / TWILIGHT_DISTANCE_SPAN_METERS, 0, 1);
  return raw * raw * (3 - 2 * raw);
}

/**
 * Computes the dynamic in-run time-of-day hour (17.45 -> 20.65) so each run
 * smoothly shifts from Sunset Orange at Delhi Gate into Deep Indigo Twilight
 * as distance accumulates across Lahore's landmarks.
 */
export function getDynamicRunHourDecimal(distanceMeters: number, elapsedRunSeconds: number): number {
  const progress = computeDistanceSkyboxProgress(distanceMeters, elapsedRunSeconds);
  return THREE.MathUtils.lerp(SUNSET_TWILIGHT_START_HOUR, DEEP_INDIGO_TWILIGHT_HOUR, progress);
}

export function getHourForLightingMode(
  mode: LightingMode,
  distanceMeters = 0,
  elapsedRunSeconds = 0,
): number {
  const found = LIGHTING_MODES.find((opt) => opt.id === mode);
  if (found && found.presetHour !== null) {
    return found.presetHour;
  }
  return getDynamicRunHourDecimal(distanceMeters, elapsedRunSeconds);
}

export function getTimePhaseLabel(hourDecimal: number): string {
  const h = ((hourDecimal % 24) + 24) % 24;
  if (h >= 5.25 && h < 8.0) return 'Sunrise';
  if (h >= 8.0 && h < 11.25) return 'Morning';
  if (h >= 11.25 && h < 15.75) return 'Noon';
  if (h >= 15.75 && h < 18.6) return 'Sunset';
  if (h >= 18.6 && h < 21.1) return 'Twilight';
  return 'Night';
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
  const effectivePhaseLabel =
    mode === 'auto'
      ? 'Sunset → Indigo Twilight'
      : getTimePhaseLabel(getHourForLightingMode(mode));
  return {
    clockText,
    livePhaseLabel: getTimePhaseLabel(liveHour),
    effectivePhaseLabel,
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
  // Smoothstep for organic sunrise, noon, sunset & indigo twilight easing
  const t = rawT * rawT * (3 - 2 * rawT);

  out.skyZenith.setHex(prev.skyZenith).lerp(_colorB.setHex(next.skyZenith), t);
  out.skyMid.setHex(prev.skyMid).lerp(_colorB.setHex(next.skyMid), t);
  out.sky.setHex(prev.sky).lerp(_colorB.setHex(next.sky), t);
  out.fog.setHex(prev.fog).lerp(_colorB.setHex(next.fog), t);
  out.hemiSky.setHex(prev.hemiSky).lerp(_colorB.setHex(next.hemiSky), t);
  out.hemiGround.setHex(prev.hemiGround).lerp(_colorB.setHex(next.hemiGround), t);
  out.sunColor.setHex(prev.sunColor).lerp(_colorB.setHex(next.sunColor), t);
  out.sunGlowColor.setHex(prev.sunGlowColor).lerp(_colorB.setHex(next.sunGlowColor), t);
  out.sunGlowStrength = THREE.MathUtils.lerp(prev.sunGlowStrength, next.sunGlowStrength, t);
  out.rimColor.setHex(prev.rimColor).lerp(_colorB.setHex(next.rimColor), t);

  out.sunIntensity = THREE.MathUtils.lerp(prev.sunIntensity, next.sunIntensity, t);
  out.hemiIntensity = THREE.MathUtils.lerp(prev.hemiIntensity, next.hemiIntensity, t);
  out.rimIntensity = THREE.MathUtils.lerp(prev.rimIntensity, next.rimIntensity, t);
  out.envIntensity = THREE.MathUtils.lerp(prev.envIntensity, next.envIntensity, t);
  out.exposure = THREE.MathUtils.lerp(prev.exposure, next.exposure, t);
  out.nightFactor = THREE.MathUtils.lerp(prev.nightFactor, next.nightFactor, t);
  out.twilightBlend = THREE.MathUtils.lerp(prev.twilightBlend, next.twilightBlend, t);
  out.goldenHourFactor = THREE.MathUtils.lerp(prev.goldenHourFactor, next.goldenHourFactor, t);

  // Sun celestial arc across the forward horizon (approx 05:30 -> 18:45)
  const dayT = (h - 5.5) / 13.15;
  if (dayT >= -0.05 && dayT <= 1.05) {
    const clampedDay = THREE.MathUtils.clamp(dayT, 0, 1);
    const arc = Math.sin(clampedDay * Math.PI);
    out.sunX = THREE.MathUtils.lerp(-46, 46, clampedDay);
    out.sunY = -4 + arc * 48;
    out.sunVisible = out.sunY > -3.5 && out.nightFactor < 0.9;
  } else {
    out.sunX = 0;
    out.sunY = -20;
    out.sunVisible = false;
  }

  // Moon celestial arc across the forward horizon (approx 17:45 -> 06:00)
  const nightHours = h >= 17.75 ? h - 17.75 : h + 6.25;
  const nightT = nightHours / 12.25;
  if (nightT >= 0 && nightT <= 1) {
    const arc = Math.sin(nightT * Math.PI);
    out.moonX = THREE.MathUtils.lerp(-38, 38, nightT);
    out.moonY = 2 + arc * 38;
    out.moonVisible = out.nightFactor > 0.16;
  } else {
    out.moonX = 0;
    out.moonY = -20;
    out.moonVisible = false;
  }

  // Key directional light sweeps low at sunrise/sunset for long shadows,
  // climbs high at solar noon, and shifts to cool elevated twilight/moonlight
  const dayArcT = THREE.MathUtils.clamp(dayT, 0, 1);
  const sunElevation = Math.sin(dayArcT * Math.PI);
  const dayKeyX = THREE.MathUtils.lerp(-27, 27, dayArcT);
  const dayKeyY = 6.2 + Math.pow(sunElevation, 0.72) * 23.0;
  const dayKeyZ = THREE.MathUtils.lerp(13.5, 8.0, sunElevation);
  const nightKeyX = -11;
  const nightKeyY = 22;
  const nightKeyZ = 10;

  out.keyOffsetX = THREE.MathUtils.lerp(dayKeyX, nightKeyX, out.nightFactor);
  out.keyOffsetY = THREE.MathUtils.lerp(dayKeyY, nightKeyY, out.nightFactor);
  out.keyOffsetZ = THREE.MathUtils.lerp(dayKeyZ, nightKeyZ, out.nightFactor);
}
