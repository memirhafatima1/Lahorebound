import * as THREE from 'three';
import type { BiomeId, LahoreLandmarkKind, WeatherCondition } from './types';

export interface BiomeWeatherProfile {
  fogCompression: number;
  fogTintBoost: number;
  rainSpeedMul: number;
  rainDensityMul: number;
  mistScaleMul: number;
  hazeShimmerMul: number;
}

// Distinct atmospheric signatures for each region of Lahore
export const BIOME_WEATHER_PROFILES: Record<BiomeId, BiomeWeatherProfile> = {
  // Androon Lahore (Walled City): warm sandstone heat shimmer, golden dust haze, tighter canyon air
  canyon: {
    fogCompression: 1.14,
    fogTintBoost: 1.18,
    rainSpeedMul: 0.92,
    rainDensityMul: 0.88,
    mistScaleMul: 0.84,
    hazeShimmerMul: 1.44,
  },
  // Iqbal Park & Shalimar Gardens: lush humidity, cascading fountain mist, brisk monsoon showers
  skybridge: {
    fogCompression: 1.22,
    fogTintBoost: 1.12,
    rainSpeedMul: 1.24,
    rainDensityMul: 1.28,
    mistScaleMul: 1.38,
    hazeShimmerMul: 0.68,
  },
  // Canal Road & Liberty Chowk: high-speed urban flyover, sharp slicing rain & cool canal mist
  obsidian: {
    fogCompression: 1.05,
    fogTintBoost: 1.22,
    rainSpeedMul: 1.38,
    rainDensityMul: 1.22,
    mistScaleMul: 1.16,
    hazeShimmerMul: 0.96,
  },
};

export interface WeatherMetadata {
  id: WeatherCondition;
  label: string;
  shortLabel: string;
  accentHex: string;
}

export const WEATHER_META: Record<WeatherCondition, WeatherMetadata> = {
  clear: {
    id: 'clear',
    label: 'Clear Breeze',
    shortLabel: 'Clear',
    accentHex: '#38bdf8',
  },
  light_rain: {
    id: 'light_rain',
    label: 'Light Rain',
    shortLabel: 'Light Rain',
    accentHex: '#60a5fa',
  },
  mist: {
    id: 'mist',
    label: 'Morning Mist',
    shortLabel: 'Mist',
    accentHex: '#94a3b8',
  },
  sunny_haze: {
    id: 'sunny_haze',
    label: 'Sunny Haze',
    shortLabel: 'Sunny Haze',
    accentHex: '#fbbf24',
  },
};

interface WeightedWeatherOption {
  condition: WeatherCondition;
  weight: number;
}

// Weighted weather probabilities tailored to each Lahore landmark's micro-climate
const LANDMARK_WEATHER_WEIGHTS: Record<LahoreLandmarkKind, WeightedWeatherOption[]> = {
  gate: [
    { condition: 'sunny_haze', weight: 46 },
    { condition: 'mist', weight: 28 },
    { condition: 'light_rain', weight: 16 },
    { condition: 'clear', weight: 10 },
  ],
  bazaar: [
    { condition: 'sunny_haze', weight: 40 },
    { condition: 'light_rain', weight: 32 },
    { condition: 'mist', weight: 22 },
    { condition: 'clear', weight: 6 },
  ],
  mosque: [
    { condition: 'sunny_haze', weight: 42 },
    { condition: 'mist', weight: 34 },
    { condition: 'light_rain', weight: 16 },
    { condition: 'clear', weight: 8 },
  ],
  minar: [
    { condition: 'light_rain', weight: 38 },
    { condition: 'mist', weight: 28 },
    { condition: 'sunny_haze', weight: 22 },
    { condition: 'clear', weight: 12 },
  ],
  gardens: [
    { condition: 'mist', weight: 44 },
    { condition: 'light_rain', weight: 34 },
    { condition: 'sunny_haze', weight: 16 },
    { condition: 'clear', weight: 6 },
  ],
  canal: [
    { condition: 'light_rain', weight: 42 },
    { condition: 'mist', weight: 40 },
    { condition: 'sunny_haze', weight: 12 },
    { condition: 'clear', weight: 6 },
  ],
  liberty: [
    { condition: 'light_rain', weight: 36 },
    { condition: 'sunny_haze', weight: 34 },
    { condition: 'mist', weight: 22 },
    { condition: 'clear', weight: 8 },
  ],
};

