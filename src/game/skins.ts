import { normalizeDailyLogin } from './dailyLogin';
import { LAHORE_TRACK_STOPS } from './lahoreJourney';
import { normalizeLuckyWheel, normalizePendingSpeedBoost } from './luckyWheel';
import {
  advanceDailyStreakOnMissionComplete,
  normalizeDailyMissionState,
  normalizeDailyStreak,
  syncMissionArchive,
} from './missions';
import { normalizeDailyRunObjectiveState } from './dailyRunObjective';
import {
  PROFILE_BADGES,
  SKIN_COSMETICS,
  normalizeWeeklyChallengeState,
} from './weeklyChallenges';
import type {
  CharacterSkin,
  GlobalEventMode,
  LahoreLandmarkKind,
  LeaderboardEntry,
  LightingMode,
  ProfileBadgeId,
  RadioStationId,
  SaveData,
  SkinCosmeticId,
} from './types';

export const CHARACTER_SKINS: CharacterSkin[] = [
  {
    id: 'trailblazer',
    name: 'Trailblazer',
    tagline: 'Lahore Parkour Kid',
    costGems: 0,
    milestoneMeters: 0,
    primaryColor: 0xe85d44,
    secondaryColor: 0x1e293b,
    accentColor: 0xf59e0b,
    visorColor: 0x38bdf8,
    skinTone: 0xd99b72,
    hairColor: 0x1b1512,
    eyeColor: 0x3f2414,
    metalness: 0.14,
    roughness: 0.56,
    emissiveIntensity: 0.55,
    accessory: 'pack',
    swatchHex: '#e85d44',
    accentHex: '#38bdf8',
  },
  {
    id: 'basant',
    name: 'Basant Flyer',
    tagline: 'Rooftop Kite Acrobat',
    costGems: 25,
    milestoneMeters: 140,
    primaryColor: 0xf59e0b,
    secondaryColor: 0x0f766e,
    accentColor: 0xfef3c7,
    visorColor: 0x22d3ee,
    skinTone: 0xd29268,
    hairColor: 0x221712,
    eyeColor: 0x452715,
    metalness: 0.18,
    roughness: 0.48,
    emissiveIntensity: 0.65,
    accessory: 'basant',
    swatchHex: '#f59e0b',
    accentHex: '#22d3ee',
  },
  {
    id: 'glacier',
    name: 'Glacier Scout',
    tagline: 'Cryo Ridge Runner',
    costGems: 55,
    milestoneMeters: 260,
    primaryColor: 0x38bdf8,
    secondaryColor: 0x0f2744,
    accentColor: 0xeaf6ff,
    visorColor: 0x7df9ff,
    skinTone: 0xe4b596,
    hairColor: 0xdbeafe,
    eyeColor: 0x0ea5e9,
    metalness: 0.42,
    roughness: 0.30,
    emissiveIntensity: 0.80,
    accessory: 'crest',
    swatchHex: '#38bdf8',
    accentHex: '#7df9ff',
  },
  {
    id: 'shahi',
    name: 'Shahi Falconer',
    tagline: 'Badshahi Royal Courier',
    costGems: 85,
    milestoneMeters: 420,
    primaryColor: 0x065f46,
    secondaryColor: 0x881337,
    accentColor: 0xfbbf24,
    visorColor: 0x34d399,
    skinTone: 0xc9885c,
    hairColor: 0x171210,
    eyeColor: 0x2b190e,
    metalness: 0.38,
    roughness: 0.40,
    emissiveIntensity: 0.72,
    accessory: 'shahi',
    swatchHex: '#059669',
    accentHex: '#fbbf24',
  },
  {
    id: 'solar',
    name: 'Solar Flare',
    tagline: 'Sunforged Rocketeer',
    costGems: 120,
    milestoneMeters: 600,
    primaryColor: 0xf59e0b,
    secondaryColor: 0x1e2230,
    accentColor: 0xfef08a,
    visorColor: 0xff5a1f,
    skinTone: 0xd99b72,
    hairColor: 0x291811,
    eyeColor: 0xd97706,
    metalness: 0.80,
    roughness: 0.24,
    emissiveIntensity: 0.90,
    accessory: 'fins',
    swatchHex: '#f59e0b',
    accentHex: '#ff5a1f',
  },
  {
    id: 'warden',
    name: 'Moss Warden',
    tagline: 'Shalimar Canopy Ranger',
    costGems: 170,
    milestoneMeters: 820,
    primaryColor: 0x10b981,
    secondaryColor: 0x3b2a22,
    accentColor: 0xa7f3d0,
    visorColor: 0xd9f99d,
    skinTone: 0xcf916a,
    hairColor: 0x241b16,
    eyeColor: 0x15803d,
    metalness: 0.16,
    roughness: 0.60,
    emissiveIntensity: 0.65,
    accessory: 'hood',
    swatchHex: '#10b981',
    accentHex: '#d9f99d',
  },
  {
    id: 'qawwal',
    name: 'Cyber Qawwal',
    tagline: 'Neon Beats Virtuoso',
    costGems: 230,
    milestoneMeters: 1050,
    primaryColor: 0x312e81,
    secondaryColor: 0x1e1b4b,
    accentColor: 0xfbbf24,
    visorColor: 0xec4899,
    skinTone: 0xc8875b,
    hairColor: 0x141118,
    eyeColor: 0x4c1d95,
    metalness: 0.56,
    roughness: 0.28,
    emissiveIntensity: 1.0,
    accessory: 'qawwal',
    swatchHex: '#4f46e5',
    accentHex: '#ec4899',
  },
  {
    id: 'neon',
    name: 'Neon Striker',
    tagline: 'Velocity Phantom',
    costGems: 300,
    milestoneMeters: 1300,
    primaryColor: 0x1e1438,
    secondaryColor: 0x0f172a,
    accentColor: 0x22d3ee,
    visorColor: 0xf43f5e,
    skinTone: 0xdfb192,
    hairColor: 0x0f172a,
    eyeColor: 0xf43f5e,
    metalness: 0.68,
    roughness: 0.24,
    emissiveIntensity: 1.1,
    accessory: 'wings',
    swatchHex: '#ec4899',
    accentHex: '#22d3ee',
  },
  {
    id: 'stormrider',
    name: 'Ravi Stormrider',
    tagline: 'Monsoon Thunder Vanguard',
    costGems: 380,
    milestoneMeters: 1600,
    primaryColor: 0x0284c7,
    secondaryColor: 0x0f172a,
    accentColor: 0xfacc15,
    visorColor: 0x38bdf8,
    skinTone: 0xd4966e,
    hairColor: 0xe2e8f0,
    eyeColor: 0x0284c7,
    metalness: 0.62,
    roughness: 0.26,
    emissiveIntensity: 1.05,
    accessory: 'stormrider',
    swatchHex: '#0284c7',
    accentHex: '#facc15',
  },
  {
    id: 'aether',
    name: 'Aether Knight',
    tagline: 'Celestial Vanguard',
    costGems: 500,
    milestoneMeters: 2000,
    primaryColor: 0xf8fafc,
    secondaryColor: 0x5b21b6,
    accentColor: 0xfbbf24,
    visorColor: 0x67e8f9,
    skinTone: 0xe2b393,
    hairColor: 0xfef3c7,
    eyeColor: 0x06b6d4,
    metalness: 0.88,
    roughness: 0.18,
    emissiveIntensity: 1.18,
    accessory: 'halo',
    swatchHex: '#7c3aed',
    accentHex: '#fbbf24',
  },
];

