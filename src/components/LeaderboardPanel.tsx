import React, { useEffect, useState } from 'react';
import {
  Award,
  Check,
  Edit3,
  Globe,
  LogIn,
  LogOut,
  Monitor,
  RefreshCw,
  Trophy,
  Upload,
  X,
} from 'lucide-react';
import { DIFFICULTY_CONFIGS, DIFFICULTY_MODES } from '../game/difficulty';
import { FIRESTORE_UPGRADE_URL, isFirestoreQuotaError } from '../game/firebase';
import {
  deriveDefaultHandle,
  fetchGlobalLeaderboard,
  HANDLE_MAX_LENGTH,
  HANDLE_MIN_LENGTH,
  isValidRunnerHandle,
  sanitizeRunnerHandleInput,
  submitGlobalLeaderboardRun,
  subscribeGlobalLeaderboard,
} from '../game/globalLeaderboard';
import { getSkinById } from '../game/skins';
import { getBadgeById } from '../game/weeklyChallenges';
import { useRunnerAuth } from './AuthContext';
import type { DifficultyMode, LeaderboardEntry, ProfileBadgeId } from '../game/types';

export type LeaderboardTab = 'local' | 'global';

export interface PendingRunSubmission {
  difficulty: DifficultyMode;
  score: number;
  distance: number;
  skinId: string;
  badgeId: ProfileBadgeId | null;
  peakSpeedMultiplier: number;
  landmarkReachedName: string;
}

interface LeaderboardPanelProps {
  localEntries: LeaderboardEntry[];
  highlightEntryId?: string | null;
  localRank?: number | null;
  difficulty?: DifficultyMode;
  playerBestScore: number;
  playerBestDistance: number;
  playerSkinId: string;
  playerBadgeId?: ProfileBadgeId | null;
  latestRunForSubmit?: PendingRunSubmission | null;
  defaultTab?: LeaderboardTab;
  className?: string;
}

interface LeaderboardRowProps {
  rank: number;
  entry: LeaderboardEntry;
  highlighted: boolean;
}

