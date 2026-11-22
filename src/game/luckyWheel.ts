import { getLocalDateKey } from './missions';
import { SKIN_COSMETICS } from './weeklyChallenges';
import type {
  LuckyWheelSlice,
  LuckyWheelState,
  SaveData,
  SkinCosmetic,
  TemporarySpeedBoostState,
} from './types';

export const LUCKY_WHEEL_SLICES: LuckyWheelSlice[] = [
  {
    id: 'gems_25',
    kind: 'gems',
    shortLabel: '+25 GEMS',
    title: 'Bazaar Gem Pouch',
    description: 'Adds 25 Gems directly to your vault.',
    gemsAmount: 25,
    weight: 22,
    colorHex: '#0284c7',
    textHex: '#f8fafc',
    accentHex: '#38bdf8',
  },
  {
    id: 'boost_nitro_12',
    kind: 'speed_boost',
    shortLabel: 'TURBO 12s',
    title: 'Rickshaw Nitro Boost',
    description: '+28% pace & score surge for the first 12s of your next run.',
    boostMultiplier: 1.28,
    boostSeconds: 12,
    weight: 16,
    colorHex: '#d97706',
    textHex: '#fffbeb',
    accentHex: '#fbbf24',
  },
  {
    id: 'gems_55',
    kind: 'gems',
    shortLabel: '+55 GEMS',
    title: 'Lahore Sapphire Cache',
    description: 'Adds 55 Gems directly to your vault.',
    gemsAmount: 55,
    weight: 15,
    colorHex: '#059669',
    textHex: '#ecfdf5',
    accentHex: '#34d399',
  },
  {
    id: 'cosmetic_box',
    kind: 'cosmetic',
    shortLabel: 'COSMETIC',
    title: 'Runner Cosmetic Drop',
    description: 'Unlocks an exclusive runner accessory (or +140 Gems if all owned).',
    gemsAmount: 140,
    weight: 12,
    colorHex: '#7c3aed',
    textHex: '#f5f3ff',
    accentHex: '#c084fc',
  },
  {
    id: 'gems_35',
    kind: 'gems',
    shortLabel: '+35 GEMS',
    title: 'Minar Crystal Stash',
    description: 'Adds 35 Gems directly to your vault.',
    gemsAmount: 35,
    weight: 18,
    colorHex: '#0f766e',
    textHex: '#f0fdfa',
    accentHex: '#2dd4bf',
  },
  {
    id: 'boost_hyper_18',
    kind: 'speed_boost',
    shortLabel: 'HYPER 18s',
    title: 'Hyper Stride Overdrive',
    description: '+38% blistering pace & bonus points for 18s on your next run.',
    boostMultiplier: 1.38,
    boostSeconds: 18,
    weight: 8,
    colorHex: '#e11d48',
    textHex: '#fff1f2',
    accentHex: '#fb7185',
  },
  {
    id: 'gems_120',
    kind: 'gems',
    shortLabel: '+120 GEMS',
    title: 'Shahi Jackpot Gems',
    description: 'Massive 120 Gem windfall added to your vault!',
    gemsAmount: 120,
    weight: 5,
    colorHex: '#b45309',
    textHex: '#fef3c7',
    accentHex: '#fde047',
  },
  {
    id: 'cosmetic_royal',
    kind: 'cosmetic',
    shortLabel: 'RARE GEAR',
    title: 'Royal Artisan Crate',
    description: 'Unlocks a rare runner cosmetic (or +175 Gems if all owned).',
    gemsAmount: 175,
    weight: 4,
    colorHex: '#be185d',
    textHex: '#fdf2f8',
    accentHex: '#f472b6',
  },
];

export interface LuckyWheelStatus {
  canSpinToday: boolean;
  totalSpins: number;
  lastRewardLabel: string | null;
}

export interface LuckyWheelOutcome {
  slice: LuckyWheelSlice;
  gemsAwarded: number;
  cosmeticUnlocked: SkinCosmetic | null;
  speedBoostGranted: TemporarySpeedBoostState | null;
  duplicateFallbackUsed: boolean;
  summaryText: string;
}

export function normalizeLuckyWheel(raw: Partial<LuckyWheelState> | undefined): LuckyWheelState {
  if (!raw || typeof raw !== 'object') {
    return {
      lastSpinDateKey: null,
      totalSpins: 0,
      lastRewardId: null,
      lastRewardLabel: null,
    };
  }
  return {
    lastSpinDateKey: typeof raw.lastSpinDateKey === 'string' ? raw.lastSpinDateKey : null,
    totalSpins:
      typeof raw.totalSpins === 'number' && Number.isFinite(raw.totalSpins) && raw.totalSpins >= 0
        ? Math.floor(raw.totalSpins)
        : 0,
    lastRewardId: typeof raw.lastRewardId === 'string' ? raw.lastRewardId : null,
    lastRewardLabel: typeof raw.lastRewardLabel === 'string' ? raw.lastRewardLabel : null,
  };
}

export function normalizePendingSpeedBoost(
  raw: Partial<TemporarySpeedBoostState> | null | undefined,
): TemporarySpeedBoostState | null {
  if (
    !raw ||
    typeof raw !== 'object' ||
    typeof raw.multiplier !== 'number' ||
    !Number.isFinite(raw.multiplier) ||
    raw.multiplier <= 1 ||
    typeof raw.durationSeconds !== 'number' ||
    !Number.isFinite(raw.durationSeconds) ||
    raw.durationSeconds <= 0
  ) {
    return null;
  }
  return {
    multiplier: Math.min(1.6, Math.max(1.1, raw.multiplier)),
    durationSeconds: Math.min(30, Math.max(5, Math.round(raw.durationSeconds))),
    label: typeof raw.label === 'string' && raw.label.length > 0 ? raw.label : 'Lucky Speed Boost',
  };
}

