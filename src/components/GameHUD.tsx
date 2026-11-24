import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  CloudFog,
  CloudRain,
  Flame,
  Gem,
  Hourglass,
  Landmark,
  Magnet,
  Megaphone,
  Moon,
  Music2,
  PartyPopper,
  Pause,
  Radio,
  Shield,
  SkipForward,
  Sun,
  Sunrise,
  Sunset,
  Volume2,
  VolumeX,
  Wind,
  Zap,
} from 'lucide-react';
import { DIFFICULTY_CONFIGS } from '../game/difficulty';
import { useHudSnapshot } from '../game/hudStore';
import { RADIO_STATIONS, RADIO_STATION_MAP } from '../game/music';
import { SpeedVisualization } from './SpeedVisualization';
import type {
  HudSnapshot,
  PowerupType,
  RadioStationId,
  WeatherCondition,
} from '../game/types';

interface GameHUDProps {
  hud?: HudSnapshot;
  muted: boolean;
  radioStation: RadioStationId;
  showTouchButtons: boolean;
  showOnboardingHint?: boolean;
  onToggleMute: () => void;
  onSelectRadioStation: (station: RadioStationId) => void;
  onCycleRadioStation: () => void;
  onPause: () => void;
  onJump: () => void;
  onSlide: () => void;
  onLeft: () => void;
  onRight: () => void;
}

const FLASH_GRADIENTS: Record<PowerupType, string> = {
  shield: 'radial-gradient(ellipse at center, transparent 68%, rgba(56, 189, 248, 0.34) 100%)',
  magnet: 'radial-gradient(ellipse at center, transparent 68%, rgba(16, 185, 129, 0.34) 100%)',
  multiplier: 'radial-gradient(ellipse at center, transparent 68%, rgba(244, 63, 94, 0.34) 100%)',
  chronos: 'radial-gradient(ellipse at center, transparent 66%, rgba(168, 85, 247, 0.38) 100%)',
};

const PULSE_BAR_HEIGHTS = ['h-2', 'h-3', 'h-3.5', 'h-2.5', 'h-2'] as const;
const PULSE_BAR_DELAYS = ['0ms', '170ms', '320ms', '130ms', '260ms'] as const;

