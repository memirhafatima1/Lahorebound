import React from 'react';
import { Flame, Gauge, Hourglass } from 'lucide-react';
import { DIFFICULTY_CONFIGS } from '../game/difficulty';
import type { DifficultyMode } from '../game/types';

interface SpeedVisualizationProps {
  speedMultiplier: number;
  difficulty: DifficultyMode;
  chronosTimer: number;
  speedBoostTimer: number;
}

const SEGMENT_COUNT = 8;

export const SpeedVisualization: React.FC<SpeedVisualizationProps> = ({
  speedMultiplier,
  difficulty,
  chronosTimer,
  speedBoostTimer,
}) => {
  const diffCfg = DIFFICULTY_CONFIGS[difficulty];
  const isChronosSlow = chronosTimer > 0;
  const effectiveMultiplier = isChronosSlow ? speedMultiplier * 0.48 : speedMultiplier;
  const isOverdrive = !isChronosSlow && speedMultiplier > 2.0;
  const isSupersonic = !isChronosSlow && speedMultiplier >= 3.0;

  // Normalize fill across 1.0x -> max ceiling (expand ceiling if lucky-wheel boost pushes past normal max)
  const scaleCeiling = Math.max(diffCfg.maxMultiplier, speedMultiplier, 2.25);
  const speedRatio = Math.min(
    1,
    Math.max(0, (effectiveMultiplier - 1) / Math.max(0.15, scaleCeiling - 1)),
  );

  // Normalized position of the 2.0x overdrive threshold on the arc/segments
  const thresholdRatio = Math.min(
    0.92,
    Math.max(0.15, (2.0 - 1) / Math.max(0.15, scaleCeiling - 1)),
  );
  const sonicThresholdRatio =
    scaleCeiling >= 2.95
      ? Math.min(0.97, Math.max(thresholdRatio + 0.08, (3.0 - 1) / Math.max(0.15, scaleCeiling - 1)))
      : null;

  const isCoolCruise = !isChronosSlow && speedMultiplier < 1.5;

  // Smooth continuous weights for the container's atmospheric color transition:
  // < 1.5x: cool blue -> 1.5x..2.99x: warm amber-orange -> >= 3.0x: energized orange-to-violet gradient
  const coolBlueWeight = isChronosSlow
    ? 0
    : speedMultiplier < 1.5
      ? 1
      : Math.max(0, 1 - (speedMultiplier - 1.5) / 0.75);
  const warmAmberWeight = isChronosSlow
    ? 0
    : speedMultiplier < 1.5
      ? 0
      : isSupersonic
        ? 0.25
        : Math.min(1, 0.35 + ((speedMultiplier - 1.5) / 1.15) * 0.65);
  const orangeVioletWeight = isChronosSlow
    ? 0
    : isSupersonic
      ? 1
      : speedMultiplier >= 2.65
        ? Math.min(0.32, ((speedMultiplier - 2.65) / 0.35) * 0.32)
        : 0;

  // Overdrive intensity scales continuously from 2.0x upward (0.28 right past 2.0x -> 1.0 at 2.6x+)
  const overdriveIntensity = isOverdrive
    ? Math.min(1, 0.28 + ((speedMultiplier - 2.0) / 0.55) * 0.72)
    : 0;
  const supersonicIntensity = isSupersonic
    ? Math.min(1, 0.65 + ((speedMultiplier - 3.0) / 0.6) * 0.35)
    : 0;

  const phaseLabel = isChronosSlow
    ? 'SLOW'
    : isSupersonic
      ? 'OVERDRIVE'
      : isOverdrive
        ? 'SURGE+'
        : speedBoostTimer > 0
          ? 'BOOST'
          : !isCoolCruise
            ? 'SURGE'
            : 'CRUISE';

  const primaryHex = isChronosSlow
    ? '#c084fc'
    : isSupersonic
      ? '#fbbf24'
      : isOverdrive
        ? '#fb923c'
        : !isCoolCruise
          ? '#fbbf24'
          : '#38bdf8';

  const secondaryHex = isChronosSlow
    ? '#22d3ee'
    : isSupersonic
      ? '#a855f7'
      : isOverdrive
        ? '#fbbf24'
        : !isCoolCruise
          ? '#f97316'
          : '#0ea5e9';

  // SVG semi-circular arc geometry (180deg sweep from left to right)
  const radius = 15;
  const arcLength = Math.PI * radius;
  const activeLength = arcLength * Math.max(0.06, speedRatio);
  const thresholdAngleRad = Math.PI * (1 - thresholdRatio);
  const tickInnerX = 20 + Math.cos(thresholdAngleRad) * (radius - 3.2);
  const tickInnerY = 20 - Math.sin(thresholdAngleRad) * (radius - 3.2);
  const tickOuterX = 20 + Math.cos(thresholdAngleRad) * (radius + 3.2);
  const tickOuterY = 20 - Math.sin(thresholdAngleRad) * (radius + 3.2);

  const sonicAngleRad = sonicThresholdRatio !== null ? Math.PI * (1 - sonicThresholdRatio) : 0;
  const sonicInnerX = 20 + Math.cos(sonicAngleRad) * (radius - 3.4);
  const sonicInnerY = 20 - Math.sin(sonicAngleRad) * (radius - 3.4);
  const sonicOuterX = 20 + Math.cos(sonicAngleRad) * (radius + 3.4);
  const sonicOuterY = 20 - Math.sin(sonicAngleRad) * (radius + 3.4);

  const headAngleRad = Math.PI * (1 - speedRatio);
  const headX = 20 + Math.cos(headAngleRad) * radius;
  const headY = 20 - Math.sin(headAngleRad) * radius;

  const activeSegments = Math.max(1, Math.round(speedRatio * SEGMENT_COUNT));
  const thresholdSegIndex = Math.floor(thresholdRatio * SEGMENT_COUNT);

  const containerShadow = isSupersonic
    ? `0 0 ${Math.round(24 + supersonicIntensity * 18)}px ${Math.round(
        4 + supersonicIntensity * 6,
      )}px rgba(168, 85, 247, 0.56), -6px 0 22px rgba(249, 115, 22, 0.42), inset 0 0 18px rgba(249, 115, 22, 0.30)`
    : isOverdrive
      ? `0 0 ${Math.round(18 + overdriveIntensity * 20)}px ${Math.round(
          2 + overdriveIntensity * 5,
        )}px rgba(249, 115, 22, ${(0.34 + overdriveIntensity * 0.4).toFixed(2)}), 0 0 ${Math.round(
          10 + overdriveIntensity * 14,
        )}px rgba(251, 191, 36, ${(0.18 + overdriveIntensity * 0.28).toFixed(2)}), inset 0 0 ${Math.round(
          10 + overdriveIntensity * 12,
        )}px rgba(251, 146, 60, ${(0.18 + overdriveIntensity * 0.24).toFixed(2)})`
      : isChronosSlow
        ? '0 0 14px rgba(168, 85, 247, 0.35)'
        : isCoolCruise
          ? '0 4px 16px rgba(14, 165, 233, 0.24), inset 0 0 14px rgba(56, 189, 248, 0.14)'
          : '0 4px 16px rgba(245, 158, 11, 0.20), inset 0 0 12px rgba(249, 115, 22, 0.12)';

  return (
    <div
      role="status"
      aria-label={`Speed ${effectiveMultiplier.toFixed(2)}x, ${phaseLabel}`}
      className={`relative inline-flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 border transition-[border-color,background-color,box-shadow] duration-500 ease-out ${
        isSupersonic
          ? 'bg-[#1c0c29]/92 border-violet-400/90 animate-speed-mach-pulse'
          : isOverdrive
            ? 'bg-[#22100a]/92 border-orange-400/80'
            : isChronosSlow
              ? 'bg-[#170e2e]/90 border-purple-400/55'
              : isCoolCruise
                ? 'bg-[#081529]/90 border-sky-400/45'
                : 'bg-[#1a130b]/90 border-amber-400/55'
      }`}
      style={{ boxShadow: containerShadow }}
    >
      {/* Smooth multi-tier HUD container background gradient layers (cool blue -> warm orange -> orange-to-violet) */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[11px]"
      >
        <span
          className="absolute inset-0 transition-opacity duration-500 ease-out"
          style={{
            opacity: coolBlueWeight,
            backgroundImage:
              'linear-gradient(135deg, rgba(14, 165, 233, 0.28) 0%, rgba(30, 58, 138, 0.32) 55%, rgba(6, 182, 212, 0.24) 100%)',
          }}
        />
        <span
          className="absolute inset-0 transition-opacity duration-500 ease-out"
          style={{
            opacity: warmAmberWeight,
            backgroundImage:
              'linear-gradient(135deg, rgba(249, 115, 22, 0.30) 0%, rgba(194, 65, 12, 0.24) 52%, rgba(245, 158, 11, 0.32) 100%)',
          }}
        />
        <span
          className="absolute inset-0 transition-opacity duration-500 ease-out"
          style={{
            opacity: orangeVioletWeight,
            backgroundImage:
              'linear-gradient(125deg, rgba(249, 115, 22, 0.54) 0%, rgba(236, 72, 153, 0.42) 48%, rgba(139, 92, 246, 0.58) 100%)',
          }}
        />
        <span
          className="absolute inset-0 transition-opacity duration-500 ease-out"
          style={{
            opacity: isChronosSlow ? 1 : 0,
            backgroundImage:
              'linear-gradient(135deg, rgba(139, 92, 246, 0.32) 0%, rgba(34, 211, 238, 0.24) 100%)',
          }}
        />
      </span>

      {/* Compositor-only radiant overdrive / supersonic amber-to-violet aura layers */}
      {isSupersonic ? (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-[3px] rounded-[14px] border-2 border-orange-300/95 animate-speed-mach-amber"
            style={{
              boxShadow:
                '0 0 24px 4px rgba(249, 115, 22, 0.78), inset 0 0 14px rgba(251, 191, 36, 0.42)',
            }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-[3px] rounded-[14px] border-2 border-violet-400/95 animate-speed-mach-violet"
            style={{
              boxShadow:
                '0 0 28px 6px rgba(168, 85, 247, 0.85), inset 0 0 16px rgba(192, 132, 252, 0.46)',
            }}
          />
        </>
      ) : (
        isOverdrive && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-[2px] rounded-[13px]"
            style={{
              opacity: 0.4 + overdriveIntensity * 0.6,
            }}
          >
            <span className="block w-full h-full rounded-[13px] border border-amber-300/80 animate-speed-overdrive" />
          </span>
        )
      )}

      {/* Telemetry content (hue-shifts swiftly from amber -> violet when breaking 3.0x) */}
      <div
        className={`relative z-10 inline-flex items-center gap-2.5 ${
          isSupersonic ? 'animate-speed-mach-shift' : ''
        }`}
      >
        {/* Precision SVG Arc Speedometer */}
        <div className="relative w-10 h-6 shrink-0 flex items-end justify-center">
          <svg
            viewBox="0 0 40 24"
            className="w-10 h-6 overflow-visible"
            aria-hidden="true"
          >
            {/* Base track */}
            <path
              d="M 5 20 A 15 15 0 0 1 35 20"
              fill="none"
              stroke="rgba(255,255,255,0.14)"
              strokeWidth="3.2"
              strokeLinecap="round"
            />

            {/* Overdrive / Supersonic halo stroke underneath primary arc */}
            {isOverdrive && (
              <path
                d="M 5 20 A 15 15 0 0 1 35 20"
                fill="none"
                stroke={primaryHex}
                strokeWidth={isSupersonic ? 8.5 : 5.5 + overdriveIntensity * 2.5}
                strokeLinecap="round"
                strokeDasharray={`${activeLength} ${arcLength}`}
                opacity={isSupersonic ? 0.58 : 0.28 + overdriveIntensity * 0.32}
              />
            )}

            {/* Active velocity arc */}
            <path
              d="M 5 20 A 15 15 0 0 1 35 20"
              fill="none"
              stroke={primaryHex}
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeDasharray={`${activeLength} ${arcLength}`}
              style={{
                transition: 'stroke-dasharray 120ms ease-out, stroke 200ms ease',
              }}
            />

            {/* 2.0x overdrive threshold notch */}
            {!isChronosSlow && (
              <line
                x1={tickInnerX}
                y1={tickInnerY}
                x2={tickOuterX}
                y2={tickOuterY}
                stroke={isOverdrive ? '#fde68a' : 'rgba(255,255,255,0.45)'}
                strokeWidth="1.25"
                strokeLinecap="round"
              />
            )}

            {/* 3.0x sound barrier threshold notch when scale reaches Mach 3+ */}
            {!isChronosSlow && sonicThresholdRatio !== null && (
              <line
                x1={sonicInnerX}
                y1={sonicInnerY}
                x2={sonicOuterX}
                y2={sonicOuterY}
                stroke={isSupersonic ? '#f5d0fe' : 'rgba(192, 132, 252, 0.7)'}
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            )}

            {/* Arc head indicator */}
            <circle
              cx={headX}
              cy={headY}
              r={isSupersonic ? 2.9 : isOverdrive ? 2.6 : 1.9}
              fill={isOverdrive ? '#fef08a' : primaryHex}
            />
          </svg>

          <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2">
            {isChronosSlow ? (
              <Hourglass className="w-3 h-3 text-cyan-300" />
            ) : isOverdrive ? (
              <Flame
                className={`w-3 h-3 ${isSupersonic ? 'text-amber-200' : 'text-amber-300'}`}
              />
            ) : (
              <Gauge className="w-3 h-3" style={{ color: primaryHex }} />
            )}
          </span>
        </div>

        {/* Numeric Multiplier & Explicit Phase Label */}
        <div className="flex flex-col leading-none">
          <span
            className="text-xs sm:text-sm font-black tabular-nums tracking-tight whitespace-nowrap"
            style={{
              color: isSupersonic
                ? '#fef08a'
                : isOverdrive
                  ? '#ffedd5'
                  : isCoolCruise
                    ? '#e0f2fe'
                    : primaryHex,
              textShadow: isSupersonic
                ? '0 0 14px rgba(249, 115, 22, 0.95)'
                : isOverdrive
                  ? `0 0 ${Math.round(8 + overdriveIntensity * 10)}px rgba(249, 115, 22, 0.9)`
                  : isCoolCruise
                    ? '0 0 10px rgba(56, 189, 248, 0.45)'
                    : undefined,
            }}
          >
            {effectiveMultiplier.toFixed(2)}×
          </span>
          <span
            className="mt-0.5 text-[9px] font-black uppercase tracking-wider whitespace-nowrap"
            style={{
              color: isSupersonic
                ? '#f5d0fe'
                : isOverdrive
                  ? '#fed7aa'
                  : isChronosSlow
                    ? '#67e8f9'
                    : isCoolCruise
                      ? 'rgba(186, 230, 253, 0.9)'
                      : 'rgba(253, 230, 138, 0.88)',
            }}
          >
            {phaseLabel}
          </span>
        </div>

        {/* 8-Segment Kinetic Velocity Equalizer Bars */}
        <div
          className="flex items-end gap-[2.5px] h-4 pl-0.5"
          aria-hidden="true"
        >
          {Array.from({ length: SEGMENT_COUNT }).map((_, i) => {
            const lit = i < activeSegments;
            const pastThreshold = i >= thresholdSegIndex;
            const barColor = !lit
              ? 'rgba(255,255,255,0.12)'
              : isChronosSlow
                ? primaryHex
                : isSupersonic
                  ? i >= SEGMENT_COUNT - 2
                    ? '#e9d5ff'
                    : i >= SEGMENT_COUNT - 4
                      ? '#fbbf24'
                      : '#fb923c'
                  : pastThreshold
                    ? i >= SEGMENT_COUNT - 2
                      ? '#fde047'
                      : primaryHex
                    : secondaryHex;
            const barHeightPx = 6 + Math.round((i / (SEGMENT_COUNT - 1)) * 10);

            return (
              <span
                key={i}
                className="w-[3px] rounded-full transition-colors duration-150"
                style={{
                  height: `${barHeightPx}px`,
                  backgroundColor: barColor,
                  boxShadow:
                    lit && isOverdrive
                      ? `0 0 ${isSupersonic ? 11 : pastThreshold ? 8 : 5}px ${barColor}`
                      : undefined,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