export const CARNIVAL_RUNNER_SKIN: CharacterSkin = {
  id: 'carnival',
  name: 'Carnival Runner',
  tagline: 'Street Festival Herald',
  costGems: 0,
  milestoneMeters: 0,
  primaryColor: 0xdb2777,
  secondaryColor: 0x1e1b4b,
  accentColor: 0x06b6d4,
  visorColor: 0xfacc15,
  skinTone: 0xd4966e,
  hairColor: 0x1c1412,
  eyeColor: 0x3b2214,
  metalness: 0.44,
  roughness: 0.28,
  emissiveIntensity: 1.05,
  accessory: 'carnival',
  swatchHex: '#ec4899',
  accentHex: '#22d3ee',
  eventExclusive: 'street_carnival',
};

const STORAGE_KEY = 'skybound_stride_save_v1';

function normalizeLeaderboard(raw: unknown): LeaderboardEntry[] {
  if (!Array.isArray(raw)) return [];
  const valid: LeaderboardEntry[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as LeaderboardEntry).id === 'string' &&
      typeof (item as LeaderboardEntry).score === 'number' &&
      typeof (item as LeaderboardEntry).distance === 'number'
    ) {
      const entry = item as LeaderboardEntry;
      const diff =
        entry.difficulty === 'zen' || entry.difficulty === 'normal' || entry.difficulty === 'turbo'
          ? entry.difficulty
          : 'normal';
      valid.push({
        id: entry.id,
        difficulty: diff,
        score: Math.max(0, Math.floor(entry.score)),
        distance: Math.max(0, Math.floor(entry.distance)),
        skinId: typeof entry.skinId === 'string' ? entry.skinId : 'trailblazer',
        peakSpeedMultiplier:
          typeof entry.peakSpeedMultiplier === 'number' ? entry.peakSpeedMultiplier : undefined,
        landmarkReachedName:
          typeof entry.landmarkReachedName === 'string' ? entry.landmarkReachedName : undefined,
        recordedAt: typeof entry.recordedAt === 'string' ? entry.recordedAt : new Date().toISOString(),
      });
    }
  }
  const byDifficulty: Record<'zen' | 'normal' | 'turbo', LeaderboardEntry[]> = {
    zen: [],
    normal: [],
    turbo: [],
  };
  for (const e of valid) {
    byDifficulty[e.difficulty ?? 'normal'].push(e);
  }
  return (['zen', 'normal', 'turbo'] as const)
    .flatMap((d) =>
      byDifficulty[d]
        .sort((a, b) => b.score - a.score || b.distance - a.distance)
        .slice(0, 5),
    )
    .sort((a, b) => b.score - a.score || b.distance - a.distance);
}