const WeatherIcon: React.FC<{ weather: WeatherCondition; color: string }> = ({
  weather,
  color,
}) => {
  const props = { className: 'w-3 h-3 shrink-0', style: { color } };
  switch (weather) {
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

const TimeOfDayIcon: React.FC<{ label: string }> = ({ label }) => {
  switch (label) {
    case 'Sunrise':
      return <Sunrise className="w-3 h-3 shrink-0 text-orange-300" />;
    case 'Morning':
    case 'Noon':
      return <Sun className="w-3 h-3 shrink-0 text-amber-300" />;
    case 'Dusk':
    case 'Sunset':
      return <Sunset className="w-3 h-3 shrink-0 text-orange-300" />;
    case 'Twilight':
      return <Moon className="w-3 h-3 shrink-0 text-violet-300" />;
    case 'Night':
    default:
      return <Moon className="w-3 h-3 shrink-0 text-indigo-300" />;
  }
};

const LahorePulseBars: React.FC<{ color: string; compact?: boolean }> = ({
  color,
  compact = false,
}) => (
  <span className="inline-flex items-end gap-[2px] h-3.5 shrink-0" aria-hidden="true">
    {PULSE_BAR_HEIGHTS.slice(0, compact ? 4 : 5).map((hClass, i) => (
      <span
        key={i}
        className={`w-[2px] rounded-full animate-lahore-pulse-bar transition-colors duration-700 ${
          compact ? (i % 2 === 0 ? 'h-2' : 'h-3') : hClass
        }`}
        style={{
          backgroundColor: color,
          animationDelay: PULSE_BAR_DELAYS[i],
        }}
      />
    ))}
  </span>
);

export const GameHUD: React.FC<GameHUDProps> = React.memo(({
  hud: propHud,
  muted,
  radioStation,
  showTouchButtons,
  showOnboardingHint = false,
  onToggleMute,
  onSelectRadioStation,
  onCycleRadioStation,
  onPause,
  onJump,
  onSlide,
  onLeft,
  onRight,
}) => {
  const storeHud = useHudSnapshot();
  const hud = propHud ?? storeHud;
  const [flashVisible, setFlashVisible] = useState(false);
  const [comboPopPulse, setComboPopPulse] = useState(false);
  const [gemPopSeq, setGemPopSeq] = useState(0);
  const [distPopSeq, setDistPopSeq] = useState(0);
  const [radioMenuOpen, setRadioMenuOpen] = useState(false);
  const radioMenuRef = useRef<HTMLDivElement | null>(null);
  const prevGemsRef = useRef(hud.runGems);
  const prevDistanceRef = useRef(hud.distance);
  const lastDistPopAtRef = useRef(0);

  useEffect(() => {
    if (!radioMenuOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (radioMenuRef.current && !radioMenuRef.current.contains(e.target as Node)) {
        setRadioMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setRadioMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [radioMenuOpen]);

  useEffect(() => {
    if (hud.powerupFlashSeq <= 0 || !hud.powerupFlashType) return;
    setFlashVisible(true);
    const id = window.setTimeout(() => setFlashVisible(false), 240);
    return () => window.clearTimeout(id);
  }, [hud.powerupFlashSeq, hud.powerupFlashType]);

  useEffect(() => {
    if (hud.comboPopSeq <= 0 || hud.comboStreak < 2) return;
    setComboPopPulse(true);
    const id = window.setTimeout(() => setComboPopPulse(false), 160);
    return () => window.clearTimeout(id);
  }, [hud.comboPopSeq, hud.comboStreak]);

  useEffect(() => {
    if (hud.runGems === prevGemsRef.current) return;
    prevGemsRef.current = hud.runGems;
    if (hud.runGems > 0) {
      setGemPopSeq((seq) => seq + 1);
    }
  }, [hud.runGems]);

  useEffect(() => {
    if (hud.distance === prevDistanceRef.current) return;
    prevDistanceRef.current = hud.distance;
    if (hud.distance <= 0) return;
    const now = performance.now();
    if (now - lastDistPopAtRef.current >= 150) {
      lastDistPopAtRef.current = now;
      setDistPopSeq((seq) => seq + 1);
    }
  }, [hud.distance]);

  const activeStation = RADIO_STATION_MAP[radioStation];
  const pulseColor = hud.journeyAccentHex || '#f97316';
  const diffCfg = DIFFICULTY_CONFIGS[hud.difficulty];
  const overdriveActive = hud.chronosTimer <= 0 && hud.speedMultiplier > 2.0;
  const supersonicActive = hud.chronosTimer <= 0 && hud.speedMultiplier >= 3.0;
  const overdriveIntensity = overdriveActive
    ? Math.min(1, 0.25 + ((hud.speedMultiplier - 2.0) / 0.55) * 0.75)
    : 0;

  const comboActive = hud.comboStreak >= 2;
  const comboScale = comboPopPulse ? 1.07 : 1;
  const comboTierStyle =
    hud.comboStreak >= 10
      ? 'bg-[#1a0b2e]/74 border-fuchsia-300/60 text-fuchsia-200'
      : hud.comboStreak >= 6
        ? 'bg-[#260b1c]/74 border-rose-400/60 text-rose-200'
        : hud.comboStreak >= 4
          ? 'bg-[#231507]/72 border-amber-400/55 text-amber-200'
          : 'bg-[#09182e]/72 border-sky-400/55 text-sky-200';
  const comboBarColor =
    hud.comboStreak >= 10
      ? 'bg-fuchsia-400'
      : hud.comboStreak >= 6
        ? 'bg-rose-400'
        : hud.comboStreak >= 4
          ? 'bg-amber-400'
          : 'bg-sky-400';

  // Single prioritized non-blocking peripheral alert (strictly outside the track sightline)
  const activeToastKind = hud.landmarkPopupName
    ? 'landmark'
    : hud.eventBanner
      ? 'event'
      : hud.voiceoverCallout
        ? 'voiceover'
        : null;

  return (
    <div className="fixed inset-0 pointer-events-none z-20 flex flex-col justify-between p-2.5 sm:p-4">
      {/* Lahore Pulse Top-Edge Horizon Glow (color-reactive to current landmark/neighborhood) */}
      <div
        aria-hidden="true"
        className="fixed top-0 inset-x-0 h-[3px] pointer-events-none transition-colors duration-700"
        style={{
          backgroundColor: pulseColor,
          boxShadow: `0 0 16px 1px ${pulseColor}77`,
        }}
      />
      <div
        aria-hidden="true"
        className="fixed top-0 inset-x-0 h-5 pointer-events-none"
        style={{
          background: `linear-gradient(to bottom, ${pulseColor}1c, transparent)`,
        }}
      />

      {/* Ultra-Slim Top-Edge Skyband Ticker (desktop/tablet only, sits well above track horizon) */}
      <div
        aria-label={`Lahore Pulse: ${hud.journeyStopName}, ${hud.weatherLabel}, ${hud.timeOfDayLabel}`}
        className="hidden lg:flex fixed top-1.5 left-1/2 -translate-x-1/2 pointer-events-none items-center gap-2 rounded-lg bg-[#0b1322]/52 border border-white/10 px-3 py-1 transition-colors duration-700"
      >
        <LahorePulseBars color={pulseColor} compact />
        <div className="flex items-center gap-1.5 text-[11px] whitespace-nowrap">
          <span
            className="font-black transition-colors duration-700"
            style={{ color: pulseColor }}
          >
            {hud.journeyStopName}
          </span>
          <span aria-hidden="true" className="text-white/25">
            ·
          </span>
          <span
            className="inline-flex items-center gap-1 font-semibold"
            style={{ color: hud.weatherAccentHex }}
            title={
              hud.weatherModifierSummary ??
              (hud.ambientOverlayLabel ? `Ambient Overlay: ${hud.ambientOverlayLabel}` : undefined)
            }
          >
            <WeatherIcon weather={hud.weather} color={hud.weatherAccentHex} />
            <span>{hud.weatherLabel}</span>
            {hud.weatherModifierLabel && (
              <span className="ml-0.5 rounded bg-white/10 px-1.5 py-[1px] text-[9px] font-black tracking-wide text-white/90">
                {hud.weatherModifierLabel}
              </span>
            )}
          </span>
          <span aria-hidden="true" className="text-white/25">
            ·
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-slate-200">
            <TimeOfDayIcon label={hud.timeOfDayLabel} />
            <span>{hud.timeOfDayLabel}</span>
          </span>
          <span aria-hidden="true" className="text-white/25">
            ·
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-amber-200/90">
            <Music2 className="w-3 h-3 shrink-0 text-amber-300" />
            <span>{radioStation === 'auto' ? hud.musicTrackLabel : activeStation.shortName}</span>
          </span>
          {hud.globalEventActive && hud.globalEventName && (
            <>
              <span aria-hidden="true" className="text-white/25">
                ·
              </span>
              <span className="inline-flex items-center gap-1 font-black text-pink-300">
                <PartyPopper className="w-3 h-3 shrink-0 text-pink-400" />
                <span>{hud.globalEventName}</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* High-Velocity (>2.0x) & Supersonic (>=3.0x) Extreme-Edge Vignette (keeps center track razor-clear) */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: overdriveActive && !supersonicActive ? 0.38 + overdriveIntensity * 0.35 : 0,
          backgroundImage:
            'radial-gradient(ellipse at center, transparent 68%, rgba(244, 63, 94, 0.34) 100%)',
        }}
      />
      {supersonicActive && (
        <>
          <div
            aria-hidden="true"
            className="fixed inset-0 pointer-events-none animate-speed-mach-amber"
            style={{
              backgroundImage:
                'radial-gradient(ellipse at center, transparent 66%, rgba(251, 191, 36, 0.34) 100%)',
            }}
          />
          <div
            aria-hidden="true"
            className="fixed inset-0 pointer-events-none animate-speed-mach-violet"
            style={{
              backgroundImage:
                'radial-gradient(ellipse at center, transparent 65%, rgba(168, 85, 247, 0.38) 100%)',
            }}
          />
        </>
      )}

      {/* Power-up Pickup Extreme-Edge Flash */}
      {hud.powerupFlashType && (
        <div
          className="fixed inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            opacity: flashVisible ? 1 : 0,
            backgroundImage: FLASH_GRADIENTS[hud.powerupFlashType],
          }}
        />
      )}

      {/* Top Perimeter Rails (Left & Right Corners Only — Center Track Remains 100% Clear) */}
      <div className="flex items-start justify-between gap-2">
        {/* Top-Left Compact Telemetry & Peripheral Combo Rail */}
        <div className="flex flex-col items-start gap-1.5 max-w-[235px] sm:max-w-[295px]">
          {/* Distance, Score & Gems in one compact horizontal strip */}
          <div className="flex items-center gap-2.5 sm:gap-3 rounded-xl bg-[#0b1322]/64 border border-white/12 px-2.5 sm:px-3 py-1.5">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-sky-300/80 leading-none">
                Dist
              </div>
              <div
                className={`text-sm sm:text-lg font-black text-white font-mono-num leading-tight ${
                  distPopSeq === 0
                    ? ''
                    : distPopSeq % 2 === 0
                      ? 'animate-hud-distance-pop-a'
                      : 'animate-hud-distance-pop-b'
                }`}
              >
                {hud.distance}
                <span className="text-[10px] sm:text-xs font-bold text-sky-300 ml-0.5">m</span>
              </div>
            </div>
            <div className="h-6 w-px bg-white/15" />
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-amber-300/80 leading-none">
                Score
              </div>
              <div className="text-sm sm:text-lg font-black text-white font-mono-num leading-tight">
                {hud.score.toLocaleString()}
              </div>
            </div>
            <div className="h-6 w-px bg-white/15" />
            <div
              className={`flex items-center gap-1 ${
                gemPopSeq === 0
                  ? ''
                  : gemPopSeq % 2 === 0
                    ? 'animate-hud-gem-pop-a'
                    : 'animate-hud-gem-pop-b'
              }`}
            >
              <Gem className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="text-sm sm:text-base font-black text-sky-200 font-mono-num leading-tight">
                {hud.runGems}
              </span>
            </div>
          </div>

          {/* Compact Journey Strip with Difficulty & Weather */}
          <div className="rounded-lg bg-[#0b1322]/56 border border-white/10 px-2.5 py-1 w-full">
            <div className="flex items-center justify-between gap-2 text-[10px] font-bold tracking-wide">
              <span className="inline-flex items-center gap-1.5 text-white truncate">
                <span style={{ color: diffCfg.accentHex }} className="font-black uppercase shrink-0">
                  {diffCfg.label}
                </span>
                <span aria-hidden="true" className="text-white/25">
                  ·
                </span>
                <span className="truncate">{hud.journeyStopName}</span>
              </span>
              <span className="text-[10px] font-bold text-slate-300/90 tabular-nums shrink-0">
                → {hud.nextJourneyDistance}m
              </span>
            </div>
            <div className="mt-1 h-[3px] w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full w-full rounded-full origin-left transition-transform duration-150"
                style={{
                  transform: `scaleX(${Math.max(0.04, Math.min(1, hud.journeyProgress)).toFixed(4)})`,
                  backgroundColor: pulseColor,
                }}
              />
            </div>
            {hud.weatherModifierLabel && (
              <div
                className="mt-1 flex items-center justify-between gap-1.5 text-[9px] font-bold tracking-wide leading-none"
                title={hud.weatherModifierSummary ?? undefined}
              >
                <span
                  className="inline-flex items-center gap-1 truncate"
                  style={{ color: hud.weatherAccentHex }}
                >
                  <WeatherIcon weather={hud.weather} color={hud.weatherAccentHex} />
                  <span>{hud.weatherLabel}</span>
                </span>
                <span className="text-slate-200/90 font-black uppercase shrink-0">
                  {hud.weatherModifierLabel}
                </span>
              </div>
            )}
          </div>

          {/* Compact Speedometer */}
          <div className="origin-top-left scale-[0.88] sm:scale-95">
            <SpeedVisualization
              speedMultiplier={hud.speedMultiplier}
              difficulty={hud.difficulty}
              chronosTimer={hud.chronosTimer}
              speedBoostTimer={hud.speedBoostTimer}
            />
          </div>

          {/* Peripheral Combo Counter — Left Rail Docked (Never Obstructs Center Track) */}
          {comboActive && (
            <div
              className={`rounded-xl border px-2.5 py-1 transition-transform duration-150 ease-out origin-top-left whitespace-nowrap ${comboTierStyle}`}
              style={{
                transform: `scale(${comboScale.toFixed(3)})`,
              }}
            >
              <div className="flex items-center gap-1.5 leading-none">
                <Flame className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="text-xs sm:text-sm font-display font-bold italic uppercase tracking-tight font-mono-num">
                  {hud.comboStreak}× COMBO
                </span>
                {hud.combo > 1 && (
                  <span className="text-[10px] font-black text-white/90 tabular-nums">
                    · ×{hud.combo} PTS
                  </span>
                )}
              </div>
              {hud.comboActionLabel && (
                <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider opacity-85">
                  {hud.comboActionLabel}
                </div>
              )}
              <div className="mt-1 h-[2.5px] w-full rounded-full bg-white/15 overflow-hidden">
                <div
                  className={`h-full w-full rounded-full origin-left transition-transform duration-75 ${comboBarColor}`}
                  style={{
                    transform: `scaleX(${Math.max(0.04, Math.min(1, hud.comboDecayRatio)).toFixed(4)})`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Top-Right Compact Controls, Powerup Timers & Single Non-Blocking Alert Toast */}
        <div
          className="flex flex-col items-end gap-1.5"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Single Horizontal Control Row (Radio + Skip + Mute + Pause) */}
          <div ref={radioMenuRef} className="relative flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              onClick={() => setRadioMenuOpen((prev) => !prev)}
              aria-expanded={radioMenuOpen}
              aria-haspopup="listbox"
              aria-label={`Radio Mode: ${activeStation.name}. Choose regional music station`}
              className="h-10 rounded-xl bg-[#0b1322]/64 hover:bg-[#162238] border px-2.5 flex items-center gap-1.5 text-xs font-bold text-white transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
              style={{
                borderColor: `${activeStation.accentHex}4d`,
              }}
            >
              <Radio
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: muted ? '#64748b' : activeStation.accentHex }}
              />
              <span
                className="hidden sm:inline font-black text-[11px]"
                style={{ color: muted ? '#94a3b8' : activeStation.accentHex }}
              >
                {activeStation.shortName}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                  radioMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            <button
              type="button"
              onClick={onCycleRadioStation}
              aria-label="Next radio station"
              title="Next radio station (R)"
              className="hidden sm:flex w-10 h-10 rounded-xl bg-[#0b1322]/64 hover:bg-[#162238] border border-white/12 text-slate-200 items-center justify-center active:scale-95 transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="w-10 h-10 rounded-xl bg-[#0b1322]/64 border border-white/12 text-white flex items-center justify-center hover:bg-[#162238] active:scale-95 transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
            >
              {muted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-sky-300" />}
            </button>
            <button
              type="button"
              onClick={onPause}
              aria-label="Pause game"
              className="w-10 h-10 rounded-xl bg-[#0b1322]/64 border border-white/12 text-white flex items-center justify-center hover:bg-[#162238] active:scale-95 transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
            >
              <Pause className="w-4 h-4" />
            </button>

            {radioMenuOpen && (
              <div
                role="listbox"
                aria-label="Regional Music Stations"
                className="absolute top-full right-0 mt-1.5 w-64 rounded-xl bg-[#0b1322]/96 border border-white/15 p-1.5 shadow-2xl z-30"
              >
                <div className="flex items-center justify-between px-2.5 py-1.5 text-[11px] font-bold text-slate-400 border-b border-white/10 mb-1">
                  <span>Radio Mode</span>
                  <span className="tabular-nums text-slate-300">{activeStation.frequency}</span>
                </div>
                <div className="flex flex-col gap-1">
                  {RADIO_STATIONS.map((station) => {
                    const selected = station.id === radioStation;
                    return (
                      <button
                        key={station.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          onSelectRadioStation(station.id);
                          setRadioMenuOpen(false);
                        }}
                        className={`w-full min-h-[42px] flex items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors cursor-pointer ${
                          selected
                            ? 'bg-white/10 text-white'
                            : 'text-slate-200 hover:bg-white/6'
                        }`}
                        style={
                          selected
                            ? {
                                boxShadow: `inset 0 0 0 1px ${station.accentHex}66`,
                              }
                            : undefined
                        }
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-xs font-black leading-tight whitespace-nowrap">
                            <span
                              style={{ color: selected ? station.accentHex : '#ffffff' }}
                            >
                              {station.name}
                            </span>
                            <span aria-hidden="true" className="text-white/25 font-normal">
                              ·
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400 tabular-nums">
                              {station.frequency}
                            </span>
                          </div>
                          <div className="text-[11px] font-medium text-slate-400 truncate mt-0.5">
                            {station.tagline}
                          </div>
                        </div>
                        {selected && (
                          <Check
                            className="w-4 h-4 shrink-0"
                            style={{ color: station.accentHex }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Active Powerup Timers (compact right-edge strip) */}
          {(hud.hasShield ||
            hud.magnetTimer > 0 ||
            hud.multiplierTimer > 0 ||
            hud.chronosTimer > 0 ||
            hud.speedBoostTimer > 0) && (
            <div className="flex flex-wrap justify-end gap-1 pointer-events-none">
              {hud.hasShield && (
                <div className="flex items-center gap-1 rounded-lg bg-sky-500/85 px-2 py-1 text-[11px] font-black text-slate-950">
                  <Shield className="w-3 h-3" />
                  <span className="hidden sm:inline">SHIELD</span>
                </div>
              )}
              {hud.magnetTimer > 0 && (
                <div className="flex items-center gap-1 rounded-lg bg-emerald-500/85 px-2 py-1 text-[11px] font-black text-slate-950 tabular-nums">
                  <Magnet className="w-3 h-3" />
                  <span>{Math.ceil(hud.magnetTimer)}s</span>
                </div>
              )}
              {hud.multiplierTimer > 0 && (
                <div className="flex items-center gap-1 rounded-lg bg-rose-500/85 px-2 py-1 text-[11px] font-black text-white tabular-nums">
                  <Zap className="w-3 h-3" />
                  <span>2× {Math.ceil(hud.multiplierTimer)}s</span>
                </div>
              )}
              {hud.chronosTimer > 0 && (
                <div className="flex items-center gap-1 rounded-lg bg-purple-600/85 border border-cyan-300/50 px-2 py-1 text-[11px] font-black text-white tabular-nums">
                  <Hourglass className="w-3 h-3 text-cyan-200" />
                  <span>{hud.chronosTimer.toFixed(1)}s</span>
                </div>
              )}
              {hud.speedBoostTimer > 0 && (
                <div className="flex items-center gap-1 rounded-lg bg-amber-400/90 px-2 py-1 text-[11px] font-black text-slate-950 tabular-nums">
                  <Flame className="w-3 h-3" />
                  <span>{Math.ceil(hud.speedBoostTimer)}s</span>
                </div>
              )}
            </div>
          )}

          {/* Single Prioritized Peripheral Alert Toast (Right-Edge Docked — Zero Track Obstruction) */}
          {activeToastKind === 'landmark' && hud.landmarkPopupName && (
            <div
              key={`landmark-${hud.landmarkPopupSeq}`}
              className="animate-landmark-pop pointer-events-none rounded-xl bg-[#0b1322]/74 border px-3 py-1.5 flex items-center gap-2.5 max-w-[235px] sm:max-w-[285px]"
              style={{
                borderColor: `${hud.landmarkPopupAccent ?? '#fbbf24'}77`,
              }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: `${hud.landmarkPopupAccent ?? '#fbbf24'}22`,
                  color: hud.landmarkPopupAccent ?? '#fbbf24',
                }}
              >
                <Landmark className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex flex-col">
                <div className="text-[11px] sm:text-xs font-display font-bold text-white truncate leading-tight">
                  {hud.landmarkPopupName}
                </div>
                <div className="text-[10px] font-semibold text-slate-300/90 truncate tabular-nums leading-tight">
                  {hud.landmarkPopupIsNew ? 'Codex Unlocked · ' : ''}
                  {hud.landmarkPopupDistance}m · {hud.weatherModifierLabel ?? hud.weatherLabel}
                </div>
              </div>
            </div>
          )}

          {activeToastKind === 'event' && hud.eventBanner && (
            <div className="pointer-events-none rounded-lg bg-[#0b1322]/72 border border-amber-400/45 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-amber-200 whitespace-nowrap max-w-[240px] sm:max-w-[290px] truncate">
              {hud.eventBanner}
            </div>
          )}

          {activeToastKind === 'voiceover' && hud.voiceoverCallout && (
            <div
              key={`vo-${hud.voiceoverSeq}`}
              className="pointer-events-none inline-flex items-center gap-1.5 rounded-lg bg-[#0b1322]/72 border border-orange-400/45 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-amber-200 whitespace-nowrap max-w-[240px] sm:max-w-[290px]"
            >
              <Megaphone className="w-3 h-3 shrink-0 text-orange-300" />
              <span className="truncate">{hud.voiceoverCallout}</span>
            </div>
          )}
        </div>
      </div>

      {/* First-Run Bottom-Edge Micro Controls Hint (tucked along bottom edge below runner) */}
      {showOnboardingHint && hud.distance < 75 && (
        <div
          aria-hidden="true"
          className="fixed bottom-2.5 left-1/2 -translate-x-1/2 pointer-events-none transition-opacity duration-500"
          style={{ opacity: hud.distance >= 58 ? 0 : 1 }}
        >
          <div className="rounded-md bg-[#0b1322]/48 px-2.5 py-0.5 text-center whitespace-nowrap">
            <div className="text-[10px] font-semibold tracking-wide text-sky-200/90 uppercase">
              ←/→ Steer · Space/↑ Jump · S/↓ Slide
            </div>
          </div>
        </div>
      )}

      {/* Bottom Corner Mobile Touch Action Pads (leaves center >=85% unobstructed) */}
      {showTouchButtons && (
        <div className="flex items-end justify-between gap-4 pb-1 sm:pb-2">
          {/* Bottom-Left Lane Steer Buttons */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onLeft();
              }}
              aria-label="Move Left"
              className="w-14 h-14 sm:w-15 sm:h-15 rounded-2xl bg-[#0b1322]/68 border border-white/18 text-white flex items-center justify-center active:scale-90 active:bg-sky-500/40 transition-transform touch-none cursor-pointer"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onRight();
              }}
              aria-label="Move Right"
              className="w-14 h-14 sm:w-15 sm:h-15 rounded-2xl bg-[#0b1322]/68 border border-white/18 text-white flex items-center justify-center active:scale-90 active:bg-sky-500/40 transition-transform touch-none cursor-pointer"
            >
              <ArrowRight className="w-6 h-6" />
            </button>
          </div>

          {/* Subtle swipe hint on desktop/tablet bottom edge (hidden while onboarding hint shows) */}
          {(!showOnboardingHint || hud.distance >= 75) && (
            <div className="hidden md:block text-[10px] font-medium tracking-wide text-white/60 bg-[#0b1322]/45 px-2.5 py-0.5 rounded-md">
              Swipe or Arrows Move · Space/Up Jump · S/Down Slide
            </div>
          )}

          {/* Bottom-Right Slide & Jump Buttons */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onSlide();
              }}
              aria-label="Slide"
              className="w-14 h-14 sm:w-15 sm:h-15 rounded-2xl bg-[#0b1322]/68 border border-amber-400/40 text-amber-200 flex flex-col items-center justify-center active:scale-90 active:bg-amber-500/40 transition-transform touch-none cursor-pointer"
            >
              <ArrowDown className="w-5 h-5" />
              <span className="text-[9px] font-black uppercase tracking-wider">Slide</span>
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onJump();
              }}
              aria-label="Jump"
              className="w-14 h-14 sm:w-15 sm:h-15 rounded-2xl bg-sky-500/80 border border-sky-200/55 text-slate-950 flex flex-col items-center justify-center active:scale-90 active:bg-sky-300 transition-transform touch-none shadow-lg cursor-pointer"
            >
              <ArrowUp className="w-5 h-5 stroke-[2.5]" />
              <span className="text-[9px] font-black uppercase tracking-wider">Jump</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
