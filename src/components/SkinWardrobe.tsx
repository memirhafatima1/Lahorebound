import React, { useState } from 'react';
import { Check, Clock, Crown, Gem, Lock, PartyPopper, Sparkles, Trophy, X } from 'lucide-react';
import type { GlobalEventStatus } from '../game/globalEvents';
import { CARNIVAL_RUNNER_SKIN, CHARACTER_SKINS, getSkinById } from '../game/skins';
import { SKIN_COSMETICS } from '../game/weeklyChallenges';
import type { CharacterSkin, SkinCosmeticId } from '../game/types';

interface SkinWardrobeProps {
  totalGems: number;
  bestDistance: number;
  unlockedSkinIds: string[];
  selectedSkinId: string;
  previewSkinId: string;
  unlockedCosmeticIds: SkinCosmeticId[];
  equippedCosmeticId: SkinCosmeticId | null;
  previewCosmeticId: SkinCosmeticId | null;
  carnivalEvent: GlobalEventStatus;
  onPreviewSkin: (skinId: string) => void;
  onSelectSkin: (skinId: string) => void;
  onUnlockWithGems: (skin: CharacterSkin) => void;
  onPreviewCosmetic: (cosmeticId: SkinCosmeticId | null) => void;
  onEquipCosmetic: (cosmeticId: SkinCosmeticId | null) => void;
  onClose: () => void;
}

