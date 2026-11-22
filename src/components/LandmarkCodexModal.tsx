import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudFog,
  CloudRain,
  Compass,
  Lock,
  MapPin,
  Sun,
  Wind,
  X,
} from 'lucide-react';
import { LAHORE_TRACK_STOPS, type TrackJourneyStop } from '../game/lahoreJourney';
import { getAllLandmarkForecasts, type LandmarkForecast } from '../game/weather';
import type { LahoreLandmarkKind, WeatherCondition } from '../game/types';

interface LandmarkCodexModalProps {
  unlockedLandmarkIds: LahoreLandmarkKind[];
  landmarkForecasts?: Record<LahoreLandmarkKind, LandmarkForecast>;
  initialLandmark?: LahoreLandmarkKind | null;
  onClose: () => void;
}

const ForecastWeatherIcon: React.FC<{
  condition: WeatherCondition;
  color: string;
  className?: string;
}> = ({ condition, color, className = 'w-3.5 h-3.5 shrink-0' }) => {
  const props = { className, style: { color } };
  switch (condition) {
    case 'light_rain':
      return <CloudRain {...props} />;
    case 'mist':
      return <CloudFog {...props} />;
    case 'sunny_haze':
      return <Sun {...props} />;
    case 'clear':
    default:
      return <Wind {...props} />;
  }
};

