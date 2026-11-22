import React from 'react';
import { Trophy, X } from 'lucide-react';
import { LeaderboardPanel, type LeaderboardTab } from './LeaderboardPanel';
import type { LeaderboardEntry } from '../game/types';

interface LeaderboardModalProps {
  localEntries: LeaderboardEntry[];
  playerBestScore: number;
  playerBestDistance: number;
  playerSkinId: string;
  defaultTab?: LeaderboardTab;
  onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  localEntries,
  playerBestScore,
  playerBestDistance,
  playerSkinId,
  defaultTab = 'local',
  onClose,
}) => {
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
        aria-labelledby="leaderboard-modal-title"
        className="w-full max-w-md rounded-2xl bg-[#0b1322] border border-white/15 p-5 sm:p-6 shadow-2xl text-white"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-amber-300">
              <Trophy className="w-3.5 h-3.5" />
              <span>Hall of Stride</span>
            </div>
            <h2
              id="leaderboard-modal-title"
              className="text-xl sm:text-2xl font-black uppercase tracking-wide mt-1"
            >
              Leaderboard
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
              Compare your personal top 5 runs against global Lahore sprinters
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close leaderboard"
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center text-slate-200 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <LeaderboardPanel
          className="mt-4"
          localEntries={localEntries}
          playerBestScore={playerBestScore}
          playerBestDistance={playerBestDistance}
          playerSkinId={playerSkinId}
          defaultTab={defaultTab}
        />

        <div className="mt-5 flex items-center justify-between gap-3 pt-3 border-t border-white/10">
          <div className="text-xs font-bold text-slate-300 tabular-nums">
            Personal Best: <span className="text-amber-300 font-black">{playerBestScore.toLocaleString()}</span> pts ·{' '}
            <span className="text-sky-300 font-black">{playerBestDistance}m</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold uppercase tracking-wider text-xs px-4 py-2 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
