export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type DifficultyMode = 'zen' | 'normal' | 'turbo';

export type BiomeId = 'canyon' | 'skybridge' | 'obsidian';

export type LahoreLandmarkKind =
  | 'gate'
  | 'bazaar'
  | 'mosque'
  | 'minar'
  | 'gardens'
  | 'canal'
  | 'liberty';

export type WeatherCondition = 'clear' | 'light_rain' | 'mist' | 'sunny_haze';

export type MusicTrackId = 'street_ambient' | 'qawwali' | 'sufi_fusion';

export type RadioStationId =
  | 'auto'
  | 'sufi_soul'
  | 'lahore_pop'
  | 'historical_instrumental';

export type LightingMode = 'auto' | 'dawn' | 'day' | 'sunset' | 'night';

export type GlobalEventMode = 'auto' | 'carnival' | 'off';

export type PowerupType = 'shield' | 'magnet' | 'multiplier' | 'chronos';

export type SkinAccessory =
  | 'pack'
  | 'basant'
  | 'crest'
  | 'shahi'
  | 'fins'
  | 'hood'
  | 'qawwal'
  | 'wings'
  | 'stormrider'
  | 'halo'
  | 'carnival';

export interface CharacterSkin {
  id: string;
  name: string;
  tagline: string;
  costGems: number;
  milestoneMeters: number;
  primaryColor: number;
  secondaryColor: number;
  accentColor: number;
  visorColor: number;
  skinTone?: number;
  hairColor?: number;
  eyeColor?: number;
  metalness: number;
  roughness: number;
  emissiveIntensity: number;
  accessory: SkinAccessory;
  swatchHex: string;
  accentHex: string;
  eventExclusive?: 'street_carnival';
}

export type MissionType =
  | 'jumps'
  | 'slides'
  | 'gems'
  | 'distance'
  | 'style'
  | 'springs';

export interface DailyMission {
  id: string;
  type: MissionType;
  label: string;
  target: number;
  progress: number;
  rewardGems: number;
  claimed: boolean;
}

export interface DailyMissionState {
  dateKey: string;
  missions: DailyMission[];
}

export interface CompletedMissionRecord {
  id: string;
  type: MissionType;
  label: string;
  target: number;
  rewardGems: number;
  claimed: boolean;
}

export interface DailyMissionArchiveEntry {
  dateKey: string;
  completed: number;
  total: number;
  completedMissions?: CompletedMissionRecord[];
}

export type WeeklyChallengeType = 'distance' | 'gems' | 'style' | 'jumps';

export type ProfileBadgeId =
  | 'lahore_legend'
  | 'gem_sovereign'
  | 'street_virtuoso'
  | 'sky_acrobat'
  | 'slide_phantom'
  | 'grounded_jade'
  | 'iron_strider'
  | 'bazaar_virtuoso';

export type SkinCosmeticId =
  | 'starlight_crown'
  | 'truckart_wings'
  | 'emerald_crest'
  | 'comet_halo'
  | 'marigold_scarf'
  | 'badshahi_crest'
  | 'prism_thrusters'
  | 'golden_chakkar';

export interface ProfileBadge {
  id: ProfileBadgeId;
  name: string;
  description: string;
  accentHex: string;
  source?: 'weekly' | 'daily_run';
}

export interface SkinCosmetic {
  id: SkinCosmeticId;
  name: string;
  description: string;
  accentHex: string;
  secondaryHex: string;
  source?: 'weekly' | 'daily_run';
}

export type DailyRunObjectiveMetric =
  | 'slides'
  | 'gems'
  | 'distance'
  | 'styleBonuses'
  | 'jumps'
  | 'springHits';

export type DailyRunForbiddenAction = 'jumps' | 'slides';

export interface DailyRunObjectiveTemplate {
  id: string;
  title: string;
  label: string;
  ruleHint: string;
  metric: DailyRunObjectiveMetric;
  target: number;
  forbidAction: DailyRunForbiddenAction | null;
  rewardGems: number;
  repeatBonusGems: number;
  rewardBadgeId: ProfileBadgeId;
  rewardCosmeticId: SkinCosmeticId;
  rewardBoost: TemporarySpeedBoostState;
}

export interface DailyRunObjectiveState {
  dateKey: string;
  templateId: string;
  bestProgress: number;
  completed: boolean;
  claimed: boolean;
}

export interface WeeklyChallenge {
  id: string;
  templateId: string;
  title: string;
  type: WeeklyChallengeType;
  label: string;
  target: number;
  progress: number;
  rewardGems: number;
  rewardBadgeId: ProfileBadgeId;
  rewardCosmeticId: SkinCosmeticId;
  claimed: boolean;
}

export interface WeeklyChallengeState {
  weekKey: string;
  challenges: WeeklyChallenge[];
}

export interface DailyStreakData {
  count: number;
  lastCompletedDateKey: string | null;
}