const LeaderboardRow: React.FC<LeaderboardRowProps> = ({ rank, entry, highlighted }) => {
  const entrySkin = getSkinById(entry.skinId);
  const badge = entry.badgeId ? getBadgeById(entry.badgeId) : undefined;
  const rankColor =
    rank === 1
      ? 'text-amber-300'
      : rank === 2
        ? 'text-slate-200'
        : rank === 3
          ? 'text-orange-300'
          : 'text-slate-400';

  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
        highlighted ? 'bg-sky-400/18 border border-sky-400/45' : 'bg-white/3'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-6 font-black tabular-nums shrink-0 ${rankColor}`}>#{rank}</span>
        <span
          className="w-2.5 h-2.5 rounded-xs shrink-0"
          style={{ backgroundColor: entrySkin.swatchHex }}
        />
        <span className="font-bold text-slate-100 truncate">
          {entry.playerName ? `@${entry.playerName}` : entrySkin.name}
        </span>
        {badge && (
          <span
            title={badge.name}
            className="inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[9px] font-black shrink-0"
            style={{
              backgroundColor: `${badge.accentHex}22`,
              color: badge.accentHex,
            }}
          >
            <Award className="w-2.5 h-2.5" />
          </span>
        )}
        {highlighted && (
          <span className="text-[9px] font-black uppercase bg-sky-400 text-slate-950 px-1 py-0.2 rounded shrink-0">
            You
          </span>
        )}
      </div>
      <div className="flex items-center gap-2.5 shrink-0 tabular-nums">
        {typeof entry.peakSpeedMultiplier === 'number' && entry.peakSpeedMultiplier >= 2.0 && (
          <span className="hidden sm:inline text-[10px] font-bold text-orange-300/85">
            {entry.peakSpeedMultiplier.toFixed(1)}×
          </span>
        )}
        <span className="text-[11px] font-bold text-slate-300">{entry.distance}m</span>
        <span className="font-black text-amber-300 min-w-[48px] text-right">
          {entry.score.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

export const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({
  localEntries,
  highlightEntryId = null,
  localRank = null,
  difficulty = 'normal',
  playerBestScore,
  playerBestDistance,
  playerSkinId,
  playerBadgeId = null,
  latestRunForSubmit = null,
  defaultTab = 'local',
  className = '',
}) => {
  const {
    user,
    authReady,
    runnerHandle,
    authBusy,
    authError,
    signInWithGoogle,
    signOutRunner,
    saveRunnerHandle,
    clearAuthError,
  } = useRunnerAuth();

  const [activeTab, setActiveTab] = useState<LeaderboardTab>(defaultTab);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyMode>(difficulty);
  const [globalStatus, setGlobalStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [globalErrorQuota, setGlobalErrorQuota] = useState(false);
  const [globalEntries, setGlobalEntries] = useState<LeaderboardEntry[]>([]);
  const [globalPlayerEntry, setGlobalPlayerEntry] = useState<LeaderboardEntry | null>(null);
  const [globalPlayerRank, setGlobalPlayerRank] = useState<number | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const [editingHandle, setEditingHandle] = useState(false);
  const [handleDraft, setHandleDraft] = useState(runnerHandle);
  const [handleSaveError, setHandleSaveError] = useState<string | null>(null);
  const [submittingRun, setSubmittingRun] = useState(false);
  const [submittedRunMsg, setSubmittedRunMsg] = useState<string | null>(null);

  useEffect(() => {
    setSelectedDifficulty(difficulty);
  }, [difficulty]);

  useEffect(() => {
    if (!editingHandle) {
      setHandleDraft(runnerHandle);
    }
  }, [runnerHandle, editingHandle]);

  useEffect(() => {
    if (activeTab !== 'global' || !authReady) return;

    setGlobalStatus('loading');
    setGlobalErrorQuota(false);

    if (user) {
      const unsub = subscribeGlobalLeaderboard(
        selectedDifficulty,
        user.uid,
        (res) => {
          setGlobalEntries(res.entries);
          setGlobalPlayerEntry(res.playerEntry);
          setGlobalPlayerRank(res.playerRank);
          setGlobalStatus('loaded');
        },
        (err) => {
          setGlobalErrorQuota(isFirestoreQuotaError(err));
          setGlobalStatus('error');
        },
      );
      return () => {
        unsub();
      };
    }

    const controller = new AbortController();
    fetchGlobalLeaderboard(selectedDifficulty, null, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        setGlobalEntries(res.entries);
        setGlobalPlayerEntry(res.playerEntry);
        setGlobalPlayerRank(res.playerRank);
        setGlobalStatus('loaded');
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setGlobalErrorQuota(isFirestoreQuotaError(err));
        setGlobalStatus('error');
      });

    return () => {
      controller.abort();
    };
  }, [activeTab, authReady, user, selectedDifficulty, refreshNonce]);

  const scopedLocalEntries = localEntries
    .filter((entry) => (entry.difficulty ?? 'normal') === selectedDifficulty)
    .sort((a, b) => b.score - a.score || b.distance - a.distance)
    .slice(0, 5);

  const activeRankBadge =
    activeTab === 'local'
      ? localRank !== null && selectedDifficulty === difficulty
        ? `Local #${localRank}`
        : null
      : globalStatus === 'loaded' && globalPlayerRank !== null
        ? `Global #${globalPlayerRank}`
        : null;

  const handleSaveHandleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = sanitizeRunnerHandleInput(handleDraft);
    if (!isValidRunnerHandle(cleaned)) {
      setHandleSaveError(
        `Use ${HANDLE_MIN_LENGTH}-${HANDLE_MAX_LENGTH} chars (letters, numbers, _ or -).`,
      );
      return;
    }
    setHandleSaveError(null);
    try {
      await saveRunnerHandle(cleaned, playerSkinId, playerBadgeId ?? null);
      setEditingHandle(false);
    } catch (err) {
      setHandleSaveError(err instanceof Error ? err.message : 'Unable to save handle.');
    }
  };

  const handleSignInAndPost = async () => {
    clearAuthError();
    const signedIn = await signInWithGoogle();
    if (!signedIn || !latestRunForSubmit || latestRunForSubmit.score <= 0) return;
    setSubmittingRun(true);
    try {
      const res = await submitGlobalLeaderboardRun({
        uid: signedIn.uid,
        handle:
          runnerHandle !== 'Lahore_Runner'
            ? runnerHandle
            : deriveDefaultHandle(signedIn.displayName, signedIn.uid),
        difficulty: latestRunForSubmit.difficulty,
        score: latestRunForSubmit.score,
        distance: latestRunForSubmit.distance,
        skinId: latestRunForSubmit.skinId,
        badgeId: latestRunForSubmit.badgeId,
        peakSpeedMultiplier: latestRunForSubmit.peakSpeedMultiplier,
        landmarkReachedName: latestRunForSubmit.landmarkReachedName,
      });
      setSelectedDifficulty(latestRunForSubmit.difficulty);
      setSubmittedRunMsg(
        res.isNewPersonalBest
          ? `Posted @${res.handle} to ${DIFFICULTY_CONFIGS[latestRunForSubmit.difficulty].label} rankings!`
          : `Synced @${res.handle} (higher best already recorded).`,
      );
      setRefreshNonce((n) => n + 1);
    } catch (err) {
      setHandleSaveError(
        isFirestoreQuotaError(err)
          ? 'Daily Firestore quota exceeded; try again tomorrow.'
          : 'Could not post run right now.',
      );
    } finally {
      setSubmittingRun(false);
    }
  };

  const handleManualPostRun = async () => {
    if (!user || !latestRunForSubmit || latestRunForSubmit.score <= 0) return;
    setSubmittingRun(true);
    try {
      const res = await submitGlobalLeaderboardRun({
        uid: user.uid,
        handle: runnerHandle,
        difficulty: latestRunForSubmit.difficulty,
        score: latestRunForSubmit.score,
        distance: latestRunForSubmit.distance,
        skinId: latestRunForSubmit.skinId,
        badgeId: latestRunForSubmit.badgeId,
        peakSpeedMultiplier: latestRunForSubmit.peakSpeedMultiplier,
        landmarkReachedName: latestRunForSubmit.landmarkReachedName,
      });
      setSelectedDifficulty(latestRunForSubmit.difficulty);
      setSubmittedRunMsg(
        res.isNewPersonalBest
          ? `New ${DIFFICULTY_CONFIGS[latestRunForSubmit.difficulty].label} Best posted!`
          : 'Personal best is already higher on this tier.',
      );
      setRefreshNonce((n) => n + 1);
    } catch (err) {
      setHandleSaveError(
        isFirestoreQuotaError(err)
          ? 'Daily Firestore quota exceeded; try again tomorrow.'
          : 'Could not post run right now.',
      );
    } finally {
      setSubmittingRun(false);
    }
  };

  return (
    <div className={`rounded-xl bg-white/5 border border-white/10 p-3 ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-sky-300">
          <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            {activeTab === 'global'
              ? `${DIFFICULTY_CONFIGS[selectedDifficulty].label} Global Ranks`
              : `${DIFFICULTY_CONFIGS[selectedDifficulty].label} Top Runs`}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {activeRankBadge && (
            <span className="text-[10px] font-black uppercase bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded tabular-nums whitespace-nowrap shrink-0">
              {activeRankBadge}
            </span>
          )}
          {activeTab === 'global' && (
            <button
              type="button"
              onClick={() => setRefreshNonce((n) => n + 1)}
              disabled={globalStatus === 'loading'}
              aria-label="Refresh global scores"
              title="Refresh global scores"
              className="w-6 h-6 rounded-md bg-white/8 hover:bg-white/15 disabled:opacity-45 flex items-center justify-center text-slate-300 cursor-pointer disabled:cursor-wait shrink-0"
            >
              <RefreshCw
                className={`w-3 h-3 ${globalStatus === 'loading' ? 'animate-spin' : ''}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Local / Global Tab Switcher */}
      <div
        role="tablist"
        aria-label="Leaderboard Scope"
        className="grid grid-cols-2 gap-1 rounded-lg bg-[#080f1d] border border-white/10 p-1 mb-2"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'local'}
          onClick={() => setActiveTab('local')}
          className={`inline-flex items-center justify-center gap-1.5 rounded-md py-1.5 px-2 text-[11px] font-black uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'local'
              ? 'bg-sky-400 text-slate-950 shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <Monitor className="w-3 h-3" />
          <span>Local</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'global'}
          onClick={() => setActiveTab('global')}
          className={`inline-flex items-center justify-center gap-1.5 rounded-md py-1.5 px-2 text-[11px] font-black uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'global'
              ? 'bg-amber-400 text-slate-950 shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <Globe className="w-3 h-3" />
          <span>Global</span>
        </button>
      </div>

      {/* Difficulty-Scoped Selector */}
      <div
        role="tablist"
        aria-label="Difficulty Ranking Tier"
        className="grid grid-cols-3 gap-1 rounded-lg bg-[#080f1d]/80 border border-white/8 p-1 mb-2.5"
      >
        {DIFFICULTY_MODES.map((mode) => {
          const cfg = DIFFICULTY_CONFIGS[mode];
          const active = selectedDifficulty === mode;
          return (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedDifficulty(mode)}
              className={`rounded-md py-1 px-2 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                active
                  ? 'text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
              style={active ? { backgroundColor: cfg.accentHex } : undefined}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Global Identity & Runner Handle Strip */}
      {activeTab === 'global' && (
        <div className="mb-2.5 rounded-lg bg-[#080f1d]/90 border border-white/10 p-2">
          {!user ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-extrabold text-white truncate">
                  Claim Your Runner Handle
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  Sign in with Google to post {DIFFICULTY_CONFIGS[selectedDifficulty].label} runs
                </div>
              </div>
              <button
                type="button"
                disabled={authBusy || submittingRun}
                onClick={handleSignInAndPost}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-black uppercase tracking-wider text-[10px] px-2.5 py-1.5 cursor-pointer shrink-0"
              >
                <LogIn className="w-3 h-3" />
                <span>{authBusy ? 'Signing In...' : 'Sign In'}</span>
              </button>
            </div>
          ) : editingHandle ? (
            <form onSubmit={handleSaveHandleSubmit} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-amber-300">@</span>
                <input
                  type="text"
                  value={handleDraft}
                  onChange={(e) => setHandleDraft(sanitizeRunnerHandleInput(e.target.value))}
                  maxLength={HANDLE_MAX_LENGTH}
                  placeholder="Lahore_Runner"
                  aria-label="Runner Handle"
                  className="flex-1 min-w-0 rounded-md bg-white/10 border border-white/20 px-2 py-1 text-xs font-bold text-white focus:outline-none focus:border-sky-400"
                />
                <button
                  type="submit"
                  disabled={authBusy}
                  aria-label="Save runner handle"
                  className="w-7 h-7 rounded-md bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 text-slate-950 flex items-center justify-center cursor-pointer shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingHandle(false);
                    setHandleSaveError(null);
                    setHandleDraft(runnerHandle);
                  }}
                  aria-label="Cancel handle edit"
                  className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/15 text-slate-300 flex items-center justify-center cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-[10px] text-slate-400">
                3–18 chars · letters, numbers, _ or -
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Handle
                </span>
                <span className="text-xs font-black text-amber-300 truncate">
                  @{runnerHandle}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {latestRunForSubmit && latestRunForSubmit.score > 0 && (
                  <button
                    type="button"
                    disabled={submittingRun}
                    onClick={handleManualPostRun}
                    title="Sync latest run to global rankings"
                    className="inline-flex items-center gap-1 rounded-md bg-sky-400/20 hover:bg-sky-400/30 border border-sky-400/40 px-2 py-1 text-[10px] font-black text-sky-200 cursor-pointer"
                  >
                    <Upload className="w-3 h-3" />
                    <span>{submittingRun ? 'Syncing' : 'Post'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setHandleDraft(runnerHandle);
                    setHandleSaveError(null);
                    setEditingHandle(true);
                  }}
                  aria-label="Edit runner handle"
                  title="Edit runner handle"
                  className="inline-flex items-center gap-1 rounded-md bg-white/10 hover:bg-white/15 px-2 py-1 text-[10px] font-bold text-slate-200 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => void signOutRunner()}
                  aria-label="Sign out"
                  title="Sign out"
                  className="w-6 h-6 rounded-md bg-white/6 hover:bg-white/12 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {(authError || handleSaveError || submittedRunMsg) && (
            <div
              className={`mt-1.5 text-[10px] font-bold ${
                authError || handleSaveError ? 'text-rose-300' : 'text-emerald-300'
              }`}
            >
              {authError || handleSaveError || submittedRunMsg}
            </div>
          )}
        </div>
      )}

      {/* Local Leaderboard List */}
      {activeTab === 'local' && (
        <div className="flex flex-col gap-1">
          {scopedLocalEntries.length === 0 ? (
            <div className="rounded-lg bg-white/3 px-3 py-4 text-center text-xs text-slate-400">
              No local {DIFFICULTY_CONFIGS[selectedDifficulty].label} runs recorded yet.
            </div>
          ) : (
            scopedLocalEntries.map((entry, idx) => (
              <LeaderboardRow
                key={entry.id}
                rank={idx + 1}
                entry={entry}
                highlighted={highlightEntryId !== null && entry.id === highlightEntryId}
              />
            ))
          )}
        </div>
      )}

      {/* Global Leaderboard List */}
      {activeTab === 'global' && (
        <div className="flex flex-col gap-1">
          {globalStatus === 'loading' && (
            <>
              {[0, 1, 2, 3, 4].map((slot) => (
                <div
                  key={slot}
                  className="h-7 rounded-lg bg-white/5 border border-white/5 px-2 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-3 rounded bg-white/10" />
                    <span className="w-24 h-3 rounded bg-white/10" />
                  </div>
                  <span className="w-16 h-3 rounded bg-white/10" />
                </div>
              ))}
            </>
          )}

          {globalStatus === 'error' && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-400/30 px-3 py-3 text-center text-xs text-rose-200 flex flex-col items-center gap-2">
              <span>
                {globalErrorQuota
                  ? 'Daily Firestore read quota exceeded. Resets tomorrow.'
                  : 'Unable to load global rankings right now.'}
              </span>
              {globalErrorQuota && (
                <a
                  href={FIRESTORE_UPGRADE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-bold text-sky-300 underline"
                >
                  Open Firestore Console
                </a>
              )}
              <button
                type="button"
                onClick={() => setRefreshNonce((n) => n + 1)}
                className="rounded-md bg-white/10 hover:bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {globalStatus === 'loaded' && globalEntries.length === 0 && (
            <div className="rounded-lg bg-white/3 px-3 py-4 text-center text-xs text-slate-400">
              No global {DIFFICULTY_CONFIGS[selectedDifficulty].label} runs yet. Be the first sprinter!
            </div>
          )}

          {globalStatus === 'loaded' && globalEntries.length > 0 && (
            <>
              {globalEntries.slice(0, 5).map((entry, idx) => (
                <LeaderboardRow
                  key={entry.id}
                  rank={idx + 1}
                  entry={entry}
                  highlighted={Boolean(entry.isPlayer)}
                />
              ))}

              {user &&
                globalPlayerEntry &&
                (globalPlayerRank === null || globalPlayerRank > 5) && (
                  <div className="mt-1 pt-1.5 border-t border-white/10">
                    <LeaderboardRow
                      rank={globalPlayerRank ?? 6}
                      entry={globalPlayerEntry}
                      highlighted
                    />
                  </div>
                )}

              {!user && playerBestScore > 0 && (
                <div className="mt-1 pt-1.5 border-t border-white/10">
                  <LeaderboardRow
                    rank={globalEntries.length + 1}
                    entry={{
                      id: 'local_preview_unposted',
                      playerName: runnerHandle,
                      score: playerBestScore,
                      distance: playerBestDistance,
                      skinId: playerSkinId,
                      badgeId: playerBadgeId,
                      recordedAt: '',
                      isPlayer: true,
                    }}
                    highlighted
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
