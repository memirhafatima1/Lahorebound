import React, { useEffect, useRef, useState } from 'react';
import { Check, Flame, Gem, Gift, Sparkles, Trophy, X } from 'lucide-react';
import {
  LUCKY_WHEEL_SLICES,
  computeWheelTargetRotation,
  getLuckyWheelStatus,
  pickWeightedLuckySliceIndex,
  type LuckyWheelOutcome,
} from '../game/luckyWheel';
import type { LuckyWheelSlice, LuckyWheelState, TemporarySpeedBoostState } from '../game/types';

interface LuckyWheelModalProps {
  luckyWheel: LuckyWheelState;
  pendingSpeedBoost: TemporarySpeedBoostState | null;
  totalGems: number;
  onSpinComplete: (slice: LuckyWheelSlice) => LuckyWheelOutcome;
  onWheelTick: () => void;
  onClose: () => void;
}

const SLICE_COUNT = LUCKY_WHEEL_SLICES.length;
const SLICE_DEG = 360 / SLICE_COUNT;
const SPIN_DURATION_MS = 3800;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function buildWedgePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const p1 = polarToCartesian(cx, cy, r, startDeg);
  const p2 = polarToCartesian(cx, cy, r, endDeg);
  return `M ${cx} ${cy} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 0 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} Z`;
}

