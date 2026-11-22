import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudFog,
  CloudRain,
  Compass,
  MapPin,
  Sun,
  Wind,
} from 'lucide-react';
import { LAHORE_TRACK_STOPS } from '../game/lahoreJourney';
import { getLandmarkForecast } from '../game/weather';
import type { LahoreLandmarkKind, WeatherCondition } from '../game/types';

const GuideWeatherIcon: React.FC<{ condition: WeatherCondition; color: string }> = ({
  condition,
  color,
}) => {
  const props = { className: 'w-3 h-3 shrink-0', style: { color } };
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

interface TouristGuideSlide {
  landmark: LahoreLandmarkKind;
  name: string;
  district: string;
  distanceMeters: number;
  accentHex: string;
  imageUrl: string;
  imageAlt: string;
  trivia: string;
}

const TOURIST_GUIDE_SLIDES: TouristGuideSlide[] = LAHORE_TRACK_STOPS.map((stop) => ({
  landmark: stop.landmark,
  name: stop.name,
  district: stop.subtitle,
  distanceMeters: stop.encounterMeters,
  accentHex: stop.accentHex,
  imageUrl: stop.imageUrl,
  imageAlt: stop.imageAlt,
  trivia: stop.guideTrivia,
}));

interface LahoreTouristGuideProps {
  unlockedLandmarkIds: LahoreLandmarkKind[];
  onInspectInCodex: (landmark: LahoreLandmarkKind) => void;
}

export const LahoreTouristGuide: React.FC<LahoreTouristGuideProps> = ({
  unlockedLandmarkIds,
  onInspectInCodex,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (paused) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const id = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % TOURIST_GUIDE_SLIDES.length);
    }, 6500);
    return () => window.clearInterval(id);
  }, [paused]);

  const slide = TOURIST_GUIDE_SLIDES[activeIndex];
  const isUnlocked = unlockedLandmarkIds.includes(slide.landmark);
  const imageBroken = Boolean(failedImages[slide.landmark]);
  const forecast = getLandmarkForecast(slide.landmark);
  const totalStops = LAHORE_TRACK_STOPS.length;

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + TOURIST_GUIDE_SLIDES.length) % TOURIST_GUIDE_SLIDES.length);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % TOURIST_GUIDE_SLIDES.length);
  };

  return (
    <aside
      aria-label="Lahore Tourist Guide"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className="pointer-events-auto w-full max-w-md lg:max-w-[348px] rounded-2xl bg-[#0b1322]/90 border border-white/15 shadow-2xl overflow-hidden text-white"
    >
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-white/10">
        <div className="flex items-center gap-1.5 min-w-0">
          <Compass className="w-4 h-4 text-amber-300 shrink-0" />
          <h2 className="text-xs font-extrabold tracking-wide text-amber-200 truncate">
            Lahore Tourist Guide
          </h2>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[11px] font-semibold text-slate-400 tabular-nums mr-1">
            {activeIndex + 1}/{TOURIST_GUIDE_SLIDES.length}
          </span>
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous Lahore landmark"
            className="w-7 h-7 rounded-lg bg-white/8 hover:bg-white/15 flex items-center justify-center text-slate-200 cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next Lahore landmark"
            className="w-7 h-7 rounded-lg bg-white/8 hover:bg-white/15 flex items-center justify-center text-slate-200 cursor-pointer transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Responsive Body: horizontal compact strip below lg, stacked 16:9 showcase at lg+ */}
      <div className="flex flex-row lg:flex-col">
        {/* 16:9 Generated Landmark Preview */}
        <div className="relative w-36 sm:w-44 lg:w-full aspect-video shrink-0 bg-[#07101f] overflow-hidden">
          {!imageBroken ? (
            <img
              key={slide.landmark}
              src={slide.imageUrl}
              alt={slide.imageAlt}
              referrerPolicy="no-referrer"
              onError={() =>
                setFailedImages((prev) => ({
                  ...prev,
                  [slide.landmark]: true,
                }))
              }
              className="w-full h-full object-cover block"
            />
          ) : (
            <div
              className="w-full h-full flex flex-col items-center justify-center gap-1 p-3 text-center"
              style={{
                background: `linear-gradient(135deg, #0b172c 0%, ${slide.accentHex}33 100%)`,
              }}
            >
              <Compass className="w-6 h-6 text-amber-300" />
              <span className="text-xs font-bold text-white">{slide.name}</span>
            </div>
          )}

          {/* Scrim for high-contrast overlay caption on desktop */}
          <div className="hidden lg:block absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#060b14]/92 via-[#060b14]/50 to-transparent pointer-events-none" />
          <div className="hidden lg:flex absolute inset-x-0 bottom-0 px-3.5 py-2.5 items-end justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-200/90 tabular-nums">
                <MapPin className="w-3 h-3 shrink-0" style={{ color: slide.accentHex }} />
                <span className="truncate">{slide.district}</span>
                <span aria-hidden="true">·</span>
                <span>{slide.distanceMeters}m</span>
              </div>
              <div className="text-base font-black tracking-tight text-white truncate">
                {slide.name}
              </div>
            </div>

            {isUnlocked && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 shrink-0">
                <Check className="w-3.5 h-3.5" />
                <span>Visited</span>
              </span>
            )}
          </div>
        </div>

        {/* Trivia & Codex Action */}
        <div className="p-3 sm:p-3.5 flex-1 min-w-0 flex flex-col justify-between gap-2">
          <div>
            <div className="flex lg:hidden items-center justify-between gap-2 mb-0.5">
              <span className="text-sm font-black text-white truncate">{slide.name}</span>
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold shrink-0"
                style={{ color: forecast.accentHex }}
              >
                <GuideWeatherIcon condition={forecast.condition} color={forecast.accentHex} />
                <span>{forecast.shortLabel}</span>
              </span>
            </div>
            <div className="hidden lg:flex items-center justify-between gap-2 mb-1 text-[11px] text-slate-300 tabular-nums">
              <span>Encounter at {slide.distanceMeters}m</span>
              <span
                className="inline-flex items-center gap-1 font-bold"
                style={{ color: forecast.accentHex }}
              >
                <GuideWeatherIcon condition={forecast.condition} color={forecast.accentHex} />
                <span>{forecast.label}</span>
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-200/95 leading-relaxed line-clamp-3">
              {slide.trivia}
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/8">
            <div className="flex items-center" role="tablist" aria-label="Select landmark preview">
              {TOURIST_GUIDE_SLIDES.map((item, idx) => {
                const active = idx === activeIndex;
                return (
                  <button
                    key={item.landmark}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={`View ${item.name}`}
                    onClick={() => setActiveIndex(idx)}
                    className="h-7 min-w-6 px-1 flex items-center justify-center cursor-pointer group"
                  >
                    <span
                      className={`h-1.5 rounded-full transition-all ${
                        active
                          ? 'w-5 bg-amber-400'
                          : 'w-1.5 bg-white/25 group-hover:bg-white/50'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => onInspectInCodex(slide.landmark)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 hover:text-emerald-200 whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>
                Codex {unlockedLandmarkIds.length}/{totalStops}
              </span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
