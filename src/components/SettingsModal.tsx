import React, { useEffect, useState } from 'react';
import {
  Check,
  Clock,
  Gamepad2,
  Moon,
  PartyPopper,
  Radio,
  Settings,
  Smartphone,
  Sun,
  Sunrise,
  Sunset,
  Volume2,
  VolumeX,
  Wind,
  X,
} from 'lucide-react';
import { LIGHTING_MODES, formatLahoreClockAndPhase } from '../game/dayNightCycle';
import { GLOBAL_EVENT_MODES, getStreetCarnivalStatus } from '../game/globalEvents';
import { RADIO_STATIONS } from '../game/music';
import type { GlobalEventMode, LightingMode, RadioStationId } from '../game/types';

interface SettingsModalProps {
  muted: boolean;
  radioStation: RadioStationId;
  lightingMode: LightingMode;
  eventMode: GlobalEventMode;
  ambientWeatherOverlay: boolean;
  showTouchButtons: boolean;
  hapticsEnabled: boolean;
  onToggleMute: () => void;
  onSelectRadioStation: (station: RadioStationId) => void;
  onSelectLightingMode: (mode: LightingMode) => void;
  onSelectEventMode: (mode: GlobalEventMode) => void;
  onToggleAmbientOverlay: () => void;
  onToggleTouchButtons: () => void;
  onToggleHaptics: () => void;
  onClose: () => void;
}

