import type {
  ProfileBadge,
  ProfileBadgeId,
  RunMetrics,
  SkinCosmetic,
  SkinCosmeticId,
  WeeklyChallenge,
  WeeklyChallengeState,
  WeeklyChallengeType,
} from './types';

export const PROFILE_BADGES: ProfileBadge[] = [
  {
    id: 'lahore_legend',
    name: 'Lahore Legend',
    description: 'Awarded for running 5,000m in a single week',
    accentHex: '#fbbf24',
  },
  {
    id: 'gem_sovereign',
    name: 'Gem Sovereign',
    description: 'Awarded for collecting 600 gems in a week',
    accentHex: '#38bdf8',
  },
  {
    id: 'street_virtuoso',
    name: 'Street Virtuoso',
    description: 'Awarded for scoring 45 style bonuses in a week',
    accentHex: '#fb7185',
  },
  {
    id: 'sky_acrobat',
    name: 'Sky Acrobat',
    description: 'Awarded for executing 280 jumps in a week',
    accentHex: '#34d399',
  },
];

export const SKIN_COSMETICS: SkinCosmetic[] = [
  {
    id: 'starlight_crown',
    name: 'Starlight Crown',
    description: 'Floating golden star-crown & shoulder chevrons',
    accentHex: '#fbbf24',
    secondaryHex: '#10b981',
  },
  {
    id: 'truckart_wings',
    name: 'Truck-Art Wings',
    description: 'Marigold & rose prism back wings',
    accentHex: '#ec4899',
    secondaryHex: '#22d3ee',
  },
  {
    id: 'emerald_crest',
    name: 'Emerald Crest',
    description: 'Lahore green & gold glowing shoulder fins',
    accentHex: '#34d399',
    secondaryHex: '#fbbf24',
  },
  {
    id: 'comet_halo',
    name: 'Comet Ring',
    description: 'Spinning cyan-gold orbital halo behind runner',
    accentHex: '#38bdf8',
    secondaryHex: '#fde047',
  },
];

export function getBadgeById(id: ProfileBadgeId | null | undefined): ProfileBadge | null {
  if (!id) return null;
  return PROFILE_BADGES.find((b) => b.id === id) ?? null;
}

export function getCosmeticById(id: SkinCosmeticId | null | undefined): SkinCosmetic | null {
  if (!id) return null;
  return SKIN_COSMETICS.find((c) => c.id === id) ?? null;
}

interface WeeklyChallengeTemplate {
  templateId: string;
  title: string;
  type: WeeklyChallengeType;
  label: string;
  target: number;
  rewardGems: number;
  rewardBadgeId: ProfileBadgeId;
  rewardCosmeticId: SkinCosmeticId;
}

const ANCHOR_DISTANCE_CHALLENGE: WeeklyChallengeTemplate = {
  templateId: 'weekly_distance_5000',
  title: 'Lahore Marathon',
  type: 'distance',
  label: 'Run 5,000m total in a week',
  target: 5000,
  rewardGems: 120,
  rewardBadgeId: 'lahore_legend',
  rewardCosmeticId: 'starlight_crown',
};

const ROTATING_WEEKLY_POOL: WeeklyChallengeTemplate[] = [
  {
    templateId: 'weekly_gems_600',
    title: 'Bazaar Jeweler',
    type: 'gems',
    label: 'Collect 600 gems in a week',
    target: 600,
    rewardGems: 100,
    rewardBadgeId: 'gem_sovereign',
    rewardCosmeticId: 'truckart_wings',
  },
  {
    templateId: 'weekly_style_45',
    title: 'Rickshaw Dodger',
    type: 'style',
    label: 'Score 45 style bonuses in a week',
    target: 45,
    rewardGems: 110,
    rewardBadgeId: 'street_virtuoso',
    rewardCosmeticId: 'emerald_crest',
  },
  {
    templateId: 'weekly_jumps_280',
    title: 'Rooftop Acrobat',
    type: 'jumps',
    label: 'Execute 280 jumps in a week',
    target: 280,
    rewardGems: 95,
    rewardBadgeId: 'sky_acrobat',
    rewardCosmeticId: 'comet_halo',
  },
];

