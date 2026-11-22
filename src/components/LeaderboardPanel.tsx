import React, { useEffect, useState } from 'react';
import { Globe, Monitor, RefreshCw, Trophy } from 'lucide-react';
import { fetchGlobalLeaderboard } from '../game/globalLeaderboard';
import { getSkinById } from '../game/skins';
import type { LeaderboardEntry } from '../game/types';

export type LeaderboardTab = 'local' | 'global';

interface LeaderboardPanelProps {
  localEntries: LeaderboardEntry[];
  highlightEntryId?: string | null;
  localRank?: number | null;
  playerBestScore: number;
  playerBestDistance: number;
  playerSkinId: string;
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
      className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs ${
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
          {entry.playerName ?? entrySkin.name}
        </span>
        {highlighted && (
          <span className="text-[9px] font-black uppercase bg-sky-400 text-slate-950 px-1 py-0.2 rounded shrink-0">
            You
          </span>
        )}
      </div>
      <div className="flex items-center gap-2.5 shrink-0 tabular-nums">
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
  playerBestScore,
  playerBestDistance,
  playerSkinId,
  defaultTab = 'local',
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>(defaultTab);
  const [globalStatus, setGlobalStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [globalEntries, setGlobalEntries] = useState<LeaderboardEntry[]>([]);
  const [globalPlayerRank, setGlobalPlayerRank] = useState<number | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    if (activeTab !== 'global') return;

    const controller = new AbortController();
    setGlobalStatus('loading');

    fetchGlobalLeaderboard(
      playerBestScore > 0
        ? {
            score: playerBestScore,
            distance: playerBestDistance,
            skinId: playerSkinId,
          }
        : undefined,
      controller.signal,
    )
      .then((res) => {
        if (controller.signal.aborted) return;
        setGlobalEntries(res.entries);
        setGlobalPlayerRank(res.playerRank);
        setGlobalStatus('loaded');
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setGlobalStatus('error');
      });

    return () => {
      controller.abort();
    };
  }, [activeTab, playerBestScore, playerBestDistance, playerSkinId, refreshNonce]);

  const activeRankBadge =
    activeTab === 'local'
      ? localRank !== null
        ? `Ranked #${localRank}`
        : null
      : globalStatus === 'loaded' && globalPlayerRank !== null
        ? `Global #${globalPlayerRank}`
        : null;

  return (
    <div className={`rounded-xl bg-white/5 border border-white/10 p-3 ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-sky-300">
          <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Top 5 High Scores</span>
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
        className="grid grid-cols-2 gap-1 rounded-lg bg-[#080f1d] border border-white/10 p-1 mb-2.5"
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

      {/* Local Leaderboard List */}
      {activeTab === 'local' && (
        <div className="flex flex-col gap-1">
          {localEntries.length === 0 ? (
            <div className="rounded-lg bg-white/3 px-3 py-4 text-center text-xs text-slate-400">
              Complete a run to record your first local high score.
            </div>
          ) : (
            localEntries.map((entry, idx) => (
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
              <span>Unable to load global rankings right now.</span>
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
              No global scores available yet.
            </div>
          )}

          {globalStatus === 'loaded' && globalEntries.length > 0 && (
            <>
              {globalEntries.map((entry, idx) => (
                <LeaderboardRow
                  key={entry.id}
                  rank={idx + 1}
                  entry={entry}
                  highlighted={Boolean(entry.isPlayer)}
                />
              ))}

              {playerBestScore > 0 && globalPlayerRank !== null && globalPlayerRank > 5 && (
                <div className="mt-1 pt-1.5 border-t border-white/10">
                  <LeaderboardRow
                    rank={globalPlayerRank}
                    entry={{
                      id: 'global_player_outside_top5',
                      playerName: 'You (Best)',
                      score: playerBestScore,
                      distance: playerBestDistance,
                      skinId: playerSkinId,
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