export function pickWeatherForLandmark(
  landmark: LahoreLandmarkKind,
  previous?: WeatherCondition,
  avoidClear = false,
): WeatherCondition {
  const baseOptions = LANDMARK_WEATHER_WEIGHTS[landmark] ?? LANDMARK_WEATHER_WEIGHTS.gate;
  const options = baseOptions
    .filter((opt) => !(avoidClear && opt.condition === 'clear'))
    .map((opt) => ({
      condition: opt.condition,
      // Slightly reduce chance of repeating the exact previous weather so each landmark feels distinct
      weight: previous && opt.condition === previous ? opt.weight * 0.35 : opt.weight,
    }));

  let totalWeight = 0;
  for (const opt of options) totalWeight += opt.weight;

  let roll = Math.random() * Math.max(0.001, totalWeight);
  for (const opt of options) {
    roll -= opt.weight;
    if (roll <= 0) return opt.condition;
  }
  return options[0]?.condition ?? 'sunny_haze';
}

export interface LandmarkForecast {
  landmark: LahoreLandmarkKind;
  condition: WeatherCondition;
  label: string;
  shortLabel: string;
  accentHex: string;
  likelihoodPct: number;
}

export function getLandmarkForecast(landmark: LahoreLandmarkKind): LandmarkForecast {
  const options = LANDMARK_WEATHER_WEIGHTS[landmark] ?? LANDMARK_WEATHER_WEIGHTS.gate;
  let totalWeight = 0;
  let top = options[0];
  for (const opt of options) {
    totalWeight += opt.weight;
    if (opt.weight > top.weight) {
      top = opt;
    }
  }
  const meta = WEATHER_META[top.condition];
  const likelihoodPct = Math.round((top.weight / Math.max(1, totalWeight)) * 100);
  return {
    landmark,
    condition: top.condition,
    label: meta.label,
    shortLabel: meta.shortLabel,
    accentHex: meta.accentHex,
    likelihoodPct,
  };
}

export function getAllLandmarkForecasts(): Record<LahoreLandmarkKind, LandmarkForecast> {
  return {
    gate: getLandmarkForecast('gate'),
    bazaar: getLandmarkForecast('bazaar'),
    mosque: getLandmarkForecast('mosque'),
    minar: getLandmarkForecast('minar'),
    gardens: getLandmarkForecast('gardens'),
    canal: getLandmarkForecast('canal'),
    liberty: getLandmarkForecast('liberty'),
  };
}

export interface WeatherLightingModifiers {
  fogNear: number;
  fogFar: number;
  skyTint: THREE.Color;
  skyTintWeight: number;
  fogTint: THREE.Color;
  fogTintWeight: number;
  sunIntensityMul: number;
  hemiIntensityMul: number;
  exposureOffset: number;
}

const _dayRainSky = new THREE.Color(0x64748b);
const _dayRainFog = new THREE.Color(0x94a3b8);
const _nightRainSky = new THREE.Color(0x0b1326);
const _nightRainFog = new THREE.Color(0x16223b);

const _dayMistSky = new THREE.Color(0xcbd5e1);
const _dayMistFog = new THREE.Color(0xdce6f0);
const _nightMistSky = new THREE.Color(0x1a253d);
const _nightMistFog = new THREE.Color(0x283854);

const _dayHazeSky = new THREE.Color(0xf6c478);
const _dayHazeFog = new THREE.Color(0xfde6ba);
const _nightHazeSky = new THREE.Color(0x3a241c);
const _nightHazeFog = new THREE.Color(0x523124);

const _tmpSkyTint = new THREE.Color();
const _tmpFogTint = new THREE.Color();

