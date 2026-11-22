import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Award,
  CalendarDays,
  Check,
  Flame,
  Footprints,
  Gem,
  History,
  ShieldAlert,
  Sparkles,
  Target,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import {
  getDailyRunMetricUnit,
  getDailyRunObjectiveTemplateById,
} from '../game/dailyRunObjective';
import { buildWeeklyMissionArchive } from '../game/missions';
import { getBadgeById, getCosmeticById } from '../game/weeklyChallenges';
import type {
  DailyMission,
  DailyMissionArchiveEntry,
  DailyRunObjectiveMetric,
  DailyRunObjectiveState,
  DailyStreakData,
  MissionType,
  ProfileBadgeId,
  SkinCosmeticId,
} from '../game/types';

interface MissionsModalProps {
  missions: DailyMission[];
  dailyRunObjective: DailyRunObjectiveState;
  unlockedBadgeIds: ProfileBadgeId[];
  unlockedCosmeticIds: SkinCosmeticId[];
  lastAttemptProgress: number;
  lastAttemptDisqualified: boolean;
  missionArchive: DailyMissionArchiveEntry[];
  dailyStreak: DailyStreakData;
  totalGems: number;
  dateKey: string;
  onClaimMission: (missionId: string) => void;
  onClaimDailyRunObjective: () => void;
  onClaimAll: () => void;
  onClose: () => void;
}

function getMissionIcon(type: MissionType) {
  switch (type) {
    case 'jumps':
      return <ArrowUp className="w-4 h-4 text-sky-300" />;
    case 'slides':
      return <ArrowDown className="w-4 h-4 text-amber-300" />;
    case 'gems':
      return <Gem className="w-4 h-4 text-cyan-300" />;
    case 'distance':
      return <Footprints className="w-4 h-4 text-emerald-300" />;
    case 'style':
      return <Sparkles className="w-4 h-4 text-rose-300" />;
    case 'springs':
      return <Zap className="w-4 h-4 text-yellow-300" />;
  }
}

function getMissionTypeLabel(type: MissionType): string {
  switch (type) {
    case 'jumps':
      return 'Jumps';
    case 'slides':
      return 'Slides';
    case 'gems':
      return 'Gems';
    case 'distance':
      return 'Distance';
    case 'style':
      return 'Style';
    case 'springs':
      return 'Springs';
  }
}

function getDailyRunIcon(metric: DailyRunObjectiveMetric) {
  switch (metric) {
    case 'slides':
      return <ArrowDown className="w-4 h-4 text-amber-300" />;
    case 'gems':
      return <Gem className="w-4 h-4 text-emerald-300" />;
    case 'distance':
      return <Footprints className="w-4 h-4 text-sky-300" />;
    case 'styleBonuses':
      return <Sparkles className="w-4 h-4 text-rose-300" />;
    case 'jumps':
      return <ArrowUp className="w-4 h-4 text-sky-300" />;
    case 'springHits':
      return <Zap className="w-4 h-4 text-yellow-300" />;
  }
}