export const SkinWardrobe: React.FC<SkinWardrobeProps> = ({
  totalGems,
  bestDistance,
  unlockedSkinIds,
  selectedSkinId,
  previewSkinId,
  unlockedCosmeticIds,
  equippedCosmeticId,
  previewCosmeticId,
  carnivalEvent,
  onPreviewSkin,
  onSelectSkin,
  onUnlockWithGems,
  onPreviewCosmetic,
  onEquipCosmetic,
  onClose,
}) => {
  const [wardrobeTab, setWardrobeTab] = useState<'skins' | 'cosmetics'>('skins');

  const activePreview = getSkinById(previewSkinId);
  const isEventExclusive = activePreview.eventExclusive === 'street_carnival';
  const isEventAvailable = !isEventExclusive || carnivalEvent.active;
  const isUnlocked = isEventExclusive
    ? carnivalEvent.active
    : unlockedSkinIds.includes(activePreview.id);
  const isEquipped = selectedSkinId === activePreview.id && isUnlocked;
  const canAfford = totalGems >= activePreview.costGems;

  const activeCosmetic = previewCosmeticId
    ? SKIN_COSMETICS.find((c) => c.id === previewCosmeticId) ?? null
    : null;
  const cosmeticUnlocked = activeCosmetic ? unlockedCosmeticIds.includes(activeCosmetic.id) : true;
  const cosmeticEquipped = equippedCosmeticId === previewCosmeticId;

  return (
    <div className="fixed inset-0 z-30 pointer-events-none flex flex-col justify-between p-3 sm:p-5">
      {/* Top Bar: Gems & Close (keeps center 3D turntable unobstructed!) */}
      <div className="flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center gap-1.5 rounded-xl bg-[#0b1322]/90 border border-white/15 px-3.5 py-2 text-sm font-black text-sky-200 tabular-nums shadow-lg">
            <Gem className="w-4 h-4 text-sky-400" />
            <span>{totalGems}</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-xl bg-[#0b1322]/90 border border-white/15 px-3.5 py-2 text-sm font-bold text-amber-200 tabular-nums shadow-lg">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Best {bestDistance}m</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#0b1322]/90 border border-white/15 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-[#17253e] active:scale-95 transition-transform cursor-pointer shadow-lg"
        >
          <X className="w-4 h-4" />
          <span>Done</span>
        </button>
      </div>

      {/* Unified Bottom Dock for Skin & Cosmetic Selection */}
      <div className="pointer-events-auto self-center w-[min(940px,95vw)] rounded-2xl bg-[#0b1322]/92 border border-white/15 p-3.5 sm:p-4 shadow-2xl">
        {/* Mode Switcher */}
        <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-white/10">
          <div className="inline-flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 p-1">
            <button
              type="button"
              onClick={() => setWardrobeTab('skins')}
              className={`rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wider cursor-pointer transition-colors ${
                wardrobeTab === 'skins'
                  ? 'bg-sky-400 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Runner Skins ({unlockedSkinIds.length}/{CHARACTER_SKINS.length})
            </button>
            <button
              type="button"
              onClick={() => setWardrobeTab('cosmetics')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wider cursor-pointer transition-colors ${
                wardrobeTab === 'cosmetics'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>Runner Gear ({unlockedCosmeticIds.length}/{SKIN_COSMETICS.length})</span>
            </button>
          </div>

          <div
            className={`hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold ${
              carnivalEvent.active ? 'text-pink-300' : 'text-slate-400'
            }`}
          >
            <PartyPopper className="w-3.5 h-3.5 shrink-0" />
            <span>
              {carnivalEvent.active
                ? `${carnivalEvent.name} Live · ${carnivalEvent.countdownLabel}`
                : `${carnivalEvent.name}: ${carnivalEvent.countdownLabel}`}
            </span>
          </div>
        </div>

        {wardrobeTab === 'skins' ? (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="w-3 h-3 rounded-xs border border-white/40"
                    style={{ backgroundColor: activePreview.swatchHex }}
                  />
                  <h2 className="text-base sm:text-lg font-black uppercase tracking-wide text-white">
                    {activePreview.name}
                  </h2>
                  <span
                    className={`text-xs font-semibold ${
                      isEventExclusive ? 'text-pink-300' : 'text-sky-300/80'
                    }`}
                  >
                    — {activePreview.tagline}
                  </span>
                </div>
                {isEventExclusive ? (
                  <p className="text-xs text-slate-300 mt-0.5 tabular-nums">
                    {carnivalEvent.active ? (
                      <>
                        Temporary <span className="text-pink-300 font-bold">Street Carnival</span> exclusive ·{' '}
                        <span className="text-amber-300 font-bold">{carnivalEvent.countdownLabel}</span>
                      </>
                    ) : (
                      <>
                        Unlocks automatically during <span className="text-pink-300 font-bold">Street Carnival</span> ({carnivalEvent.scheduleSummary})
                      </>
                    )}
                  </p>
                ) : !isUnlocked ? (
                  <p className="text-xs text-slate-300 mt-0.5 tabular-nums">
                    Unlock for <span className="text-sky-300 font-bold">{activePreview.costGems} Gems</span> or reach{' '}
                    <span className="text-amber-300 font-bold">{activePreview.milestoneMeters}m</span> in a run
                  </p>
                ) : null}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isEventExclusive ? (
                  isEventAvailable ? (
                    <button
                      type="button"
                      onClick={() => onSelectSkin(activePreview.id)}
                      disabled={isEquipped}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-transform active:scale-95 cursor-pointer ${
                        isEquipped
                          ? 'bg-pink-500/25 border border-pink-400/60 text-pink-200 cursor-default'
                          : 'bg-pink-500 text-white hover:bg-pink-400'
                      }`}
                    >
                      {isEquipped ? 'Festival Equipped' : 'Equip Carnival Skin'}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/8 border border-white/10 px-3 py-2 text-xs font-bold text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-pink-300" />
                      <span>{carnivalEvent.countdownLabel}</span>
                    </span>
                  )
                ) : isUnlocked ? (
                  <button
                    type="button"
                    onClick={() => onSelectSkin(activePreview.id)}
                    disabled={isEquipped}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-transform active:scale-95 cursor-pointer ${
                      isEquipped
                        ? 'bg-emerald-500/25 border border-emerald-400/50 text-emerald-200 cursor-default'
                        : 'bg-sky-400 text-slate-950 hover:bg-sky-300'
                    }`}
                  >
                    {isEquipped ? 'Equipped' : 'Equip Runner'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onUnlockWithGems(activePreview)}
                    disabled={!canAfford}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-transform active:scale-95 ${
                      canAfford
                        ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 cursor-pointer'
                        : 'bg-white/10 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Gem className="w-3.5 h-3.5" />
                    <span>Unlock · {activePreview.costGems}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Event-Exclusive Carnival Runner Banner Card */}
            <button
              type="button"
              onClick={() => {
                onPreviewSkin(CARNIVAL_RUNNER_SKIN.id);
                if (carnivalEvent.active) {
                  onSelectSkin(CARNIVAL_RUNNER_SKIN.id);
                }
              }}
              className={`mb-2.5 w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left border transition-all cursor-pointer ${
                previewSkinId === CARNIVAL_RUNNER_SKIN.id
                  ? 'bg-pink-500/18 border-pink-400 shadow-[0_0_0_1px_rgba(244,114,182,0.5)]'
                  : carnivalEvent.active
                    ? 'bg-pink-500/10 border-pink-400/45 hover:bg-pink-500/16'
                    : 'bg-white/4 border-white/10 hover:bg-white/8'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className="w-3.5 h-3.5 rounded-xs border border-white/30"
                    style={{ backgroundColor: CARNIVAL_RUNNER_SKIN.swatchHex }}
                  />
                  <span
                    className="w-2.5 h-3.5 rounded-xs border border-white/30"
                    style={{ backgroundColor: CARNIVAL_RUNNER_SKIN.accentHex }}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black uppercase tracking-wider text-white">
                      {CARNIVAL_RUNNER_SKIN.name}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-pink-300">
                      {carnivalEvent.active ? 'Event Active' : 'Event Exclusive'}
                    </span>
                  </div>
                  <div className="text-[11px] font-medium text-slate-300 truncate">
                    {carnivalEvent.active
                      ? `${carnivalEvent.triggerLabel} · ${carnivalEvent.countdownLabel} · Free for duration of event`
                      : `${carnivalEvent.triggerLabel} · ${carnivalEvent.countdownLabel}`}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 text-xs font-black">
                {selectedSkinId === CARNIVAL_RUNNER_SKIN.id && carnivalEvent.active ? (
                  <span className="inline-flex items-center gap-1 text-pink-300">
                    <Check className="w-4 h-4" />
                    <span>Equipped</span>
                  </span>
                ) : carnivalEvent.active ? (
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <PartyPopper className="w-4 h-4" />
                    <span>Wear Free</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-slate-400">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Locked</span>
                  </span>
                )}
              </div>
            </button>

            {/* Runner Character Roster Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 max-h-[28vh] overflow-y-auto pr-0.5">
              {CHARACTER_SKINS.map((skin) => {
                const unlocked = unlockedSkinIds.includes(skin.id);
                const selected = previewSkinId === skin.id;
                const equipped = selectedSkinId === skin.id;

                return (
                  <button
                    key={skin.id}
                    type="button"
                    onClick={() => {
                      onPreviewSkin(skin.id);
                      if (unlocked) onSelectSkin(skin.id);
                    }}
                    className={`relative flex flex-col items-start rounded-xl p-2.5 text-left border transition-all cursor-pointer ${
                      selected
                        ? 'bg-white/12 border-sky-400 shadow-[0_0_0_1px_rgba(56,189,248,0.5)]'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <div className="flex items-center gap-1">
                        <span
                          className="w-3.5 h-3.5 rounded-xs"
                          style={{ backgroundColor: skin.swatchHex }}
                        />
                        <span
                          className="w-2 h-3.5 rounded-xs"
                          style={{ backgroundColor: skin.accentHex }}
                        />
                      </div>
                      {equipped ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : !unlocked ? (
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                      ) : null}
                    </div>
                    <div className="text-xs font-extrabold text-white truncate w-full">
                      {skin.name}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 tabular-nums">
                      {unlocked ? (equipped ? 'Active' : 'Owned') : `${skin.costGems} Gems`}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <h2 className="text-base sm:text-lg font-black uppercase tracking-wide text-white">
                    {activeCosmetic ? activeCosmetic.name : 'No Cosmetic Gear'}
                  </h2>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  {activeCosmetic
                    ? cosmeticUnlocked
                      ? activeCosmetic.description
                      : `${activeCosmetic.description} · Unlock via ${
                          activeCosmetic.source === 'daily_run'
                            ? 'Daily Run Objective'
                            : 'Weekly Challenges'
                        }`
                    : 'Run with your base runner skin silhouette'}
                </p>
              </div>

              <div>
                {cosmeticUnlocked ? (
                  <button
                    type="button"
                    onClick={() => onEquipCosmetic(previewCosmeticId)}
                    disabled={cosmeticEquipped}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-transform active:scale-95 cursor-pointer ${
                      cosmeticEquipped
                        ? 'bg-emerald-500/25 border border-emerald-400/50 text-emerald-200 cursor-default'
                        : 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                    }`}
                  >
                    {cosmeticEquipped ? 'Equipped' : 'Equip Cosmetic'}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/8 border border-white/10 px-3 py-2 text-xs font-bold text-slate-400">
                    <Lock className="w-3.5 h-3.5" />
                    <span>
                      {activeCosmetic?.source === 'daily_run'
                        ? 'Daily Run Objective'
                        : 'Weekly Challenge Reward'}
                    </span>
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-[30vh] overflow-y-auto pr-0.5">
              <button
                type="button"
                onClick={() => {
                  onPreviewCosmetic(null);
                  onEquipCosmetic(null);
                }}
                className={`flex flex-col items-start rounded-xl p-2.5 text-left border transition-all cursor-pointer ${
                  previewCosmeticId === null
                    ? 'bg-white/12 border-sky-400'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <span className="w-3.5 h-3.5 rounded-xs bg-slate-500" />
                  {equippedCosmeticId === null && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <div className="text-xs font-extrabold text-white">None</div>
                <div className="text-[10px] font-bold text-slate-400">Default</div>
              </button>

              {SKIN_COSMETICS.map((cosmetic) => {
                const unlocked = unlockedCosmeticIds.includes(cosmetic.id);
                const selected = previewCosmeticId === cosmetic.id;
                const equipped = equippedCosmeticId === cosmetic.id;

                return (
                  <button
                    key={cosmetic.id}
                    type="button"
                    onClick={() => {
                      onPreviewCosmetic(cosmetic.id);
                      if (unlocked) onEquipCosmetic(cosmetic.id);
                    }}
                    className={`flex flex-col items-start rounded-xl p-2.5 text-left border transition-all cursor-pointer ${
                      selected
                        ? 'bg-white/12 border-amber-400 shadow-[0_0_0_1px_rgba(251,191,36,0.5)]'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <div className="flex items-center gap-1">
                        <span
                          className="w-3.5 h-3.5 rounded-xs"
                          style={{ backgroundColor: cosmetic.accentHex }}
                        />
                        <span
                          className="w-2 h-3.5 rounded-xs"
                          style={{ backgroundColor: cosmetic.secondaryHex }}
                        />
                      </div>
                      {equipped ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : !unlocked ? (
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                      ) : null}
                    </div>
                    <div className="text-xs font-extrabold text-white truncate w-full">
                      {cosmetic.name}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400">
                      {unlocked
                        ? equipped
                          ? 'Active'
                          : 'Owned'
                        : cosmetic.source === 'daily_run'
                          ? 'Daily Run'
                          : 'Weekly Reward'}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
