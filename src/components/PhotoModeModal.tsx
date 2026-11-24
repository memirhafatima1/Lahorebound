import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  Film,
  Play,
  Share2,
  Sparkles,
} from 'lucide-react';
import { LIGHTING_MODES } from '../game/dayNightCycle';
import { DIFFICULTY_CONFIGS } from '../game/difficulty';
import { useHudSnapshot } from '../game/hudStore';
import {
  LAHORE_PHOTO_FILTERS,
  LAHORE_PHOTO_FILTER_MAP,
  applyLahorePhotoFilter,
  type LahorePhotoFilterId,
} from '../game/photoFilters';
import type { CharacterSkin, HudSnapshot, LightingMode } from '../game/types';

export type PhotoCameraPreset = 'current' | 'hero' | 'wide';

interface PhotoModeModalProps {
  rawSnapshotUrl: string;
  hud?: HudSnapshot;
  skin: CharacterSkin;
  bestDistance: number;
  dailyStreakCount: number;
  lightingMode?: LightingMode;
  onChangeLightingMode?: (mode: LightingMode) => void;
  onSelectCameraPreset: (preset: PhotoCameraPreset) => void;
  onRecapture: () => string | null;
  onBackToPause: () => void;
  onResumeRun: () => void;
}

export const PhotoModeModal: React.FC<PhotoModeModalProps> = ({
  rawSnapshotUrl,
  hud: propHud,
  skin,
  bestDistance,
  dailyStreakCount,
  lightingMode = 'auto',
  onChangeLightingMode,
  onSelectCameraPreset,
  onRecapture,
  onBackToPause,
  onResumeRun,
}) => {
  const storeHud = useHudSnapshot();
  const hud = propHud ?? storeHud;
  const [snapshotUrl, setSnapshotUrl] = useState(rawSnapshotUrl);
  const [processedUrl, setProcessedUrl] = useState(rawSnapshotUrl);
  const [includeStamp, setIncludeStamp] = useState(true);
  const [lahoreFilter, setLahoreFilter] = useState<LahorePhotoFilterId>('original');
  const [cameraPreset, setCameraPreset] = useState<PhotoCameraPreset>('current');
  const [cleanViewfinder, setCleanViewfinder] = useState(false);
  const [hideControlsInViewfinder, setHideControlsInViewfinder] = useState(false);
  const [shutterFlash, setShutterFlash] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  useEffect(() => {
    setSnapshotUrl(rawSnapshotUrl);
  }, [rawSnapshotUrl]);

  useEffect(() => {
    if (!shutterFlash) return;
    const id = window.setTimeout(() => setShutterFlash(false), 180);
    return () => window.clearTimeout(id);
  }, [shutterFlash]);

  useEffect(() => {
    if (!feedbackMsg) return;
    const id = window.setTimeout(() => setFeedbackMsg(null), 2600);
    return () => window.clearTimeout(id);
  }, [feedbackMsg]);

  // Composite Lahore Style cinema color grading and achievement badge strip via offscreen 2D canvas
  useEffect(() => {
    if (!includeStamp && lahoreFilter === 'original') {
      setProcessedUrl(snapshotUrl);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.onerror = () => {
      if (!cancelled) {
        setProcessedUrl(snapshotUrl);
      }
    };
    img.onload = () => {
      if (cancelled) return;
      const maxW = 1440;
      const scale = img.width > maxW ? maxW / img.width : 1;
      const w = Math.max(320, Math.round(img.width * scale));
      const h = Math.max(240, Math.round(img.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: lahoreFilter !== 'original' });
      if (!ctx) {
        setProcessedUrl(snapshotUrl);
        return;
      }

      ctx.drawImage(img, 0, 0, w, h);

      if (lahoreFilter !== 'original') {
        applyLahorePhotoFilter(ctx, w, h, lahoreFilter);
      }

      if (includeStamp) {
        const filterPreset = LAHORE_PHOTO_FILTER_MAP[lahoreFilter];

        // Bottom achievement ribbon
        const barH = Math.max(66, Math.round(h * 0.12));
        const padX = Math.max(20, Math.round(w * 0.025));
        const barY = h - barH;

        const grad = ctx.createLinearGradient(0, barY - 26, 0, h);
        grad.addColorStop(0, 'rgba(6, 11, 20, 0)');
        grad.addColorStop(0.28, 'rgba(9, 15, 29, 0.78)');
        grad.addColorStop(1, 'rgba(9, 15, 29, 0.94)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, barY - 26, w, barH + 26);

        // Subtle truck-art / cinema grade accent line
        ctx.fillStyle =
          lahoreFilter !== 'original'
            ? filterPreset.swatchPrimary
            : hud.globalEventActive
              ? '#ec4899'
              : '#f59e0b';
        ctx.fillRect(padX, barY + 4, Math.round(w * 0.14), 3);

        const titleFontSize = Math.max(13, Math.round(barH * 0.24));
        const subFontSize = Math.max(10, Math.round(barH * 0.17));
        const statValSize = Math.max(15, Math.round(barH * 0.28));
        const statLblSize = Math.max(9, Math.round(barH * 0.14));

        // Left title + Lahore landmark + weather + optional Street Carnival / Lahore Style filter
        ctx.textBaseline = 'top';
        ctx.fillStyle = hud.globalEventActive ? '#f472b6' : '#fbbf24';
        ctx.font = `900 ${subFontSize}px system-ui, -apple-system, sans-serif`;
        const carnivalTag = hud.globalEventActive ? ' · STREET CARNIVAL' : '';
        const filterTag =
          lahoreFilter !== 'original' ? ` · ${filterPreset.shortLabel.toUpperCase()}` : '';
        ctx.fillText(
          `LAHORE BOUND · ${hud.journeyStopName.toUpperCase()} · ${hud.weatherLabel.toUpperCase()}${carnivalTag}${filterTag}`,
          padX,
          barY + 12,
        );

        ctx.fillStyle = '#ffffff';
        ctx.font = `800 ${titleFontSize}px system-ui, -apple-system, sans-serif`;
        const diffLabel = DIFFICULTY_CONFIGS[hud.difficulty].label;
        ctx.fillText(
          `${skin.name} · ${diffLabel} Mode`,
          padX,
          barY + 16 + subFontSize,
        );

        // Right stats blocks
        const stats = [
          { label: 'DISTANCE', value: `${hud.distance}m`, color: '#ffffff' },
          { label: 'SCORE', value: hud.score.toLocaleString(), color: '#fcd34d' },
          {
            label: dailyStreakCount > 0 ? 'STREAK' : 'COMBO',
            value: dailyStreakCount > 0 ? `${dailyStreakCount}D` : `×${hud.combo}`,
            color: '#38bdf8',
          },
        ];

        ctx.textAlign = 'right';
        let cursorX = w - padX;
        const gap = Math.max(22, Math.round(w * 0.028));

        for (let i = stats.length - 1; i >= 0; i--) {
          const s = stats[i];
          ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
          ctx.font = `800 ${statLblSize}px system-ui, -apple-system, sans-serif`;
          ctx.fillText(s.label, cursorX, barY + 12);

          ctx.fillStyle = s.color;
          ctx.font = `900 ${statValSize}px system-ui, -apple-system, sans-serif`;
          ctx.fillText(s.value, cursorX, barY + 16 + statLblSize);

          const valWidth = ctx.measureText(s.value).width;
          const lblWidth = ctx.measureText(s.label).width;
          cursorX -= Math.max(valWidth, lblWidth) + gap;
        }
      }

      setProcessedUrl(canvas.toDataURL('image/png'));
    };
    img.src = snapshotUrl;

    return () => {
      cancelled = true;
    };
  }, [snapshotUrl, includeStamp, lahoreFilter, hud, skin.name, dailyStreakCount]);

  useEffect(() => {
    if (!cleanViewfinder) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (hideControlsInViewfinder) {
          setHideControlsInViewfinder(false);
        } else {
          setCleanViewfinder(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [cleanViewfinder, hideControlsInViewfinder]);

  const activeFilterMeta = LAHORE_PHOTO_FILTER_MAP[lahoreFilter];
  const activeOutputUrl =
    includeStamp || lahoreFilter !== 'original' ? processedUrl : snapshotUrl;
  const shareSummaryText = `Running past ${hud.journeyStopName} (${hud.weatherLabel}${hud.globalEventActive ? ' · Street Carnival' : ''}${lahoreFilter !== 'original' ? ` · ${activeFilterMeta.name}` : ''}) in Lahore Bound! Reached ${hud.distance}m with ${hud.score.toLocaleString()} pts (${DIFFICULTY_CONFIGS[hud.difficulty].label} Mode · Best ${Math.max(bestDistance, hud.distance)}m).`;

  const handlePresetChange = (preset: PhotoCameraPreset) => {
    setCameraPreset(preset);
    onSelectCameraPreset(preset);
  };

  const handleSnap = () => {
    const fresh = onRecapture();
    if (fresh) {
      setSnapshotUrl(fresh);
      setShutterFlash(true);
      setCleanViewfinder(false);
      setHideControlsInViewfinder(false);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = activeOutputUrl;
    const suffix = lahoreFilter !== 'original' ? `-${lahoreFilter}` : '';
    link.download = `lahore-bound-${hud.distance}m${suffix}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setFeedbackMsg(
      lahoreFilter !== 'original'
        ? `${activeFilterMeta.shortLabel} snapshot saved`
        : 'Snapshot saved as PNG',
    );
  };

  const handleShare = async () => {
    try {
      const res = await fetch(activeOutputUrl);
      const blob = await res.blob();
      const suffix = lahoreFilter !== 'original' ? `-${lahoreFilter}` : '';
      const file = new File([blob], `lahore-bound-${hud.distance}m${suffix}.png`, {
        type: 'image/png',
      });

      if (navigator.share) {
        const shareData: ShareData = {
          title: 'Lahore Bound · City Street Runner',
          text: shareSummaryText,
        };
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          shareData.files = [file];
        }
        await navigator.share(shareData);
        setFeedbackMsg('Achievement shared!');
        return;
      }

      if (navigator.clipboard && 'ClipboardItem' in window) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setFeedbackMsg('Snapshot copied to clipboard!');
        return;
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareSummaryText);
      setFeedbackMsg('Achievement summary copied!');
    } catch {
      handleDownload();
    }
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(shareSummaryText);
      setFeedbackMsg('Achievement text copied!');
    } catch {
      setFeedbackMsg('Use Download PNG to save image');
    }
  };

  if (cleanViewfinder) {
    return (
      <div
        className="fixed inset-0 z-30 select-none"
        onClick={() => {
          if (hideControlsInViewfinder) {
            setHideControlsInViewfinder(false);
          }
        }}
      >
        {/* Subtle camera corner viewfinder marks when controls are visible */}
        {!hideControlsInViewfinder && (
          <>
            <div className="pointer-events-none fixed inset-5">
              <div className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-white/60 rounded-tl-md" />
              <div className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-white/60 rounded-tr-md" />
              <div className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-white/60 rounded-bl-md" />
              <div className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-white/60 rounded-br-md" />
            </div>

            <div className="fixed top-4 left-4 right-4 flex items-center justify-between gap-2 pointer-events-none">
              <div className="flex items-center gap-2 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => setCleanViewfinder(false)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#0b1322]/85 hover:bg-[#162238] border border-white/20 px-3.5 py-2 text-xs font-extrabold uppercase tracking-wider text-white shadow-lg cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Studio</span>
                </button>
                <button
                  type="button"
                  onClick={onBackToPause}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#0b1322]/85 hover:bg-[#162238] border border-white/15 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 shadow-lg cursor-pointer"
                >
                  <span>Pause Menu</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setHideControlsInViewfinder(true)}
                className="pointer-events-auto inline-flex items-center gap-1.5 rounded-xl bg-[#0b1322]/85 hover:bg-[#162238] border border-white/20 px-3.5 py-2 text-xs font-extrabold uppercase tracking-wider text-slate-200 shadow-lg cursor-pointer"
              >
                <EyeOff className="w-3.5 h-3.5 text-sky-300" />
                <span>Hide Frame</span>
              </button>
            </div>

            <div className="fixed bottom-5 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-[#0b1322]/90 border border-white/20 p-2 shadow-2xl">
              {(['current', 'hero', 'wide'] as PhotoCameraPreset[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={cameraPreset === preset}
                  onClick={() => handlePresetChange(preset)}
                  className={`rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wider cursor-pointer transition-colors ${
                    cameraPreset === preset
                      ? 'bg-sky-400 text-slate-950'
                      : 'bg-white/5 hover:bg-white/10 text-slate-200'
                  }`}
                >
                  {preset === 'current' ? 'Current' : preset === 'hero' ? 'Hero Angle' : 'Lahore Vista'}
                </button>
              ))}

              <button
                type="button"
                onClick={handleSnap}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-950 shadow-md transition-transform cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Capture</span>
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#060b14]/82 p-3 sm:p-5 overflow-y-auto">
      {shutterFlash && (
        <div className="fixed inset-0 z-40 pointer-events-none bg-white/45" />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-mode-title"
        className="w-full max-w-xl rounded-2xl bg-[#0b1322] border border-white/15 p-4 sm:p-5 shadow-2xl text-white my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-amber-300">
              <Camera className="w-3.5 h-3.5" />
              <span>Photo Mode · World Frozen</span>
            </div>
            <h2
              id="photo-mode-title"
              className="text-lg sm:text-xl font-black uppercase tracking-wide mt-0.5"
            >
              Lahore Snapshot
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setCleanViewfinder(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 px-3 py-2 text-xs font-extrabold uppercase tracking-wider text-sky-200 cursor-pointer shrink-0"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Clean Scene</span>
          </button>
        </div>

        {/* Snapshot Preview */}
        <div className="mt-3.5 relative rounded-xl overflow-hidden border border-white/15 bg-[#060b14]">
          <img
            src={activeOutputUrl}
            alt="Frozen Lahore Bound snapshot"
            className="w-full max-h-[48vh] object-contain mx-auto block"
          />
          {feedbackMsg && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 text-slate-950 px-3 py-1.5 text-xs font-black uppercase tracking-wider shadow-lg">
              <Check className="w-3.5 h-3.5" />
              <span>{feedbackMsg}</span>
            </div>
          )}
        </div>

        {/* Camera Angle & Achievement Stamp Controls */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 p-1">
            {(['current', 'hero', 'wide'] as PhotoCameraPreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={cameraPreset === preset}
                onClick={() => {
                  handlePresetChange(preset);
                  const fresh = onRecapture();
                  if (fresh) {
                    setSnapshotUrl(fresh);
                    setShutterFlash(true);
                  }
                }}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider cursor-pointer transition-colors ${
                  cameraPreset === preset
                    ? 'bg-sky-400 text-slate-950'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {preset === 'current' ? 'Current' : preset === 'hero' ? 'Hero' : 'Vista'}
              </button>
            ))}
          </div>

          <button
            type="button"
            aria-pressed={includeStamp}
            onClick={() => setIncludeStamp((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold cursor-pointer transition-colors ${
              includeStamp
                ? 'bg-amber-400/15 border-amber-400/45 text-amber-200'
                : 'bg-white/5 border-white/10 text-slate-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Achievement Stamp: {includeStamp ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Sky Time-of-Day Filter for Snapshot */}
        {onChangeLightingMode && (
          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl bg-white/5 border border-white/10 p-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 pl-2 shrink-0">
              Sky Time
            </span>
            <div className="flex items-center gap-1 flex-wrap justify-end">
              {LIGHTING_MODES.map((opt) => {
                const active = lightingMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      onChangeLightingMode(opt.id);
                      const fresh = onRecapture();
                      if (fresh) {
                        setSnapshotUrl(fresh);
                        setShutterFlash(true);
                      }
                    }}
                    className={`rounded-lg px-2 py-1 text-[11px] font-black transition-colors cursor-pointer ${
                      active
                        ? 'text-slate-950'
                        : 'text-slate-300 hover:text-white hover:bg-white/8'
                    }`}
                    style={active ? { backgroundColor: opt.accentHex } : undefined}
                  >
                    {opt.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Lahore Style Cinema Color Grading */}
        <div className="mt-2.5 rounded-xl bg-white/5 border border-white/10 p-2">
          <div className="flex items-center justify-between gap-2 mb-1.5 px-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-amber-300">
              <Film className="w-3.5 h-3.5 shrink-0" />
              <span>Lahore Style Filter</span>
            </span>
            <span className="text-[11px] font-semibold text-slate-300 truncate">
              {activeFilterMeta.eraTag} · {activeFilterMeta.description}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            {LAHORE_PHOTO_FILTERS.map((preset, idx) => {
              const active = lahoreFilter === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setLahoreFilter(preset.id)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-black transition-colors cursor-pointer ${
                    idx === 0 ? 'col-span-2 sm:col-span-1' : ''
                  } ${
                    active
                      ? 'bg-white/15 text-white'
                      : 'bg-[#07101f]/75 text-slate-300 hover:text-white hover:bg-white/8'
                  }`}
                  style={
                    active
                      ? {
                          boxShadow: `inset 0 0 0 1.5px ${preset.swatchPrimary}`,
                        }
                      : undefined
                  }
                >
                  <span className="inline-flex items-center shrink-0">
                    <span
                      className="w-2 h-2.5 rounded-l-xs"
                      style={{ backgroundColor: preset.swatchPrimary }}
                    />
                    <span
                      className="w-1.5 h-2.5 rounded-r-xs"
                      style={{ backgroundColor: preset.swatchSecondary }}
                    />
                  </span>
                  <span className="truncate">{preset.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Share & Save Actions */}
        <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black uppercase tracking-wider text-xs py-2.5 px-3 transition-transform cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-400 hover:bg-sky-300 active:scale-95 text-slate-950 font-black uppercase tracking-wider text-xs py-2.5 px-3 transition-transform cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Save PNG</span>
          </button>

          <button
            type="button"
            onClick={handleCopySummary}
            className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold uppercase tracking-wider text-xs py-2.5 px-3 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-sky-300" />
            <span>Copy Stats</span>
          </button>
        </div>

        {/* Navigation Footer */}
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBackToPause}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 font-bold uppercase tracking-wider text-xs px-3.5 py-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Pause Menu</span>
          </button>

          <button
            type="button"
            onClick={onResumeRun}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black uppercase tracking-wider text-xs px-4 py-2 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-slate-950" />
            <span>Resume Run</span>
          </button>
        </div>
      </div>
    </div>
  );
};
