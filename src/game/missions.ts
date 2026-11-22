import type {
  CompletedMissionRecord,
  DailyMission,
  DailyMissionArchiveEntry,
  DailyMissionState,
  DailyStreakData,
  MissionType,
  RunMetrics,
} from './types';

const VALID_MISSION_TYPES: ReadonlySet<MissionType> = new Set([
  'jumps',
  'slides',
  'gems',
  'distance',
  'style',
  'springs',
]);

function normalizeCompletedMissions(raw: unknown): CompletedMissionRecord[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const records: CompletedMissionRecord[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as CompletedMissionRecord).id === 'string' &&
      typeof (item as CompletedMissionRecord).type === 'string' &&
      VALID_MISSION_TYPES.has((item as CompletedMissionRecord).type) &&
      typeof (item as CompletedMissionRecord).label === 'string' &&
      typeof (item as CompletedMissionRecord).target === 'number' &&
      typeof (item as CompletedMissionRecord).rewardGems === 'number'
    ) {
      const rec = item as CompletedMissionRecord;
      if (seen.has(rec.id)) continue;
      seen.add(rec.id);
      records.push({
        id: rec.id,
        type: rec.type,
        label: rec.label,
        target: Math.max(1, Math.floor(rec.target)),
        rewardGems: Math.max(0, Math.floor(rec.rewardGems)),
        claimed: Boolean(rec.claimed),
      });
    }
  }
  return records;
}

function toCompletedMissionRecords(missions: DailyMission[]): CompletedMissionRecord[] {
  return missions
    .filter(
      (m) =>
        m &&
        typeof m.id === 'string' &&
        VALID_MISSION_TYPES.has(m.type) &&
        typeof m.label === 'string' &&
        typeof m.progress === 'number' &&
        typeof m.target === 'number' &&
        m.progress >= m.target,
    )
    .map((m) => ({
      id: m.id,
      type: m.type,
      label: m.label,
      target: Math.max(1, Math.floor(m.target)),
      rewardGems: Math.max(0, Math.floor(m.rewardGems)),
      claimed: Boolean(m.claimed),
    }));
}

interface MissionTemplate {
  type: MissionType;
  target: number;
  rewardGems: number;
  label: string;
}

const MISSION_POOL: MissionTemplate[] = [
  // Jumps
  { type: 'jumps', target: 35, rewardGems: 25, label: 'Jump 35 times' },
  { type: 'jumps', target: 50, rewardGems: 35, label: 'Jump 50 times' },
  { type: 'jumps', target: 75, rewardGems: 50, label: 'Jump 75 times' },
  // Slides
  { type: 'slides', target: 25, rewardGems: 25, label: 'Slide 25 times' },
  { type: 'slides', target: 40, rewardGems: 40, label: 'Slide 40 times' },
  { type: 'slides', target: 60, rewardGems: 55, label: 'Slide 60 times' },
  // Gems
  { type: 'gems', target: 60, rewardGems: 30, label: 'Collect 60 gems' },
  { type: 'gems', target: 100, rewardGems: 45, label: 'Collect 100 gems' },
  { type: 'gems', target: 150, rewardGems: 65, label: 'Collect 150 gems' },
  // Distance
  { type: 'distance', target: 600, rewardGems: 30, label: 'Travel 600m across runs' },
  { type: 'distance', target: 1000, rewardGems: 45, label: 'Travel 1,000m across runs' },
  { type: 'distance', target: 1500, rewardGems: 65, label: 'Travel 1,500m across runs' },
  // Style / Near-miss
  { type: 'style', target: 8, rewardGems: 30, label: 'Score 8 style bonuses' },
  { type: 'style', target: 15, rewardGems: 45, label: 'Score 15 style bonuses' },
  // Spring pads
  { type: 'springs', target: 4, rewardGems: 25, label: 'Launch off 4 spring pads' },
  { type: 'springs', target: 7, rewardGems: 40, label: 'Launch off 7 spring pads' },
];

export function getLocalDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getOffsetLocalDateKey(offsetDays: number, fromDate = new Date()): string {
  const shifted = new Date(
    fromDate.getFullYear(),
    fromDate.getMonth(),
    fromDate.getDate() + offsetDays,
  );
  return getLocalDateKey(shifted);
}

export function generateDailyMissions(dateKey: string): DailyMission[] {
  // Group by category so each of the 3 daily missions tests a different skill
  const byType = new Map<MissionType, MissionTemplate[]>();
  for (const tpl of MISSION_POOL) {
    const list = byType.get(tpl.type) ?? [];
    list.push(tpl);
    byType.set(tpl.type, list);
  }

  const types = Array.from(byType.keys());
  // Fisher-Yates shuffle
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }

  return types.slice(0, 3).map((type, idx) => {
    const candidates = byType.get(type)!;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    return {
      id: `${dateKey}_${type}_${idx}`,
      type: pick.type,
      label: pick.label,
      target: pick.target,
      progress: 0,
      rewardGems: pick.rewardGems,
      claimed: false,
    };
  });
}