export function getLuckyWheelStatus(
  raw: Partial<LuckyWheelState> | undefined,
  now = new Date(),
): LuckyWheelStatus {
  const normalized = normalizeLuckyWheel(raw);
  const today = getLocalDateKey(now);
  return {
    canSpinToday: normalized.lastSpinDateKey !== today,
    totalSpins: normalized.totalSpins,
    lastRewardLabel: normalized.lastRewardLabel,
  };
}

export function pickWeightedLuckySliceIndex(): number {
  const totalWeight = LUCKY_WHEEL_SLICES.reduce((acc, s) => acc + s.weight, 0);
  let roll = Math.random() * totalWeight;
  for (let i = 0; i < LUCKY_WHEEL_SLICES.length; i++) {
    roll -= LUCKY_WHEEL_SLICES[i].weight;
    if (roll <= 0) return i;
  }
  return 0;
}

export function computeWheelTargetRotation(
  sliceIndex: number,
  currentRotationDeg: number,
  sliceCount = LUCKY_WHEEL_SLICES.length,
): number {
  const sliceDeg = 360 / sliceCount;
  // Slice i is centered at (i * sliceDeg) clockwise from 12 o'clock.
  // Aligning slice i under the 12 o'clock pointer requires wheel mod = (360 - i * sliceDeg) % 360.
  const jitter = (Math.random() - 0.5) * (sliceDeg * 0.44);
  const desiredMod = (((360 - sliceIndex * sliceDeg + jitter) % 360) + 360) % 360;
  const currentMod = ((currentRotationDeg % 360) + 360) % 360;
  let delta = desiredMod - currentMod;
  if (delta <= 0) delta += 360;
  const fullTurns = 5 + Math.floor(Math.random() * 2); // 5-6 full spins
  return currentRotationDeg + fullTurns * 360 + delta;
}

export function applyLuckyWheelSliceReward(
  prev: SaveData,
  slice: LuckyWheelSlice,
  now = new Date(),
): { nextSave: SaveData; outcome: LuckyWheelOutcome } {
  const today = getLocalDateKey(now);
  const prevWheel = normalizeLuckyWheel(prev.luckyWheel);

  let gemsAwarded = 0;
  let cosmeticUnlocked: SkinCosmetic | null = null;
  let speedBoostGranted: TemporarySpeedBoostState | null = null;
  let duplicateFallbackUsed = false;
  let summaryText = '';

  let nextUnlockedCosmetics = [...prev.unlockedCosmeticIds];
  let nextEquippedCosmetic = prev.equippedCosmeticId;
  let nextPendingBoost = prev.pendingSpeedBoost;

  if (slice.kind === 'gems') {
    gemsAwarded = slice.gemsAmount ?? 25;
    summaryText = `+${gemsAwarded} Gems added to your vault`;
  } else if (slice.kind === 'cosmetic') {
    const ownedSet = new Set(nextUnlockedCosmetics);
    const available = SKIN_COSMETICS.filter((c) => !ownedSet.has(c.id));
    if (available.length > 0) {
      const picked = available[Math.floor(Math.random() * available.length)];
      cosmeticUnlocked = picked;
      nextUnlockedCosmetics = [...nextUnlockedCosmetics, picked.id];
      nextEquippedCosmetic = nextEquippedCosmetic ?? picked.id;
      summaryText = `Unlocked cosmetic: ${picked.name}`;
    } else {
      duplicateFallbackUsed = true;
      gemsAwarded = slice.gemsAmount ?? 140;
      summaryText = `All cosmetics owned! Jackpot fallback: +${gemsAwarded} Gems`;
    }
  } else if (slice.kind === 'speed_boost') {
    const multiplier = slice.boostMultiplier ?? 1.28;
    const durationSeconds = slice.boostSeconds ?? 12;
    speedBoostGranted = {
      multiplier,
      durationSeconds,
      label: slice.title,
    };
    nextPendingBoost = speedBoostGranted;
    const pct = Math.round((multiplier - 1) * 100);
    summaryText = `+${pct}% Speed Boost primed for ${durationSeconds}s on your next run`;
  }

  const nextSave: SaveData = {
    ...prev,
    totalGems: prev.totalGems + gemsAwarded,
    unlockedCosmeticIds: nextUnlockedCosmetics,
    equippedCosmeticId: nextEquippedCosmetic,
    pendingSpeedBoost: nextPendingBoost,
    luckyWheel: {
      lastSpinDateKey: today,
      totalSpins: prevWheel.totalSpins + 1,
      lastRewardId: slice.id,
      lastRewardLabel: cosmeticUnlocked
        ? cosmeticUnlocked.name
        : speedBoostGranted
          ? `${slice.shortLabel}`
          : `+${gemsAwarded} Gems`,
    },
  };

  return {
    nextSave,
    outcome: {
      slice,
      gemsAwarded,
      cosmeticUnlocked,
      speedBoostGranted,
      duplicateFallbackUsed,
      summaryText,
    },
  };
}
