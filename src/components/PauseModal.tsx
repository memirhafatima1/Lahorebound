import React from 'react';
import {
  Camera,
  Play,
  Radio,
  RotateCcw,
  Settings,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { getDailyRunMetricUnit } from '../game/dailyRunObjective';
import { useHudSnapshot } from '../game/hudStore';
import { RADIO_STATION_MAP } from '../game/music';
import type { DailyRunObjectiveTemplate, SaveData } from '../game/types';

interface PauseModalProps {
  save: SaveData;
  dailyRunObjTpl: DailyRunObjectiveTemplate;
  dailyRunAttempt: { progress: number; disqualified: boolean };
  onResume: () => void;
  onOpenPhotoMode: () => void;
  onStartRun: () => void;
  onToggleMute: () => void;
  onCycleRadioStation: () => void;
  onToggleTouchButtons: () => void;
  onToggleHaptics: () => void;
  onOpenSettings: () => void;
  onReturnToTitle: () => void;
}

const PausedHudStats: React.FC = React.memo(() => {
  const hud = useHudSnapshot();
  return (
    <p className="text-xs text-slate-400 text-center mt-1 font-mono-num">
      {hud.distance}m · {hud.score.toLocaleString()} pts
    </p>
  );
});

export const PauseModal: React.FC<PauseModalProps> = React.memo(({
  save,
  dailyRunObjTpl,
  dailyRunAttempt,
  onResume,
  onOpenPhotoMode,
  onStartRun,
  onToggleMute,
  onCycleRadioStation,
  onToggleTouchButtons,
  onToggleHaptics,
  onOpenSettings,
  onReturnToTitle,
}) => {
  const dailyRunObj = save.dailyRunObjective;
  const stationMeta = RADIO_STATION_MAP[save.radioStation];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#060b14]/65 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-modal-title"
        className="w-full max-w-sm rounded-2xl bg-[#0b1322] border border-white/15 p-6 shadow-2xl text-white"
      >
        <h2
          id="pause-modal-title"
          className="text-2xl font-display font-bold uppercase tracking-wider text-center"
        >
          Paused
        </h2>
        <PausedHudStats />
        <div className="mt-2.5 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-center text-[11px] font-mono-num">
          <span className="font-bold text-slate-300">{dailyRunObjTpl.label}: </span>
          {dailyRunObj.completed ? (
            <span className="font-black text-emerald-300">Complete!</span>
          ) : dailyRunAttempt.disqualified ? (
            <span className="font-bold text-rose-300">
              Rule broken this run ({dailyRunObjTpl.forbidAction === 'jumps' ? 'jumped' : 'slid'})
            </span>
          ) : (
            <span className="font-black text-sky-300">
              {dailyRunAttempt.progress}/{dailyRunObjTpl.target}{' '}
              {getDailyRunMetricUnit(dailyRunObjTpl.metric)}
            </span>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-display font-bold uppercase tracking-wider text-sm py-3 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>Resume</span>
          </button>

          <button
            type="button"
            onClick={onOpenPhotoMode}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-200 font-black uppercase tracking-wider text-xs py-2.5 cursor-pointer"
          >
            <Camera className="w-4 h-4 text-amber-300" />
            <span>Photo Mode</span>
          </button>

          <button
            type="button"
            onClick={onStartRun}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold uppercase tracking-wider text-xs py-2.5 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restart Run</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="w-full flex items-center justify-between rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2.5 text-xs font-bold text-slate-200 cursor-pointer"
          >
            <span className="inline-flex items-center gap-2">
              {save.muted ? (
                <VolumeX className="w-4 h-4 text-slate-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-sky-300" />
              )}
              <span>Audio &amp; Voiceover</span>
            </span>
            <span className={save.muted ? 'text-slate-400' : 'text-sky-300'}>
              {save.muted ? 'MUTED' : 'ON'}
            </span>
          </button>

          <button
            type="button"
            onClick={onCycleRadioStation}
            className="w-full flex items-center justify-between rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2.5 text-xs font-bold text-slate-200 cursor-pointer"
          >
            <span className="inline-flex items-center gap-2">
              <Radio className="w-4 h-4" style={{ color: stationMeta.accentHex }} />
              <span>Radio Station</span>
            </span>
            <span style={{ color: stationMeta.accentHex }}>{stationMeta.name}</span>
          </button>

          <button
            type="button"
            onClick={onToggleTouchButtons}
            className="w-full flex items-center justify-between rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2.5 text-xs font-bold text-slate-200 cursor-pointer"
          >
            <span>On-Screen Touch Buttons</span>
            <span className={save.showTouchButtons ? 'text-emerald-400' : 'text-slate-400'}>
              {save.showTouchButtons ? 'ON' : 'SWIPE ONLY'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleHaptics}
            className="w-full flex items-center justify-between rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2.5 text-xs font-bold text-slate-200 cursor-pointer"
          >
            <span>Haptic Vibration</span>
            <span className={save.hapticsEnabled ? 'text-emerald-400' : 'text-slate-400'}>
              {save.hapticsEnabled ? 'ON' : 'OFF'}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full flex items-center justify-between rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2.5 text-xs font-bold text-slate-200 cursor-pointer"
          >
            <span className="inline-flex items-center gap-2">
              <Settings className="w-4 h-4 text-sky-300" />
              <span>All Settings &amp; Sky Time</span>
            </span>
            <span className="text-sky-300 uppercase">Open</span>
          </button>

          <button
            type="button"
            onClick={onReturnToTitle}
            className="w-full rounded-xl bg-transparent hover:bg-white/5 text-slate-300 font-bold uppercase tracking-wider text-xs py-2.5 cursor-pointer"
          >
            Back to Title
          </button>
        </div>
      </div>
    </div>
  );
});