export function recordLeaderboardRun(
  existing: LeaderboardEntry[],
  candidate: LeaderboardEntry,
): { leaderboard: LeaderboardEntry[]; rank: number | null } {
  const targetDiff = candidate.difficulty ?? 'normal';
  const sameDiffExisting = existing.filter((e) => (e.difficulty ?? 'normal') === targetDiff);
  const otherDiffExisting = existing.filter((e) => (e.difficulty ?? 'normal') !== targetDiff);

  if (candidate.score <= 0 && candidate.distance <= 0) {
    return { leaderboard: existing, rank: null };
  }
  const updatedSameDiff = [...sameDiffExisting, { ...candidate, difficulty: targetDiff }]
    .sort((a, b) => b.score - a.score || b.distance - a.distance)
    .slice(0, 5);
  const idx = updatedSameDiff.findIndex((e) => e.id === candidate.id);
  const combined = [...updatedSameDiff, ...otherDiffExisting].sort(
    (a, b) => b.score - a.score || b.distance - a.distance,
  );
  return {
    leaderboard: combined,
    rank: idx >= 0 ? idx + 1 : null,
  };
}

function createDefaultSave(): SaveData {
  const dailyMissions = normalizeDailyMissionState(undefined);
  return {
    totalGems: 0,
    bestDistance: 0,
    bestScore: 0,
    unlockedSkinIds: ['trailblazer'],
    selectedSkinId: 'trailblazer',
    difficulty: 'normal',
    muted: false,
    radioStation: 'auto',
    lightingMode: 'auto',
    eventMode: 'auto',
    ambientWeatherOverlay: true,
    hapticsEnabled: true,
    showTouchButtons: true,
    debugFootIk: false,
    dailyMissions,
    dailyRunObjective: normalizeDailyRunObjectiveState(undefined),
    missionArchive: syncMissionArchive([], dailyMissions),
    weeklyChallenges: normalizeWeeklyChallengeState(undefined),
    unlockedBadgeIds: [],
    equippedBadgeId: null,
    unlockedCosmeticIds: [],
    equippedCosmeticId: null,
    unlockedLandmarkIds: [],
    dailyStreak: { count: 0, lastCompletedDateKey: null },
    dailyLogin: { lastClaimedDateKey: null, consecutiveDays: 0 },
    luckyWheel: normalizeLuckyWheel(undefined),
    pendingSpeedBoost: null,
    leaderboard: [],
    runnerHandle: null,
  };
}

