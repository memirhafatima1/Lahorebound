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
  Music2,
  PartyPopper,
  Pause,
  Radio,
  Shield,
  SkipForward,
  Sun,
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
  shield: 'radial-gradient(ellipse at center, transparent 58%, rgba(56, 189, 248, 0.45) 100%)',
  magnet: 'radial-gradient(ellipse at center, transparent 58%, rgba(16, 185, 129, 0.45) 100%)',
  multiplier: 'radial-gradient(ellipse at center, transparent 58%, rgba(244, 63, 94, 0.45) 100%)',
  chronos: 'radial-gradient(ellipse at center, transparent 55%, rgba(168, 85, 247, 0.52) 100%)',
};

const PULSE_BAR_HEIGHTS = ['h-2', 'h-3.5', 'h-4', 'h-3', 'h-2.5'] as const;
const PULSE_BAR_DELAYS = ['0ms', '170ms', '320ms', '130ms', '260ms'] as const;

const WeatherIcon: React.FC<{ weather: WeatherCondition; color: string }> = ({
  weather,
  color,
}) => {
  const props = { className: 'w-3.5 h-3.5 shrink-0', style: { color } };
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

const LahorePulseBars: React.FC<{ color: string; compact?: boolean }> = ({
  color,
  compact = false,
}) => (
  <span className="inline-flex items-end gap-[2px] h-4 shrink-0" aria-hidden="true">
    {PULSE_BAR_HEIGHTS.slice(0, compact ? 4 : 5).map((hClass, i) => (
      <span
        key={i}
        className={`w-[2.5px] rounded-full animate-lahore-pulse-bar transition-colors duration-700 ${
          compact ? (i % 2 === 0 ? 'h-2.5' : 'h-3.5') : hClass
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
    const id = window.setTimeout(() => setFlashVisible(false), 260);
    return () => window.clearTimeout(id);
  }, [hud.powerupFlashSeq, hud.powerupFlashType]);

  useEffect(() => {
    if (hud.comboPopSeq <= 0 || hud.comboStreak < 2) return;
    setComboPopPulse(true);
    const id = window.setTimeout(() => setComboPopPulse(false), 170);
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
  const comboBaseScale = comboActive
    ? Math.min(1.62, 0.96 + (hud.comboStreak - 2) * 0.08)
    : 1;
  const comboScale = comboBaseScale + (comboPopPulse ? 0.22 : 0);
  const comboFontSize = comboActive
    ? Math.min(34, 18 + (hud.comboStreak - 2) * 2)
    : 18;
  const comboTierStyle =
    hud.comboStreak >= 10
      ? 'bg-[#1a0b2e]/92 border-fuchsia-300/75 text-fuchsia-200 shadow-[0_8px_28px_rgba(217,70,239,0.45)]'
      : hud.comboStreak >= 6
        ? 'bg-[#260b1c]/92 border-rose-400/75 text-rose-200 shadow-[0_8px_26px_rgba(244,63,94,0.42)]'
        : hud.comboStreak >= 4
          ? 'bg-[#231507]/90 border-amber-400/70 text-amber-200 shadow-[0_8px_24px_rgba(245,158,11,0.38)]'
          : 'bg-[#09182e]/90 border-sky-400/65 text-sky-200 shadow-[0_8px_22px_rgba(56,189,248,0.35)]';
  const comboBarColor =
    hud.comboStreak >= 10
      ? 'bg-fuchsia-400'
      : hud.comboStreak >= 6
        ? 'bg-rose-400'
        : hud.comboStreak >= 4
          ? 'bg-amber-400'
          : 'bg-sky-400';

  return (
    <div className="fixed inset-0 pointer-events-none z-20 flex flex-col justify-between p-3 sm:p-5">
      {/* Lahore Pulse Top-Edge Horizon Glow (color-reactive to current landmark/neighborhood) */}
      <div
        aria-hidden="true"
        className="fixed top-0 inset-x-0 h-[3px] pointer-events-none transition-colors duration-700"
        style={{
          backgroundColor: pulseColor,
          boxShadow: `0 0 18px 2px ${pulseColor}88`,
        }}
      />
      <div
        aria-hidden="true"
        className="fixed top-0 inset-x-0 h-8 pointer-events-none"
        style={{
          background: `linear-gradient(to bottom, ${pulseColor}24, transparent)`,
        }}
      />

      {/* Top-Center Lahore Pulse Neighborhood + Weather Indicator (md+) */}
      <div
        aria-label={`Lahore Pulse: ${hud.journeyStopName}, ${hud.journeySubtitle}, ${hud.weatherLabel}`}
        className="hidden md:flex fixed top-3.5 left-1/2 -translate-x-1/2 pointer-events-none items-center gap-2.5 rounded-xl bg-[#0b1322]/88 border px-3.5 py-1.5 shadow-lg transition-colors duration-700"
        style={{
          borderColor: `${pulseColor}66`,
          boxShadow: `0 6px 22px -6px ${pulseColor}44`,
        }}
      >
        <LahorePulseBars color={pulseColor} />
        <div className="flex items-center gap-2 text-xs whitespace-nowrap">
          <span className="font-bold text-slate-300">Lahore Pulse</span>
          <span aria-hidden="true" className="text-white/25">
            ·
          </span>
          <span
            className="font-black transition-colors duration-700"
            style={{ color: pulseColor }}
          >
            {hud.journeyStopName}
          </span>
          <span aria-hidden="true" className="text-white/25">
            ·
          </span>
          <span className="text-[11px] font-medium text-slate-300/90">{hud.journeySubtitle}</span>
          <span aria-hidden="true" className="text-white/25">
            ·
          </span>
          <span
            className="inline-flex items-center gap-1 text-[11px] font-bold"
            style={{ color: hud.weatherAccentHex }}
            title={hud.ambientOverlayLabel ? `Ambient Overlay: ${hud.ambientOverlayLabel}` : undefined}
          >
            <WeatherIcon weather={hud.weather} color={hud.weatherAccentHex} />
            <span>{hud.weatherLabel}</span>
          </span>
          <span aria-hidden="true" className="hidden lg:inline text-white/25">
            ·
          </span>
          <span className="hidden lg:inline-flex items-center gap-1 text-[11px] font-semibold text-amber-200/90">
            <Music2 className="w-3 h-3 shrink-0 text-amber-300" />
            <span>
              {radioStation === 'auto' ? hud.musicTrackLabel : activeStation.name}
            </span>
          </span>
          {hud.globalEventActive && hud.globalEventName && (
            <>
              <span aria-hidden="true" className="text-white/25">
                ·
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-black text-pink-300">
                <PartyPopper className="w-3 h-3 shrink-0 text-pink-400" />
                <span>{hud.globalEventName}</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* High-Velocity (>2.0x) & Supersonic (>=3.0x) Peripheral Screen Glow (pure compositor opacity radial-gradients) */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: overdriveActive && !supersonicActive ? 0.48 + overdriveIntensity * 0.45 : 0,
          backgroundImage:
            'radial-gradient(ellipse at center, transparent 56%, rgba(244, 63, 94, 0.42) 100%)',
        }}
      />
      {supersonicActive && (
        <>
          <div
            aria-hidden="true"
            className="fixed inset-0 pointer-events-none animate-speed-mach-amber"
            style={{
              backgroundImage:
                'radial-gradient(ellipse at center, transparent 52%, rgba(251, 191, 36, 0.42) 100%)',
            }}
          />
          <div
            aria-hidden="true"
            className="fixed inset-0 pointer-events-none animate-speed-mach-violet"
            style={{
              backgroundImage:
                'radial-gradient(ellipse at center, transparent 50%, rgba(168, 85, 247, 0.46) 100%)',
            }}
          />
        </>
      )}

      {/* Power-up Pickup Edge Flash (pure CSS opacity transition, zero backdrop-filter) */}
      {hud.powerupFlashType && (
        <div
          className="fixed inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            opacity: flashVisible ? 1 : 0,
            backgroundImage: FLASH_GRADIENTS[hud.powerupFlashType],
          }}
        />
      )}

      {/* Top Perimeter Status Bar */}
      <div className="flex items-start justify-between gap-2">
        {/* Top-Left Score & Distance Cluster */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3 rounded-xl bg-[#0b1322]/85 border border-white/15 px-3.5 py-2 shadow-lg">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-sky-300/80">
                Distance
              </div>
              <div
                className={`text-lg sm:text-xl font-black text-white font-mono-num leading-tight ${
                  distPopSeq === 0
                    ? ''
                    : distPopSeq % 2 === 0
                      ? 'animate-hud-distance-pop-a'
                      : 'animate-hud-distance-pop-b'
                }`}
              >
                {hud.distance}
                <span className="text-xs font-bold text-sky-300 ml-0.5">m</span>
              </div>
            </div>
            <div className="h-7 w-px bg-white/15" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80">
                Score
              </div>
              <div className="text-lg sm:text-xl font-black text-white font-mono-num leading-tight">
                {hud.score.toLocaleString()}
              </div>
            </div>
            <div className="h-7 w-px bg-white/15" />
            <div
              className={`flex items-center gap-1.5 ${
                gemPopSeq === 0
                  ? ''
                  : gemPopSeq % 2 === 0
                    ? 'animate-hud-gem-pop-a'
                    : 'animate-hud-gem-pop-b'
              }`}
            >
              <Gem className="w-4 h-4 text-sky-400 shrink-0" />
              <span className="text-base sm:text-lg font-black text-sky-200 font-mono-num">
                {hud.runGems}
              </span>
            </div>
          </div>

          {/* Lahore Journey Progress Strip + Difficulty, Pace & Combo */}
          <div className="rounded-lg bg-[#0b1322]/85 border border-white/12 px-2.5 py-1.5 shadow-md max-w-[280px] sm:max-w-[330px]">
            <div className="flex items-center justify-between gap-3 text-[11px] font-bold tracking-wide">
              <span className="inline-flex items-center gap-1.5 text-white truncate">
                <span className="md:hidden">
                  <LahorePulseBars color={pulseColor} compact />
                </span>
                <span className="uppercase tracking-wider truncate">{hud.journeyStopName}</span>
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-300/90 tabular-nums shrink-0">
                → {hud.nextJourneyStopName} · {hud.nextJourneyDistance}m
              </span>
            </div>
            <div className="mt-1 h-1 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full w-full rounded-full origin-left transition-transform duration-150"
                style={{
                  transform: `scaleX(${Math.max(0.04, Math.min(1, hud.journeyProgress)).toFixed(4)})`,
                  backgroundColor: pulseColor,
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <div
              className="inline-flex items-center gap-1 rounded-lg bg-[#0b1322]/85 border px-2 py-1 text-[10px] font-black uppercase tracking-wider"
              style={{
                borderColor: `${diffCfg.accentHex}55`,
                color: diffCfg.accentHex,
              }}
            >
              {diffCfg.label}
            </div>

            <SpeedVisualization
              speedMultiplier={hud.speedMultiplier}
              difficulty={hud.difficulty}
              chronosTimer={hud.chronosTimer}
              speedBoostTimer={hud.speedBoostTimer}
            />

            <div
              className="md:hidden inline-flex items-center gap-1 rounded-lg bg-[#0b1322]/85 border border-white/12 px-2 py-1 text-[10px] font-bold"
              style={{ color: hud.weatherAccentHex }}
            >
              <WeatherIcon weather={hud.weather} color={hud.weatherAccentHex} />
              <span>{hud.weatherLabel}</span>
            </div>

            {hud.globalEventActive && hud.globalEventName && (
              <div className="md:hidden inline-flex items-center gap-1 rounded-lg bg-[#0b1322]/85 border border-pink-400/50 px-2 py-1 text-[10px] font-black text-pink-300">
                <PartyPopper className="w-3 h-3 shrink-0 text-pink-400" />
                <span>{hud.globalEventName}</span>
              </div>
            )}

            {hud.combo > 1 && (
              <div className="inline-flex items-center gap-1 rounded-lg bg-amber-500/90 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-slate-950 tabular-nums">
                Combo ×{hud.combo}
              </div>
            )}
          </div>
        </div>

        {/* Top-Right Active Powerups, Audio, Pause & Radio Mode Tuner */}
        <div
          className="flex flex-col items-end gap-2 pointer-events-auto"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            {hud.hasShield && (
              <div className="flex items-center gap-1 rounded-lg bg-sky-500/90 px-2.5 py-1.5 text-xs font-black text-slate-950 shadow">
                <Shield className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">SHIELD</span>
              </div>
            )}
            {hud.magnetTimer > 0 && (
              <div className="flex items-center gap-1 rounded-lg bg-emerald-500/90 px-2.5 py-1.5 text-xs font-black text-slate-950 tabular-nums shadow">
                <Magnet className="w-3.5 h-3.5" />
                <span>{Math.ceil(hud.magnetTimer)}s</span>
              </div>
            )}
            {hud.multiplierTimer > 0 && (
              <div className="flex items-center gap-1 rounded-lg bg-rose-500/90 px-2.5 py-1.5 text-xs font-black text-white tabular-nums shadow">
                <Zap className="w-3.5 h-3.5" />
                <span>2× {Math.ceil(hud.multiplierTimer)}s</span>
              </div>
            )}
            {hud.chronosTimer > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-purple-600/92 border border-cyan-300/60 px-2.5 py-1.5 text-xs font-black text-white tabular-nums shadow">
                <Hourglass className="w-3.5 h-3.5 text-cyan-200" />
                <span>{hud.chronosTimer.toFixed(1)}s</span>
              </div>
            )}
            {hud.speedBoostTimer > 0 && (
              <div className="flex items-center gap-1 rounded-lg bg-amber-400/95 border border-amber-200/70 px-2.5 py-1.5 text-xs font-black text-slate-950 tabular-nums shadow">
                <Flame className="w-3.5 h-3.5" />
                <span>BOOST {Math.ceil(hud.speedBoostTimer)}s</span>
              </div>
            )}

            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="w-10 h-10 rounded-xl bg-[#0b1322]/85 border border-white/15 text-white flex items-center justify-center hover:bg-[#162238] active:scale-95 transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
            >
              {muted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-sky-300" />}
            </button>
            <button
              type="button"
              onClick={onPause}
              aria-label="Pause game"
              className="w-10 h-10 rounded-xl bg-[#0b1322]/85 border border-white/15 text-white flex items-center justify-center hover:bg-[#162238] active:scale-95 transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>

          {/* Radio Mode Station Switcher */}
          <div ref={radioMenuRef} className="relative flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setRadioMenuOpen((prev) => !prev)}
              aria-expanded={radioMenuOpen}
              aria-haspopup="listbox"
              aria-label={`Radio Mode: ${activeStation.name}. Choose regional music station`}
              className="h-10 rounded-xl bg-[#0b1322]/88 hover:bg-[#162238] border px-3 flex items-center gap-2 text-xs font-bold text-white shadow-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
              style={{
                borderColor: `${activeStation.accentHex}55`,
              }}
            >
              <Radio
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: muted ? '#64748b' : activeStation.accentHex }}
              />
              <span className="hidden sm:inline text-slate-300 font-semibold">Radio</span>
              <span aria-hidden="true" className="hidden sm:inline text-white/25">
                ·
              </span>
              <span
                className="font-black"
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
              className="w-10 h-10 rounded-xl bg-[#0b1322]/88 hover:bg-[#162238] border border-white/15 text-slate-200 flex items-center justify-center active:scale-95 transition-transform cursor-pointer shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
            >
              <SkipForward className="w-4 h-4" />
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
        </div>
      </div>

      {/* Transient Center-Top Event, Landmark Pop-Up, Voiceover & Growing Combo (non-blocking) */}
      {(hud.eventBanner || hud.landmarkPopupName || hud.voiceoverCallout || comboActive) && (
        <div className="fixed top-24 sm:top-24 left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center gap-2">
          {hud.landmarkPopupName && (
            <div
              key={hud.landmarkPopupSeq}
              className="animate-landmark-pop rounded-xl bg-[#0b1322]/92 border px-4 sm:px-5 py-2.5 flex items-center gap-3 whitespace-nowrap"
              style={{
                borderColor: `${hud.landmarkPopupAccent ?? '#fbbf24'}88`,
                boxShadow: `0 12px 32px -6px ${hud.landmarkPopupAccent ?? '#fbbf24'}44`,
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: `${hud.landmarkPopupAccent ?? '#fbbf24'}22`,
                  border: `1px solid ${hud.landmarkPopupAccent ?? '#fbbf24'}55`,
                  color: hud.landmarkPopupAccent ?? '#fbbf24',
                }}
              >
                <Landmark className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-amber-200/85">
                  <span>Lahore Bound</span>
                  <span aria-hidden="true">·</span>
                  <span>City Landmark</span>
                  {hud.landmarkPopupIsNew && (
                    <>
                      <span aria-hidden="true" className="text-white/30">
                        ·
                      </span>
                      <span className="text-emerald-300 font-black">Codex Unlocked</span>
                    </>
                  )}
                </div>
                <div className="text-base sm:text-lg font-display font-bold tracking-wide text-white leading-tight">
                  {hud.landmarkPopupName}
                </div>
                {hud.landmarkPopupSubtitle && (
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300 leading-tight tabular-nums">
                    <span>
                      {hud.landmarkPopupSubtitle} · {hud.landmarkPopupDistance}m
                    </span>
                    <span aria-hidden="true" className="text-white/25">
                      ·
                    </span>
                    <span
                      className="inline-flex items-center gap-1 font-semibold"
                      style={{ color: hud.weatherAccentHex }}
                    >
                      <WeatherIcon weather={hud.weather} color={hud.weatherAccentHex} />
                      <span>{hud.weatherLabel}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          {hud.eventBanner && (
            <div className="rounded-lg bg-[#0b1322]/88 border border-amber-400/50 px-4 py-1.5 text-xs sm:text-sm font-black uppercase tracking-widest text-amber-300 shadow-lg whitespace-nowrap">
              {hud.eventBanner}
            </div>
          )}
          {hud.voiceoverCallout && (
            <div
              key={hud.voiceoverSeq}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 px-4 py-1 text-xs sm:text-sm font-black uppercase tracking-wider text-slate-950 shadow-[0_6px_22px_rgba(251,191,36,0.45)] whitespace-nowrap"
            >
              <Megaphone className="w-3.5 h-3.5 shrink-0" />
              <span>{hud.voiceoverCallout}</span>
              {muted && (
                <span className="text-[10px] font-extrabold opacity-75">(Muted)</span>
              )}
            </div>
          )}
          {comboActive && (
            <div
              className={`mt-1 flex flex-col items-center rounded-2xl border-2 px-4 py-1.5 transition-transform duration-150 ease-out origin-top whitespace-nowrap ${comboTierStyle}`}
              style={{
                transform: `scale(${comboScale.toFixed(3)})`,
              }}
            >
              <div className="flex items-center gap-1.5 leading-none">
                <Flame className="w-4 h-4 text-amber-300 shrink-0" />
                <span
                  className="font-display font-bold italic uppercase tracking-tight font-mono-num leading-none drop-shadow"
                  style={{ fontSize: `${comboFontSize}px` }}
                >
                  {hud.comboStreak}× COMBO!
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider opacity-90">
                {hud.comboActionLabel && <span>{hud.comboActionLabel}</span>}
                {hud.combo > 1 && (
                  <span className="rounded bg-white/15 px-1.5 py-0.5 text-white tabular-nums">
                    ×{hud.combo} PTS
                  </span>
                )}
              </div>
              <div className="mt-1.5 h-1 w-full rounded-full bg-white/15 overflow-hidden">
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
      )}

      {/* First-Run Floating Controls Onboarding Card (fades cleanly by 75m) */}
      {showOnboardingHint && hud.distance < 75 && (
        <div
          aria-hidden="true"
          className="fixed bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 pointer-events-none transition-opacity duration-500"
          style={{ opacity: hud.distance >= 58 ? 0 : 1 }}
        >
          <div className="rounded-xl bg-[#0b1322]/90 border border-sky-400/35 px-4 py-2 text-center shadow-xl whitespace-nowrap">
            <div className="text-[11px] sm:text-xs font-display font-bold tracking-wide text-sky-200 uppercase">
              ← / → or Swipe to Steer · Space / ↑ Jump · S / ↓ Slide
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
              className="w-14 h-14 sm:w-15 sm:h-15 rounded-2xl bg-[#0b1322]/75 border border-white/20 text-white flex items-center justify-center active:scale-90 active:bg-sky-500/40 transition-transform touch-none cursor-pointer"
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
              className="w-14 h-14 sm:w-15 sm:h-15 rounded-2xl bg-[#0b1322]/75 border border-white/20 text-white flex items-center justify-center active:scale-90 active:bg-sky-500/40 transition-transform touch-none cursor-pointer"
            >
              <ArrowRight className="w-6 h-6" />
            </button>
          </div>

          {/* Subtle swipe hint on desktop/tablet bottom center */}
          <div className="hidden md:block text-[11px] font-semibold tracking-wide text-white/70 bg-[#0b1322]/65 px-3 py-1 rounded-lg">
            Swipe or Arrows Move · Space/Up Jump · S/Down Slide
          </div>

          {/* Bottom-Right Slide & Jump Buttons */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onSlide();
              }}
              aria-label="Slide"
              className="w-14 h-14 sm:w-15 sm:h-15 rounded-2xl bg-[#0b1322]/75 border border-amber-400/45 text-amber-200 flex flex-col items-center justify-center active:scale-90 active:bg-amber-500/40 transition-transform touch-none cursor-pointer"
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
              className="w-14 h-14 sm:w-15 sm:h-15 rounded-2xl bg-sky-500/85 border border-sky-200/60 text-slate-950 flex flex-col items-center justify-center active:scale-90 active:bg-sky-300 transition-transform touch-none shadow-lg cursor-pointer"
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