export const LuckyWheelModal: React.FC<LuckyWheelModalProps> = ({
  luckyWheel,
  pendingSpeedBoost,
  totalGems,
  onSpinComplete,
  onWheelTick,
  onClose,
}) => {
  const status = getLuckyWheelStatus(luckyWheel);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [pointerKick, setPointerKick] = useState(0);
  const [outcome, setOutcome] = useState<LuckyWheelOutcome | null>(null);

  const rafRef = useRef<number>(0);
  const pointerTimeoutRef = useRef<number>(0);
  const rotationRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.clearTimeout(pointerTimeoutRef.current);
    };
  }, []);

  const handleSpin = () => {
    if (spinning || !status.canSpinToday) return;

    const chosenIdx = pickWeightedLuckySliceIndex();
    const chosenSlice = LUCKY_WHEEL_SLICES[chosenIdx];
    const startAngle = rotationRef.current;
    const targetAngle = computeWheelTargetRotation(chosenIdx, startAngle, SLICE_COUNT);

    setOutcome(null);
    setSpinning(true);

    const startTime = performance.now();
    let lastPegIndex = Math.floor((startAngle + SLICE_DEG / 2) / SLICE_DEG);

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / SPIN_DURATION_MS);
      // Smooth cubic-quartic deceleration curve
      const eased = 1 - Math.pow(1 - t, 3.6);
      const current = startAngle + (targetAngle - startAngle) * eased;
      rotationRef.current = current;
      setRotationDeg(current);

      const pegIndex = Math.floor((current + SLICE_DEG / 2) / SLICE_DEG);
      if (pegIndex !== lastPegIndex) {
        lastPegIndex = pegIndex;
        onWheelTick();
        setPointerKick(-20);
        window.clearTimeout(pointerTimeoutRef.current);
        pointerTimeoutRef.current = window.setTimeout(() => setPointerKick(0), 65);
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setSpinning(false);
        const result = onSpinComplete(chosenSlice);
        setOutcome(result);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#060b14]/75 p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !spinning) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lucky-wheel-modal-title"
        className="w-full max-w-lg rounded-2xl bg-[#0b1322] border border-white/15 p-5 sm:p-6 shadow-2xl text-white my-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-amber-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Daily Lucky Wheel</span>
            </div>
            <h2
              id="lucky-wheel-modal-title"
              className="text-xl sm:text-2xl font-black uppercase tracking-wide mt-1"
            >
              {status.canSpinToday
                ? 'Free Daily Spin Ready'
                : outcome
                  ? 'Prize Won Today!'
                  : 'Come Back Tomorrow'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
              Spin once daily for Gems, Runner Cosmetics, or Next-Run Speed Boosts · Spins:{' '}
              {status.totalSpins}
            </p>
          </div>

          <button
            type="button"
            disabled={spinning}
            onClick={onClose}
            aria-label="Close Lucky Wheel"
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-40 flex items-center justify-center text-slate-200 cursor-pointer disabled:cursor-not-allowed shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Wheel Stage */}
        <div className="mt-4 flex flex-col items-center">
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
            {/* Top 12-o'clock Pointer Pin */}
            <div
              className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-20 transition-transform duration-75 origin-top"
              style={{ transform: `rotate(${pointerKick}deg)` }}
            >
              <svg width="32" height="36" viewBox="0 0 32 36" aria-hidden="true">
                <path
                  d="M16 34 L4 10 C2 5 6 1 11 1 L21 1 C26 1 30 5 28 10 Z"
                  fill="#fbbf24"
                  stroke="#0b1322"
                  strokeWidth="3"
                />
                <circle cx="16" cy="10" r="3.5" fill="#0b1322" />
              </svg>
            </div>

            {/* Rotating SVG Prize Wheel */}
            <svg
              viewBox="0 0 320 320"
              className="w-full h-full drop-shadow-[0_14px_30px_rgba(0,0,0,0.65)]"
              style={{
                transform: `rotate(${rotationDeg}deg)`,
                willChange: 'transform',
              }}
              aria-label="Lucky Wheel"
            >
              {/* Outer Gold Rim */}
              <circle cx="160" cy="160" r="152" fill="#1e293b" stroke="#fbbf24" strokeWidth="6" />
              <circle cx="160" cy="160" r="142" fill="#0f172a" />

              {/* 8 Prize Wedges */}
              {LUCKY_WHEEL_SLICES.map((slice, idx) => {
                const centerDeg = -90 + idx * SLICE_DEG;
                const startDeg = centerDeg - SLICE_DEG / 2;
                const endDeg = centerDeg + SLICE_DEG / 2;
                const path = buildWedgePath(160, 160, 136, startDeg, endDeg);
                const [topWord, bottomWord] = slice.shortLabel.split(' ');
                const kindTag =
                  slice.kind === 'gems' ? 'GEM' : slice.kind === 'cosmetic' ? 'SKIN' : 'PACE';

                return (
                  <g key={slice.id}>
                    <path d={path} fill={slice.colorHex} stroke="#0b1322" strokeWidth="2.5" />
                    <g transform={`translate(160, 160) rotate(${idx * SLICE_DEG})`}>
                      <text
                        x="0"
                        y="-112"
                        textAnchor="middle"
                        fill={slice.accentHex}
                        fontSize="8.5"
                        fontWeight="900"
                        letterSpacing="1.2"
                      >
                        {kindTag}
                      </text>
                      <text
                        x="0"
                        y="-95"
                        textAnchor="middle"
                        fill={slice.textHex}
                        fontSize="12.5"
                        fontWeight="900"
                      >
                        {topWord}
                      </text>
                      {bottomWord && (
                        <text
                          x="0"
                          y="-81"
                          textAnchor="middle"
                          fill={slice.textHex}
                          fontSize="10"
                          fontWeight="800"
                          opacity="0.92"
                        >
                          {bottomWord}
                        </text>
                      )}
                    </g>
                  </g>
                );
              })}

              {/* 8 Brass Pegs at Wedge Boundaries */}
              {LUCKY_WHEEL_SLICES.map((slice, idx) => {
                const pegPos = polarToCartesian(160, 160, 141, -90 + idx * SLICE_DEG + SLICE_DEG / 2);
                return (
                  <circle
                    key={`peg_${slice.id}`}
                    cx={pegPos.x}
                    cy={pegPos.y}
                    r="4.2"
                    fill="#fde68a"
                    stroke="#0b1322"
                    strokeWidth="1.5"
                  />
                );
              })}

              {/* Center Hub */}
              <circle cx="160" cy="160" r="26" fill="#0b1322" stroke="#fbbf24" strokeWidth="4" />
              <circle cx="160" cy="160" r="14" fill="#fbbf24" />
            </svg>
          </div>

          {/* Outcome / Primed Boost / Cooldown Banner */}
          {outcome && (
            <div
              className="mt-4 w-full rounded-xl border p-3.5 flex items-center justify-between gap-3"
              style={{
                borderColor: `${outcome.slice.accentHex}75`,
                backgroundColor: 'rgba(255,255,255,0.06)',
              }}
            >
              <div className="min-w-0">
                <div
                  className="text-[11px] font-black uppercase tracking-wider"
                  style={{ color: outcome.slice.accentHex }}
                >
                  {outcome.cosmeticUnlocked
                    ? 'New Runner Cosmetic Unlocked!'
                    : outcome.speedBoostGranted
                      ? 'Speed Boost Ready!'
                      : 'Gem Jackpot!'}
                </div>
                <div className="text-sm sm:text-base font-black text-white truncate mt-0.5">
                  {outcome.cosmeticUnlocked ? outcome.cosmeticUnlocked.name : outcome.slice.title}
                </div>
                <div className="text-xs text-slate-300 mt-0.5">{outcome.summaryText}</div>
              </div>
              <div className="shrink-0 w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                {outcome.cosmeticUnlocked ? (
                  <Trophy className="w-5 h-5 text-purple-300" />
                ) : outcome.speedBoostGranted ? (
                  <Flame className="w-5 h-5 text-amber-300" />
                ) : (
                  <Gem className="w-5 h-5 text-sky-300" />
                )}
              </div>
            </div>
          )}

          {!outcome && pendingSpeedBoost && (
            <div className="mt-4 w-full rounded-xl bg-amber-400/12 border border-amber-400/45 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-amber-200 font-bold">
                <Flame className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Next Run Primed: +{Math.round((pendingSpeedBoost.multiplier - 1) * 100)}% Speed for{' '}
                  {pendingSpeedBoost.durationSeconds}s
                </span>
              </div>
              <span className="text-[10px] font-black uppercase bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded shrink-0">
                Armed
              </span>
            </div>
          )}

          {!outcome && !status.canSpinToday && status.lastRewardLabel && (
            <div className="mt-3 w-full rounded-xl bg-white/5 border border-white/10 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Today&apos;s spin claimed ({status.lastRewardLabel})</span>
              </span>
              <span className="text-[11px] font-bold text-slate-400">Resets Midnight</span>
            </div>
          )}
        </div>

        {/* Reward Categories Legend */}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/5 border border-white/10 px-2 py-2">
            <Gem className="w-4 h-4 text-sky-400 mx-auto" />
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-200 mt-1">
              25–120 Gems
            </div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 px-2 py-2">
            <Gift className="w-4 h-4 text-purple-300 mx-auto" />
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-200 mt-1">
              Cosmetics
            </div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 px-2 py-2">
            <Flame className="w-4 h-4 text-amber-400 mx-auto" />
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-200 mt-1">
              Speed Boosts
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-5 flex items-center justify-between gap-3 pt-3 border-t border-white/10">
          <div className="inline-flex items-center gap-1.5 text-xs font-black text-sky-200 tabular-nums">
            <Gem className="w-4 h-4 text-sky-400" />
            <span>Vault: {totalGems} Gems</span>
          </div>

          {status.canSpinToday ? (
            <button
              type="button"
              disabled={spinning}
              onClick={handleSpin}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-65 active:scale-95 text-slate-950 font-black uppercase tracking-wider text-xs px-5 py-2.5 transition-transform cursor-pointer disabled:cursor-wait shadow-[0_6px_20px_rgba(245,158,11,0.35)]"
            >
              <Sparkles className="w-4 h-4" />
              <span>{spinning ? 'Spinning...' : 'Spin Free Wheel'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold uppercase tracking-wider text-xs px-5 py-2.5 cursor-pointer"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