export function loadSaveData(): SaveData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const unlocked = Array.isArray(parsed.unlockedSkinIds)
      ? Array.from(new Set(['trailblazer', ...parsed.unlockedSkinIds]))
      : ['trailblazer'];
    const selected =
      typeof parsed.selectedSkinId === 'string' &&
      (unlocked.includes(parsed.selectedSkinId) ||
        parsed.selectedSkinId === CARNIVAL_RUNNER_SKIN.id)
        ? parsed.selectedSkinId
        : 'trailblazer';
    const difficulty =
      parsed.difficulty === 'zen' || parsed.difficulty === 'normal' || parsed.difficulty === 'turbo'
        ? parsed.difficulty
        : 'normal';
    const archiveWithPrev = syncMissionArchive(parsed.missionArchive, parsed.dailyMissions);
    const dailyMissions = normalizeDailyMissionState(parsed.dailyMissions);
    const dailyRunObjective = normalizeDailyRunObjectiveState(parsed.dailyRunObjective);
    const missionArchive = syncMissionArchive(archiveWithPrev, dailyMissions);
    const normalizedStreak = normalizeDailyStreak(parsed.dailyStreak);
    const dailyStreak = advanceDailyStreakOnMissionComplete(
      normalizedStreak,
      dailyMissions.missions,
    );
    const dailyLogin = normalizeDailyLogin(parsed.dailyLogin);
    const weeklyChallenges = normalizeWeeklyChallengeState(parsed.weeklyChallenges);
    const validBadgeIds = new Set(PROFILE_BADGES.map((b) => b.id));
    const unlockedBadgeIds: ProfileBadgeId[] = Array.isArray(parsed.unlockedBadgeIds)
      ? Array.from(
          new Set(
            parsed.unlockedBadgeIds.filter((id): id is ProfileBadgeId =>
              validBadgeIds.has(id as ProfileBadgeId),
            ),
          ),
        )
      : [];
    const equippedBadgeId =
      typeof parsed.equippedBadgeId === 'string' &&
      unlockedBadgeIds.includes(parsed.equippedBadgeId as ProfileBadgeId)
        ? (parsed.equippedBadgeId as ProfileBadgeId)
        : null;

    const validCosmeticIds = new Set(SKIN_COSMETICS.map((c) => c.id));
    const unlockedCosmeticIds: SkinCosmeticId[] = Array.isArray(parsed.unlockedCosmeticIds)
      ? Array.from(
          new Set(
            parsed.unlockedCosmeticIds.filter((id): id is SkinCosmeticId =>
              validCosmeticIds.has(id as SkinCosmeticId),
            ),
          ),
        )
      : [];
    const equippedCosmeticId =
      typeof parsed.equippedCosmeticId === 'string' &&
      unlockedCosmeticIds.includes(parsed.equippedCosmeticId as SkinCosmeticId)
        ? (parsed.equippedCosmeticId as SkinCosmeticId)
        : null;

    const validLandmarkIds = new Set(LAHORE_TRACK_STOPS.map((s) => s.landmark));
    const unlockedLandmarkIds: LahoreLandmarkKind[] = Array.isArray(parsed.unlockedLandmarkIds)
      ? Array.from(
          new Set(
            parsed.unlockedLandmarkIds.filter((id): id is LahoreLandmarkKind =>
              validLandmarkIds.has(id as LahoreLandmarkKind),
            ),
          ),
        )
      : [];

    const radioStation: RadioStationId =
      parsed.radioStation === 'auto' ||
      parsed.radioStation === 'sufi_soul' ||
      parsed.radioStation === 'lahore_pop' ||
      parsed.radioStation === 'historical_instrumental'
        ? parsed.radioStation
        : 'auto';

    const lightingMode: LightingMode =
      parsed.lightingMode === 'auto' ||
      parsed.lightingMode === 'dawn' ||
      parsed.lightingMode === 'day' ||
      parsed.lightingMode === 'sunset' ||
      parsed.lightingMode === 'night'
        ? parsed.lightingMode
        : 'auto';

    const eventMode: GlobalEventMode =
      parsed.eventMode === 'auto' ||
      parsed.eventMode === 'carnival' ||
      parsed.eventMode === 'off'
        ? parsed.eventMode
        : 'auto';

    return {
      totalGems: typeof parsed.totalGems === 'number' && parsed.totalGems >= 0 ? Math.floor(parsed.totalGems) : 0,
      bestDistance: typeof parsed.bestDistance === 'number' && parsed.bestDistance >= 0 ? Math.floor(parsed.bestDistance) : 0,
      bestScore: typeof parsed.bestScore === 'number' && parsed.bestScore >= 0 ? Math.floor(parsed.bestScore) : 0,
      unlockedSkinIds: unlocked,
      selectedSkinId: selected,
      difficulty,
      muted: Boolean(parsed.muted),
      radioStation,
      lightingMode,
      eventMode,
      ambientWeatherOverlay:
        parsed.ambientWeatherOverlay !== undefined ? Boolean(parsed.ambientWeatherOverlay) : true,
      hapticsEnabled: parsed.hapticsEnabled !== undefined ? Boolean(parsed.hapticsEnabled) : true,
      showTouchButtons: parsed.showTouchButtons !== undefined ? Boolean(parsed.showTouchButtons) : true,
      debugFootIk: Boolean(parsed.debugFootIk),
      dailyMissions,
      dailyRunObjective,
      missionArchive,
      weeklyChallenges,
      unlockedBadgeIds,
      equippedBadgeId,
      unlockedCosmeticIds,
      equippedCosmeticId,
      unlockedLandmarkIds,
      dailyStreak,
      dailyLogin,
      luckyWheel: normalizeLuckyWheel(parsed.luckyWheel),
      pendingSpeedBoost: normalizePendingSpeedBoost(parsed.pendingSpeedBoost),
      leaderboard: normalizeLeaderboard(parsed.leaderboard),
      runnerHandle:
        typeof parsed.runnerHandle === 'string' && parsed.runnerHandle.length >= 3
          ? parsed.runnerHandle.slice(0, 18)
          : null,
    };
  } catch {
    return createDefaultSave();
  }
}

