import type { DifficultyMode } from './types';

export interface DifficultyConfig {
  id: DifficultyMode;
  label: string;
  tagline: string;
  baseSpeed: number;
  maxMultiplier: number;
  rampDistance: number;
  rampTimeSeconds: number;
  obstacleDensity: number;
  scoreFactor: number;
  accentHex: string;
}

export const DIFFICULTY_MODES: DifficultyMode[] = ['zen', 'normal', 'turbo'];

export const DIFFICULTY_CONFIGS: Record<DifficultyMode, DifficultyConfig> = {
  zen: {
    id: 'zen',
    label: 'Zen',
    tagline: 'Relaxed pace · Light obstacles',
    baseSpeed: 9.2,
    maxMultiplier: 1.7,
    rampDistance: 1350,
    rampTimeSeconds: 95,
    obstacleDensity: 0.5,
    scoreFactor: 0.85,
    accentHex: '#34d399',
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    tagline: 'Balanced speed & hazards',
    baseSpeed: 11.2,
    maxMultiplier: 2.15,
    rampDistance: 980,
    rampTimeSeconds: 75,
    obstacleDensity: 1.0,
    scoreFactor: 1.0,
    accentHex: '#38bdf8',
  },
  turbo: {
    id: 'turbo',
    label: 'Turbo',
    tagline: 'High velocity · Dense gauntlet',
    baseSpeed: 14.0,
    maxMultiplier: 2.55,
    rampDistance: 720,
    rampTimeSeconds: 58,
    obstacleDensity: 1.45,
    scoreFactor: 1.35,
    accentHex: '#f43f5e',
  },
};