export interface DailyLoginBonusState {
  lastClaimedDateKey: string | null;
  consecutiveDays: number;
}

export type LuckyWheelRewardKind = 'gems' | 'cosmetic' | 'speed_boost';

export interface LuckyWheelSlice {
  id: string;
  kind: LuckyWheelRewardKind;
  shortLabel: string;
  title: string;
  description: string;
  gemsAmount?: number;
  boostMultiplier?: number;
  boostSeconds?: number;
  weight: number;
  colorHex: string;
  textHex: string;
  accentHex: string;
}

export interface LuckyWheelState {
  lastSpinDateKey: string | null;
  totalSpins: number;
  lastRewardId: string | null;
  lastRewardLabel: string | null;
}

export interface TemporarySpeedBoostState {
  multiplier: number;
  durationSeconds: number;
  label: string;
}

export interface RunMetrics {
  distance: number;
  gems: number;
  jumps: number;
  slides: number;
  styleBonuses: number;
  springHits: number;
}

export interface HudSnapshot {
  distance: number;
  score: number;
  runGems: number;
  combo: number;
  comboStreak: number;
  comboPopSeq: number;
  comboActionLabel: string | null;
  comboDecayRatio: number;
  speedMultiplier: number;
  difficulty: DifficultyMode;
  biome: BiomeId;
  journeyStopName: string;
  journeySubtitle: string;
  journeyAccentHex: string;
  weather: WeatherCondition;
  weatherLabel: string;
  weatherAccentHex: string;
  weatherModifierLabel: string | null;
  weatherModifierSummary: string | null;
  ambientOverlayLabel: string;
  timeOfDayLabel: string;
  timeOfDayHour: number;
  musicTrack: MusicTrackId;
  musicTrackLabel: string;
  radioStation: RadioStationId;
  radioStationLabel: string;
  nextJourneyStopName: string;
  nextJourneyDistance: number;
  journeyProgress: number;
  hasShield: boolean;
  magnetTimer: number;
  multiplierTimer: number;
  chronosTimer: number;
  speedBoostTimer: number;
  powerupFlashType: PowerupType | null;
  powerupFlashSeq: number;
  eventBanner: string | null;
  landmarkPopupName: string | null;
  landmarkPopupSubtitle: string | null;
  landmarkPopupAccent: string | null;
  landmarkPopupDistance: number;
  landmarkPopupSeq: number;
  landmarkPopupIsNew: boolean;
  voiceoverCallout: string | null;
  voiceoverSeq: number;
  globalEventActive: boolean;
  globalEventName: string | null;
  globalEventLabel: string | null;
  globalEventAccentHex: string | null;
  jumps: number;
  slides: number;
  styleBonuses: number;
  springHits: number;
}

export interface LeaderboardEntry {
  id: string;
  uid?: string;
  difficulty?: DifficultyMode;
  score: number;
  distance: number;
  skinId: string;
  badgeId?: ProfileBadgeId | null;
  peakSpeedMultiplier?: number;
  landmarkReachedName?: string;
  recordedAt: string;
  playerName?: string;
  isPlayer?: boolean;
}

export interface RunSummary {
  entryId: string;
  distance: number;
  score: number;
  gemsEarned: number;
  maxCombo: number;
  peakSpeedMultiplier: number;
  difficulty: DifficultyMode;
  biomeReached: BiomeId;
  landmarkReached: LahoreLandmarkKind;
  landmarkReachedName: string;
  weatherReached: WeatherCondition;
  weatherLabel: string;
  isNewBestDistance: boolean;
  leaderboardRank: number | null;
  newlyUnlockedSkins: CharacterSkin[];
  reason: 'obstacle' | 'fall';
}

export interface SaveData {
  totalGems: number;
  bestDistance: number;
  bestScore: number;
  unlockedSkinIds: string[];
  selectedSkinId: string;
  difficulty: DifficultyMode;
  muted: boolean;
  radioStation: RadioStationId;
  lightingMode: LightingMode;
  eventMode: GlobalEventMode;
  ambientWeatherOverlay: boolean;
  hapticsEnabled: boolean;
  showTouchButtons: boolean;
  debugFootIk: boolean;
  dailyMissions: DailyMissionState;
  dailyRunObjective: DailyRunObjectiveState;
  missionArchive: DailyMissionArchiveEntry[];
  weeklyChallenges: WeeklyChallengeState;
  unlockedBadgeIds: ProfileBadgeId[];
  equippedBadgeId: ProfileBadgeId | null;
  unlockedCosmeticIds: SkinCosmeticId[];
  equippedCosmeticId: SkinCosmeticId | null;
  unlockedLandmarkIds: LahoreLandmarkKind[];
  dailyStreak: DailyStreakData;
  dailyLogin: DailyLoginBonusState;
  luckyWheel: LuckyWheelState;
  pendingSpeedBoost: TemporarySpeedBoostState | null;
  leaderboard: LeaderboardEntry[];
  runnerHandle?: string | null;
}
