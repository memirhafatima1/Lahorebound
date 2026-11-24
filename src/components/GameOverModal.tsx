import React from 'react';
import {
  BookOpen,
  Check,
  Compass,
  Gem,
  Landmark,
  MapPin,
  RotateCcw,
  Shirt,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';
import { useRunnerAuth } from './AuthContext';
import { LeaderboardPanel } from './LeaderboardPanel';
import { DIFFICULTY_CONFIGS } from '../game/difficulty';
import {
  getJourneyProgressForDistance,
  LAHORE_TRACK_STOPS,
} from '../game/lahoreJourney';
import type {
  DailyRunObjectiveTemplate,
  LahoreLandmarkKind,
  RunSummary,
  SaveData,
} from '../game/types';

interface GameOverModalProps {
  save: SaveData;
  runSummary: RunSummary;
  effectiveSkinId: string;
  dailyRunObjTpl: DailyRunObjectiveTemplate;
  dailyRunAttempt: { progress: number; disqualified: boolean };
  dailyRunClaimable: boolean;
  totalTodayDoneCount: number;
  totalClaimableDailyCount: number;
  onInspectLandmarkInCodex: (kind: LahoreLandmarkKind) => void;
  onClaimAllMissions: () => void;
  onClaimDailyRunObjective: () => void;
  onClaimMission: (id: string) => void;
  onSelectSkin: (skinId: string) => void;
  onStartRun: () => void;
  onOpenWardrobe: (focusSkinId?: string) => void;
  onOpenCodex: () => void;
  onReturnToTitle: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = React.memo(({
  save,
  runSummary,
  effectiveSkinId,
  dailyRunObjTpl,
  dailyRunAttempt,
  dailyRunClaimable,
  totalTodayDoneCount,
  totalClaimableDailyCount,
  onInspectLandmarkInCodex,
  onClaimAllMissions,
  onClaimDailyRunObjective,
  onClaimMission,
  onSelectSkin,
  onStartRun,
  onOpenWardrobe,
  onOpenCodex,
  onReturnToTitle,
}) => {
  const { runnerHandle } = useRunnerAuth();
  const dailyMissions = save.dailyMissions.missions;
  const dailyRunObj = save.dailyRunObjective;
  const journey = getJourneyProgressForDistance(runSummary.distance);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#060b14]/70 p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gameover-modal-title"
        className="w-full max-w-md rounded-2xl bg-[#0b1322] border border-white/15 p-5 sm:p-6 shadow-2xl text-white my-auto"
      >
        <div className="text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="inline-block rounded-lg bg-rose-500/20 border border-rose-400/40 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-widest text-rose-300">
              {runSummary.reason === 'fall' ? 'Missed the Bridge' : 'Obstacle Impact'}
            </span>
            <span
              className="inline-block rounded-lg bg-white/5 border px-2.5 py-0.5 text-[11px] font-black uppercase tracking-widest"
              style={{
                borderColor: `${DIFFICULTY_CONFIGS[runSummary.difficulty].accentHex}55`,
                color: DIFFICULTY_CONFIGS[runSummary.difficulty].accentHex,
              }}
            >
              {DIFFICULTY_CONFIGS[runSummary.difficulty].label} Mode
            </span>
            <span className="inline-block rounded-lg bg-white/5 border border-white/12 px-2 py-0.5 text-[11px] font-bold text-slate-300">
              @{runnerHandle}
            </span>
          </div>
          <h2
            id="gameover-modal-title"
            className="text-2xl sm:text-3xl font-display font-bold uppercase tracking-wide mt-2"
          >
            Run Complete
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Distance
              </span>
              {runSummary.isNewBestDistance && (
                <span className="text-[10px] font-black uppercase bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded">
                  New Best
                </span>
              )}
            </div>
            <div className="text-2xl font-black font-mono-num mt-0.5">
              {runSummary.distance}m
            </div>
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Score
            </span>
            <div className="text-2xl font-black font-mono-num mt-0.5 text-amber-300">
              {runSummary.score.toLocaleString()}
            </div>
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Gems Collected
            </span>
            <div className="flex items-center gap-1.5 text-xl font-black font-mono-num mt-0.5 text-sky-300">
              <Gem className="w-4 h-4 text-sky-400" />
              <span>+{runSummary.gemsEarned}</span>
            </div>
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Best Combo
              </span>
              <span className="text-[10px] font-bold text-amber-300 font-mono-num">
                Peak {runSummary.peakSpeedMultiplier.toFixed(2)}×
              </span>
            </div>
            <div className="text-xl font-black font-mono-num mt-0.5 text-emerald-300">
              ×{runSummary.maxCombo}
            </div>
          </div>
        </div>

        {/* Furthest Landmark & Next Goal Progress */}
        <button
          type="button"
          onClick={() => onInspectLandmarkInCodex(runSummary.landmarkReached)}
          className="mt-2.5 w-full rounded-xl bg-[#07101f] hover:bg-[#0e1a30] border border-white/12 px-3.5 py-2.5 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <MapPin className="w-4 h-4 text-amber-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Furthest Site Reached
                </div>
                <div className="text-xs sm:text-sm font-black text-white truncate">
                  {runSummary.landmarkReachedName} ·{' '}
                  <span className="text-sky-300 font-bold">{runSummary.weatherLabel}</span>
                </div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 shrink-0">
              <Landmark className="w-3.5 h-3.5" />
              <span>Codex</span>
            </span>
          </div>

          <div className="mt-2 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1.5 font-bold text-slate-300">
                <Compass className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>Next Stop: {journey.nextStop.name}</span>
              </span>
              <span className="font-mono-num font-bold text-amber-300">
                {journey.metersToNext}m away
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.max(6, Math.round(journey.segmentProgress * 100))}%`,
                  backgroundColor: journey.nextStop.accentHex,
                }}
              />
            </div>
          </div>
        </button>

        {/* Difficulty-Scoped Local & Global Leaderboard */}
        <LeaderboardPanel
          className="mt-3.5"
          localEntries={save.leaderboard}
          highlightEntryId={runSummary.entryId}
          localRank={runSummary.leaderboardRank}
          difficulty={runSummary.difficulty}
          playerBestScore={save.bestScore}
          playerBestDistance={save.bestDistance}
          playerSkinId={effectiveSkinId}
          playerBadgeId={save.equippedBadgeId}
          latestRunForSubmit={{
            difficulty: runSummary.difficulty,
            score: runSummary.score,
            distance: runSummary.distance,
            skinId: effectiveSkinId,
            badgeId: save.equippedBadgeId,
            peakSpeedMultiplier: runSummary.peakSpeedMultiplier,
            landmarkReachedName: runSummary.landmarkReachedName,
          }}
        />

        {/* Daily Missions & Daily Run Objective Summary */}
        <div className="mt-3.5 rounded-xl bg-white/5 border border-white/10 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-amber-300">
              <Target className="w-3.5 h-3.5" />
              <span>Daily Objectives</span>
            </div>
            {totalClaimableDailyCount > 0 ? (
              <button
                type="button"
                onClick={onClaimAllMissions}
                className="inline-flex items-center gap-1 rounded-md bg-amber-400 hover:bg-amber-300 px-2 py-0.5 text-[11px] font-black uppercase text-slate-950 cursor-pointer"
              >
                <Gem className="w-3 h-3" />
                <span>Claim All</span>
              </button>
            ) : (
              <span className="text-[11px] font-bold text-slate-400 font-mono-num">
                {totalTodayDoneCount}/4 Complete
              </span>
            )}
          </div>

          <div className="mb-2 pb-2 border-b border-white/10 flex items-center justify-between gap-2 text-xs">
            <div className="min-w-0">
              <div className="text-emerald-300 font-bold truncate">
                Run Goal: {dailyRunObjTpl.label}
              </div>
              {!dailyRunObj.completed && (
                <div className="text-[11px] text-slate-400 font-mono-num">
                  {dailyRunAttempt.disqualified
                    ? `Rule broken this run · Best today: ${dailyRunObj.bestProgress}/${dailyRunObjTpl.target}`
                    : `This run: ${dailyRunAttempt.progress}/${dailyRunObjTpl.target} · Best today: ${dailyRunObj.bestProgress}/${dailyRunObjTpl.target}`}
                </div>
              )}
            </div>
            {dailyRunClaimable ? (
              <button
                type="button"
                onClick={onClaimDailyRunObjective}
                className="inline-flex items-center gap-1 rounded bg-amber-400 hover:bg-amber-300 px-2 py-0.5 text-[11px] font-black text-slate-950 cursor-pointer shrink-0"
              >
                <Trophy className="w-3 h-3" />
                <span>Claim Reward</span>
              </button>
            ) : dailyRunObj.claimed ? (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-400 shrink-0">
                <Check className="w-3 h-3" />
                <span>Claimed</span>
              </span>
            ) : (
              <span className="text-[11px] font-bold text-emerald-300 font-mono-num shrink-0">
                {dailyRunObj.bestProgress}/{dailyRunObjTpl.target}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            {dailyMissions.map((m) => {
              const done = m.progress >= m.target;
              const canClaim = done && !m.claimed;
              return (
                <div key={m.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-200 font-semibold truncate">{m.label}</span>
                  {canClaim ? (
                    <button
                      type="button"
                      onClick={() => onClaimMission(m.id)}
                      className="inline-flex items-center gap-1 rounded bg-amber-400 hover:bg-amber-300 px-2 py-0.5 text-[11px] font-black text-slate-950 cursor-pointer shrink-0"
                    >
                      <Gem className="w-3 h-3" />
                      <span>+{m.rewardGems}</span>
                    </button>
                  ) : m.claimed ? (
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-400 shrink-0">
                      <Check className="w-3 h-3" />
                      <span>Claimed</span>
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-sky-300 font-mono-num shrink-0">
                      {m.progress}/{m.target}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Newly Unlocked Milestone Skins */}
        {runSummary.newlyUnlockedSkins.length > 0 && (
          <div className="mt-3.5 rounded-xl bg-amber-400/15 border border-amber-400/40 p-3">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-300">
              <Sparkles className="w-4 h-4" />
              <span>Skin Unlocked!</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {runSummary.newlyUnlockedSkins.map((skin) => (
                <button
                  key={skin.id}
                  type="button"
                  onClick={() => onSelectSkin(skin.id)}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0b1322] border border-amber-300/50 px-3 py-1.5 text-xs font-bold text-white hover:bg-[#162238] cursor-pointer"
                >
                  <span className="w-3 h-3 rounded-xs" style={{ backgroundColor: skin.swatchHex }} />
                  <span>{skin.name}</span>
                  <span className="text-amber-300 font-black">
                    {save.selectedSkinId === skin.id ? 'Equipped' : 'Equip'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onStartRun}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-display font-bold uppercase tracking-wider text-sm py-3.5 transition-transform cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Run Again</span>
          </button>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onOpenWardrobe()}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold uppercase tracking-wider text-xs py-2.5 cursor-pointer"
            >
              <Shirt className="w-4 h-4 text-sky-300" />
              <span>Skins ({save.totalGems})</span>
            </button>
            <button
              type="button"
              onClick={onOpenCodex}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/35 text-emerald-200 font-bold uppercase tracking-wider text-xs py-2.5 font-mono-num cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-emerald-300" />
              <span>
                Codex {save.unlockedLandmarkIds.length}/{LAHORE_TRACK_STOPS.length}
              </span>
            </button>
            <button
              type="button"
              onClick={onReturnToTitle}
              className="rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold uppercase tracking-wider text-xs py-2.5 cursor-pointer"
            >
              Title
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