export function normalizeDailyMissionState(
  raw: Partial<DailyMissionState> | undefined,
): DailyMissionState {
  const today = getLocalDateKey();
  if (!raw || raw.dateKey !== today || !Array.isArray(raw.missions) || raw.missions.length !== 3) {
    return {
      dateKey: today,
      missions: generateDailyMissions(today),
    };
  }

  const validMissions = raw.missions.every(
    (m) =>
      m &&
      typeof m.id === 'string' &&
      typeof m.type === 'string' &&
      typeof m.label === 'string' &&
      typeof m.target === 'number' &&
      typeof m.progress === 'number' &&
      typeof m.rewardGems === 'number' &&
      typeof m.claimed === 'boolean',
  );

  if (!validMissions) {
    return {
      dateKey: today,
      missions: generateDailyMissions(today),
    };
  }

  return {
    dateKey: today,
    missions: raw.missions.map((m) => ({
      ...m,
      progress: Math.min(m.target, Math.max(0, Math.floor(m.progress))),
    })),
  };
}

export function applyMetricsDeltaToMissions(
  missions: DailyMission[],
  delta: RunMetrics,
): { updated: DailyMission[]; newlyCompleted: DailyMission[] } {
  const newlyCompleted: DailyMission[] = [];

  const updated = missions.map((mission) => {
    let inc = 0;
    switch (mission.type) {
      case 'jumps':
        inc = delta.jumps;
        break;
      case 'slides':
        inc = delta.slides;
        break;
      case 'gems':
        inc = delta.gems;
        break;
      case 'distance':
        inc = delta.distance;
        break;
      case 'style':
        inc = delta.styleBonuses;
        break;
      case 'springs':
        inc = delta.springHits;
        break;
    }

    if (inc <= 0 || mission.progress >= mission.target) {
      return mission;
    }

    const nextProgress = Math.min(mission.target, mission.progress + inc);
    const nextMission: DailyMission = {
      ...mission,
      progress: nextProgress,
    };

    if (mission.progress < mission.target && nextProgress >= mission.target) {
      newlyCompleted.push(nextMission);
    }
    return nextMission;
  });

  return { updated, newlyCompleted };
}

export function normalizeDailyStreak(
  raw: Partial<DailyStreakData> | undefined,
  now = new Date(),
): DailyStreakData {
  if (
    !raw ||
    typeof raw.count !== 'number' ||
    !Number.isFinite(raw.count) ||
    raw.count <= 0 ||
    typeof raw.lastCompletedDateKey !== 'string'
  ) {
    return { count: 0, lastCompletedDateKey: null };
  }

  const today = getLocalDateKey(now);
  const yesterday = getOffsetLocalDateKey(-1, now);
  if (raw.lastCompletedDateKey === today || raw.lastCompletedDateKey === yesterday) {
    return {
      count: Math.floor(raw.count),
      lastCompletedDateKey: raw.lastCompletedDateKey,
    };
  }

  return { count: 0, lastCompletedDateKey: null };
}

export function advanceDailyStreakOnMissionComplete(
  rawStreak: Partial<DailyStreakData> | undefined,
  missions: DailyMission[],
  now = new Date(),
): DailyStreakData {
  const current = normalizeDailyStreak(rawStreak, now);
  const hasCompletedMission = missions.some((m) => m.progress >= m.target);
  if (!hasCompletedMission) {
    return current;
  }

  const today = getLocalDateKey(now);
  if (current.lastCompletedDateKey === today) {
    return current;
  }

  const yesterday = getOffsetLocalDateKey(-1, now);
  const nextCount = current.lastCompletedDateKey === yesterday ? current.count + 1 : 1;
  return {
    count: nextCount,
    lastCompletedDateKey: today,
  };
}

