import { getLocalDateKey, getOffsetLocalDateKey } from './missions';
import type { DailyLoginBonusState, LahoreLandmarkKind } from './types';

export type { LahoreLandmarkKind };

export const DAILY_LOGIN_REWARDS = [15, 25, 35, 50, 65, 85, 120] as const;

export interface DailyCityStop {
  dayNumber: number;
  locationName: string;
  shortName: string;
  districtTag: string;
  flavorText: string;
  landmark: LahoreLandmarkKind;
  rewardGems: number;
  mapX: number;
  mapY: number;
}

export const DAILY_LOGIN_STOPS: DailyCityStop[] = [
  {
    dayNumber: 1,
    locationName: 'Delhi Gate',
    shortName: 'Delhi Gate',
    districtTag: 'Androon Trailhead',
    flavorText: 'Step beneath the historic walled-city archway to begin your Lahore tour.',
    landmark: 'gate',
    rewardGems: DAILY_LOGIN_REWARDS[0],
    mapX: 46,
    mapY: 120,
  },
  {
    dayNumber: 2,
    locationName: 'Anarkali Bazaar',
    shortName: 'Anarkali',
    districtTag: 'Lantern Arcade',
    flavorText: 'Dash past vibrant spice stalls, truck-art banners, and bustling evening crowds.',
    landmark: 'bazaar',
    rewardGems: DAILY_LOGIN_REWARDS[1],
    mapX: 122,
    mapY: 84,
  },
  {
    dayNumber: 3,
    locationName: 'Badshahi Mosque',
    shortName: 'Badshahi',
    districtTag: 'Royal Courtyard',
    flavorText: 'Marble domes and towering red sandstone minarets glow beneath the golden sky.',
    landmark: 'mosque',
    rewardGems: DAILY_LOGIN_REWARDS[2],
    mapX: 200,
    mapY: 56,
  },
  {
    dayNumber: 4,
    locationName: 'Minar-e-Pakistan',
    shortName: 'Minar Park',
    districtTag: 'Greater Iqbal Park',
    flavorText: 'Midway milestone beneath the iconic star-petal monument overlooking the Ravi.',
    landmark: 'minar',
    rewardGems: DAILY_LOGIN_REWARDS[3],
    mapX: 280,
    mapY: 94,
  },
  {
    dayNumber: 5,
    locationName: 'Shalimar Gardens',
    shortName: 'Shalimar',
    districtTag: 'Marble Terraces',
    flavorText: 'Glide beside cool reflecting pools and centuries-old Mughal pavilions.',
    landmark: 'gardens',
    rewardGems: DAILY_LOGIN_REWARDS[4],
    mapX: 358,
    mapY: 60,
  },
  {
    dayNumber: 6,
    locationName: 'Canal Road',
    shortName: 'Canal Rd',
    districtTag: 'Willow Flyover',
    flavorText: 'Sprint along the shimmering turquoise canal and illuminated overhead bridges.',
    landmark: 'canal',
    rewardGems: DAILY_LOGIN_REWARDS[5],
    mapX: 436,
    mapY: 116,
  },
  {
    dayNumber: 7,
    locationName: 'Liberty Chowk',
    shortName: 'Liberty',
    districtTag: 'Grand Finale',
    flavorText: 'Reach the neon heart of Gulberg for the Week-Complete Gem Jackpot!',
    landmark: 'liberty',
    rewardGems: DAILY_LOGIN_REWARDS[6],
    mapX: 512,
    mapY: 56,
  },
];

export interface DailyLoginStatus {
  canClaimToday: boolean;
  daySlotIndex: number; // 0..6 in the 7-day reward cycle
  dayNumber: number; // 1..7
  rewardGems: number;
  consecutiveDays: number;
  currentStop: DailyCityStop;
}

export function normalizeDailyLogin(
  raw: Partial<DailyLoginBonusState> | undefined,
  now = new Date(),
): DailyLoginBonusState {
  if (
    !raw ||
    typeof raw.consecutiveDays !== 'number' ||
    !Number.isFinite(raw.consecutiveDays) ||
    raw.consecutiveDays <= 0 ||
    typeof raw.lastClaimedDateKey !== 'string'
  ) {
    return { lastClaimedDateKey: null, consecutiveDays: 0 };
  }

  const today = getLocalDateKey(now);
  const yesterday = getOffsetLocalDateKey(-1, now);
  if (raw.lastClaimedDateKey === today || raw.lastClaimedDateKey === yesterday) {
    return {
      lastClaimedDateKey: raw.lastClaimedDateKey,
      consecutiveDays: Math.floor(raw.consecutiveDays),
    };
  }

  return { lastClaimedDateKey: null, consecutiveDays: 0 };
}

export function getDailyLoginStatus(
  raw: Partial<DailyLoginBonusState> | undefined,
  now = new Date(),
): DailyLoginStatus {
  const normalized = normalizeDailyLogin(raw, now);
  const today = getLocalDateKey(now);
  const canClaimToday = normalized.lastClaimedDateKey !== today;

  const daySlotIndex = canClaimToday
    ? normalized.consecutiveDays % DAILY_LOGIN_REWARDS.length
    : Math.max(0, (normalized.consecutiveDays - 1) % DAILY_LOGIN_REWARDS.length);

  return {
    canClaimToday,
    daySlotIndex,
    dayNumber: daySlotIndex + 1,
    rewardGems: DAILY_LOGIN_REWARDS[daySlotIndex],
    consecutiveDays: normalized.consecutiveDays,
    currentStop: DAILY_LOGIN_STOPS[daySlotIndex],
  };
}

export function claimDailyLoginBonus(
  raw: Partial<DailyLoginBonusState> | undefined,
  now = new Date(),
): {
  nextState: DailyLoginBonusState;
  gemsAwarded: number;
  dayNumber: number;
} {
  const normalized = normalizeDailyLogin(raw, now);
  const today = getLocalDateKey(now);
  if (normalized.lastClaimedDateKey === today) {
    const slot = Math.max(0, (normalized.consecutiveDays - 1) % DAILY_LOGIN_REWARDS.length);
    return {
      nextState: normalized,
      gemsAwarded: 0,
      dayNumber: slot + 1,
    };
  }

  const yesterday = getOffsetLocalDateKey(-1, now);
  const nextConsecutive =
    normalized.lastClaimedDateKey === yesterday ? normalized.consecutiveDays + 1 : 1;
  const slot = (nextConsecutive - 1) % DAILY_LOGIN_REWARDS.length;
  const gemsAwarded = DAILY_LOGIN_REWARDS[slot];

  return {
    nextState: {
      lastClaimedDateKey: today,
      consecutiveDays: nextConsecutive,
    },
    gemsAwarded,
    dayNumber: slot + 1,
  };
}
