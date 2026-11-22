import React, { useEffect, useState } from 'react';
import { Check, Compass, Gem, MapPin, Sparkles, X } from 'lucide-react';
import {
  DAILY_LOGIN_STOPS,
  getDailyLoginStatus,
  type DailyCityStop,
  type LahoreLandmarkKind,
} from '../game/dailyLogin';
import type { DailyLoginBonusState } from '../game/types';

interface DailyBonusModalProps {
  dailyLogin: DailyLoginBonusState;
  totalGems: number;
  onClaim: () => void;
  onClose: () => void;
}

const LandmarkGlyph: React.FC<{ kind: LahoreLandmarkKind; color: string }> = ({ kind, color }) => {
  switch (kind) {
    case 'gate':
      return (
        <g fill={color}>
          <rect x="-11" y="-22" width="22" height="10" rx="1.5" />
          <path d="M-4 -12 L-4 -18 A4 4 0 0 1 4 -18 L4 -12 Z" fill="#07101f" />
          <rect x="-12" y="-25" width="4" height="3" />
          <rect x="8" y="-25" width="4" height="3" />
        </g>
      );
    case 'bazaar':
      return (
        <g fill={color}>
          <polygon points="-12,-18 12,-18 9,-24 -9,-24" />
          <rect x="-10" y="-18" width="20" height="6" opacity="0.85" />
          <rect x="-6" y="-16" width="3" height="4" fill="#07101f" />
          <rect x="3" y="-16" width="3" height="4" fill="#07101f" />
        </g>
      );
    case 'mosque':
      return (
        <g fill={color}>
          {/* Badshahi 3-dome & twin minarets silhouette */}
          <rect x="-13" y="-24" width="2.5" height="12" rx="0.5" />
          <rect x="10.5" y="-24" width="2.5" height="12" rx="0.5" />
          <rect x="-9" y="-18" width="18" height="6" />
          <path d="M-4 -18 A4 4.5 0 0 1 4 -18 Z" />
          <path d="M-8.5 -18 A2.2 2.6 0 0 1 -4.1 -18 Z" />
          <path d="M4.1 -18 A2.2 2.6 0 0 1 8.5 -18 Z" />
        </g>
      );
    case 'minar':
      return (
        <g fill={color}>
          {/* Minar-e-Pakistan tapering floral tower */}
          <polygon points="-7,-12 7,-12 5,-16 -5,-16" />
          <polygon points="-3.4,-16 3.4,-16 1.5,-30 -1.5,-30" />
          <circle cx="0" cy="-31.5" r="2.2" />
          <line x1="0" y1="-33.5" x2="0" y2="-36.5" stroke={color} strokeWidth="1.4" />
        </g>
      );
    case 'gardens':
      return (
        <g fill={color}>
          {/* Shalimar Mughal pavilion & fountain */}
          <polygon points="-10,-20 10,-20 0,-26" />
          <rect x="-8" y="-20" width="16" height="8" opacity="0.85" />
          <rect x="-3" y="-18" width="6" height="6" fill="#07101f" />
        </g>
      );
    case 'canal':
      return (
        <g fill={color}>
          {/* Canal Road arched bridge */}
          <rect x="-13" y="-19" width="26" height="3.5" rx="1" />
          <path d="M-9 -15.5 Q0 -21 9 -15.5 L9 -12 L5 -12 Q0 -16 -5 -12 L-9 -12 Z" />
        </g>
      );
    case 'liberty':
      return (
        <g fill={color}>
          {/* Liberty Chowk monument & star */}
          <polygon points="0,-32 2.2,-26.5 8,-26.5 3.4,-23 5,-17.5 0,-20.8 -5,-17.5 -3.4,-23 -8,-26.5 -2.2,-26.5" />
          <rect x="-7" y="-15.5" width="14" height="3.5" rx="1" opacity="0.9" />
        </g>
      );
  }
};