export function normalizeMissionArchive(
  raw: unknown,
  now = new Date(),
): DailyMissionArchiveEntry[] {
  if (!Array.isArray(raw)) return [];
  const cutoffKey = getOffsetLocalDateKey(-13, now);
  const byDate = new Map<string, DailyMissionArchiveEntry>();

  for (const item of raw) {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as DailyMissionArchiveEntry).dateKey === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test((item as DailyMissionArchiveEntry).dateKey) &&
      typeof (item as DailyMissionArchiveEntry).completed === 'number' &&
      typeof (item as DailyMissionArchiveEntry).total === 'number'
    ) {
      const entry = item as DailyMissionArchiveEntry;
      if (entry.dateKey < cutoffKey) continue;
      const total = Math.max(1, Math.min(10, Math.floor(entry.total)));
      const completedMissions = normalizeCompletedMissions(entry.completedMissions);
      const completed = Math.max(
        Math.min(total, completedMissions.length),
        Math.max(0, Math.min(total, Math.floor(entry.completed))),
      );
      const existing = byDate.get(entry.dateKey);
      if (
        !existing ||
        completed > existing.completed ||
        (completed === existing.completed &&
          completedMissions.length > (existing.completedMissions?.length ?? 0))
      ) {
        byDate.set(entry.dateKey, {
          dateKey: entry.dateKey,
          completed,
          total,
          completedMissions,
        });
      }
    }
  }

  return Array.from(byDate.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

export function syncMissionArchive(
  rawArchive: unknown,
  missionState: Partial<DailyMissionState> | undefined,
  now = new Date(),
): DailyMissionArchiveEntry[] {
  const entries = normalizeMissionArchive(rawArchive, now);
  const cutoffKey = getOffsetLocalDateKey(-13, now);

  if (
    missionState &&
    typeof missionState.dateKey === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(missionState.dateKey) &&
    missionState.dateKey >= cutoffKey &&
    Array.isArray(missionState.missions) &&
    missionState.missions.length > 0
  ) {
    const total = missionState.missions.length;
    const completedMissions = toCompletedMissionRecords(missionState.missions);
    const completed = completedMissions.length;

    const idx = entries.findIndex((e) => e.dateKey === missionState.dateKey);
    const updatedEntry: DailyMissionArchiveEntry = {
      dateKey: missionState.dateKey,
      completed,
      total,
      completedMissions,
    };
    if (idx >= 0) {
      entries[idx] = updatedEntry;
    } else {
      entries.push(updatedEntry);
    }
  }

  return entries.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

export interface WeeklyArchiveDay {
  dateKey: string;
  shortWeekday: string;
  dateLabel: string;
  isToday: boolean;
  isYesterday: boolean;
  completed: number;
  total: number;
  ratePct: number;
  hasActivity: boolean;
  completedMissions: CompletedMissionRecord[];
  gemsEarned: number;
}

export interface WeeklyMissionArchiveSummary {
  daysChronological: WeeklyArchiveDay[];
  totalCompleted: number;
  totalPossible: number;
  overallRatePct: number;
  perfectDays: number;
  activeDays: number;
  totalGemsEarned: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function buildWeeklyMissionArchive(
  archive: DailyMissionArchiveEntry[],
  currentState: DailyMissionState,
  now = new Date(),
): WeeklyMissionArchiveSummary {
  const map = new Map<string, DailyMissionArchiveEntry>();
  for (const entry of archive) {
    map.set(entry.dateKey, entry);
  }

  // Always reflect live today's missions
  const todayCompletedMissions = toCompletedMissionRecords(currentState.missions);
  const todayTotal = Math.max(1, currentState.missions.length);
  map.set(currentState.dateKey, {
    dateKey: currentState.dateKey,
    completed: todayCompletedMissions.length,
    total: todayTotal,
    completedMissions: todayCompletedMissions,
  });

  const daysChronological: WeeklyArchiveDay[] = [];
  let totalCompleted = 0;
  let totalPossible = 0;
  let perfectDays = 0;
  let activeDays = 0;
  let totalGemsEarned = 0;

  for (let offset = -6; offset <= 0; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const dateKey = getLocalDateKey(d);
    const recorded = map.get(dateKey);
    const completedMissions = normalizeCompletedMissions(recorded?.completedMissions);
    const total = recorded?.total ?? 3;
    const completed = Math.max(completedMissions.length, recorded?.completed ?? 0);
    const ratePct = Math.round((completed / total) * 100);
    const hasActivity = Boolean(recorded);
    const gemsEarned = completedMissions.reduce((acc, m) => acc + m.rewardGems, 0);

    if (hasActivity) activeDays++;
    if (completed >= total && total > 0) perfectDays++;
    totalCompleted += completed;
    totalPossible += total;
    totalGemsEarned += gemsEarned;

    const shortWeekday = WEEKDAYS[d.getDay()];
    const dateLabel =
      offset === 0
        ? 'Today'
        : offset === -1
          ? 'Yesterday'
          : `${shortWeekday}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;

    daysChronological.push({
      dateKey,
      shortWeekday,
      dateLabel,
      isToday: offset === 0,
      isYesterday: offset === -1,
      completed,
      total,
      ratePct,
      hasActivity,
      completedMissions,
      gemsEarned,
    });
  }

  const overallRatePct = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;

  return {
    daysChronological,
    totalCompleted,
    totalPossible,
    overallRatePct,
    perfectDays,
    activeDays,
    totalGemsEarned,
  };
}