let pendingSaveTimer: number | null = null;
let pendingSaveData: SaveData | null = null;

function writeSaveToStorage(data: SaveData): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export function persistSaveData(data: SaveData): void {
  if (pendingSaveTimer !== null) {
    window.clearTimeout(pendingSaveTimer);
    pendingSaveTimer = null;
  }
  pendingSaveData = null;
  writeSaveToStorage(data);
}

export function schedulePersistSaveData(data: SaveData, delayMs = 2000): void {
  pendingSaveData = data;
  if (pendingSaveTimer !== null) return;
  pendingSaveTimer = window.setTimeout(() => {
    pendingSaveTimer = null;
    const latest = pendingSaveData;
    pendingSaveData = null;
    if (latest) {
      writeSaveToStorage(latest);
    }
  }, delayMs);
}

export function flushPendingSaveData(): void {
  if (pendingSaveTimer !== null) {
    window.clearTimeout(pendingSaveTimer);
    pendingSaveTimer = null;
  }
  if (pendingSaveData) {
    const latest = pendingSaveData;
    pendingSaveData = null;
    writeSaveToStorage(latest);
  }
}

export function getSkinById(id: string): CharacterSkin {
  if (id === CARNIVAL_RUNNER_SKIN.id) {
    return CARNIVAL_RUNNER_SKIN;
  }
  return CHARACTER_SKINS.find((s) => s.id === id) ?? CHARACTER_SKINS[0];
}

export function resolveActiveSkinId(
  selectedSkinId: string,
  unlockedSkinIds: string[],
  carnivalActive: boolean,
): string {
  if (selectedSkinId === CARNIVAL_RUNNER_SKIN.id) {
    return carnivalActive ? CARNIVAL_RUNNER_SKIN.id : unlockedSkinIds[0] ?? CHARACTER_SKINS[0].id;
  }
  return unlockedSkinIds.includes(selectedSkinId) ? selectedSkinId : CHARACTER_SKINS[0].id;
}
