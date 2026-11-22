import { getLocalDateKey } from './missions';
import type {
  DailyRunObjectiveMetric,
  DailyRunObjectiveState,
  DailyRunObjectiveTemplate,
  HudSnapshot,
  ProfileBadgeId,
  SaveData,
  SkinCosmeticId,
} from './types';

export const DAILY_RUN_OBJECTIVE_POOL: DailyRunObjectiveTemplate[] = [
  {
    id: 'slide_50_one_run',
    title: 'Silk Road Slipstream',
    label: 'Slide 50 times in one run',
    ruleHint: 'Single run · Reach 50 slides before crashing',
    metric: 'slides',
    target: 50,
    forbidAction: null,
    rewardGems: 75,
    repeatBonusGems: 30,
    rewardBadgeId: 'slide_phantom',
    rewardCosmeticId: 'marigold_scarf',
    rewardBoost: {
      multiplier: 1.2,
      durationSeconds: 14,
      label: 'Slipstream Start',
    },
  },
  {
    id: 'gems_100_no_jump',
    title: 'Grounded Collector',
    label: 'Collect 100 gems without jumping',
    ruleHint: 'Single run · Jump count must stay 0 until 100 gems',
    metric: 'gems',
    target: 100,
    forbidAction: 'jumps',
    rewardGems: 90,
    repeatBonusGems: 35,
    rewardBadgeId: 'grounded_jade',
    rewardCosmeticId: 'golden_chakkar',
    rewardBoost: {
      multiplier: 1.25,
      durationSeconds: 15,
      label: 'Jade Surge',
    },
  },
  {
    id: 'distance_650_no_slide',
    title: 'Highline Stride',
    label: 'Reach 650m without sliding',
    ruleHint: 'Single run · Slide count must stay 0 until 650m',
    metric: 'distance',
    target: 650,
    forbidAction: 'slides',
    rewardGems: 85,
    repeatBonusGems: 30,
    rewardBadgeId: 'iron_strider',
    rewardCosmeticId: 'badshahi_crest',
    rewardBoost: {
      multiplier: 1.2,
      durationSeconds: 14,
      label: 'Highline Turbo',
    },
  },
  {
    id: 'style_12_one_run',
    title: 'Minar Daredevil',
    label: 'Score 12 style bonuses in one run',
    ruleHint: 'Single run · Near-misses, hurdles, or clean slides',
    metric: 'styleBonuses',
    target: 12,
    forbidAction: null,
    rewardGems: 80,
    repeatBonusGems: 30,
    rewardBadgeId: 'bazaar_virtuoso',
    rewardCosmeticId: 'prism_thrusters',
    rewardBoost: {
      multiplier: 1.22,
      durationSeconds: 15,
      label: 'Daredevil Spark',
    },
  },
  {
    id: 'gems_125_one_run',
    title: 'Anarkali Hoard',
    label: 'Collect 125 gems in one run',
    ruleHint: 'Single run · Magnets and 2× multipliers count toward total',
    metric: 'gems',
    target: 125,
    forbidAction: null,
    rewardGems: 75,
    repeatBonusGems: 30,
    rewardBadgeId: 'grounded_jade',
    rewardCosmeticId: 'golden_chakkar',
    rewardBoost: {
      multiplier: 1.2,
      durationSeconds: 12,
      label: 'Bazaar Rush',
    },
  },
  {
    id: 'jumps_65_one_run',
    title: 'Rooftop Vaulter',
    label: 'Jump 65 times in one run',
    ruleHint: 'Single run · 65 leaps before the run ends',
    metric: 'jumps',
    target: 65,
    forbidAction: null,
    rewardGems: 70,
    repeatBonusGems: 25,
    rewardBadgeId: 'iron_strider',
    rewardCosmeticId: 'badshahi_crest',
    rewardBoost: {
      multiplier: 1.18,
      durationSeconds: 14,
      label: 'Vault Boost',
    },
  },
  {
    id: 'springs_6_one_run',
    title: 'Skyline Catapult',
    label: 'Hit 6 spring pads in one run',
    ruleHint: 'Single run · Launch off 6 spring pads in one attempt',
    metric: 'springHits',
    target: 6,
    forbidAction: null,
    rewardGems: 80,
    repeatBonusGems: 30,
    rewardBadgeId: 'bazaar_virtuoso',
    rewardCosmeticId: 'prism_thrusters',
    rewardBoost: {
      multiplier: 1.25,
      durationSeconds: 14,
      label: 'Catapult Launch',
    },
  },
];

