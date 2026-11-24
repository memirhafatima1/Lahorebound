import React from 'react';
import {
  Award,
  BookOpen,
  Crown,
  Flame,
  Gem,
  Gift,
  PartyPopper,
  Play,
  Radio,
  Settings,
  Shirt,
  Sparkles,
  Target,
  Trophy,
  UserCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useRunnerAuth } from './AuthContext';
import { LahoreTouristGuide } from './LahoreTouristGuide';
import { TitleLogo } from './TitleLogo';
import { DIFFICULTY_CONFIGS, DIFFICULTY_MODES } from '../game/difficulty';
import type { GlobalEventStatus } from '../game/globalEvents';
import { LAHORE_TRACK_STOPS } from '../game/lahoreJourney';
import { RADIO_STATION_MAP } from '../game/music';
import { CARNIVAL_RUNNER_SKIN, CHARACTER_SKINS } from '../game/skins';
import type {
  CharacterSkin,
  DailyRunObjectiveTemplate,
  DifficultyMode,
  LahoreLandmarkKind,
  ProfileBadge,
  RadioStationId,
  SaveData,
} from '../game/types';

interface TitleScreenProps {
  save: SaveData;
  activeSkin: CharacterSkin;
  equippedBadge: ProfileBadge | null;
  globalEvent: GlobalEventStatus;
  streakSecuredToday: boolean;
  loginBonusStatus: { canClaimToday: boolean; rewardGems: number };
  luckyWheelStatus: { canSpinToday: boolean };
  dailyRunObjTpl: DailyRunObjectiveTemplate;
  dailyRunClaimable: boolean;
  totalTodayDoneCount: number;
  totalClaimableDailyCount: number;
  weeklyDoneCount: number;
  claimableWeeklyCount: number;
  onStartRun: () => void;
  onOpenMissions: () => void;
  onOpenLeaderboard: () => void;
  onOpenCodex: () => void;
  onInspectLandmarkInCodex: (kind: LahoreLandmarkKind) => void;
  onOpenWeekly: () => void;
  onOpenDailyBonus: () => void;
  onCycleRadioStation: () => void;
  onToggleMute: () => void;
  onOpenSettings: () => void;
  onSelectDifficulty: (mode: DifficultyMode) => void;
  onOpenWardrobe: (focusSkinId?: string) => void;
  onOpenLuckyWheel: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = React.memo(({
  save,
  activeSkin,
  equippedBadge,
  globalEvent,
  streakSecuredToday,
  loginBonusStatus,
  luckyWheelStatus,
  dailyRunObjTpl,
  dailyRunClaimable,
  totalTodayDoneCount,
  totalClaimableDailyCount,
  weeklyDoneCount,
  claimableWeeklyCount,
  onStartRun,
  onOpenMissions,
  onOpenLeaderboard,
  onOpenCodex,
  onInspectLandmarkInCodex,
  onOpenWeekly,
  onOpenDailyBonus,
  onCycleRadioStation,
  onToggleMute,
  onOpenSettings,
  onSelectDifficulty,
  onOpenWardrobe,
  onOpenLuckyWheel,
}) => {
  const { user, runnerHandle } = useRunnerAuth();
  const dailyRunObj = save.dailyRunObjective;
  const stationMeta = RADIO_STATION_MAP[save.radioStation as RadioStationId];

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 sm:p-6">
      {/* Top bar: Gems, Daily Streak, Best Distance, Codex, Handle & Audio Mute */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          <div className="inline-flex items-center gap-1.5 rounded-xl bg-[#0b1322]/85 border border-white/15 px-3 py-2 text-xs sm:text-sm font-black text-sky-200 font-mono-num shadow-lg">
            <Gem className="w-4 h-4 text-sky-400" />
            <span>{save.totalGems}</span>
          </div>
          <button
            type="button"
            onClick={onOpenMissions}
            title={
              streakSecuredToday
                ? 'Daily Streak secured for today!'
                : 'Complete at least 1 Daily Mission today to extend your streak'
            }
            className={`inline-flex items-center gap-1.5 rounded-xl bg-[#0b1322]/85 border px-3 py-2 text-xs sm:text-sm font-black font-mono-num shadow-lg transition-colors cursor-pointer ${
              streakSecuredToday
                ? 'border-orange-400/55 text-orange-200 hover:bg-[#162238]'
                : 'border-white/15 text-slate-200 hover:bg-[#162238]'
            }`}
          >
            <Flame
              className={`w-4 h-4 ${
                save.dailyStreak.count > 0 ? 'text-orange-400' : 'text-slate-400'
              }`}
            />
            <span className="hidden sm:inline text-[11px] font-bold uppercase tracking-wider text-slate-300/85">
              Daily Streak
            </span>
            <span className="sm:hidden text-[10px] font-bold uppercase tracking-wider text-slate-300/85">
              Streak
            </span>
            <span className={streakSecuredToday ? 'text-orange-300' : 'text-white'}>
              {save.dailyStreak.count}
            </span>
          </button>
          <button
            type="button"
            onClick={onOpenLeaderboard}
            title="Open Local & Global Leaderboards"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0b1322]/85 hover:bg-[#162238] border border-white/15 px-3 py-2 text-xs sm:text-sm font-bold text-amber-200 font-mono-num shadow-lg transition-colors cursor-pointer"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>{save.bestDistance > 0 ? `${save.bestDistance}m` : 'Ranks'}</span>
          </button>
          <button
            type="button"
            onClick={onOpenCodex}
            title="Open Lahore Landmark Codex"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0b1322]/85 hover:bg-[#162238] border border-white/15 px-3 py-2 text-xs sm:text-sm font-bold text-emerald-200 font-mono-num shadow-lg transition-colors cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Codex</span>
            <span className="text-emerald-300">
              {save.unlockedLandmarkIds.length}/{LAHORE_TRACK_STOPS.length}
            </span>
          </button>
          <button
            type="button"
            onClick={onOpenLeaderboard}
            title={user ? `Signed in as @${runnerHandle}` : 'Sign in or edit your Global Runner Handle'}
            className={`hidden md:inline-flex items-center gap-1.5 rounded-xl bg-[#0b1322]/85 hover:bg-[#162238] border px-3 py-2 text-xs font-bold shadow-lg transition-colors cursor-pointer ${
              user ? 'border-emerald-400/45 text-emerald-200' : 'border-white/15 text-slate-300'
            }`}
          >
            <UserCheck className={`w-3.5 h-3.5 ${user ? 'text-emerald-400' : 'text-slate-400'}`} />
            <span>@{runnerHandle}</span>
          </button>
          {equippedBadge && (
            <button
              type="button"
              onClick={onOpenWeekly}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0b1322]/85 hover:bg-[#162238] border px-3 py-2 text-xs font-black shadow-lg transition-colors cursor-pointer"
              style={{
                borderColor: `${equippedBadge.accentHex}66`,
                color: equippedBadge.accentHex,
              }}
            >
              <Award className="w-4 h-4 shrink-0" />
              <span>{equippedBadge.name}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={onOpenDailyBonus}
            className={`relative inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-wider shadow-lg transition-colors cursor-pointer ${
              loginBonusStatus.canClaimToday
                ? 'bg-emerald-500/90 hover:bg-emerald-400 border-emerald-200/70 text-slate-950'
                : 'bg-[#0b1322]/85 hover:bg-[#162238] border-white/15 text-slate-200'
            }`}
          >
            <Gift
              className={`w-4 h-4 ${
                loginBonusStatus.canClaimToday ? 'text-slate-950' : 'text-emerald-300'
              }`}
            />
            <span className="hidden sm:inline">Daily Bonus</span>
            <span className="sm:hidden">Bonus</span>
            {loginBonusStatus.canClaimToday && (
              <span className="absolute -top-2 -right-2 rounded-full bg-amber-400 border-2 border-[#0b1322] px-1.5 py-0.5 text-[10px] font-black leading-none text-slate-950 font-mono-num shadow">
                +{loginBonusStatus.rewardGems}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onCycleRadioStation}
            aria-label={`Radio Mode: ${stationMeta.name}. Click to switch station`}
            title={`Radio: ${stationMeta.name} (${stationMeta.frequency})`}
            className="h-10 rounded-xl bg-[#0b1322]/85 hover:bg-[#162238] border px-3 text-xs font-bold text-white flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer shadow-lg whitespace-nowrap shrink-0"
            style={{
              borderColor: `${stationMeta.accentHex}55`,
            }}
          >
            <Radio
              className="w-3.5 h-3.5 shrink-0"
              style={{
                color: save.muted ? '#64748b' : stationMeta.accentHex,
              }}
            />
            <span className="hidden md:inline text-slate-300 font-semibold">Radio</span>
            <span
              className="font-black"
              style={{
                color: save.muted ? '#94a3b8' : stationMeta.accentHex,
              }}
            >
              {stationMeta.shortName}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={save.muted ? 'Unmute audio' : 'Mute audio'}
            className="w-10 h-10 rounded-xl bg-[#0b1322]/85 border border-white/15 text-white flex items-center justify-center hover:bg-[#162238] active:scale-95 transition-transform cursor-pointer shadow-lg"
          >
            {save.muted ? (
              <VolumeX className="w-4 h-4 text-slate-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-sky-300" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open settings"
            title="Settings (Audio, Radio, Sky Lighting & Controls)"
            className="w-10 h-10 rounded-xl bg-[#0b1322]/85 border border-white/15 text-white flex items-center justify-center hover:bg-[#162238] active:scale-95 transition-transform cursor-pointer shadow-lg"
          >
            <Settings className="w-4 h-4 text-slate-200" />
          </button>
        </div>
      </div>

      {/* Upper-Sky Bespoke Title Lockup (keeps center-bottom runner visible!) */}
      <div className="flex flex-col items-center -mt-6 sm:-mt-14">
        <TitleLogo />
      </div>

      {/* Lahore Tourist Guide */}
      <div className="flex justify-center lg:block lg:fixed lg:right-6 lg:top-1/2 lg:-translate-y-1/2 lg:z-20 my-1 lg:my-0">
        <LahoreTouristGuide
          unlockedLandmarkIds={save.unlockedLandmarkIds}
          onInspectInCodex={onInspectLandmarkInCodex}
        />
      </div>

      {/* Bottom Action Cluster */}
      <div className="flex flex-col items-center gap-3 pb-2 sm:pb-4">
        {/* Difficulty Selector */}
        <div className="flex flex-col items-center gap-1.5 pointer-events-auto">
          <div
            role="radiogroup"
            aria-label="Difficulty Mode"
            className="inline-flex items-center gap-1 rounded-2xl bg-[#0b1322]/88 border border-white/15 p-1 shadow-lg"
          >
            {DIFFICULTY_MODES.map((mode) => {
              const cfg = DIFFICULTY_CONFIGS[mode];
              const active = save.difficulty === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onSelectDifficulty(mode)}
                  className={`rounded-xl px-3.5 sm:px-4 py-1.5 text-xs font-display font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    active
                      ? 'text-slate-950 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-white/8'
                  }`}
                  style={active ? { backgroundColor: cfg.accentHex } : undefined}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
          <div
            className="text-[11px] font-bold tracking-wide px-2.5 py-0.5 rounded-lg bg-[#0b1322]/75 border border-white/10"
            style={{ color: DIFFICULTY_CONFIGS[save.difficulty].accentHex }}
          >
            {DIFFICULTY_CONFIGS[save.difficulty].tagline}
          </div>
        </div>

        {globalEvent.active && (
          <button
            type="button"
            onClick={() => onOpenWardrobe(CARNIVAL_RUNNER_SKIN.id)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#160b29]/90 hover:bg-[#23103f] border border-pink-400/55 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg transition-colors cursor-pointer pointer-events-auto"
          >
            <PartyPopper className="w-3.5 h-3.5 text-pink-300 shrink-0" />
            <span className="font-display font-bold uppercase tracking-wider text-pink-300">
              {globalEvent.name}
            </span>
            <span aria-hidden="true" className="text-white/25">
              ·
            </span>
            <span className="text-amber-300 font-bold">{globalEvent.triggerLabel}</span>
            <span aria-hidden="true" className="text-white/25 hidden sm:inline">
              ·
            </span>
            <span className="hidden sm:inline text-cyan-300 font-bold">
              {activeSkin.id === CARNIVAL_RUNNER_SKIN.id
                ? 'Carnival Runner Equipped'
                : 'Unlock Carnival Skin'}
            </span>
          </button>
        )}

        {save.pendingSpeedBoost && (
          <div className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400/95 border border-amber-200/70 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-950 shadow-lg pointer-events-auto">
            <Flame className="w-3.5 h-3.5" />
            <span>
              Next Run Primed: +{Math.round((save.pendingSpeedBoost.multiplier - 1) * 100)}%
              Speed ({save.pendingSpeedBoost.durationSeconds}s)
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={onOpenMissions}
          className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-bold shadow-lg transition-colors cursor-pointer pointer-events-auto ${
            dailyRunClaimable
              ? 'bg-amber-400 hover:bg-amber-300 border-amber-200 text-slate-950'
              : dailyRunObj.claimed
                ? 'bg-emerald-950/85 hover:bg-emerald-900/85 border-emerald-400/45 text-emerald-200'
                : 'bg-[#0b1322]/88 hover:bg-[#162238] border-white/15 text-slate-200'
          }`}
        >
          <Trophy
            className={`w-3.5 h-3.5 shrink-0 ${
              dailyRunClaimable ? 'text-slate-950' : 'text-emerald-300'
            }`}
          />
          <span className="font-extrabold">Daily Run Goal:</span>
          <span className="truncate max-w-[210px] sm:max-w-none">{dailyRunObjTpl.label}</span>
          <span aria-hidden="true" className="opacity-40">
            ·
          </span>
          <span className="font-black font-mono-num shrink-0">
            {dailyRunClaimable
              ? 'Claim Unique Reward!'
              : dailyRunObj.claimed
                ? 'Completed'
                : `${dailyRunObj.bestProgress}/${dailyRunObjTpl.target}`}
          </span>
        </button>

        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 pointer-events-auto">
          <button
            type="button"
            onClick={onStartRun}
            className="inline-flex items-center gap-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-display font-bold uppercase tracking-wider text-base sm:text-lg px-7 sm:px-8 py-3.5 shadow-[0_10px_28px_rgba(245,158,11,0.45)] transition-transform cursor-pointer"
          >
            <Play className="w-5 h-5 fill-slate-950" />
            <span>Start Run</span>
          </button>

          <button
            type="button"
            onClick={onOpenLuckyWheel}
            className={`relative inline-flex items-center gap-2 rounded-2xl active:scale-95 border font-display font-bold uppercase tracking-wider text-sm px-4 sm:px-5 py-3.5 shadow-lg transition-transform cursor-pointer ${
              luckyWheelStatus.canSpinToday
                ? 'bg-purple-600/92 hover:bg-purple-500 border-purple-200/65 text-white'
                : 'bg-[#0b1322]/90 hover:bg-[#162238] border-white/20 text-white'
            }`}
          >
            <Sparkles
              className={`w-4 h-4 ${
                luckyWheelStatus.canSpinToday ? 'text-amber-300' : 'text-purple-300'
              }`}
            />
            <span>Lucky Wheel</span>
            {luckyWheelStatus.canSpinToday && (
              <span className="absolute -top-2 -right-2 rounded-full bg-amber-400 border-2 border-[#0b1322] px-1.5 py-0.5 text-[10px] font-black leading-none text-slate-950 shadow">
                SPIN
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenMissions}
            className={`relative inline-flex items-center gap-2 rounded-2xl active:scale-95 border font-display font-bold uppercase tracking-wider text-sm px-4 sm:px-5 py-3.5 shadow-lg transition-transform cursor-pointer ${
              totalClaimableDailyCount > 0
                ? 'bg-emerald-500/90 hover:bg-emerald-400 border-emerald-200/60 text-slate-950'
                : 'bg-[#0b1322]/90 hover:bg-[#162238] border-white/20 text-white'
            }`}
          >
            <Target
              className={`w-4 h-4 ${
                totalClaimableDailyCount > 0 ? 'text-slate-950' : 'text-amber-300'
              }`}
            />
            <span>Missions</span>
            <span
              className={`ml-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-black font-mono-num ${
                totalClaimableDailyCount > 0
                  ? 'bg-slate-950/20 text-slate-950'
                  : 'bg-white/10 text-amber-200'
              }`}
            >
              {totalClaimableDailyCount > 0
                ? `Claim ${totalClaimableDailyCount}`
                : `${totalTodayDoneCount}/4`}
            </span>
            {totalClaimableDailyCount > 0 && (
              <span
                aria-label={`${totalClaimableDailyCount} mission rewards ready`}
                className="absolute -top-2 -right-2 min-w-5 h-5 px-1.5 rounded-full bg-amber-400 border-2 border-[#0b1322] text-[11px] font-black leading-none text-slate-950 flex items-center justify-center font-mono-num shadow"
              >
                {totalClaimableDailyCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenWeekly}
            className={`relative inline-flex items-center gap-2 rounded-2xl active:scale-95 border font-display font-bold uppercase tracking-wider text-sm px-4 sm:px-5 py-3.5 shadow-lg transition-transform cursor-pointer ${
              claimableWeeklyCount > 0
                ? 'bg-amber-400 hover:bg-amber-300 border-amber-200/60 text-slate-950'
                : 'bg-[#0b1322]/90 hover:bg-[#162238] border-white/20 text-white'
            }`}
          >
            <Crown
              className={`w-4 h-4 ${
                claimableWeeklyCount > 0 ? 'text-slate-950' : 'text-amber-300'
              }`}
            />
            <span>Weekly</span>
            <span
              className={`ml-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-black font-mono-num ${
                claimableWeeklyCount > 0
                  ? 'bg-slate-950/20 text-slate-950'
                  : 'bg-white/10 text-amber-200'
              }`}
            >
              {claimableWeeklyCount > 0 ? `Claim ${claimableWeeklyCount}` : `${weeklyDoneCount}/3`}
            </span>
            {claimableWeeklyCount > 0 && (
              <span
                aria-label={`${claimableWeeklyCount} weekly challenge rewards ready`}
                className="absolute -top-2 -right-2 min-w-5 h-5 px-1.5 rounded-full bg-emerald-400 border-2 border-[#0b1322] text-[11px] font-black leading-none text-slate-950 flex items-center justify-center font-mono-num shadow"
              >
                {claimableWeeklyCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onOpenWardrobe()}
            className={`relative inline-flex items-center gap-2 rounded-2xl active:scale-95 border font-display font-bold uppercase tracking-wider text-sm px-4 sm:px-5 py-3.5 shadow-lg transition-transform cursor-pointer ${
              globalEvent.active
                ? 'bg-[#170c2b]/92 hover:bg-[#231140] border-pink-400/55 text-white'
                : 'bg-[#0b1322]/90 hover:bg-[#162238] border-white/20 text-white'
            }`}
          >
            <Shirt
              className={`w-4 h-4 ${
                globalEvent.active ? 'text-pink-300' : 'text-sky-300'
              }`}
            />
            <span>Skins</span>
            <span className="ml-0.5 rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-black text-sky-200 font-mono-num">
              {save.unlockedSkinIds.length}/{CHARACTER_SKINS.length}
            </span>
            {globalEvent.active && (
              <span className="absolute -top-2 -right-2 rounded-full bg-pink-500 border-2 border-[#0b1322] px-1.5 py-0.5 text-[9px] font-black uppercase leading-none text-white shadow">
                Event
              </span>
            )}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] sm:text-xs font-semibold text-white/90 bg-[#0b1322]/75 border border-white/10 rounded-xl px-3.5 py-1.5">
          <span>Swipe / Arrows Move</span>
          <span className="text-white/40">·</span>
          <span>Up / Space Jump</span>
          <span className="text-white/40">·</span>
          <span>Down / S Slide</span>
          <span className="text-white/40 hidden sm:inline">·</span>
          <span
            className={`hidden sm:inline font-bold ${
              activeSkin.id === CARNIVAL_RUNNER_SKIN.id ? 'text-pink-300' : 'text-sky-300'
            }`}
          >
            Runner: {activeSkin.name}
          </span>
        </div>
      </div>
    </div>
  );
});