export function getIsoWeekKey(date = new Date()): string {
  // Compute ISO-8601 week key using local calendar date
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getDaysLeftInWeek(date = new Date()): number {
  const day = date.getDay(); // 0=Sun .. 6=Sat
  return day === 0 ? 1 : 8 - day;
}

export function generateWeeklyChallenges(weekKey: string): WeeklyChallenge[] {
  // Deterministically rotate 2 secondary challenges alongside the flagship 5,000m challenge
  const weekSeed = weekKey
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const firstIdx = weekSeed % ROTATING_WEEKLY_POOL.length;
  const secondIdx = (firstIdx + 1) % ROTATING_WEEKLY_POOL.length;

  const selected: WeeklyChallengeTemplate[] = [
    ANCHOR_DISTANCE_CHALLENGE,
    ROTATING_WEEKLY_POOL[firstIdx],
    ROTATING_WEEKLY_POOL[secondIdx],
  ];

  return selected.map((tpl) => ({
    id: `${weekKey}_${tpl.templateId}`,
    templateId: tpl.templateId,
    title: tpl.title,
    type: tpl.type,
    label: tpl.label,
    target: tpl.target,
    progress: 0,
    rewardGems: tpl.rewardGems,
    rewardBadgeId: tpl.rewardBadgeId,
    rewardCosmeticId: tpl.rewardCosmeticId,
    claimed: false,
  }));
}

export function normalizeWeeklyChallengeState(
  raw: Partial<WeeklyChallengeState> | undefined,
  now = new Date(),
): WeeklyChallengeState {
  const weekKey = getIsoWeekKey(now);
  if (!raw || raw.weekKey !== weekKey || !Array.isArray(raw.challenges) || raw.challenges.length !== 3) {
    return {
      weekKey,
      challenges: generateWeeklyChallenges(weekKey),
    };
  }

  const valid = raw.challenges.every(
    (c) =>
      c &&
      typeof c.id === 'string' &&
      typeof c.templateId === 'string' &&
      typeof c.title === 'string' &&
      typeof c.type === 'string' &&
      typeof c.label === 'string' &&
      typeof c.target === 'number' &&
      typeof c.progress === 'number' &&
      typeof c.rewardGems === 'number' &&
      typeof c.rewardBadgeId === 'string' &&
      typeof c.rewardCosmeticId === 'string' &&
      typeof c.claimed === 'boolean',
  );

  if (!valid) {
    return {
      weekKey,
      challenges: generateWeeklyChallenges(weekKey),
    };
  }

  return {
    weekKey,
    challenges: raw.challenges.map((c) => ({
      ...c,
      progress: Math.min(c.target, Math.max(0, Math.floor(c.progress))),
    })),
  };
}

export function applyMetricsDeltaToWeeklyChallenges(
  challenges: WeeklyChallenge[],
  delta: RunMetrics,
): { updated: WeeklyChallenge[]; newlyCompleted: WeeklyChallenge[] } {
  const newlyCompleted: WeeklyChallenge[] = [];

  const updated = challenges.map((challenge) => {
    let inc = 0;
    switch (challenge.type) {
      case 'distance':
        inc = delta.distance;
        break;
      case 'gems':
        inc = delta.gems;
        break;
      case 'style':
        inc = delta.styleBonuses;
        break;
      case 'jumps':
        inc = delta.jumps;
        break;
    }

    if (inc <= 0 || challenge.progress >= challenge.target) {
      return challenge;
    }

    const nextProgress = Math.min(challenge.target, challenge.progress + inc);
    const nextChallenge: WeeklyChallenge = {
      ...challenge,
      progress: nextProgress,
    };

    if (challenge.progress < challenge.target && nextProgress >= challenge.target) {
      newlyCompleted.push(nextChallenge);
    }
    return nextChallenge;
  });

  return { updated, newlyCompleted };
}