function hashDateKey(dateKey: string): number {
  let hash = 2166136261;
  for (let i = 0; i < dateKey.length; i++) {
    hash ^= dateKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getDailyRunObjectiveTemplateById(
  templateId: string | null | undefined,
): DailyRunObjectiveTemplate {
  return (
    DAILY_RUN_OBJECTIVE_POOL.find((t) => t.id === templateId) ?? DAILY_RUN_OBJECTIVE_POOL[0]
  );
}

export function getDailyRunObjectiveTemplateForDate(dateKey: string): DailyRunObjectiveTemplate {
  const idx = hashDateKey(`daily-run:${dateKey}`) % DAILY_RUN_OBJECTIVE_POOL.length;
  return DAILY_RUN_OBJECTIVE_POOL[idx];
}

export function createDailyRunObjectiveForDate(dateKey: string): DailyRunObjectiveState {
  const tpl = getDailyRunObjectiveTemplateForDate(dateKey);
  return {
    dateKey,
    templateId: tpl.id,
    bestProgress: 0,
    completed: false,
    claimed: false,
  };
}

export function normalizeDailyRunObjectiveState(
  raw: Partial<DailyRunObjectiveState> | undefined,
  now = new Date(),
): DailyRunObjectiveState {
  const todayKey = getLocalDateKey(now);
  const expectedTpl = getDailyRunObjectiveTemplateForDate(todayKey);

  if (
    !raw ||
    raw.dateKey !== todayKey ||
    typeof raw.templateId !== 'string' ||
    raw.templateId !== expectedTpl.id
  ) {
    return createDailyRunObjectiveForDate(todayKey);
  }

  const bestProgress =
    typeof raw.bestProgress === 'number' && Number.isFinite(raw.bestProgress)
      ? Math.min(expectedTpl.target, Math.max(0, Math.floor(raw.bestProgress)))
      : 0;
  const completed = Boolean(raw.completed) || bestProgress >= expectedTpl.target;
  const claimed = completed && Boolean(raw.claimed);

  return {
    dateKey: todayKey,
    templateId: expectedTpl.id,
    bestProgress: completed ? expectedTpl.target : bestProgress,
    completed,
    claimed,
  };
}

export function getDailyRunMetricValue(
  metric: DailyRunObjectiveMetric,
  snapshot: HudSnapshot,
): number {
  switch (metric) {
    case 'slides':
      return snapshot.slides;
    case 'gems':
      return snapshot.runGems;
    case 'distance':
      return snapshot.distance;
    case 'styleBonuses':
      return snapshot.styleBonuses;
    case 'jumps':
      return snapshot.jumps;
    case 'springHits':
      return snapshot.springHits;
  }
}

export function getDailyRunMetricUnit(metric: DailyRunObjectiveMetric): string {
  switch (metric) {
    case 'slides':
      return 'slides';
    case 'gems':
      return 'gems';
    case 'distance':
      return 'm';
    case 'styleBonuses':
      return 'style';
    case 'jumps':
      return 'jumps';
    case 'springHits':
      return 'springs';
  }
}

export interface DailyRunEvaluationResult {
  nextState: DailyRunObjectiveState;
  disqualifiedThisRun: boolean;
  currentRunProgress: number;
  newlyCompleted: boolean;
}

export function evaluateDailyRunObjectiveAttempt(
  rawState: DailyRunObjectiveState,
  snapshot: HudSnapshot,
  prevDisqualified: boolean,
  now = new Date(),
): DailyRunEvaluationResult {
  const state = normalizeDailyRunObjectiveState(rawState, now);
  const tpl = getDailyRunObjectiveTemplateById(state.templateId);

  const violatedRestriction =
    (tpl.forbidAction === 'jumps' && snapshot.jumps > 0) ||
    (tpl.forbidAction === 'slides' && snapshot.slides > 0);
  const disqualifiedThisRun = prevDisqualified || violatedRestriction;

  const rawValue = Math.max(0, Math.floor(getDailyRunMetricValue(tpl.metric, snapshot)));
  const cappedProgress = Math.min(tpl.target, rawValue);

  // If already completed earlier today (or earlier in this same run before jumping/sliding), keep completed!
  if (state.completed) {
    return {
      nextState: state,
      disqualifiedThisRun: false,
      currentRunProgress: tpl.target,
      newlyCompleted: false,
    };
  }

  if (disqualifiedThisRun) {
    return {
      nextState: state,
      disqualifiedThisRun: true,
      currentRunProgress: 0,
      newlyCompleted: false,
    };
  }

  const nextBest = Math.max(state.bestProgress, cappedProgress);
  const completedNow = cappedProgress >= tpl.target;

  return {
    nextState: {
      ...state,
      bestProgress: completedNow ? tpl.target : nextBest,
      completed: completedNow,
    },
    disqualifiedThisRun: false,
    currentRunProgress: cappedProgress,
    newlyCompleted: completedNow,
  };
}

export interface ClaimDailyRunObjectiveOutcome {
  nextSave: SaveData;
  claimed: boolean;
  gemsAwarded: number;
  unlockedNewBadge: ProfileBadgeId | null;
  unlockedNewCosmetic: SkinCosmeticId | null;
  boostLabel: string | null;
}

export function claimDailyRunObjectiveReward(
  prev: SaveData,
  now = new Date(),
): ClaimDailyRunObjectiveOutcome {
  const normalized = normalizeDailyRunObjectiveState(prev.dailyRunObjective, now);
  if (!normalized.completed || normalized.claimed) {
    return {
      nextSave: prev,
      claimed: false,
      gemsAwarded: 0,
      unlockedNewBadge: null,
      unlockedNewCosmetic: null,
      boostLabel: null,
    };
  }

  const tpl = getDailyRunObjectiveTemplateById(normalized.templateId);
  const alreadyHasBadge = prev.unlockedBadgeIds.includes(tpl.rewardBadgeId);
  const alreadyHasCosmetic = prev.unlockedCosmeticIds.includes(tpl.rewardCosmeticId);

  const unlockedNewBadge = alreadyHasBadge ? null : tpl.rewardBadgeId;
  const unlockedNewCosmetic = alreadyHasCosmetic ? null : tpl.rewardCosmeticId;

  // If the player already owns both unique items from a previous day, grant repeat mastery bonus gems
  const gemsAwarded =
    tpl.rewardGems + (alreadyHasBadge && alreadyHasCosmetic ? tpl.repeatBonusGems : 0);

  const unlockedBadgeIds = Array.from(new Set([...prev.unlockedBadgeIds, tpl.rewardBadgeId]));
  const equippedBadgeId = prev.equippedBadgeId ?? tpl.rewardBadgeId;

  const unlockedCosmeticIds = Array.from(
    new Set([...prev.unlockedCosmeticIds, tpl.rewardCosmeticId]),
  );
  const equippedCosmeticId = prev.equippedCosmeticId ?? tpl.rewardCosmeticId;

  const nextSave: SaveData = {
    ...prev,
    totalGems: prev.totalGems + gemsAwarded,
    dailyRunObjective: {
      ...normalized,
      claimed: true,
    },
    unlockedBadgeIds,
    equippedBadgeId,
    unlockedCosmeticIds,
    equippedCosmeticId,
    pendingSpeedBoost: { ...tpl.rewardBoost },
  };

  return {
    nextSave,
    claimed: true,
    gemsAwarded,
    unlockedNewBadge,
    unlockedNewCosmetic,
    boostLabel: tpl.rewardBoost.label,
  };
}
