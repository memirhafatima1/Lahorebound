import React, { useState } from 'react';
import {
  Award,
  Check,
  Crown,
  Footprints,
  Gem,
  Lock,
  Sparkles,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import {
  PROFILE_BADGES,
  SKIN_COSMETICS,
  getBadgeById,
  getCosmeticById,
  getDaysLeftInWeek,
} from '../game/weeklyChallenges';
import type {
  ProfileBadgeId,
  SkinCosmeticId,
  WeeklyChallenge,
  WeeklyChallengeType,
} from '../game/types';

interface WeeklyChallengeModalProps {
  weekKey: string;
  challenges: WeeklyChallenge[];
  unlockedBadgeIds: ProfileBadgeId[];
  equippedBadgeId: ProfileBadgeId | null;
  unlockedCosmeticIds: SkinCosmeticId[];
  equippedCosmeticId: SkinCosmeticId | null;
  totalGems: number;
  onClaimChallenge: (challengeId: string) => void;
  onEquipBadge: (badgeId: ProfileBadgeId | null) => void;
  onEquipCosmetic: (cosmeticId: SkinCosmeticId | null) => void;
  onClose: () => void;
}

function getChallengeIcon(type: WeeklyChallengeType) {
  switch (type) {
    case 'distance':
      return <Footprints className="w-4 h-4 text-amber-300" />;
    case 'gems':
      return <Gem className="w-4 h-4 text-sky-300" />;
    case 'style':
      return <Sparkles className="w-4 h-4 text-rose-300" />;
    case 'jumps':
      return <Zap className="w-4 h-4 text-emerald-300" />;
  }
}

export const WeeklyChallengeModal: React.FC<WeeklyChallengeModalProps> = ({
  weekKey,
  challenges,
  unlockedBadgeIds,
  equippedBadgeId,
  unlockedCosmeticIds,
  equippedCosmeticId,
  totalGems,
  onClaimChallenge,
  onEquipBadge,
  onEquipCosmetic,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'challenges' | 'rewards'>('challenges');
  const daysLeft = getDaysLeftInWeek();
  const completedCount = challenges.filter((c) => c.progress >= c.target).length;
  const claimableCount = challenges.filter((c) => c.progress >= c.target && !c.claimed).length;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#060b14]/75 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="weekly-modal-title"
        className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-[#0b1322] border border-white/15 p-5 sm:p-6 shadow-2xl text-white"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 shrink-0">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-amber-300">
              <Crown className="w-3.5 h-3.5" />
              <span>Weekly Challenge · {weekKey}</span>
            </div>
            <h2
              id="weekly-modal-title"
              className="text-xl sm:text-2xl font-black uppercase tracking-wide mt-1"
            >
              {activeTab === 'challenges' ? 'Endurance Goals' : 'Badges & Runner Gear'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
              {completedCount}/{challenges.length} completed · {daysLeft}{' '}
              {daysLeft === 1 ? 'day' : 'days'} left this week
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close weekly challenges"
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center text-slate-200 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* View Switcher */}
        <div className="mt-3.5 grid grid-cols-2 gap-1.5 rounded-xl bg-white/5 border border-white/10 p-1 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('challenges')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer ${
              activeTab === 'challenges'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>
              Challenges ({claimableCount > 0 ? `${claimableCount} Ready` : `${completedCount}/3`})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rewards')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer ${
              activeTab === 'rewards'
                ? 'bg-sky-400 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>
              Locker ({unlockedBadgeIds.length}/{PROFILE_BADGES.length})
            </span>
          </button>
        </div>

        {/* Body */}
        <div className="mt-3.5 overflow-y-auto pr-0.5 flex-1 min-h-0">
          {activeTab === 'challenges' ? (
            <div className="flex flex-col gap-3">
              {challenges.map((ch) => {
                const pct = Math.min(100, Math.round((ch.progress / ch.target) * 100));
                const isComplete = ch.progress >= ch.target;
                const canClaim = isComplete && !ch.claimed;
                const badge = getBadgeById(ch.rewardBadgeId);
                const cosmetic = getCosmeticById(ch.rewardCosmeticId);

                return (
                  <div
                    key={ch.id}
                    className={`rounded-xl border p-3.5 transition-colors ${
                      canClaim
                        ? 'bg-amber-400/12 border-amber-400/50'
                        : ch.claimed
                          ? 'bg-emerald-500/10 border-emerald-400/30'
                          : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-[#162238] border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                          {getChallengeIcon(ch.type)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                            {ch.title}
                          </div>
                          <div className="text-sm font-extrabold text-white mt-0.5">
                            {ch.label}
                          </div>
                          <div className="text-[11px] font-bold text-slate-300 tabular-nums mt-0.5">
                            {ch.progress.toLocaleString()} / {ch.target.toLocaleString()}
                            {ch.type === 'distance' ? ' m' : ''} · {pct}%
                          </div>
                        </div>
                      </div>

                      {canClaim ? (
                        <button
                          type="button"
                          onClick={() => onClaimChallenge(ch.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black uppercase tracking-wider text-xs px-3 py-2 transition-transform cursor-pointer shrink-0"
                        >
                          <Crown className="w-3.5 h-3.5" />
                          <span>Claim</span>
                        </button>
                      ) : ch.claimed ? (
                        <div className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-300 shrink-0">
                          <Check className="w-3.5 h-3.5" />
                          <span>Claimed</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-black text-sky-300 tabular-nums shrink-0">
                          <Gem className="w-3.5 h-3.5 text-sky-400" />
                          <span>+{ch.rewardGems}</span>
                        </div>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="mt-2.5 h-2 w-full rounded-full bg-slate-900 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-200 ${
                          ch.claimed
                            ? 'bg-emerald-400'
                            : isComplete
                              ? 'bg-amber-400'
                              : 'bg-sky-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {/* Exclusive Rewards Strip */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px] font-extrabold">
                      {badge && (
                        <span
                          className="inline-flex items-center gap-1 rounded-md bg-[#080f1d] border px-2 py-1"
                          style={{
                            borderColor: `${badge.accentHex}55`,
                            color: badge.accentHex,
                          }}
                        >
                          <Award className="w-3 h-3" />
                          <span>Badge: {badge.name}</span>
                        </span>
                      )}
                      {cosmetic && (
                        <span
                          className="inline-flex items-center gap-1 rounded-md bg-[#080f1d] border px-2 py-1"
                          style={{
                            borderColor: `${cosmetic.accentHex}55`,
                            color: cosmetic.accentHex,
                          }}
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Cosmetic: {cosmetic.name}</span>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#080f1d] border border-sky-400/35 px-2 py-1 text-sky-300 tabular-nums">
                        <Gem className="w-3 h-3" />
                        <span>+{ch.rewardGems} Gems</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Profile Badges */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-300 mb-2">
                  <span>Unique Profile Badges</span>
                  <span className="text-slate-400 tabular-nums">
                    {unlockedBadgeIds.length}/{PROFILE_BADGES.length} Unlocked
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PROFILE_BADGES.map((badge) => {
                    const unlocked = unlockedBadgeIds.includes(badge.id);
                    const equipped = equippedBadgeId === badge.id;

                    return (
                      <button
                        key={badge.id}
                        type="button"
                        disabled={!unlocked}
                        onClick={() => onEquipBadge(equipped ? null : badge.id)}
                        className={`rounded-xl border p-3 text-left transition-colors ${
                          equipped
                            ? 'bg-amber-400/15 border-amber-400/60 cursor-pointer'
                            : unlocked
                              ? 'bg-white/5 hover:bg-white/10 border-white/15 cursor-pointer'
                              : 'bg-white/3 border-white/8 opacity-65 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="inline-flex items-center gap-1.5 text-xs font-black"
                            style={{ color: unlocked ? badge.accentHex : '#94a3b8' }}
                          >
                            <Award className="w-4 h-4 shrink-0" />
                            <span>{badge.name}</span>
                          </span>
                          {equipped ? (
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                              Active
                            </span>
                          ) : !unlocked ? (
                            <Lock className="w-3.5 h-3.5 text-slate-500" />
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300">
                              Equip
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                          {badge.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Runner Skin Cosmetics */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-300 mb-2">
                  <span>Runner Skin Cosmetics</span>
                  <span className="text-slate-400 tabular-nums">
                    {unlockedCosmeticIds.length}/{SKIN_COSMETICS.length} Unlocked
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SKIN_COSMETICS.map((cosmetic) => {
                    const unlocked = unlockedCosmeticIds.includes(cosmetic.id);
                    const equipped = equippedCosmeticId === cosmetic.id;

                    return (
                      <button
                        key={cosmetic.id}
                        type="button"
                        disabled={!unlocked}
                        onClick={() => onEquipCosmetic(equipped ? null : cosmetic.id)}
                        className={`rounded-xl border p-3 text-left transition-colors ${
                          equipped
                            ? 'bg-sky-400/15 border-sky-400/60 cursor-pointer'
                            : unlocked
                              ? 'bg-white/5 hover:bg-white/10 border-white/15 cursor-pointer'
                              : 'bg-white/3 border-white/8 opacity-65 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="inline-flex items-center gap-1.5 text-xs font-black text-white">
                            <span
                              className="w-2.5 h-2.5 rounded-xs shrink-0"
                              style={{ backgroundColor: cosmetic.accentHex }}
                            />
                            <span>{cosmetic.name}</span>
                          </div>
                          {equipped ? (
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                              Equipped
                            </span>
                          ) : !unlocked ? (
                            <Lock className="w-3.5 h-3.5 text-slate-500" />
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300">
                              Equip
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                          {cosmetic.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between gap-3 pt-3 border-t border-white/10 shrink-0">
          <div className="inline-flex items-center gap-1.5 text-xs font-black text-sky-200 tabular-nums">
            <Gem className="w-4 h-4 text-sky-400" />
            <span>Total: {totalGems} Gems</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold uppercase tracking-wider text-xs px-4 py-2.5 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