export const MissionsModal: React.FC<MissionsModalProps> = ({
  missions,
  dailyRunObjective,
  unlockedBadgeIds,
  unlockedCosmeticIds,
  lastAttemptProgress,
  lastAttemptDisqualified,
  missionArchive,
  dailyStreak,
  totalGems,
  dateKey,
  onClaimMission,
  onClaimDailyRunObjective,
  onClaimAll,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');
  const [historyScope, setHistoryScope] = useState<'week' | 'previous'>('week');
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const dailyRunTpl = getDailyRunObjectiveTemplateById(dailyRunObjective.templateId);
  const dailyRunBadge = getBadgeById(dailyRunTpl.rewardBadgeId);
  const dailyRunCosmetic = getCosmeticById(dailyRunTpl.rewardCosmeticId);
  const dailyRunCanClaim = dailyRunObjective.completed && !dailyRunObjective.claimed;
  const dailyRunPct = Math.min(
    100,
    Math.round((dailyRunObjective.bestProgress / dailyRunTpl.target) * 100),
  );
  const alreadyOwnsBadge = unlockedBadgeIds.includes(dailyRunTpl.rewardBadgeId);
  const alreadyOwnsCosmetic = unlockedCosmeticIds.includes(dailyRunTpl.rewardCosmeticId);
  const effectiveDailyGems =
    dailyRunTpl.rewardGems + (alreadyOwnsBadge && alreadyOwnsCosmetic ? dailyRunTpl.repeatBonusGems : 0);

  const claimableMissionsCount = missions.filter((m) => m.progress >= m.target && !m.claimed).length;
  const claimableCount = claimableMissionsCount + (dailyRunCanClaim ? 1 : 0);
  const completedCount = missions.filter((m) => m.progress >= m.target).length;
  const totalTodayDone = completedCount + (dailyRunObjective.completed ? 1 : 0);
  const totalTodayGoalCount = missions.length + 1;
  const securedToday = dailyStreak.lastCompletedDateKey === dateKey;

  const weeklySummary = useMemo(
    () => buildWeeklyMissionArchive(missionArchive, { dateKey, missions }),
    [missionArchive, dateKey, missions],
  );
  const daysNewestFirst = useMemo(
    () => [...weeklySummary.daysChronological].reverse(),
    [weeklySummary.daysChronological],
  );

  const filteredHistoryDays = useMemo(() => {
    if (selectedDayKey) {
      return daysNewestFirst.filter((d) => d.dateKey === selectedDayKey);
    }
    if (historyScope === 'previous') {
      return daysNewestFirst.filter((d) => !d.isToday);
    }
    return daysNewestFirst;
  }, [daysNewestFirst, historyScope, selectedDayKey]);

  const filteredCompletedTotal = useMemo(
    () => filteredHistoryDays.reduce((sum, day) => sum + day.completed, 0),
    [filteredHistoryDays],
  );

  const selectedDayInfo = useMemo(
    () => (selectedDayKey ? daysNewestFirst.find((d) => d.dateKey === selectedDayKey) ?? null : null),
    [daysNewestFirst, selectedDayKey],
  );

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#060b14]/72 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="missions-modal-title"
        className="w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl bg-[#0b1322] border border-white/15 p-5 sm:p-6 shadow-2xl text-white"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 shrink-0">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-amber-300">
              <Target className="w-3.5 h-3.5" />
              <span>Daily Missions · {dateKey}</span>
            </div>
            <h2
              id="missions-modal-title"
              className="text-xl sm:text-2xl font-black uppercase tracking-wide mt-1"
            >
              {activeTab === 'today' ? "Today's Objectives" : 'Mission History'}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5 tabular-nums">
              {activeTab === 'today'
                ? `${totalTodayDone}/${totalTodayGoalCount} completed · Daily Challenge + cumulative runs`
                : `Last 7 days · ${weeklySummary.totalCompleted}/${weeklySummary.totalPossible} missions · +${weeklySummary.totalGemsEarned} gems`}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close missions"
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center text-slate-200 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* View Switcher */}
        <div className="mt-3.5 grid grid-cols-2 gap-1.5 rounded-xl bg-white/5 border border-white/10 p-1 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('today')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-xs font-black uppercase tracking-wider whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              activeTab === 'today'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Target className="w-3.5 h-3.5 shrink-0" />
            <span>Today ({totalTodayDone}/{totalTodayGoalCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-xs font-black uppercase tracking-wider whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
              activeTab === 'history'
                ? 'bg-sky-400 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <History className="w-3.5 h-3.5 shrink-0" />
            <span>History ({weeklySummary.totalCompleted})</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="mt-3.5 overflow-y-auto pr-0.5 flex-1 min-h-0">
          {activeTab === 'today' ? (
            <>
              {/* Daily Streak Banner */}
              <div
                className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${
                  securedToday
                    ? 'bg-orange-500/12 border-orange-400/40 text-orange-200'
                    : 'bg-white/5 border-white/10 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  <Flame
                    className={`w-4 h-4 shrink-0 ${
                      dailyStreak.count > 0 ? 'text-orange-400' : 'text-slate-400'
                    }`}
                  />
                  <span>
                    {securedToday
                      ? 'Today’s streak secured!'
                      : 'Complete 1 mission today to grow your streak'}
                  </span>
                </div>
                <span className="font-black text-orange-300 tabular-nums shrink-0">
                  {dailyStreak.count} {dailyStreak.count === 1 ? 'Day' : 'Days'}
                </span>
              </div>

              {/* Daily Featured Single-Run Objective */}
              <section aria-labelledby="daily-run-objective-heading" className="mt-3.5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3
                    id="daily-run-objective-heading"
                    className="text-[11px] font-black uppercase tracking-widest text-emerald-300 flex items-center gap-1.5"
                  >
                    <Trophy className="w-3.5 h-3.5 shrink-0" />
                    <span>Daily Run Objective</span>
                  </h3>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Single-run milestone
                  </span>
                </div>

                <div
                  className={`rounded-xl border p-3.5 transition-colors ${
                    dailyRunCanClaim
                      ? 'bg-amber-400/14 border-amber-400/60'
                      : dailyRunObjective.claimed
                        ? 'bg-emerald-500/10 border-emerald-400/35'
                        : 'bg-[#101c33] border-emerald-400/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-[#080f1d] border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                        {getDailyRunIcon(dailyRunTpl.metric)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
                          {dailyRunTpl.title}
                        </div>
                        <div className="text-sm font-extrabold text-white mt-0.5">
                          {dailyRunTpl.label}
                        </div>
                        <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                          {dailyRunTpl.ruleHint}
                        </p>
                      </div>
                    </div>

                    {dailyRunCanClaim ? (
                      <button
                        type="button"
                        onClick={onClaimDailyRunObjective}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black uppercase tracking-wider text-xs px-3 py-2 transition-transform cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                      >
                        <Trophy className="w-3.5 h-3.5" />
                        <span>Claim</span>
                      </button>
                    ) : dailyRunObjective.claimed ? (
                      <div className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-300 shrink-0">
                        <Check className="w-3.5 h-3.5" />
                        <span>Claimed</span>
                      </div>
                    ) : (
                      <div className="text-right shrink-0 tabular-nums">
                        <div className="text-xs font-black text-emerald-300">
                          {dailyRunObjective.bestProgress}/{dailyRunTpl.target}
                        </div>
                        <div className="text-[10px] font-semibold text-slate-400">
                          Best today
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2.5 h-2 w-full rounded-full bg-slate-900 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${
                        dailyRunObjective.claimed
                          ? 'bg-emerald-400'
                          : dailyRunObjective.completed
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                      }`}
                      style={{ width: `${dailyRunPct}%` }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-300 tabular-nums">
                    <span>
                      Best single run: <strong className="text-white">{dailyRunObjective.bestProgress}</strong> /{' '}
                      {dailyRunTpl.target} {getDailyRunMetricUnit(dailyRunTpl.metric)} ({dailyRunPct}%)
                    </span>
                    {!dailyRunObjective.completed && lastAttemptDisqualified && (
                      <span className="inline-flex items-center gap-1 text-rose-300 font-bold">
                        <ShieldAlert className="w-3 h-3 shrink-0" />
                        <span>Last run broke rule</span>
                      </span>
                    )}
                    {!dailyRunObjective.completed && !lastAttemptDisqualified && lastAttemptProgress > 0 && (
                      <span className="text-slate-400">
                        Last run: {lastAttemptProgress}
                      </span>
                    )}
                  </div>

                  {/* Unique Reward Breakdown (unboxed typographic row) */}
                  <div className="mt-2.5 pt-2 border-t border-white/10 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold">
                    <span className="text-sky-300 inline-flex items-center gap-1 tabular-nums">
                      <Gem className="w-3 h-3 shrink-0" />
                      <span>+{effectiveDailyGems} Gems</span>
                    </span>
                    {dailyRunCosmetic && (
                      <span
                        className="inline-flex items-center gap-1"
                        style={{ color: dailyRunCosmetic.accentHex }}
                      >
                        <Sparkles className="w-3 h-3 shrink-0" />
                        <span>
                          {alreadyOwnsCosmetic
                            ? `Gear: ${dailyRunCosmetic.name} (Owned)`
                            : `Unique Gear: ${dailyRunCosmetic.name}`}
                        </span>
                      </span>
                    )}
                    {dailyRunBadge && (
                      <span
                        className="inline-flex items-center gap-1"
                        style={{ color: dailyRunBadge.accentHex }}
                      >
                        <Award className="w-3 h-3 shrink-0" />
                        <span>
                          {alreadyOwnsBadge
                            ? `Badge: ${dailyRunBadge.name} (Owned)`
                            : `Badge: ${dailyRunBadge.name}`}
                        </span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-amber-300 tabular-nums">
                      <Zap className="w-3 h-3 shrink-0" />
                      <span>
                        +{Math.round((dailyRunTpl.rewardBoost.multiplier - 1) * 100)}% Next-Run Boost
                      </span>
                    </span>
                  </div>
                </div>
              </section>

              {/* Cumulative Mission List */}
              <div className="mt-4 flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-amber-300">
                <span>Cumulative Daily Missions</span>
                <span className="font-semibold normal-case tracking-normal text-slate-400">
                  Progress carries across runs
                </span>
              </div>
              <div className="mt-2 flex flex-col gap-3">
                {missions.map((mission) => {
                  const pct = Math.min(100, Math.round((mission.progress / mission.target) * 100));
                  const isComplete = mission.progress >= mission.target;
                  const canClaim = isComplete && !mission.claimed;

                  return (
                    <div
                      key={mission.id}
                      className={`rounded-xl border p-3.5 transition-colors ${
                        canClaim
                          ? 'bg-amber-400/12 border-amber-400/50'
                          : mission.claimed
                            ? 'bg-emerald-500/10 border-emerald-400/30'
                            : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-[#162238] border border-white/10 flex items-center justify-center shrink-0">
                            {getMissionIcon(mission.type)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-extrabold text-white truncate">
                              {mission.label}
                            </div>
                            <div className="text-[11px] font-bold text-slate-300 tabular-nums">
                              {mission.progress.toLocaleString()} / {mission.target.toLocaleString()}
                            </div>
                          </div>
                        </div>

                        {canClaim ? (
                          <button
                            type="button"
                            onClick={() => onClaimMission(mission.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black uppercase tracking-wider text-xs px-3 py-1.5 transition-transform cursor-pointer shrink-0"
                          >
                            <Gem className="w-3.5 h-3.5" />
                            <span>+{mission.rewardGems}</span>
                          </button>
                        ) : mission.claimed ? (
                          <div className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-300 shrink-0">
                            <Check className="w-3.5 h-3.5" />
                            <span>Claimed</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-black text-sky-300 tabular-nums shrink-0">
                            <Gem className="w-3.5 h-3.5 text-sky-400" />
                            <span>+{mission.rewardGems}</span>
                          </div>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="mt-2.5 h-2 w-full rounded-full bg-slate-900 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-200 ${
                            mission.claimed
                              ? 'bg-emerald-400'
                              : isComplete
                                ? 'bg-amber-400'
                                : 'bg-sky-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick Link to Mission History */}
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-300 tabular-nums">
                  7-day rate: <strong className="text-white">{weeklySummary.overallRatePct}%</strong>{' '}
                  · {weeklySummary.totalCompleted}/{weeklySummary.totalPossible} done
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200 font-bold whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded px-1 py-0.5"
                >
                  <span>Mission History</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-4">
              {/* 7-Day Aggregate Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-sky-500/10 border border-sky-400/30 p-3">
                  <div className="text-[11px] font-bold text-sky-300">7-Day Rate</div>
                  <div className="text-xl font-black text-white tabular-nums mt-0.5">
                    {weeklySummary.overallRatePct}%
                  </div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="text-[11px] font-bold text-slate-300">Completed</div>
                  <div className="text-xl font-black text-amber-300 tabular-nums mt-0.5">
                    {weeklySummary.totalCompleted}
                    <span className="text-xs font-bold text-slate-400">
                      /{weeklySummary.totalPossible}
                    </span>
                  </div>
                </div>
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/30 p-3">
                  <div className="text-[11px] font-bold text-emerald-300">Gems Earned</div>
                  <div className="text-xl font-black text-emerald-300 tabular-nums mt-0.5">
                    +{weeklySummary.totalGemsEarned}
                  </div>
                </div>
              </div>

              {/* 7-Day Visual Completion Strip (Interactive Day Selector) */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-3.5">
                <div className="flex items-center justify-between text-xs text-slate-300 mb-3">
                  <span className="font-bold text-white">7-Day Progression</span>
                  <span className="text-slate-300 tabular-nums text-[11px]">
                    {weeklySummary.perfectDays}/7 full · {weeklySummary.activeDays}/7 active
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1.5 items-end">
                  {weeklySummary.daysChronological.map((day) => {
                    const isPerfect = day.completed >= day.total && day.total > 0;
                    const isSelected = selectedDayKey === day.dateKey;
                    return (
                      <button
                        key={day.dateKey}
                        type="button"
                        onClick={() =>
                          setSelectedDayKey((prev) => (prev === day.dateKey ? null : day.dateKey))
                        }
                        aria-pressed={isSelected}
                        title={`${day.dateLabel}: ${day.completed}/${day.total} completed`}
                        className={`flex flex-col items-center gap-1.5 rounded-lg p-1 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                          isSelected
                            ? 'bg-sky-400/15 ring-1 ring-sky-400'
                            : 'hover:bg-white/5'
                        }`}
                      >
                        <span className="text-[10px] font-black tabular-nums text-slate-300">
                          {day.completed}/{day.total}
                        </span>
                        <div className="w-full flex flex-col-reverse gap-1 h-12 justify-start rounded-md bg-[#080f1d] p-1">
                          {Array.from({ length: day.total }).map((_, slotIdx) => {
                            const filled = slotIdx < day.completed;
                            return (
                              <div
                                key={slotIdx}
                                className={`w-full flex-1 rounded-xs ${
                                  filled
                                    ? isPerfect
                                      ? 'bg-emerald-400'
                                      : day.isToday
                                        ? 'bg-amber-400'
                                        : 'bg-sky-400'
                                    : 'bg-white/8'
                                }`}
                              />
                            );
                          })}
                        </div>
                        <span
                          className={`text-[10px] font-extrabold uppercase tracking-wider ${
                            isSelected
                              ? 'text-sky-300'
                              : day.isToday
                                ? 'text-amber-300'
                                : 'text-slate-300'
                          }`}
                        >
                          {day.isToday ? 'Now' : day.shortWeekday}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mission History Section */}
              <section aria-labelledby="mission-history-heading" className="pt-1">
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/10">
                  <div className="min-w-0">
                    <h3
                      id="mission-history-heading"
                      className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-1.5"
                    >
                      <CalendarDays className="w-4 h-4 text-sky-300 shrink-0" />
                      <span>Mission History</span>
                    </h3>
                    <p className="text-[11px] text-slate-300 tabular-nums mt-0.5">
                      {selectedDayInfo
                        ? `${selectedDayInfo.dateLabel} · ${selectedDayInfo.completed}/${selectedDayInfo.total} completed`
                        : historyScope === 'previous'
                          ? `Previous 6 days · ${filteredCompletedTotal} completed`
                          : `Past 7 days · ${filteredCompletedTotal} completed`}
                    </p>
                  </div>

                  {selectedDayKey ? (
                    <button
                      type="button"
                      onClick={() => setSelectedDayKey(null)}
                      className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-bold text-sky-300 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      Show all
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 rounded-lg bg-white/5 p-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setHistoryScope('week')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                          historyScope === 'week'
                            ? 'bg-sky-400 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        7 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryScope('previous')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                          historyScope === 'previous'
                            ? 'bg-sky-400 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        Prev Days
                      </button>
                    </div>
                  )}
                </div>

                {filteredCompletedTotal === 0 && (
                  <div className="mt-3 rounded-xl bg-white/[0.04] px-3.5 py-3 text-xs text-slate-300">
                    <div className="font-bold text-white">
                      {selectedDayInfo
                        ? `No completed missions on ${selectedDayInfo.dateLabel}`
                        : historyScope === 'previous'
                          ? 'No completed missions from previous days yet'
                          : 'No completed missions in the last 7 days yet'}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Complete daily objectives during your runs in Lahore to build your weekly
                      history and track gem rewards over time.
                    </p>
                  </div>
                )}

                <div className="mt-2 divide-y divide-white/10">
                  {filteredHistoryDays.map((day) => {
                    const isPerfect = day.completed >= day.total && day.total > 0;
                    return (
                      <div key={day.dateKey} className="py-3 first:pt-2 last:pb-1">
                        {/* Day Header */}
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span
                            className={`font-extrabold ${
                              day.isToday ? 'text-amber-300' : 'text-white'
                            }`}
                          >
                            {day.dateLabel}
                          </span>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-300 tabular-nums shrink-0">
                            <span>
                              {day.completed}/{day.total} done
                            </span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={
                                isPerfect
                                  ? 'text-emerald-300 font-bold'
                                  : day.completed > 0
                                    ? 'text-sky-300 font-bold'
                                    : 'text-slate-400'
                              }
                            >
                              {day.ratePct}%
                            </span>
                            {day.gemsEarned > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-sky-300 font-bold">
                                  +{day.gemsEarned} gems
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Completed Missions for this Day */}
                        {day.completedMissions.length > 0 ? (
                          <ul className="mt-2 flex flex-col gap-1.5">
                            {day.completedMissions.map((item) => (
                              <li
                                key={item.id}
                                className="flex items-center justify-between gap-2.5 rounded-lg bg-white/[0.04] px-2.5 py-2"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-7 h-7 rounded-md bg-[#162238] flex items-center justify-center shrink-0">
                                    {getMissionIcon(item.type)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-white truncate">
                                      {item.label}
                                    </div>
                                    <div className="text-[11px] text-slate-300 tabular-nums">
                                      {getMissionTypeLabel(item.type)} · Target{' '}
                                      {item.target.toLocaleString()} ·{' '}
                                      <span
                                        className={
                                          item.claimed ? 'text-emerald-300' : 'text-amber-300'
                                        }
                                      >
                                        {item.claimed ? 'Claimed' : 'Ready to claim'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="inline-flex items-center gap-1 text-xs font-black text-emerald-300 tabular-nums shrink-0">
                                  <Check className="w-3.5 h-3.5" />
                                  <span>+{item.rewardGems}</span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : day.completed > 0 ? (
                          <p className="mt-1.5 text-[11px] text-slate-400 tabular-nums">
                            {day.completed} {day.completed === 1 ? 'mission' : 'missions'} completed
                            (recorded before detailed log)
                          </p>
                        ) : (
                          <p className="mt-1 text-[11px] text-slate-400">
                            {day.hasActivity ? 'No missions finished' : 'No runs logged'}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between gap-3 pt-3 border-t border-white/10 shrink-0">
          <div className="inline-flex items-center gap-1.5 text-xs font-black text-sky-200 tabular-nums">
            <Gem className="w-4 h-4 text-sky-400" />
            <span>Total: {totalGems} Gems</span>
          </div>

          {activeTab === 'today' && claimableCount > 0 ? (
            <button
              type="button"
              onClick={onClaimAll}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black uppercase tracking-wider text-xs px-4 py-2.5 transition-transform cursor-pointer"
            >
              <Gem className="w-3.5 h-3.5" />
              <span>Claim All ({claimableCount})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold uppercase tracking-wider text-xs px-4 py-2.5 cursor-pointer"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
