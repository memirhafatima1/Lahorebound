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
    tagline: 'Alpine Explorer',
    costGems: 0,
    milestoneMeters: 0,
    primaryColor: 0xe85d44,
    secondaryColor: 0xf4efe6,
    accentColor: 0x2a3647,
    visorColor: 0xffb830,
    metalness: 0.12,
    roughness: 0.58,
    emissiveIntensity: 0.45,
    accessory: 'pack',
    swatchHex: '#e85d44',
    accentHex: '#ffb830',
  },
  {
    id: 'glacier',
    name: 'Glacier Scout',
    tagline: 'Cryo Ridge Runner',
    costGems: 40,
    milestoneMeters: 220,
    primaryColor: 0x38bdf8,
    secondaryColor: 0xeaf6ff,
    accentColor: 0x1e3a5f,
    visorColor: 0x7df9ff,
    metalness: 0.35,
    roughness: 0.32,
    emissiveIntensity: 0.7,
    accessory: 'crest',
    swatchHex: '#38bdf8',
    accentHex: '#7df9ff',
  },
  {
    id: 'solar',
    name: 'Solar Flare',
    tagline: 'Sunforged Sprinter',
    costGems: 95,
    milestoneMeters: 450,
    primaryColor: 0xf59e0b,
    secondaryColor: 0x262936,
    accentColor: 0xfde68a,
    visorColor: 0xff5a1f,
    metalness: 0.82,
    roughness: 0.24,
    emissiveIntensity: 0.8,
    accessory: 'fins',
    swatchHex: '#f59e0b',
    accentHex: '#fde68a',
  },
  {
    id: 'warden',
    name: 'Moss Warden',
    tagline: 'Canopy Ranger',
    costGems: 160,
    milestoneMeters: 750,
    primaryColor: 0x10b981,
    secondaryColor: 0x5c4033,
    accentColor: 0xa7f3d0,
    visorColor: 0xd9f99d,
    metalness: 0.15,
    roughness: 0.65,
    emissiveIntensity: 0.6,
    accessory: 'hood',
    swatchHex: '#10b981',
    accentHex: '#d9f99d',
  },
  {
    id: 'neon',
    name: 'Neon Striker',
    tagline: 'Velocity Phantom',
    costGems: 260,
    milestoneMeters: 1100,
    primaryColor: 0x231942,
    secondaryColor: 0xec4899,
    accentColor: 0x22d3ee,
    visorColor: 0xf43f5e,
    metalness: 0.65,
    roughness: 0.25,
    emissiveIntensity: 1.05,
    accessory: 'wings',
    swatchHex: '#ec4899',
    accentHex: '#22d3ee',
  },
  {
    id: 'aether',
    name: 'Aether Knight',
    tagline: 'Celestial Vanguard',
    costGems: 400,
    milestoneMeters: 1550,
    primaryColor: 0xf8fafc,
    secondaryColor: 0x7c3aed,
    accentColor: 0xfbbf24,
    visorColor: 0x67e8f9,
    metalness: 0.9,
    roughness: 0.18,
    emissiveIntensity: 1.15,
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
  secondaryColor: 0xfef3c7,
  accentColor: 0x06b6d4,
  visorColor: 0xfacc15,
  metalness: 0.42,
  roughness: 0.28,
  emissiveIntensity: 1.0,
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
      valid.push({
        id: entry.id,
        score: Math.max(0, Math.floor(entry.score)),
        distance: Math.max(0, Math.floor(entry.distance)),
        skinId: typeof entry.skinId === 'string' ? entry.skinId : 'trailblazer',
        recordedAt: typeof entry.recordedAt === 'string' ? entry.recordedAt : new Date().toISOString(),
      });
    }
  }
  return valid
    .sort((a, b) => b.score - a.score || b.distance - a.distance)
    .slice(0, 5);
}

export function recordLeaderboardRun(
  existing: LeaderboardEntry[],
  candidate: LeaderboardEntry,
): { leaderboard: LeaderboardEntry[]; rank: number | null } {
  if (candidate.score <= 0 && candidate.distance <= 0) {
    return { leaderboard: existing.slice(0, 5), rank: null };
  }
  const combined = [...existing, candidate]
    .sort((a, b) => b.score - a.score || b.distance - a.distance)
    .slice(0, 5);
  const idx = combined.findIndex((e) => e.id === candidate.id);
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
    };
  } catch {
    return createDefaultSave();
  }
}

export function persistSaveData(data: SaveData): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota / privacy mode errors
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