function buildSegmentPath(a: DailyCityStop, b: DailyCityStop): string {
  const midX = (a.mapX + b.mapX) / 2;
  return `M ${a.mapX} ${a.mapY} C ${midX} ${a.mapY}, ${midX} ${b.mapY}, ${b.mapX} ${b.mapY}`;
}

export const DailyBonusModal: React.FC<DailyBonusModalProps> = ({
  dailyLogin,
  totalGems,
  onClaim,
  onClose,
}) => {
  const status = getDailyLoginStatus(dailyLogin);
  const [inspectedIdx, setInspectedIdx] = useState<number>(status.daySlotIndex);

  useEffect(() => {
    setInspectedIdx(status.daySlotIndex);
  }, [status.daySlotIndex]);

  const inspectedStop = DAILY_LOGIN_STOPS[inspectedIdx] ?? status.currentStop;
  const isInspectedCurrent = inspectedIdx === status.daySlotIndex;
  const isInspectedVisited = status.canClaimToday
    ? inspectedIdx < status.daySlotIndex
    : inspectedIdx <= status.daySlotIndex;

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
        aria-labelledby="daily-bonus-modal-title"
        className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl bg-[#0b1322] border border-white/15 p-5 sm:p-6 shadow-2xl text-white"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 shrink-0">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-emerald-300">
              <Compass className="w-3.5 h-3.5" />
              <span>Lahore Journey · Day {status.dayNumber} of 7</span>
            </div>
            <h2
              id="daily-bonus-modal-title"
              className="text-xl sm:text-2xl font-black uppercase tracking-wide mt-1"
            >
              {status.currentStop.locationName}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
              {status.canClaimToday
                ? `Arrived at Stop ${status.dayNumber} · Reward ready to claim`
                : 'Stop logged today · Come back tomorrow for the next landmark'}{' '}
              · Streak: {status.consecutiveDays}d
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close daily login bonus"
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center text-slate-200 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="mt-4 overflow-y-auto pr-0.5 flex-1 min-h-0 flex flex-col gap-3.5">
          {/* Interactive Visual City Progression Map */}
          <div className="rounded-xl bg-[#07101f] border border-white/12 p-2.5 shadow-inner">
            <svg
              viewBox="0 0 560 170"
              className="w-full h-auto block select-none"
              role="img"
              aria-label={`Lahore City Progression Map highlighting Day ${status.dayNumber}: ${status.currentStop.locationName}`}
            >
              <defs>
                <linearGradient id="lahoreMapSky" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0b172c" />
                  <stop offset="55%" stopColor="#12213b" />
                  <stop offset="100%" stopColor="#1b1838" />
                </linearGradient>
                <linearGradient id="routeCompletedGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#fbbf24" />
                </linearGradient>
              </defs>

              {/* Map Backdrop */}
              <rect x="0" y="0" width="560" height="170" rx="10" fill="url(#lahoreMapSky)" />

              {/* Subtle Ravi River & Canal topographic ribbons */}
              <path
                d="M 0 148 Q 140 132 280 144 T 560 134 L 560 170 L 0 170 Z"
                fill="#0ea5e9"
                opacity="0.09"
              />
              <path
                d="M 0 26 Q 180 42 360 22 T 560 32"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1"
                opacity="0.12"
              />

              {/* District Divider Hints */}
              <text
                x="14"
                y="18"
                fill="#94a3b8"
                fontSize="8.5"
                fontWeight="800"
                letterSpacing="1.6"
                opacity="0.7"
              >
                ANDROON WALLED CITY
              </text>
              <text
                x="546"
                y="18"
                textAnchor="end"
                fill="#fcd34d"
                fontSize="8.5"
                fontWeight="800"
                letterSpacing="1.6"
                opacity="0.7"
              >
                CANAL &amp; GULBERG
              </text>

              {/* Route Path Segments */}
              {DAILY_LOGIN_STOPS.slice(1).map((stop, i) => {
                const prevStop = DAILY_LOGIN_STOPS[i];
                const d = buildSegmentPath(prevStop, stop);
                const reached = i + 1 <= status.daySlotIndex;
                return (
                  <g key={`seg_${stop.dayNumber}`}>
                    <path
                      d={d}
                      fill="none"
                      stroke="#334155"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeDasharray="6 5"
                    />
                    {reached && (
                      <path
                        d={d}
                        fill="none"
                        stroke="url(#routeCompletedGrad)"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                    )}
                  </g>
                );
              })}

              {/* 7 Landmark Nodes */}
              {DAILY_LOGIN_STOPS.map((stop, idx) => {
                const isCurrent = idx === status.daySlotIndex;
                const isVisited = status.canClaimToday
                  ? idx < status.daySlotIndex
                  : idx <= status.daySlotIndex;
                const isInspected = idx === inspectedIdx;

                const glyphColor = isCurrent
                  ? '#fbbf24'
                  : isVisited
                    ? '#34d399'
                    : '#64748b';
                const nodeFill = isCurrent
                  ? '#fbbf24'
                  : isVisited
                    ? '#10b981'
                    : '#1e293b';
                const nodeStroke = isCurrent
                  ? '#fef3c7'
                  : isVisited
                    ? '#a7f3d0'
                    : '#475569';
                const labelColor = isCurrent
                  ? '#fde68a'
                  : isVisited
                    ? '#d1fae5'
                    : '#94a3b8';

                return (
                  <g
                    key={stop.dayNumber}
                    transform={`translate(${stop.mapX}, ${stop.mapY})`}
                    onClick={() => setInspectedIdx(idx)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Active Destination Halo */}
                    {isCurrent && (
                      <>
                        <circle
                          cx="0"
                          cy="0"
                          r="19"
                          fill="#fbbf24"
                          opacity="0.16"
                        />
                        <circle
                          cx="0"
                          cy="0"
                          r="14"
                          fill="none"
                          stroke="#fbbf24"
                          strokeWidth="1.8"
                          opacity="0.85"
                        />
                      </>
                    )}

                    {/* Inspected Selection Outline */}
                    {isInspected && !isCurrent && (
                      <circle
                        cx="0"
                        cy="0"
                        r="14"
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="1.5"
                      />
                    )}

                    {/* Miniature Architectural Landmark Silhouette */}
                    <LandmarkGlyph kind={stop.landmark} color={glyphColor} />

                    {/* Waypoint Node */}
                    <circle
                      cx="0"
                      cy="0"
                      r="9.5"
                      fill={nodeFill}
                      stroke={nodeStroke}
                      strokeWidth="2"
                    />
                    <text
                      x="0"
                      y="3.5"
                      textAnchor="middle"
                      fill={isCurrent || isVisited ? '#061121' : '#cbd5e1'}
                      fontSize="9.5"
                      fontWeight="900"
                    >
                      {isVisited && !isCurrent ? '✓' : stop.dayNumber}
                    </text>

                    {/* Today Marker Pill Above Current Landmark */}
                    {isCurrent && (
                      <g transform="translate(0, -40)">
                        <rect
                          x="-22"
                          y="-11"
                          width="44"
                          height="13"
                          rx="4"
                          fill="#fbbf24"
                        />
                        <text
                          x="0"
                          y="-2"
                          textAnchor="middle"
                          fill="#0b1322"
                          fontSize="7.5"
                          fontWeight="900"
                          letterSpacing="0.8"
                        >
                          TODAY
                        </text>
                      </g>
                    )}

                    {/* Landmark Name Below Node */}
                    <text
                      x="0"
                      y="23"
                      textAnchor="middle"
                      fill={labelColor}
                      fontSize="9.5"
                      fontWeight={isCurrent ? '900' : '700'}
                    >
                      {stop.shortName}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Current / Selected Landmark Spotlight Card */}
          <div
            className={`rounded-xl border p-3.5 flex items-center justify-between gap-3 ${
              isInspectedCurrent
                ? 'bg-amber-400/12 border-amber-400/55'
                : isInspectedVisited
                  ? 'bg-emerald-500/10 border-emerald-400/35'
                  : 'bg-white/5 border-white/10'
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider">
                <MapPin
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isInspectedCurrent
                      ? 'text-amber-300'
                      : isInspectedVisited
                        ? 'text-emerald-300'
                        : 'text-slate-400'
                  }`}
                />
                <span
                  className={
                    isInspectedCurrent
                      ? 'text-amber-300'
                      : isInspectedVisited
                        ? 'text-emerald-300'
                        : 'text-slate-300'
                  }
                >
                  Day {inspectedStop.dayNumber} · {inspectedStop.districtTag}
                </span>
              </div>
              <div className="text-base font-black text-white mt-0.5 truncate">
                {inspectedStop.locationName}
              </div>
              <p className="text-xs text-slate-300 mt-0.5 leading-snug">
                {inspectedStop.flavorText}
              </p>
            </div>

            <div className="shrink-0 flex flex-col items-end gap-1">
              <div className="inline-flex items-center gap-1 text-base font-black text-sky-200 tabular-nums">
                <Gem className="w-4 h-4 text-sky-400" />
                <span>+{inspectedStop.rewardGems}</span>
              </div>
              <span
                className={`text-[10px] font-black uppercase tracking-wider ${
                  isInspectedVisited
                    ? 'text-emerald-300'
                    : isInspectedCurrent
                      ? 'text-amber-300'
                      : 'text-slate-400'
                }`}
              >
                {isInspectedVisited
                  ? 'Visited'
                  : isInspectedCurrent
                    ? 'Current Stop'
                    : 'Upcoming'}
              </span>
            </div>
          </div>

          {/* 7-Day Route Stops Strip */}
          <div className="grid grid-cols-7 gap-1.5">
            {DAILY_LOGIN_STOPS.map((stop, idx) => {
              const isCurrent = idx === status.daySlotIndex;
              const isClaimedSlot = status.canClaimToday
                ? idx < status.daySlotIndex
                : idx <= status.daySlotIndex;
              const isReadyNow = status.canClaimToday && isCurrent;

              return (
                <button
                  key={stop.dayNumber}
                  type="button"
                  onClick={() => setInspectedIdx(idx)}
                  aria-label={`Day ${stop.dayNumber}: ${stop.locationName} (+${stop.rewardGems} Gems)`}
                  aria-pressed={idx === inspectedIdx}
                  className={`rounded-xl border px-1 py-2 flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${
                    isReadyNow
                      ? 'bg-amber-400/18 border-amber-400/75'
                      : isClaimedSlot
                        ? 'bg-emerald-500/14 border-emerald-400/45'
                        : idx === inspectedIdx
                          ? 'bg-sky-500/14 border-sky-400/50'
                          : 'bg-white/5 border-white/10 hover:bg-white/8'
                  }`}
                >
                  <span className="text-[10px] font-black uppercase text-slate-300 tabular-nums">
                    D{stop.dayNumber}
                  </span>
                  <span className="mt-1 inline-flex items-center gap-0.5 text-xs font-black text-sky-200 tabular-nums">
                    {isClaimedSlot ? (
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                    ) : isReadyNow ? (
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    ) : (
                      <Gem className="w-3 h-3 text-sky-400" />
                    )}
                    <span>{stop.rewardGems}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between gap-3 pt-3 border-t border-white/10 shrink-0">
          <div className="inline-flex items-center gap-1.5 text-xs font-black text-sky-200 tabular-nums">
            <Gem className="w-4 h-4 text-sky-400" />
            <span>Total: {totalGems} Gems</span>
          </div>

          {status.canClaimToday ? (
            <button
              type="button"
              onClick={onClaim}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black uppercase tracking-wider text-xs px-4 py-2.5 transition-transform cursor-pointer"
            >
              <Gem className="w-3.5 h-3.5" />
              <span>Claim +{status.rewardGems} Gems</span>
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
