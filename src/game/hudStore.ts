import { useSyncExternalStore } from 'react';
import type { HudSnapshot } from './types';

export const INITIAL_HUD_SNAPSHOT: HudSnapshot = {
  distance: 0,
  score: 0,
  runGems: 0,
  combo: 1,
  comboStreak: 0,
  comboPopSeq: 0,
  comboActionLabel: null,
  comboDecayRatio: 0,
  speedMultiplier: 1.0,
  difficulty: 'normal',
  biome: 'canyon',
  journeyStopName: 'Delhi Gate',
  journeySubtitle: 'Androon Walled City',
  journeyAccentHex: '#f97316',
  weather: 'sunny_haze',
  weatherLabel: 'Sandstone Haze',
  weatherAccentHex: '#fbbf24',
  weatherModifierLabel: 'TAILWIND · +10% PTS',
  weatherModifierSummary: 'Golden courtyard breeze grants +10% score & 15% longer combo hold',
  ambientOverlayLabel: 'Warm Sandstone Heat Shimmer · Courtyard Breeze',
  timeOfDayLabel: 'Sunset',
  timeOfDayHour: 17.45,
  musicTrack: 'street_ambient',
  musicTrackLabel: 'Street Breeze',
  radioStation: 'auto',
  radioStationLabel: 'Auto Mix',
  nextJourneyStopName: 'Anarkali',
  nextJourneyDistance: 180,
  journeyProgress: 0,
  hasShield: false,
  magnetTimer: 0,
  multiplierTimer: 0,
  chronosTimer: 0,
  speedBoostTimer: 0,
  powerupFlashType: null,
  powerupFlashSeq: 0,
  eventBanner: null,
  landmarkPopupName: null,
  landmarkPopupSubtitle: null,
  landmarkPopupAccent: null,
  landmarkPopupDistance: 0,
  landmarkPopupSeq: 0,
  landmarkPopupIsNew: false,
  voiceoverCallout: null,
  voiceoverSeq: 0,
  globalEventActive: false,
  globalEventName: null,
  globalEventLabel: null,
  globalEventAccentHex: null,
  jumps: 0,
  slides: 0,
  styleBonuses: 0,
  springHits: 0,
};

type HudListener = () => void;

class HudExternalStore {
  private snapshot: HudSnapshot = INITIAL_HUD_SNAPSHOT;
  private readonly listeners = new Set<HudListener>();

  public getSnapshot = (): HudSnapshot => this.snapshot;

  public setSnapshot = (next: HudSnapshot): void => {
    this.snapshot = next;
    for (const listener of this.listeners) {
      listener();
    }
  };

  public reset = (): void => {
    this.setSnapshot(INITIAL_HUD_SNAPSHOT);
  };

  public subscribe = (listener: HudListener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}

export const hudStore = new HudExternalStore();

export function useHudSnapshot(): HudSnapshot {
  return useSyncExternalStore(hudStore.subscribe, hudStore.getSnapshot, hudStore.getSnapshot);
}

export function useHudSelector<T>(selector: (hud: HudSnapshot) => T): T {
  return useSyncExternalStore(
    hudStore.subscribe,
    () => selector(hudStore.getSnapshot()),
    () => selector(INITIAL_HUD_SNAPSHOT),
  );
}