const LightingIcon: React.FC<{ mode: LightingMode; color: string }> = ({ mode, color }) => {
  const props = { className: 'w-4 h-4 shrink-0', style: { color } };
  switch (mode) {
    case 'dawn':
      return <Sunrise {...props} />;
    case 'day':
      return <Sun {...props} />;
    case 'sunset':
      return <Sunset {...props} />;
    case 'night':
      return <Moon {...props} />;
    case 'auto':
    default:
      return <Clock {...props} />;
  }
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  muted,
  radioStation,
  lightingMode,
  eventMode,
  ambientWeatherOverlay,
  showTouchButtons,
  hapticsEnabled,
  onToggleMute,
  onSelectRadioStation,
  onSelectLightingMode,
  onSelectEventMode,
  onToggleAmbientOverlay,
  onToggleTouchButtons,
  onToggleHaptics,
  onClose,
}) => {
  const [timeSummary, setTimeSummary] = useState(() =>
    formatLahoreClockAndPhase(lightingMode),
  );
  const [eventSummary, setEventSummary] = useState(() =>
    getStreetCarnivalStatus(eventMode),
  );

  useEffect(() => {
    setTimeSummary(formatLahoreClockAndPhase(lightingMode));
    setEventSummary(getStreetCarnivalStatus(eventMode));
    const id = window.setInterval(() => {
      setTimeSummary(formatLahoreClockAndPhase(lightingMode));
      setEventSummary(getStreetCarnivalStatus(eventMode));
    }, 15000);
    return () => window.clearInterval(id);
  }, [lightingMode, eventMode]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#060b14]/78 p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-[#0b1322] border border-white/15 p-5 sm:p-6 shadow-2xl text-white my-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 shrink-0">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-sky-300">
              <Settings className="w-3.5 h-3.5" />
              <span>Journey Preferences</span>
            </div>
            <h2
              id="settings-modal-title"
              className="text-xl sm:text-2xl font-black uppercase tracking-wide mt-0.5"
            >
              Settings
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
              Lahore Local Time: {timeSummary.clockText} · {timeSummary.livePhaseLabel}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center text-slate-200 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Sections */}
        <div className="mt-4 overflow-y-auto pr-0.5 flex-1 min-h-0 flex flex-col gap-4">
          {/* Audio & Voiceover */}
          <section className="flex flex-col gap-2">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-300">
              Audio &amp; Soundscape
            </h3>
            <button
              type="button"
              onClick={onToggleMute}
              className="w-full flex items-center justify-between rounded-xl bg-white/5 hover:bg-white/10 border border-white/12 px-4 py-3 text-xs font-bold text-white cursor-pointer transition-colors"
            >
              <span className="inline-flex items-center gap-2.5">
                {muted ? (
                  <VolumeX className="w-4 h-4 text-slate-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-sky-300" />
                )}
                <span>Master Audio, SFX &amp; Announcer</span>
              </span>
              <span
                className={`font-black uppercase tracking-wider ${
                  muted ? 'text-slate-400' : 'text-sky-300'
                }`}
              >
                {muted ? 'MUTED' : 'ON'}
              </span>
            </button>
          </section>

          {/* Regional Radio Mode */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-300">
                <Radio className="w-3.5 h-3.5 text-amber-300" />
                <span>Lahore Radio Mode</span>
              </h3>
              <span className="text-[11px] font-semibold text-slate-400">
                Press R in-run to cycle
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {RADIO_STATIONS.map((station) => {
                const selected = station.id === radioStation;
                return (
                  <button
                    key={station.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelectRadioStation(station.id)}
                    className={`rounded-xl border p-3 text-left transition-colors cursor-pointer flex items-start justify-between gap-2 ${
                      selected
                        ? 'bg-white/10 text-white'
                        : 'bg-[#07101f] border-white/10 text-slate-200 hover:bg-white/6'
                    }`}
                    style={
                      selected
                        ? {
                            borderColor: `${station.accentHex}88`,
                            boxShadow: `inset 0 0 0 1px ${station.accentHex}33`,
                          }
                        : undefined
                    }
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-black">
                        <span style={{ color: selected ? station.accentHex : '#ffffff' }}>
                          {station.name}
                        </span>
                        <span aria-hidden="true" className="text-white/25">
                          ·
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400 tabular-nums">
                          {station.frequency}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        {station.tagline}
                      </div>
                    </div>
                    {selected && (
                      <Check
                        className="w-4 h-4 shrink-0 mt-0.5"
                        style={{ color: station.accentHex }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Sky Lighting / Time of Day */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-300">
                <Sun className="w-3.5 h-3.5 text-amber-300" />
                <span>Lahore Sky Lighting</span>
              </h3>
              <span className="text-[11px] font-semibold text-sky-300">
                Active: {timeSummary.effectivePhaseLabel}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {LIGHTING_MODES.map((opt) => {
                const selected = lightingMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelectLightingMode(opt.id)}
                    className={`rounded-xl border px-1.5 py-2.5 flex flex-col items-center justify-center gap-1 text-center transition-colors cursor-pointer ${
                      selected
                        ? 'bg-white/12 text-white'
                        : 'bg-[#07101f] border-white/10 text-slate-300 hover:bg-white/6'
                    }`}
                    style={
                      selected
                        ? {
                            borderColor: `${opt.accentHex}99`,
                            boxShadow: `inset 0 0 0 1px ${opt.accentHex}44`,
                          }
                        : undefined
                    }
                  >
                    <LightingIcon mode={opt.id} color={selected ? opt.accentHex : '#94a3b8'} />
                    <span
                      className="text-[11px] font-black leading-tight"
                      style={{ color: selected ? opt.accentHex : '#e2e8f0' }}
                    >
                      {opt.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              aria-pressed={ambientWeatherOverlay}
              onClick={onToggleAmbientOverlay}
              className="w-full flex items-center justify-between gap-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/12 px-3.5 py-2.5 text-left cursor-pointer transition-colors"
            >
              <span className="inline-flex items-center gap-2.5 min-w-0">
                <Wind
                  className={`w-4 h-4 shrink-0 ${
                    ambientWeatherOverlay ? 'text-sky-300' : 'text-slate-400'
                  }`}
                />
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-white">
                    Ambient Weather Overlay
                  </span>
                  <span className="block text-[11px] text-slate-400 truncate">
                    Forecast swirling leaves, heat shimmers &amp; light mist
                  </span>
                </span>
              </span>
              <span
                className={`text-xs font-black uppercase tracking-wider shrink-0 ${
                  ambientWeatherOverlay ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                {ambientWeatherOverlay ? 'ON' : 'OFF'}
              </span>
            </button>
          </section>

          {/* Street Carnival Global Event */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-300">
                <PartyPopper className="w-3.5 h-3.5 text-pink-300" />
                <span>Street Carnival Event</span>
              </h3>
              <span
                className={`text-[11px] font-bold ${
                  eventSummary.active ? 'text-pink-300' : 'text-slate-400'
                }`}
              >
                {eventSummary.active
                  ? `Live · ${eventSummary.countdownLabel}`
                  : eventSummary.countdownLabel}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {GLOBAL_EVENT_MODES.map((opt) => {
                const selected = eventMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelectEventMode(opt.id)}
                    className={`rounded-xl border p-2.5 text-left transition-colors cursor-pointer ${
                      selected
                        ? 'bg-white/12 text-white'
                        : 'bg-[#07101f] border-white/10 text-slate-300 hover:bg-white/6'
                    }`}
                    style={
                      selected
                        ? {
                            borderColor: `${opt.accentHex}99`,
                            boxShadow: `inset 0 0 0 1px ${opt.accentHex}44`,
                          }
                        : undefined
                    }
                  >
                    <div
                      className="text-xs font-black"
                      style={{ color: selected ? opt.accentHex : '#ffffff' }}
                    >
                      {opt.shortLabel}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                      {opt.description}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400">
              Schedule: {eventSummary.scheduleSummary}
            </p>
          </section>

          {/* Controls & Tactile */}
          <section className="flex flex-col gap-2">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-300">
              Controls &amp; Tactile
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onToggleTouchButtons}
                className="flex items-center justify-between rounded-xl bg-white/5 hover:bg-white/10 border border-white/12 px-3.5 py-3 text-xs font-bold text-slate-200 cursor-pointer transition-colors"
              >
                <span className="inline-flex items-center gap-2">
                  <Gamepad2 className="w-4 h-4 text-sky-300 shrink-0" />
                  <span>Touch Pads</span>
                </span>
                <span
                  className={`font-black uppercase ${
                    showTouchButtons ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {showTouchButtons ? 'ON' : 'SWIPE'}
                </span>
              </button>

              <button
                type="button"
                onClick={onToggleHaptics}
                className="flex items-center justify-between rounded-xl bg-white/5 hover:bg-white/10 border border-white/12 px-3.5 py-3 text-xs font-bold text-slate-200 cursor-pointer transition-colors"
              >
                <span className="inline-flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>Haptics</span>
                </span>
                <span
                  className={`font-black uppercase ${
                    hapticsEnabled ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {hapticsEnabled ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black uppercase tracking-wider text-xs px-5 py-2.5 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