function createSoftRadialTexture(
  innerRgba: string,
  midRgba: string,
  outerRgba: string,
  size = 64,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, innerRgba);
    grad.addColorStop(0.45, midRgba);
    grad.addColorStop(1, outerRgba);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createSplashRingTexture(size = 64): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const half = size / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(half, half, half * 0.52, 0, Math.PI * 2);
    ctx.stroke();

    const grad = ctx.createRadialGradient(half, half, 0, half, half, half * 0.45);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
    grad.addColorStop(1, 'rgba(224, 242, 254, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(half, half, half * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const RAIN_COUNT = 260;
const SPLASH_COUNT = 64;
const MIST_COUNT = 88;
const HAZE_MOTE_COUNT = 104;

export class WeatherSystem {
  public readonly group = new THREE.Group();

  private activeCondition: WeatherCondition = 'sunny_haze';
  private rainStrength = 0;
  private mistStrength = 0;
  private hazeStrength = 0;

  // Smoothed biome & velocity scaling state
  private biomeFogCompression = BIOME_WEATHER_PROFILES.canyon.fogCompression;
  private biomeFogTintBoost = BIOME_WEATHER_PROFILES.canyon.fogTintBoost;
  private biomeRainSpeedMul = BIOME_WEATHER_PROFILES.canyon.rainSpeedMul;
  private biomeRainDensityMul = BIOME_WEATHER_PROFILES.canyon.rainDensityMul;
  private biomeMistScaleMul = BIOME_WEATHER_PROFILES.canyon.mistScaleMul;
  private biomeHazeShimmerMul = BIOME_WEATHER_PROFILES.canyon.hazeShimmerMul;
  private speedIntensity = 0;

  // 1. Light Rain streaks + ground splashes
  private readonly rainPositions: Float32Array;
  private readonly rainSpeeds: Float32Array;
  private readonly rainLengths: Float32Array;
  private readonly rainGeo: THREE.BufferGeometry;
  private readonly rainMat: THREE.LineBasicMaterial;
  private readonly rainLines: THREE.LineSegments;

  private readonly splashPositions: Float32Array;
  private readonly splashPhases: Float32Array;
  private readonly splashGeo: THREE.BufferGeometry;
  private readonly splashMat: THREE.PointsMaterial;
  private readonly splashPoints: THREE.Points;
  private readonly splashTex: THREE.CanvasTexture;

  // 2. Mist puffs
  private readonly mistPositions: Float32Array;
  private readonly mistDriftSeeds: Float32Array;
  private readonly mistGeo: THREE.BufferGeometry;
  private readonly mistMat: THREE.PointsMaterial;
  private readonly mistPoints: THREE.Points;
  private readonly mistTex: THREE.CanvasTexture;

  // 3. Sunny Haze golden motes + horizon glow veil
  private readonly hazePositions: Float32Array;
  private readonly hazeSeeds: Float32Array;
  private readonly hazeGeo: THREE.BufferGeometry;
  private readonly hazeMat: THREE.PointsMaterial;
  private readonly hazePoints: THREE.Points;
  private readonly hazeTex: THREE.CanvasTexture;

  private readonly hazeGlowTex: THREE.CanvasTexture;
  private readonly hazeGlowMat: THREE.MeshBasicMaterial;
  private readonly hazeGlowMesh: THREE.Mesh;

  constructor(initialCondition: WeatherCondition = 'sunny_haze') {
    this.activeCondition = initialCondition;
    this.rainStrength = initialCondition === 'light_rain' ? 1 : 0;
    this.mistStrength = initialCondition === 'mist' ? 1 : 0;
    this.hazeStrength = initialCondition === 'sunny_haze' ? 1 : 0;

    // --- Light Rain Lines ---
    this.rainPositions = new Float32Array(RAIN_COUNT * 2 * 3);
    this.rainSpeeds = new Float32Array(RAIN_COUNT);
    this.rainLengths = new Float32Array(RAIN_COUNT);

    for (let i = 0; i < RAIN_COUNT; i++) {
      const x = (Math.random() - 0.5) * 30;
      const y = Math.random() * 15;
      const z = -44 + Math.random() * 54;
      const len = 0.68 + Math.random() * 0.45;
      this.rainLengths[i] = len;
      this.rainSpeeds[i] = 21 + Math.random() * 7;

      const idx = i * 6;
      this.rainPositions[idx] = x;
      this.rainPositions[idx + 1] = y;
      this.rainPositions[idx + 2] = z;
      this.rainPositions[idx + 3] = x + 0.08;
      this.rainPositions[idx + 4] = y + len;
      this.rainPositions[idx + 5] = z + 0.04;
    }

    this.rainGeo = new THREE.BufferGeometry();
    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    this.rainMat = new THREE.LineBasicMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    });
    this.rainLines = new THREE.LineSegments(this.rainGeo, this.rainMat);
    this.rainLines.frustumCulled = false;
    this.rainLines.visible = false;
    this.group.add(this.rainLines);

    // --- Rain Splash Droplets ---
    this.splashPositions = new Float32Array(SPLASH_COUNT * 3);
    this.splashPhases = new Float32Array(SPLASH_COUNT);
    for (let i = 0; i < SPLASH_COUNT; i++) {
      this.splashPositions[i * 3] = (Math.random() - 0.5) * 20;
      this.splashPositions[i * 3 + 1] = 0.06;
      this.splashPositions[i * 3 + 2] = -38 + Math.random() * 44;
      this.splashPhases[i] = Math.random();
    }
    this.splashGeo = new THREE.BufferGeometry();
    this.splashGeo.setAttribute('position', new THREE.BufferAttribute(this.splashPositions, 3));
    this.splashTex = createSplashRingTexture(64);
    this.splashMat = new THREE.PointsMaterial({
      size: 0.55,
      sizeAttenuation: true,
      map: this.splashTex,
      color: 0xbae6fd,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: true,
    });
    this.splashPoints = new THREE.Points(this.splashGeo, this.splashMat);
    this.splashPoints.frustumCulled = false;
    this.splashPoints.visible = false;
    this.group.add(this.splashPoints);

    // --- Morning / Courtyard Mist ---
    this.mistPositions = new Float32Array(MIST_COUNT * 3);
    this.mistDriftSeeds = new Float32Array(MIST_COUNT * 2);
    for (let i = 0; i < MIST_COUNT; i++) {
      this.mistPositions[i * 3] = (Math.random() - 0.5) * 34;
      this.mistPositions[i * 3 + 1] = 0.6 + Math.random() * 4.4;
      this.mistPositions[i * 3 + 2] = -68 + Math.random() * 80;
      this.mistDriftSeeds[i * 2] = Math.random() * Math.PI * 2;
      this.mistDriftSeeds[i * 2 + 1] = 0.6 + Math.random() * 1.1;
    }
    this.mistGeo = new THREE.BufferGeometry();
    this.mistGeo.setAttribute('position', new THREE.BufferAttribute(this.mistPositions, 3));
    this.mistTex = createSoftRadialTexture(
      'rgba(241, 245, 249, 0.72)',
      'rgba(226, 232, 240, 0.34)',
      'rgba(226, 232, 240, 0)',
      64,
    );
    this.mistMat = new THREE.PointsMaterial({
      size: 7.4,
      sizeAttenuation: true,
      map: this.mistTex,
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: true,
    });
    this.mistPoints = new THREE.Points(this.mistGeo, this.mistMat);
    this.mistPoints.frustumCulled = false;
    this.mistPoints.visible = false;
    this.group.add(this.mistPoints);

    // --- Sunny Haze Golden Dust Motes & Horizon Warm Glow ---
    this.hazePositions = new Float32Array(HAZE_MOTE_COUNT * 3);
    this.hazeSeeds = new Float32Array(HAZE_MOTE_COUNT * 2);
    for (let i = 0; i < HAZE_MOTE_COUNT; i++) {
      this.hazePositions[i * 3] = (Math.random() - 0.5) * 26;
      this.hazePositions[i * 3 + 1] = 0.5 + Math.random() * 8.5;
      this.hazePositions[i * 3 + 2] = -54 + Math.random() * 64;
      this.hazeSeeds[i * 2] = Math.random() * Math.PI * 2;
      this.hazeSeeds[i * 2 + 1] = 0.5 + Math.random() * 0.9;
    }
    this.hazeGeo = new THREE.BufferGeometry();
    this.hazeGeo.setAttribute('position', new THREE.BufferAttribute(this.hazePositions, 3));
    this.hazeTex = createSoftRadialTexture(
      'rgba(254, 240, 138, 0.95)',
      'rgba(251, 191, 36, 0.45)',
      'rgba(245, 158, 11, 0)',
      64,
    );
    this.hazeMat = new THREE.PointsMaterial({
      size: 0.62,
      sizeAttenuation: true,
      map: this.hazeTex,
      color: 0xfde68a,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    this.hazePoints = new THREE.Points(this.hazeGeo, this.hazeMat);
    this.hazePoints.frustumCulled = false;
    this.hazePoints.visible = false;
    this.group.add(this.hazePoints);

    this.hazeGlowTex = createSoftRadialTexture(
      'rgba(254, 215, 130, 0.42)',
      'rgba(251, 146, 60, 0.16)',
      'rgba(251, 146, 60, 0)',
      128,
    );
    this.hazeGlowMat = new THREE.MeshBasicMaterial({
      map: this.hazeGlowTex,
      color: 0xfdba74,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    this.hazeGlowMesh = new THREE.Mesh(new THREE.PlaneGeometry(128, 62), this.hazeGlowMat);
    this.hazeGlowMesh.position.set(0, 14, -96);
    this.hazeGlowMesh.frustumCulled = false;
    this.hazeGlowMesh.visible = false;
    this.group.add(this.hazeGlowMesh);
  }

  public setWeather(condition: WeatherCondition, immediate = false, biome?: BiomeId): void {
    this.activeCondition = condition;
    if (immediate) {
      this.rainStrength = condition === 'light_rain' ? 1 : 0;
      this.mistStrength = condition === 'mist' ? 1 : 0;
      this.hazeStrength = condition === 'sunny_haze' ? 1 : 0;
      if (biome) {
        const bp = BIOME_WEATHER_PROFILES[biome];
        this.biomeFogCompression = bp.fogCompression;
        this.biomeFogTintBoost = bp.fogTintBoost;
        this.biomeRainSpeedMul = bp.rainSpeedMul;
        this.biomeRainDensityMul = bp.rainDensityMul;
        this.biomeMistScaleMul = bp.mistScaleMul;
        this.biomeHazeShimmerMul = bp.hazeShimmerMul;
      }
    }
  }

  public getWeather(): WeatherCondition {
    return this.activeCondition;
  }

  public getWeatherMetadata(): WeatherMetadata {
    return WEATHER_META[this.activeCondition];
  }

  public getSpeedIntensity(): number {
    return this.speedIntensity;
  }

  public getBiomeProfileSnapshot(): BiomeWeatherProfile {
    return {
      fogCompression: this.biomeFogCompression,
      fogTintBoost: this.biomeFogTintBoost,
      rainSpeedMul: this.biomeRainSpeedMul,
      rainDensityMul: this.biomeRainDensityMul,
      mistScaleMul: this.biomeMistScaleMul,
      hazeShimmerMul: this.biomeHazeShimmerMul,
    };
  }

  public update(
    dt: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    nightFactor: number,
    simTime: number,
    biome: BiomeId = 'canyon',
    speedMultiplier = 1.0,
  ): void {
    const targetRain = this.activeCondition === 'light_rain' ? 1 : 0;
    const targetMist = this.activeCondition === 'mist' ? 1 : 0;
    const targetHaze = this.activeCondition === 'sunny_haze' ? 1 : 0;

    this.rainStrength = THREE.MathUtils.damp(this.rainStrength, targetRain, 1.9, dt);
    this.mistStrength = THREE.MathUtils.damp(this.mistStrength, targetMist, 1.7, dt);
    this.hazeStrength = THREE.MathUtils.damp(this.hazeStrength, targetHaze, 1.7, dt);

    const bp = BIOME_WEATHER_PROFILES[biome];
    this.biomeFogCompression = THREE.MathUtils.damp(this.biomeFogCompression, bp.fogCompression, 1.8, dt);
    this.biomeFogTintBoost = THREE.MathUtils.damp(this.biomeFogTintBoost, bp.fogTintBoost, 1.8, dt);
    this.biomeRainSpeedMul = THREE.MathUtils.damp(this.biomeRainSpeedMul, bp.rainSpeedMul, 1.8, dt);
    this.biomeRainDensityMul = THREE.MathUtils.damp(this.biomeRainDensityMul, bp.rainDensityMul, 1.8, dt);
    this.biomeMistScaleMul = THREE.MathUtils.damp(this.biomeMistScaleMul, bp.mistScaleMul, 1.8, dt);
    this.biomeHazeShimmerMul = THREE.MathUtils.damp(this.biomeHazeShimmerMul, bp.hazeShimmerMul, 1.8, dt);

    const targetSpeedIntensity = THREE.MathUtils.clamp((speedMultiplier - 1.0) / 2.0, 0, 1.35);
    this.speedIntensity = THREE.MathUtils.damp(this.speedIntensity, targetSpeedIntensity, 4.2, dt);
    const s = this.speedIntensity;

    // 1. Update Light Rain Streaks & Ground Splashes (scaled by biome & velocity)
    if (this.rainStrength > 0.015) {
      this.rainLines.visible = true;
      this.splashPoints.visible = true;
      const rainSpeedFactor = this.biomeRainSpeedMul * (1 + s * 0.48);
      const rainDensityFactor = this.biomeRainDensityMul;
      const windTiltX = 0.09 + s * 0.09 * rainDensityFactor;
      const windTiltZ = 0.04 + s * (0.28 + 0.16 * this.biomeRainSpeedMul);
      const streakStretch = 1 + s * 0.56 * this.biomeRainSpeedMul;

      this.rainMat.opacity = Math.min(
        0.74,
        this.rainStrength * rainDensityFactor * (0.44 + s * 0.18 - nightFactor * 0.06),
      );
      this.splashMat.opacity = Math.min(
        0.65,
        this.rainStrength * rainDensityFactor * (0.4 + s * 0.16),
      );
      this.splashMat.size = 0.55 + s * 0.12 * rainDensityFactor;

      const xMin = playerX - 15;
      const xMax = playerX + 15;
      const yMin = playerY - 0.8;
      const yMax = playerY + 14.2;
      const zMin = playerZ - 46;
      const zMax = playerZ + 10;

      const posAttr = this.rainGeo.attributes.position as THREE.BufferAttribute;
      const arr = this.rainPositions;

      for (let i = 0; i < RAIN_COUNT; i++) {
        const idx = i * 6;
        const speed = this.rainSpeeds[i] * rainSpeedFactor;
        const len = this.rainLengths[i] * streakStretch;

        let x = arr[idx] - dt * (1.9 + s * 1.4) * rainDensityFactor;
        let y = arr[idx + 1] - speed * dt;
        let z = arr[idx + 2] + dt * s * 6.5 * this.biomeRainSpeedMul;

        if (y < yMin) {
          y = yMax - Math.random() * 2.5;
          x = xMin + Math.random() * 30;
          z = zMin + Math.random() * 56;
        }
        if (x < xMin) x += 30;
        if (x > xMax) x -= 30;
        if (z > zMax) z -= 56;
        if (z < zMin) z += 56;

        arr[idx] = x;
        arr[idx + 1] = y;
        arr[idx + 2] = z;
        arr[idx + 3] = x + windTiltX;
        arr[idx + 4] = y + len;
        arr[idx + 5] = z + windTiltZ;
      }
      posAttr.needsUpdate = true;

      // Update ground rain splashes
      const splashAttr = this.splashGeo.attributes.position as THREE.BufferAttribute;
      const sArr = this.splashPositions;
      const splashRate = 3.4 * (1 + s * 0.42 * this.biomeRainSpeedMul);
      for (let i = 0; i < SPLASH_COUNT; i++) {
        this.splashPhases[i] += dt * splashRate;
        if (this.splashPhases[i] >= 1) {
          this.splashPhases[i] -= 1;
          sArr[i * 3] = playerX + (Math.random() - 0.5) * 18;
          sArr[i * 3 + 1] = Math.max(0.05, playerY * 0.15 + 0.05);
          sArr[i * 3 + 2] = playerZ - 36 + Math.random() * 42;
        } else if (sArr[i * 3 + 2] > playerZ + 8) {
          sArr[i * 3 + 2] -= 44;
        }
      }
      splashAttr.needsUpdate = true;
    } else {
      this.rainLines.visible = false;
      this.splashPoints.visible = false;
    }

    // 2. Update Drifting Mist Wisps (scaled by biome humidity & forward velocity rush)
    if (this.mistStrength > 0.015) {
      this.mistPoints.visible = true;
      const mistMul = this.biomeMistScaleMul;
      this.mistMat.size = 7.4 * (0.88 + 0.14 * mistMul + s * 0.16);
      this.mistMat.opacity = Math.min(
        0.4,
        this.mistStrength * mistMul * (nightFactor > 0.5 ? 0.19 : 0.27) * (1 + s * 0.24),
      );
      this.mistMat.color.setHex(nightFactor > 0.5 ? 0x64748b : 0xe2e8f0);

      const mAttr = this.mistGeo.attributes.position as THREE.BufferAttribute;
      const mArr = this.mistPositions;
      const xMin = playerX - 17;
      const xMax = playerX + 17;
      const zMin = playerZ - 68;
      const zMax = playerZ + 12;
      const mistDriftSpeed = 1 + s * 0.45 * mistMul;

      for (let i = 0; i < MIST_COUNT; i++) {
        const seed = this.mistDriftSeeds[i * 2];
        const driftRate = this.mistDriftSeeds[i * 2 + 1];
        let x =
          mArr[i * 3] +
          Math.sin(simTime * 0.45 + seed) * dt * 1.15 * driftRate * mistDriftSpeed;
        const y = mArr[i * 3 + 1] + Math.cos(simTime * 0.6 + seed) * dt * 0.18;
        let z = mArr[i * 3 + 2] + dt * s * 3.8 * mistMul;

        if (x < xMin) x += 34;
        if (x > xMax) x -= 34;
        if (z > zMax) {
          z = zMin + Math.random() * 14;
          x = xMin + Math.random() * 34;
        } else if (z < zMin) {
          z += 80;
        }

        mArr[i * 3] = x;
        mArr[i * 3 + 1] = THREE.MathUtils.clamp(y, 0.5, 5.2);
        mArr[i * 3 + 2] = z;
      }
      mAttr.needsUpdate = true;
    } else {
      this.mistPoints.visible = false;
    }

    // 3. Update Sunny Haze Golden Motes & Warm Horizon Glow (intensified in Androon canyon & at speed)
    if (this.hazeStrength > 0.015) {
      this.hazePoints.visible = true;
      this.hazeGlowMesh.visible = true;
      const hazeMul = this.biomeHazeShimmerMul;
      const sunWarmth = THREE.MathUtils.lerp(1.0, 0.42, nightFactor);
      this.hazeMat.size = 0.62 * (0.9 + 0.18 * hazeMul + s * 0.16);
      this.hazeMat.opacity = Math.min(
        0.95,
        this.hazeStrength * hazeMul * (0.64 + s * 0.24) * sunWarmth,
      );
      this.hazeGlowMat.opacity = Math.min(
        0.7,
        this.hazeStrength * hazeMul * (0.42 + s * 0.2) * sunWarmth,
      );
      this.hazeGlowMesh.scale.set(
        1 + s * 0.14 * hazeMul,
        1 + s * 0.1 * hazeMul,
        1,
      );
      this.hazeGlowMesh.position.set(playerX * 0.4, 15, playerZ - 94);

      const hAttr = this.hazeGeo.attributes.position as THREE.BufferAttribute;
      const hArr = this.hazePositions;
      const xMin = playerX - 13;
      const xMax = playerX + 13;
      const zMin = playerZ - 54;
      const zMax = playerZ + 10;
      const moteMotionScale = 1 + s * 0.52 * hazeMul;

      for (let i = 0; i < HAZE_MOTE_COUNT; i++) {
        const seed = this.hazeSeeds[i * 2];
        const speedMul = this.hazeSeeds[i * 2 + 1];
        let x =
          hArr[i * 3] +
          Math.sin(simTime * 0.8 + seed) * dt * 0.65 * speedMul * moteMotionScale;
        let y =
          hArr[i * 3 + 1] +
          (0.25 + Math.cos(simTime * 0.7 + seed) * 0.2) * dt * moteMotionScale;
        let z = hArr[i * 3 + 2] + dt * s * 2.2 * hazeMul;

        if (x < xMin) x += 26;
        if (x > xMax) x -= 26;
        if (y > playerY + 9.5) y = playerY + 0.4;
        if (y < playerY + 0.2) y = playerY + 8.5;
        if (z > zMax) z -= 64;
        if (z < zMin) z += 64;

        hArr[i * 3] = x;
        hArr[i * 3 + 1] = y;
        hArr[i * 3 + 2] = z;
      }
      hAttr.needsUpdate = true;
    } else {
      this.hazePoints.visible = false;
      this.hazeGlowMesh.visible = false;
    }
  }

  public getLightingModifiers(nightFactor: number, out: WeatherLightingModifiers): void {
    const clearWeight = Math.max(
      0,
      1 - this.rainStrength - this.mistStrength - this.hazeStrength,
    );

    const baseFogNear =
      clearWeight * 42 +
      this.rainStrength * 27 +
      this.mistStrength * 18 +
      this.hazeStrength * 32;
    const baseFogFar =
      clearWeight * 138 +
      this.rainStrength * 98 +
      this.mistStrength * 82 +
      this.hazeStrength * 116;

    // Biome + speed dynamically compress fog slightly for richer regional atmosphere while preserving obstacle readability
    const biomeCompress = 1 + (this.biomeFogCompression - 1) * 0.65;
    const speedCompress = 1 + this.speedIntensity * (0.14 * this.biomeFogCompression);
    const totalFogScale = 1 / Math.max(0.85, biomeCompress * speedCompress);

    out.fogNear = Math.max(13.5, baseFogNear * totalFogScale);
    out.fogFar = Math.max(out.fogNear + 44, baseFogFar * totalFogScale);

    // Combined sky/fog atmospheric tint
    out.skyTint.setRGB(0, 0, 0);
    out.fogTint.setRGB(0, 0, 0);
    let totalTint = 0;

    if (this.rainStrength > 0.005) {
      _tmpSkyTint.copy(_dayRainSky).lerp(_nightRainSky, nightFactor);
      _tmpFogTint.copy(_dayRainFog).lerp(_nightRainFog, nightFactor);
      const w = this.rainStrength * 0.46;
      out.skyTint.r += _tmpSkyTint.r * w;
      out.skyTint.g += _tmpSkyTint.g * w;
      out.skyTint.b += _tmpSkyTint.b * w;
      out.fogTint.r += _tmpFogTint.r * w;
      out.fogTint.g += _tmpFogTint.g * w;
      out.fogTint.b += _tmpFogTint.b * w;
      totalTint += w;
    }
    if (this.mistStrength > 0.005) {
      _tmpSkyTint.copy(_dayMistSky).lerp(_nightMistSky, nightFactor);
      _tmpFogTint.copy(_dayMistFog).lerp(_nightMistFog, nightFactor);
      const w = this.mistStrength * 0.52;
      out.skyTint.r += _tmpSkyTint.r * w;
      out.skyTint.g += _tmpSkyTint.g * w;
      out.skyTint.b += _tmpSkyTint.b * w;
      out.fogTint.r += _tmpFogTint.r * w;
      out.fogTint.g += _tmpFogTint.g * w;
      out.fogTint.b += _tmpFogTint.b * w;
      totalTint += w;
    }
    if (this.hazeStrength > 0.005) {
      _tmpSkyTint.copy(_dayHazeSky).lerp(_nightHazeSky, nightFactor);
      _tmpFogTint.copy(_dayHazeFog).lerp(_nightHazeFog, nightFactor);
      const w = this.hazeStrength * 0.42;
      out.skyTint.r += _tmpSkyTint.r * w;
      out.skyTint.g += _tmpSkyTint.g * w;
      out.skyTint.b += _tmpSkyTint.b * w;
      out.fogTint.r += _tmpFogTint.r * w;
      out.fogTint.g += _tmpFogTint.g * w;
      out.fogTint.b += _tmpFogTint.b * w;
      totalTint += w;
    }

    if (totalTint > 0.001) {
      out.skyTint.multiplyScalar(1 / totalTint);
      out.fogTint.multiplyScalar(1 / totalTint);
    }
    const tintScale = this.biomeFogTintBoost * (1 + this.speedIntensity * 0.14);
    out.skyTintWeight = Math.min(0.72, totalTint * tintScale);
    out.fogTintWeight = Math.min(0.82, totalTint * 1.15 * tintScale);

    out.sunIntensityMul =
      clearWeight * 1.0 +
      this.rainStrength * 0.78 +
      this.mistStrength * 0.84 +
      this.hazeStrength * (1.12 + 0.06 * (this.biomeHazeShimmerMul - 1));
    out.hemiIntensityMul =
      clearWeight * 1.0 +
      this.rainStrength * 0.94 +
      this.mistStrength * 1.05 +
      this.hazeStrength * 1.04;
    out.exposureOffset =
      this.rainStrength * -0.05 +
      this.mistStrength * -0.02 +
      this.hazeStrength * (0.07 * Math.min(1.35, this.biomeHazeShimmerMul));
  }

  public dispose(): void {
    this.rainGeo.dispose();
    this.rainMat.dispose();
    this.splashGeo.dispose();
    this.splashMat.dispose();
    this.splashTex.dispose();
    this.mistGeo.dispose();
    this.mistMat.dispose();
    this.mistTex.dispose();
    this.hazeGeo.dispose();
    this.hazeMat.dispose();
    this.hazeTex.dispose();
    this.hazeGlowMesh.geometry.dispose();
    this.hazeGlowMat.dispose();
    this.hazeGlowTex.dispose();
  }
}