const LandmarkIllustration: React.FC<{
  stop: TrackJourneyStop;
  unlocked: boolean;
  compact?: boolean;
}> = ({ stop, unlocked, compact = false }) => {
  const accent = unlocked ? stop.accentHex : '#475569';
  const secondary = unlocked ? '#fde68a' : '#334155';
  const stone = unlocked ? '#cbd5e1' : '#1e293b';
  const terracotta = unlocked ? '#b45309' : '#1e293b';

  const renderArchitecture = () => {
    switch (stop.landmark) {
      case 'gate':
        return (
          <g>
            <rect x="34" y="34" width="24" height="72" rx="2" fill={terracotta} />
            <rect x="142" y="34" width="24" height="72" rx="2" fill={terracotta} />
            <rect x="54" y="42" width="92" height="24" fill={accent} opacity="0.9" />
            <path d="M74 106 L74 68 A26 24 0 0 1 126 68 L126 106 Z" fill="#07101f" />
            <path d="M40 34 A6 8 0 0 1 52 34 Z" fill={stone} />
            <path d="M148 34 A6 8 0 0 1 160 34 Z" fill={stone} />
            <rect x="58" y="37" width="8" height="5" fill={secondary} />
            <rect x="74" y="37" width="8" height="5" fill={secondary} />
            <rect x="90" y="37" width="8" height="5" fill={secondary} />
            <rect x="106" y="37" width="8" height="5" fill={secondary} />
            <rect x="122" y="37" width="8" height="5" fill={secondary} />
            <rect x="134" y="37" width="8" height="5" fill={secondary} />
          </g>
        );
      case 'bazaar':
        return (
          <g>
            <rect x="28" y="48" width="14" height="58" fill={terracotta} />
            <rect x="158" y="48" width="14" height="58" fill={terracotta} />
            <path d="M26 48 Q100 22 174 48 L174 58 Q100 34 26 58 Z" fill={accent} />
            <line x1="42" y1="62" x2="158" y2="62" stroke={secondary} strokeWidth="2" />
            <circle cx="62" cy="68" r="5" fill={secondary} />
            <circle cx="88" cy="70" r="5" fill={accent} />
            <circle cx="112" cy="70" r="5" fill={secondary} />
            <circle cx="138" cy="68" r="5" fill={accent} />
            <rect x="52" y="78" width="22" height="28" rx="2" fill={stone} opacity="0.25" />
            <rect x="126" y="78" width="22" height="28" rx="2" fill={stone} opacity="0.25" />
          </g>
        );
      case 'mosque':
        return (
          <g>
            <rect x="30" y="24" width="10" height="82" rx="1" fill={terracotta} />
            <rect x="160" y="24" width="10" height="82" rx="1" fill={terracotta} />
            <path d="M29 24 A6 8 0 0 1 41 24 Z" fill={stone} />
            <path d="M159 24 A6 8 0 0 1 171 24 Z" fill={stone} />
            <rect x="46" y="56" width="108" height="50" fill={terracotta} />
            <path d="M84 56 A16 20 0 0 1 116 56 Z" fill={stone} />
            <path d="M56 56 A11 14 0 0 1 78 56 Z" fill={stone} />
            <path d="M122 56 A11 14 0 0 1 144 56 Z" fill={stone} />
            <path d="M89 106 L89 76 A11 12 0 0 1 111 76 L111 106 Z" fill="#07101f" />
            <line x1="100" y1="36" x2="100" y2="27" stroke={secondary} strokeWidth="2" />
          </g>
        );
      case 'minar':
        return (
          <g>
            <polygon points="74,106 126,106 118,92 82,92" fill={stone} opacity="0.85" />
            <polygon points="88,92 112,92 105,34 95,34" fill={stone} />
            <polygon points="94,92 106,92 102,42 98,42" fill={accent} opacity="0.7" />
            <circle cx="100" cy="29" r="6" fill={secondary} />
            <line x1="100" y1="23" x2="100" y2="12" stroke={secondary} strokeWidth="2" />
            <rect x="44" y="88" width="22" height="18" rx="1" fill={terracotta} opacity="0.55" />
            <rect x="134" y="88" width="22" height="18" rx="1" fill={terracotta} opacity="0.55" />
          </g>
        );
      case 'gardens':
        return (
          <g>
            <polygon points="56,54 144,54 100,32" fill={stone} />
            <rect x="64" y="54" width="72" height="32" fill={accent} opacity="0.82" />
            <path d="M74 86 L74 66 A8 8 0 0 1 90 66 L90 86 Z" fill="#07101f" />
            <path d="M92 86 L92 64 A8 8 0 0 1 108 64 L108 86 Z" fill="#07101f" />
            <path d="M110 86 L110 66 A8 8 0 0 1 126 66 L126 86 Z" fill="#07101f" />
            <rect x="34" y="88" width="132" height="18" rx="2" fill="#0ea5e9" opacity={unlocked ? '0.45' : '0.18'} />
            <circle cx="100" cy="96" r="4" fill={secondary} />
          </g>
        );
      case 'canal':
        return (
          <g>
            <rect x="20" y="86" width="160" height="20" fill="#0284c7" opacity={unlocked ? '0.55' : '0.2'} />
            <rect x="26" y="48" width="148" height="10" rx="2" fill={accent} />
            <path d="M36 58 Q68 82 100 58 Q132 82 164 58 L164 86 L152 86 L152 68 Q128 84 106 68 L106 86 L94 86 L94 68 Q72 84 48 68 L48 86 L36 86 Z" fill={stone} opacity="0.88" />
            <circle cx="52" cy="40" r="4" fill={secondary} />
            <circle cx="100" cy="40" r="4" fill={secondary} />
            <circle cx="148" cy="40" r="4" fill={secondary} />
          </g>
        );
      case 'liberty':
        return (
          <g>
            <rect x="46" y="88" width="108" height="18" rx="4" fill={stone} opacity="0.75" />
            <rect x="66" y="76" width="68" height="12" rx="2" fill={accent} opacity="0.9" />
            <polygon
              points="100,24 106,42 125,42 110,53 115,71 100,60 85,71 90,53 75,42 94,42"
              fill={secondary}
            />
            <circle cx="54" cy="92" r="3" fill={accent} />
            <circle cx="146" cy="92" r="3" fill={accent} />
          </g>
        );
    }
  };

  return (
    <svg
      viewBox="0 0 200 116"
      className={compact ? 'w-full h-20 block' : 'w-full h-36 sm:h-40 block'}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`codexSky_${stop.landmark}_${compact ? 'c' : 'f'}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#070e1a" />
          <stop offset="100%" stopColor={unlocked ? '#16243d' : '#0d1524'} />
        </linearGradient>
      </defs>
      <rect
        x="0"
        y="0"
        width="200"
        height="116"
        rx="10"
        fill={`url(#codexSky_${stop.landmark}_${compact ? 'c' : 'f'})`}
      />
      {unlocked && (
        <circle cx="100" cy="64" r="46" fill={stop.accentHex} opacity="0.16" />
      )}
      {renderArchitecture()}
      <rect x="0" y="106" width="200" height="10" fill="#060b14" opacity="0.65" />
    </svg>
  );
};

export const LandmarkCodexModal: React.FC<LandmarkCodexModalProps> = ({
  unlockedLandmarkIds,
  landmarkForecasts,
  initialLandmark,
  onClose,
}) => {
  const forecasts = useMemo(
    () => landmarkForecasts ?? getAllLandmarkForecasts(),
    [landmarkForecasts],
  );
  const unlockedSet = useMemo(() => new Set(unlockedLandmarkIds), [unlockedLandmarkIds]);
  const unlockedCount = unlockedSet.size;
  const totalCount = LAHORE_TRACK_STOPS.length;

  const initialSelected = useMemo<LahoreLandmarkKind>(() => {
    if (initialLandmark) return initialLandmark;
    if (unlockedLandmarkIds.length > 0) {
      return unlockedLandmarkIds[unlockedLandmarkIds.length - 1];
    }
    return LAHORE_TRACK_STOPS[0].landmark;
  }, [initialLandmark, unlockedLandmarkIds]);

  const [selectedKind, setSelectedKind] = useState<LahoreLandmarkKind>(initialSelected);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (initialLandmark) {
      setSelectedKind(initialLandmark);
    }
  }, [initialLandmark]);

  const selectedIndex = useMemo(() => {
    const idx = LAHORE_TRACK_STOPS.findIndex((s) => s.landmark === selectedKind);
    return idx >= 0 ? idx : 0;
  }, [selectedKind]);

  const selectedStop = LAHORE_TRACK_STOPS[selectedIndex] ?? LAHORE_TRACK_STOPS[0];
  const selectedForecast = forecasts[selectedStop.landmark];
  const isSelectedUnlocked = unlockedSet.has(selectedStop.landmark);
  const selectedPhotoAvailable = isSelectedUnlocked && !failedImages[selectedStop.landmark];

  const handleStepLandmark = useCallback(
    (delta: -1 | 1) => {
      const nextIdx =
        (selectedIndex + delta + LAHORE_TRACK_STOPS.length) % LAHORE_TRACK_STOPS.length;
      setSelectedKind(LAHORE_TRACK_STOPS[nextIdx].landmark);
    },
    [selectedIndex],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleStepLandmark(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleStepLandmark(1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleStepLandmark]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#060b14]/80 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="landmark-codex-title"
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[#0b1322] border border-white/15 p-5 sm:p-6 shadow-2xl text-white"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 shrink-0">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Lahore Bound · Cultural Archive</span>
            </div>
            <h2
              id="landmark-codex-title"
              className="text-xl sm:text-2xl font-black tracking-tight mt-0.5"
            >
              Landmark Codex
            </h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-300 tabular-nums">
              <span>
                {unlockedCount} of {totalCount} sites discovered
              </span>
              <span aria-hidden="true">·</span>
              <span>Run past sites along the track to unlock entries</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Landmark Codex"
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center text-slate-200 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Overall Discovery Progress Bar */}
        <div className="mt-3.5 h-1.5 w-full rounded-full bg-white/10 overflow-hidden shrink-0">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 via-emerald-400 to-sky-400 transition-all duration-300"
            style={{ width: `${Math.max(4, (unlockedCount / totalCount) * 100)}%` }}
          />
        </div>

        {/* Scrollable Gallery Content */}
        <div className="mt-4 overflow-y-auto pr-0.5 flex-1 min-h-0 flex flex-col gap-4">
          {/* Selected Landmark Spotlight Card */}
          <div
            className="rounded-xl border bg-[#07101f] p-4 grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-4 items-center"
            style={{
              borderColor: isSelectedUnlocked
                ? `${selectedStop.accentHex}66`
                : 'rgba(255,255,255,0.1)',
            }}
          >
            <div className="relative rounded-lg overflow-hidden border border-white/10 aspect-video bg-[#07101f]">
              {selectedPhotoAvailable ? (
                <img
                  key={selectedStop.landmark}
                  src={selectedStop.imageUrl}
                  alt={selectedStop.imageAlt}
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setFailedImages((prev) => ({
                      ...prev,
                      [selectedStop.landmark]: true,
                    }))
                  }
                  className="w-full h-full object-cover block"
                />
              ) : (
                <LandmarkIllustration stop={selectedStop} unlocked={isSelectedUnlocked} />
              )}
              {!isSelectedUnlocked && (
                <div className="absolute inset-0 bg-[#060b14]/55 flex flex-col items-center justify-center gap-1 text-slate-300">
                  <Lock className="w-5 h-5 text-slate-300" />
                  <span className="text-[11px] font-bold tabular-nums">
                    Reach {selectedStop.encounterMeters}m
                  </span>
                </div>
              )}
            </div>

            <div className="min-w-0 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-300 tabular-nums">
                <MapPin
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: isSelectedUnlocked ? selectedStop.accentHex : '#94a3b8' }}
                />
                <span>{selectedStop.subtitle}</span>
                <span aria-hidden="true">·</span>
                <span>{isSelectedUnlocked ? selectedStop.era : `${selectedStop.encounterMeters}m milestone`}</span>
                <span aria-hidden="true">·</span>
                <span
                  className="inline-flex items-center gap-1 font-semibold"
                  style={{ color: selectedForecast.accentHex }}
                  title={`Forecast: ${selectedForecast.label} (${selectedForecast.likelihoodPct}% typical)`}
                >
                  <ForecastWeatherIcon
                    condition={selectedForecast.condition}
                    color={selectedForecast.accentHex}
                  />
                  <span>Forecast: {selectedForecast.label}</span>
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg sm:text-xl font-black tracking-tight text-white truncate">
                  {selectedStop.name}
                </h3>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold shrink-0 ${
                      isSelectedUnlocked ? 'text-emerald-300' : 'text-slate-400'
                    }`}
                  >
                    {isSelectedUnlocked ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Discovered</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Locked</span>
                      </>
                    )}
                  </span>
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleStepLandmark(-1)}
                      aria-label="Previous landmark"
                      className="w-8 h-8 rounded-lg bg-white/8 hover:bg-white/15 flex items-center justify-center text-slate-200 cursor-pointer transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStepLandmark(1)}
                      aria-label="Next landmark"
                      className="w-8 h-8 rounded-lg bg-white/8 hover:bg-white/15 flex items-center justify-center text-slate-200 cursor-pointer transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {isSelectedUnlocked ? (
                <>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                    {selectedStop.history}
                  </p>
                  <div className="pt-1 text-xs text-amber-200/90 font-semibold flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 shrink-0 text-amber-300" />
                    <span>Highlight: {selectedStop.architecturalHighlight}</span>
                  </div>
                </>
              ) : (
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed tabular-nums">
                  Pass through <span className="text-slate-200 font-semibold">{selectedStop.name}</span>{' '}
                  at the <span className="text-amber-300 font-semibold">{selectedStop.encounterMeters}m</span>{' '}
                  mark during a run to unlock its architectural silhouette and historical chronicle in the Codex.
                </p>
              )}
            </div>
          </div>

          {/* 7-Site Collection Grid */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
              <span>Lahore Heritage Collection</span>
              <span className="tabular-nums text-slate-400">
                {unlockedCount}/{totalCount} entries
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {LAHORE_TRACK_STOPS.map((stop) => {
                const unlocked = unlockedSet.has(stop.landmark);
                const selected = stop.landmark === selectedStop.landmark;
                const forecast = forecasts[stop.landmark];

                return (
                  <button
                    key={stop.landmark}
                    type="button"
                    onClick={() => setSelectedKind(stop.landmark)}
                    className={`rounded-xl border p-2 text-left transition-colors cursor-pointer flex flex-col gap-1.5 ${
                      selected
                        ? 'bg-[#121e36] border-white/45'
                        : unlocked
                          ? 'bg-[#07101f] border-white/15 hover:bg-[#0e192d]'
                          : 'bg-[#07101f]/75 border-white/8 hover:bg-[#0d1729]'
                    }`}
                    style={
                      selected
                        ? { borderColor: unlocked ? stop.accentHex : '#38bdf8' }
                        : undefined
                    }
                  >
                    <div className="relative rounded-lg overflow-hidden border border-white/8 aspect-video bg-[#07101f]">
                      {unlocked && !failedImages[stop.landmark] ? (
                        <img
                          src={stop.imageUrl}
                          alt={stop.imageAlt}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedImages((prev) => ({
                              ...prev,
                              [stop.landmark]: true,
                            }))
                          }
                          className="w-full h-full object-cover block"
                        />
                      ) : (
                        <LandmarkIllustration stop={stop} unlocked={unlocked} compact />
                      )}
                      {!unlocked && (
                        <div className="absolute inset-0 bg-[#060b14]/55 flex items-center justify-center">
                          <Lock className="w-4 h-4 text-slate-400" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-xs font-bold truncate ${
                            unlocked ? 'text-white' : 'text-slate-400'
                          }`}
                        >
                          {stop.shortName}
                        </span>
                        <span
                          className="inline-flex items-center gap-1 shrink-0"
                          title={`Forecast: ${forecast.label}`}
                          aria-label={`Forecast: ${forecast.label}`}
                        >
                          <ForecastWeatherIcon
                            condition={forecast.condition}
                            color={forecast.accentHex}
                            className="w-3 h-3 shrink-0"
                          />
                          {unlocked ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-500 tabular-nums shrink-0">
                              {stop.encounterMeters}m
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-1 text-[10px] leading-tight mt-0.5">
                        <span className="text-slate-400 truncate">
                          {unlocked ? stop.subtitle : 'Undiscovered'}
                        </span>
                        <span
                          className="font-semibold shrink-0 truncate"
                          style={{ color: forecast.accentHex }}
                        >
                          {forecast.shortLabel}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-slate-400 tabular-nums">
            {unlockedCount === totalCount
              ? 'Complete Collection · All Lahore heritage sites unlocked'
              : `${totalCount - unlockedCount} ${totalCount - unlockedCount === 1 ? 'landmark' : 'landmarks'} remaining`}
          </span>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs px-4 py-2 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
