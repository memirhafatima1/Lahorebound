import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpen,
  Camera,
  Check,
  Crown,
  Flame,
  Gem,
  Gift,
  Landmark,
  MapPin,
  PartyPopper,
  Play,
  Radio,
  RotateCcw,
  Settings,
  Shirt,
  Sparkles,
  Target,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { DailyBonusModal } from './components/DailyBonusModal';
import { GameHUD } from './components/GameHUD';
import { LahoreTouristGuide } from './components/LahoreTouristGuide';
import { LandmarkCodexModal } from './components/LandmarkCodexModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { LeaderboardPanel } from './components/LeaderboardPanel';
import { LuckyWheelModal } from './components/LuckyWheelModal';
import { MissionsModal } from './components/MissionsModal';
import { PhotoModeModal, type PhotoCameraPreset } from './components/PhotoModeModal';
import { SettingsModal } from './components/SettingsModal';
import { SkinWardrobe } from './components/SkinWardrobe';
import { TitleLogo } from './components/TitleLogo';
import { WeeklyChallengeModal } from './components/WeeklyChallengeModal';
import {
  claimDailyLoginBonus,
  getDailyLoginStatus,
  normalizeDailyLogin,
} from './game/dailyLogin';
import {
  claimDailyRunObjectiveReward,
  evaluateDailyRunObjectiveAttempt,
  getDailyRunMetricUnit,
  getDailyRunObjectiveTemplateById,
  normalizeDailyRunObjectiveState,
} from './game/dailyRunObjective';
import { DIFFICULTY_CONFIGS, DIFFICULTY_MODES } from './game/difficulty';
import { SkyboundEngine } from './game/engine';
import { getStreetCarnivalStatus, type GlobalEventStatus } from './game/globalEvents';
import { HapticFeedbackService } from './game/haptics';
import { LAHORE_TRACK_STOPS } from './game/lahoreJourney';
import {
  applyLuckyWheelSliceReward,
  getLuckyWheelStatus,
  normalizeLuckyWheel,
  type LuckyWheelOutcome,
} from './game/luckyWheel';
import { RADIO_STATIONS, RADIO_STATION_MAP } from './game/music';
import {
  advanceDailyStreakOnMissionComplete,
  applyMetricsDeltaToMissions,
  getLocalDateKey,
  normalizeDailyMissionState,
  normalizeDailyStreak,
  syncMissionArchive,
} from './game/missions';
import {
  CARNIVAL_RUNNER_SKIN,
  CHARACTER_SKINS,
  getSkinById,
  loadSaveData,
  persistSaveData,
  recordLeaderboardRun,
  resolveActiveSkinId,
} from './game/skins';
import {
  applyMetricsDeltaToWeeklyChallenges,
  getBadgeById,
  normalizeWeeklyChallengeState,
} from './game/weeklyChallenges';
import type {
  CharacterSkin,
  DifficultyMode,
  GamePhase,
  GlobalEventMode,
  HudSnapshot,
  LahoreLandmarkKind,
  LeaderboardEntry,
  LightingMode,
  LuckyWheelSlice,
  ProfileBadgeId,
  RadioStationId,
  RunMetrics,
  RunSummary,
  SaveData,
  SkinCosmeticId,
} from './game/types';

const INITIAL_HUD: HudSnapshot = {
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
  weatherLabel: 'Sunny Haze',
  weatherAccentHex: '#fbbf24',
  ambientOverlayLabel: 'Warm Sandstone Heat Shimmer · Courtyard Breeze',
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

const ZERO_METRICS: RunMetrics = {
  distance: 0,
  gems: 0,
  jumps: 0,
  slides: 0,
  styleBonuses: 0,
  springHits: 0,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SkyboundEngine | null>(null);
  const vibrationServiceRef = useRef<HapticFeedbackService | null>(null);
  if (!vibrationServiceRef.current) {
    vibrationServiceRef.current = new HapticFeedbackService({
      heavy: [48],
      continuous: [18, 22, 18, 22, 18, 22, 18, 22, 18, 22, 18, 22, 18, 22, 18],
      'double-tap': [12, 34, 12],
    });
  }

  const [save, setSave] = useState<SaveData>(() => loadSaveData());
  const saveRef = useRef<SaveData>(save);
  saveRef.current = save;

  useEffect(() => {
    vibrationServiceRef.current?.setEnabled(save.hapticsEnabled);
  }, [save.hapticsEnabled]);

  const [phase, setPhase] = useState<GamePhase>('title');
  const phaseRef = useRef<GamePhase>(phase);
  phaseRef.current = phase;

  const [wardrobeOpen, setWardrobeOpen] = useState(false);
  const wardrobeOpenRef = useRef(wardrobeOpen);
  wardrobeOpenRef.current = wardrobeOpen;

  const [missionsOpen, setMissionsOpen] = useState(false);
  const missionsOpenRef = useRef(missionsOpen);
  missionsOpenRef.current = missionsOpen;

  const [dailyBonusOpen, setDailyBonusOpen] = useState(false);
  const dailyBonusOpenRef = useRef(dailyBonusOpen);
  dailyBonusOpenRef.current = dailyBonusOpen;

  const [photoModeOpen, setPhotoModeOpen] = useState(false);
  const photoModeOpenRef = useRef(photoModeOpen);
  photoModeOpenRef.current = photoModeOpen;
  const [photoSnapshotUrl, setPhotoSnapshotUrl] = useState<string>('');

  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const weeklyOpenRef = useRef(weeklyOpen);
  weeklyOpenRef.current = weeklyOpen;

  const [luckyWheelOpen, setLuckyWheelOpen] = useState(false);
  const luckyWheelOpenRef = useRef(luckyWheelOpen);
  luckyWheelOpenRef.current = luckyWheelOpen;

  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const leaderboardOpenRef = useRef(leaderboardOpen);
  leaderboardOpenRef.current = leaderboardOpen;

  const [codexOpen, setCodexOpen] = useState(false);
  const [codexInitialLandmark, setCodexInitialLandmark] = useState<LahoreLandmarkKind | null>(null);
  const codexOpenRef = useRef(codexOpen);
  codexOpenRef.current = codexOpen;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsOpenRef = useRef(settingsOpen);
  settingsOpenRef.current = settingsOpen;

  const [globalEvent, setGlobalEvent] = useState<GlobalEventStatus>(() =>
    getStreetCarnivalStatus(save.eventMode),
  );

  const [previewSkinId, setPreviewSkinId] = useState<string>(() =>
    resolveActiveSkinId(
      save.selectedSkinId,
      save.unlockedSkinIds,
      getStreetCarnivalStatus(save.eventMode).active,
    ),
  );
  const [previewCosmeticId, setPreviewCosmeticId] = useState<SkinCosmeticId | null>(
    save.equippedCosmeticId,
  );
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [webglStatus, setWebglStatus] = useState<'ok' | 'lost' | 'unavailable'>('ok');

  // Tracks metrics already applied to dailyMissions during the current run so we never double-count
  const flushedMetricsRef = useRef<RunMetrics>({ ...ZERO_METRICS });
  const dailyRunAttemptRef = useRef<{ progress: number; disqualified: boolean }>({
    progress: 0,
    disqualified: false,
  });
  const [dailyRunAttempt, setDailyRunAttempt] = useState<{
    progress: number;
    disqualified: boolean;
  }>({ progress: 0, disqualified: false });

  // Swipe gesture state (zero-latency directional trigger on touch/pointer move)
  const swipeStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    triggered: boolean;
    pointerId: number;
  }>({ active: false, startX: 0, startY: 0, triggered: false, pointerId: -1 });

  const updateSave = useCallback((updater: (prev: SaveData) => SaveData) => {
    setSave((prev) => {
      const next = updater(prev);
      saveRef.current = next;
      persistSaveData(next);
      return next;
    });
  }, []);

  const flushRunMetrics = useCallback((snapshot: HudSnapshot, silentBanner = false) => {
    const flushed = flushedMetricsRef.current;
    const delta: RunMetrics = {
      distance: Math.max(0, snapshot.distance - flushed.distance),
      gems: Math.max(0, snapshot.runGems - flushed.gems),
      jumps: Math.max(0, snapshot.jumps - flushed.jumps),
      slides: Math.max(0, snapshot.slides - flushed.slides),
      styleBonuses: Math.max(0, snapshot.styleBonuses - flushed.styleBonuses),
      springHits: Math.max(0, snapshot.springHits - flushed.springHits),
    };

    const hasCumulativeDelta =
      delta.distance > 0 ||
      delta.gems > 0 ||
      delta.jumps > 0 ||
      delta.slides > 0 ||
      delta.styleBonuses > 0 ||
      delta.springHits > 0;

    const currentSave = saveRef.current;
    const dailyEval = evaluateDailyRunObjectiveAttempt(
      currentSave.dailyRunObjective,
      snapshot,
      dailyRunAttemptRef.current.disqualified,
    );

    const prevAttempt = dailyRunAttemptRef.current;
    if (
      prevAttempt.progress !== dailyEval.currentRunProgress ||
      prevAttempt.disqualified !== dailyEval.disqualifiedThisRun
    ) {
      const nextAttempt = {
        progress: dailyEval.currentRunProgress,
        disqualified: dailyEval.disqualifiedThisRun,
      };
      dailyRunAttemptRef.current = nextAttempt;
      setDailyRunAttempt(nextAttempt);
    }

    const dailyStateChanged =
      dailyEval.nextState.dateKey !== currentSave.dailyRunObjective.dateKey ||
      dailyEval.nextState.templateId !== currentSave.dailyRunObjective.templateId ||
      dailyEval.nextState.bestProgress !== currentSave.dailyRunObjective.bestProgress ||
      dailyEval.nextState.completed !== currentSave.dailyRunObjective.completed;

    if (!hasCumulativeDelta && !dailyStateChanged) {
      return;
    }

    if (hasCumulativeDelta) {
      flushedMetricsRef.current = {
        distance: Math.max(flushed.distance, snapshot.distance),
        gems: Math.max(flushed.gems, snapshot.runGems),
        jumps: Math.max(flushed.jumps, snapshot.jumps),
        slides: Math.max(flushed.slides, snapshot.slides),
        styleBonuses: Math.max(flushed.styleBonuses, snapshot.styleBonuses),
        springHits: Math.max(flushed.springHits, snapshot.springHits),
      };
    }

    const archiveWithPrev = syncMissionArchive(currentSave.missionArchive, currentSave.dailyMissions);
    const normalized = normalizeDailyMissionState(currentSave.dailyMissions);
    const { updated, newlyCompleted } = hasCumulativeDelta
      ? applyMetricsDeltaToMissions(normalized.missions, delta)
      : { updated: normalized.missions, newlyCompleted: [] };
    const nextDailyMissions = {
      dateKey: normalized.dateKey,
      missions: updated,
    };
    const nextStreak = advanceDailyStreakOnMissionComplete(currentSave.dailyStreak, updated);
    const streakExtended = nextStreak.count > currentSave.dailyStreak.count;

    const normalizedWeekly = normalizeWeeklyChallengeState(currentSave.weeklyChallenges);
    const { updated: updatedWeekly, newlyCompleted: newlyCompletedWeekly } = hasCumulativeDelta
      ? applyMetricsDeltaToWeeklyChallenges(normalizedWeekly.challenges, delta)
      : { updated: normalizedWeekly.challenges, newlyCompleted: [] };

    const nextSave: SaveData = {
      ...currentSave,
      dailyMissions: nextDailyMissions,
      dailyRunObjective: dailyEval.nextState,
      missionArchive: syncMissionArchive(archiveWithPrev, nextDailyMissions),
      weeklyChallenges: {
        weekKey: normalizedWeekly.weekKey,
        challenges: updatedWeekly,
      },
      dailyStreak: nextStreak,
    };
    saveRef.current = nextSave;
    setSave(nextSave);
    persistSaveData(nextSave);

    if (!silentBanner) {
      if (dailyEval.newlyCompleted) {
        engineRef.current?.audio.playUnlock();
        engineRef.current?.announceBanner('DAILY RUN OBJECTIVE COMPLETE!');
      } else if (newlyCompletedWeekly.length > 0) {
        engineRef.current?.audio.playUnlock();
        engineRef.current?.announceBanner('WEEKLY CHALLENGE DONE!');
      } else if (newlyCompleted.length > 0) {
        engineRef.current?.audio.playPowerup();
        engineRef.current?.announceBanner(
          streakExtended
            ? `STREAK ${nextStreak.count}D · MISSION DONE!`
            : 'MISSION COMPLETE!',
        );
      }
    }
  }, []);

  // Keep Street Carnival event timer live and automatically revert temporary event skin when event ends
  useEffect(() => {
    const syncEvent = () => {
      const nextStatus = getStreetCarnivalStatus(saveRef.current.eventMode);
      setGlobalEvent(nextStatus);
      const currentSave = saveRef.current;
      const resolved = resolveActiveSkinId(
        currentSave.selectedSkinId,
        currentSave.unlockedSkinIds,
        nextStatus.active,
      );
      if (resolved !== currentSave.selectedSkinId) {
        const updatedSave: SaveData = { ...currentSave, selectedSkinId: resolved };
        saveRef.current = updatedSave;
        setSave(updatedSave);
        persistSaveData(updatedSave);
        setPreviewSkinId(resolved);
        engineRef.current?.setSkin(resolved);
      }
    };
    syncEvent();
    const id = window.setInterval(syncEvent, 15000);
    return () => window.clearInterval(id);
  }, [save.eventMode]);

  // Initialize isolated Three.js engine once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const initialSave = saveRef.current;
    const initialEventStatus = getStreetCarnivalStatus(initialSave.eventMode);
    const initialSkinId = resolveActiveSkinId(
      initialSave.selectedSkinId,
      initialSave.unlockedSkinIds,
      initialEventStatus.active,
    );
    let engine: SkyboundEngine;
    try {
      engine = new SkyboundEngine(
        container,
        getSkinById(initialSkinId),
        initialSave.muted,
        initialSave.difficulty,
        {
          onHudUpdate: (snapshot) => {
            setHud(snapshot);
            if (phaseRef.current === 'playing') {
              flushRunMetrics(snapshot, false);
            }
          },
          onHapticEvent: (event) => {
            vibrationServiceRef.current?.triggerEvent(event);
          },
          onWebGlStatusChange: (status) => {
            setWebglStatus(status === 'lost' ? 'lost' : 'ok');
          },
          onGlobalEventChange: (status) => {
            setGlobalEvent(status);
            const currentSave = saveRef.current;
            const resolved = resolveActiveSkinId(
              currentSave.selectedSkinId,
              currentSave.unlockedSkinIds,
              status.active,
            );
            if (resolved !== currentSave.selectedSkinId) {
              const updatedSave: SaveData = { ...currentSave, selectedSkinId: resolved };
              saveRef.current = updatedSave;
              setSave(updatedSave);
              persistSaveData(updatedSave);
              setPreviewSkinId(resolved);
              engineRef.current?.setSkin(resolved);
            }
          },
          onLandmarkEncountered: (landmark) => {
            const prev = saveRef.current;
            if (prev.unlockedLandmarkIds.includes(landmark)) return false;
            const nextSave: SaveData = {
              ...prev,
              unlockedLandmarkIds: [...prev.unlockedLandmarkIds, landmark],
            };
            saveRef.current = nextSave;
            setSave(nextSave);
            persistSaveData(nextSave);
            return true;
          },
          onGameOver: (stats) => {
            vibrationServiceRef.current?.cancel();
            const prev = saveRef.current;
            const isNewBestDistance = stats.distance > prev.bestDistance;
            const nextBestDistance = Math.max(prev.bestDistance, stats.distance);
            const nextBestScore = Math.max(prev.bestScore, stats.score);
            const nextTotalGems = prev.totalGems + stats.gemsEarned;

            const newlyUnlocked: CharacterSkin[] = [];
            const nextUnlockedSet = new Set(prev.unlockedSkinIds);
            for (const skin of CHARACTER_SKINS) {
              if (!nextUnlockedSet.has(skin.id) && stats.distance >= skin.milestoneMeters) {
                nextUnlockedSet.add(skin.id);
                newlyUnlocked.push(skin);
              }
            }

            const recordedSkinId = resolveActiveSkinId(
              prev.selectedSkinId,
              prev.unlockedSkinIds,
              getStreetCarnivalStatus(prev.eventMode).active,
            );
            const entry: LeaderboardEntry = {
              id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              score: stats.score,
              distance: stats.distance,
              skinId: recordedSkinId,
              recordedAt: new Date().toISOString(),
            };
            const { leaderboard, rank } = recordLeaderboardRun(prev.leaderboard, entry);

            const nextSave: SaveData = {
              ...prev,
              totalGems: nextTotalGems,
              bestDistance: nextBestDistance,
              bestScore: nextBestScore,
              unlockedSkinIds: Array.from(nextUnlockedSet),
              leaderboard,
            };
            saveRef.current = nextSave;
            setSave(nextSave);
            persistSaveData(nextSave);

            if (newlyUnlocked.length > 0) {
              engine.audio.playUnlock();
            }

            setRunSummary({
              entryId: entry.id,
              distance: stats.distance,
              score: stats.score,
              gemsEarned: stats.gemsEarned,
              maxCombo: stats.maxCombo,
              peakSpeedMultiplier: stats.peakSpeedMultiplier,
              biomeReached: stats.biomeReached,
              landmarkReached: stats.landmarkReached,
              landmarkReachedName: stats.landmarkReachedName,
              weatherReached: stats.weatherReached,
              weatherLabel: stats.weatherLabel,
              difficulty: stats.difficulty,
              isNewBestDistance,
              leaderboardRank: rank,
              newlyUnlockedSkins: newlyUnlocked,
              reason: stats.reason,
            });
            setPhase('gameover');
          },
        },
        initialSave.equippedCosmeticId,
        initialSave.radioStation,
        initialSave.lightingMode,
        initialSave.eventMode,
        initialSave.ambientWeatherOverlay,
      );
    } catch {
      setWebglStatus('unavailable');
      return;
    }

    engineRef.current = engine;
    setWebglStatus('ok');

    return () => {
      vibrationServiceRef.current?.cancel();
      engine.dispose();
      engineRef.current = null;
    };
  }, [flushRunMetrics]);

  // Sync mute state
  const handleToggleMute = useCallback(() => {
    updateSave((prev) => {
      const muted = !prev.muted;
      engineRef.current?.audio.setMuted(muted);
      return { ...prev, muted };
    });
  }, [updateSave]);

  const handleToggleTouchButtons = useCallback(() => {
    updateSave((prev) => ({ ...prev, showTouchButtons: !prev.showTouchButtons }));
  }, [updateSave]);

  const handleToggleHaptics = useCallback(() => {
    updateSave((prev) => {
      const hapticsEnabled = !prev.hapticsEnabled;
      vibrationServiceRef.current?.setEnabled(hapticsEnabled);
      return { ...prev, hapticsEnabled };
    });
  }, [updateSave]);

  const handleToggleAmbientOverlay = useCallback(() => {
    updateSave((prev) => {
      const ambientWeatherOverlay = !prev.ambientWeatherOverlay;
      engineRef.current?.setAmbientOverlayEnabled(ambientWeatherOverlay);
      return { ...prev, ambientWeatherOverlay };
    });
  }, [updateSave]);

  const handleSelectRadioStation = useCallback(
    (station: RadioStationId) => {
      updateSave((prev) => ({ ...prev, radioStation: station }));
      engineRef.current?.setRadioStation(station);
    },
    [updateSave],
  );

  const handleCycleRadioStation = useCallback(() => {
    const idx = RADIO_STATIONS.findIndex((s) => s.id === saveRef.current.radioStation);
    const nextStation = RADIO_STATIONS[(idx + 1) % RADIO_STATIONS.length].id;
    updateSave((prev) => ({ ...prev, radioStation: nextStation }));
    engineRef.current?.setRadioStation(nextStation);
  }, [updateSave]);

  const handleSelectLightingMode = useCallback(
    (mode: LightingMode) => {
      updateSave((prev) => ({ ...prev, lightingMode: mode }));
      engineRef.current?.setLightingMode(mode);
    },
    [updateSave],
  );

  const handleSelectEventMode = useCallback(
    (mode: GlobalEventMode) => {
      const nextStatus = getStreetCarnivalStatus(mode);
      setGlobalEvent(nextStatus);
      updateSave((prev) => {
        const resolvedSkin = resolveActiveSkinId(
          prev.selectedSkinId,
          prev.unlockedSkinIds,
          nextStatus.active,
        );
        return {
          ...prev,
          eventMode: mode,
          selectedSkinId: resolvedSkin,
        };
      });
      engineRef.current?.setEventMode(mode);
      const nextSkin = resolveActiveSkinId(
        saveRef.current.selectedSkinId,
        saveRef.current.unlockedSkinIds,
        nextStatus.active,
      );
      setPreviewSkinId(nextSkin);
      engineRef.current?.setSkin(nextSkin);
    },
    [updateSave],
  );

  const handleSelectDifficulty = useCallback(
    (mode: DifficultyMode) => {
      engineRef.current?.audio.playLaneSwitch();
      updateSave((prev) => ({ ...prev, difficulty: mode }));
      engineRef.current?.setDifficulty(mode);
    },
    [updateSave],
  );

  const handleStartRun = useCallback(() => {
    const activeBoost = saveRef.current.pendingSpeedBoost;
    const currentEvent = getStreetCarnivalStatus(saveRef.current.eventMode);
    setGlobalEvent(currentEvent);
    const activeSkinForRun = resolveActiveSkinId(
      saveRef.current.selectedSkinId,
      saveRef.current.unlockedSkinIds,
      currentEvent.active,
    );
    // Ensure today's missions, run objective, streak, login bonus & lucky wheel are current if midnight crossed
    updateSave((prev) => {
      const archiveWithPrev = syncMissionArchive(prev.missionArchive, prev.dailyMissions);
      const nextDailyMissions = normalizeDailyMissionState(prev.dailyMissions);
      return {
        ...prev,
        selectedSkinId: activeSkinForRun,
        dailyMissions: nextDailyMissions,
        dailyRunObjective: normalizeDailyRunObjectiveState(prev.dailyRunObjective),
        missionArchive: syncMissionArchive(archiveWithPrev, nextDailyMissions),
        weeklyChallenges: normalizeWeeklyChallengeState(prev.weeklyChallenges),
        dailyStreak: normalizeDailyStreak(prev.dailyStreak),
        dailyLogin: normalizeDailyLogin(prev.dailyLogin),
        luckyWheel: normalizeLuckyWheel(prev.luckyWheel),
        pendingSpeedBoost: null,
      };
    });
    flushedMetricsRef.current = { ...ZERO_METRICS };
    dailyRunAttemptRef.current = { progress: 0, disqualified: false };
    setDailyRunAttempt({ progress: 0, disqualified: false });
    setWardrobeOpen(false);
    setMissionsOpen(false);
    setDailyBonusOpen(false);
    setWeeklyOpen(false);
    setLuckyWheelOpen(false);
    setLeaderboardOpen(false);
    setCodexOpen(false);
    setSettingsOpen(false);
    setPhotoModeOpen(false);
    setRunSummary(null);
    engineRef.current?.setSkin(activeSkinForRun);
    engineRef.current?.setCosmetic(saveRef.current.equippedCosmeticId);
    engineRef.current?.setDifficulty(saveRef.current.difficulty);
    engineRef.current?.startNewRun(activeBoost);
    setPhase('playing');
  }, [updateSave]);

  const handlePause = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    vibrationServiceRef.current?.cancel();
    setPhotoModeOpen(false);
    engineRef.current?.setPhase('paused');
    setPhase('paused');
  }, []);

  const handleResume = useCallback(() => {
    if (phaseRef.current !== 'paused') return;
    setPhotoModeOpen(false);
    engineRef.current?.exitPhotoMode();
    engineRef.current?.audio.unlock();
    engineRef.current?.setPhase('playing');
    setPhase('playing');
  }, []);

  const handleOpenPhotoMode = useCallback(() => {
    if (phaseRef.current !== 'paused') return;
    const engine = engineRef.current;
    if (!engine) return;
    engine.enterPhotoMode();
    const url = engine.captureSnapshot();
    setPhotoSnapshotUrl(url);
    setPhotoModeOpen(true);
  }, []);

  const handleClosePhotoMode = useCallback(() => {
    setPhotoModeOpen(false);
    engineRef.current?.exitPhotoMode();
  }, []);

  const handleSelectPhotoCameraPreset = useCallback((preset: PhotoCameraPreset) => {
    engineRef.current?.setPhotoCameraPreset(preset);
  }, []);

  const handleRecapturePhoto = useCallback((): string | null => {
    const engine = engineRef.current;
    if (!engine) return null;
    const url = engine.captureSnapshot();
    setPhotoSnapshotUrl(url);
    return url;
  }, []);

  const handleReturnToTitle = useCallback(() => {
    vibrationServiceRef.current?.cancel();
    setRunSummary(null);
    setWardrobeOpen(false);
    setMissionsOpen(false);
    setDailyBonusOpen(false);
    setWeeklyOpen(false);
    setLuckyWheelOpen(false);
    setLeaderboardOpen(false);
    setCodexOpen(false);
    setSettingsOpen(false);
    setPhotoModeOpen(false);
    engineRef.current?.exitPhotoMode();
    const activeTitleSkin = resolveActiveSkinId(
      saveRef.current.selectedSkinId,
      saveRef.current.unlockedSkinIds,
      getStreetCarnivalStatus(saveRef.current.eventMode).active,
    );
    engineRef.current?.setSkin(activeTitleSkin);
    engineRef.current?.setCosmetic(saveRef.current.equippedCosmeticId);
    engineRef.current?.setShowcaseMode(false);
    engineRef.current?.setPhase('title');
    setPhase('title');
  }, []);

  const handleOpenWardrobe = useCallback((initialSkinId?: string) => {
    const targetSkin =
      initialSkinId ??
      resolveActiveSkinId(
        saveRef.current.selectedSkinId,
        saveRef.current.unlockedSkinIds,
        getStreetCarnivalStatus(saveRef.current.eventMode).active,
      );
    setRunSummary(null);
    setMissionsOpen(false);
    setWeeklyOpen(false);
    setLuckyWheelOpen(false);
    setLeaderboardOpen(false);
    setCodexOpen(false);
    setSettingsOpen(false);
    setPreviewSkinId(targetSkin);
    setPreviewCosmeticId(saveRef.current.equippedCosmeticId);
    engineRef.current?.setSkin(targetSkin);
    engineRef.current?.setCosmetic(saveRef.current.equippedCosmeticId);
    engineRef.current?.setPhase('title');
    engineRef.current?.setShowcaseMode(true);
    setPhase('title');
    setWardrobeOpen(true);
  }, []);

  const handleCloseWardrobe = useCallback(() => {
    const activeSkinId = resolveActiveSkinId(
      saveRef.current.selectedSkinId,
      saveRef.current.unlockedSkinIds,
      getStreetCarnivalStatus(saveRef.current.eventMode).active,
    );
    setWardrobeOpen(false);
    setPreviewCosmeticId(saveRef.current.equippedCosmeticId);
    engineRef.current?.setSkin(activeSkinId);
    engineRef.current?.setCosmetic(saveRef.current.equippedCosmeticId);
    engineRef.current?.setShowcaseMode(false);
  }, []);

  const handleOpenMissions = useCallback(() => {
    updateSave((prev) => {
      const archiveWithPrev = syncMissionArchive(prev.missionArchive, prev.dailyMissions);
      const nextDailyMissions = normalizeDailyMissionState(prev.dailyMissions);
      return {
        ...prev,
        dailyMissions: nextDailyMissions,
        dailyRunObjective: normalizeDailyRunObjectiveState(prev.dailyRunObjective),
        missionArchive: syncMissionArchive(archiveWithPrev, nextDailyMissions),
        dailyStreak: normalizeDailyStreak(prev.dailyStreak),
      };
    });
    setWardrobeOpen(false);
    setDailyBonusOpen(false);
    setWeeklyOpen(false);
    setLuckyWheelOpen(false);
    setLeaderboardOpen(false);
    setCodexOpen(false);
    setSettingsOpen(false);
    setMissionsOpen(true);
  }, [updateSave]);

  const handleOpenWeekly = useCallback(() => {
    updateSave((prev) => ({
      ...prev,
      weeklyChallenges: normalizeWeeklyChallengeState(prev.weeklyChallenges),
    }));
    setWardrobeOpen(false);
    setDailyBonusOpen(false);
    setMissionsOpen(false);
    setLuckyWheelOpen(false);
    setLeaderboardOpen(false);
    setCodexOpen(false);
    setSettingsOpen(false);
    setWeeklyOpen(true);
  }, [updateSave]);

  const handleOpenLuckyWheel = useCallback(() => {
    updateSave((prev) => ({
      ...prev,
      luckyWheel: normalizeLuckyWheel(prev.luckyWheel),
    }));
    setWardrobeOpen(false);
    setDailyBonusOpen(false);
    setMissionsOpen(false);
    setWeeklyOpen(false);
    setLeaderboardOpen(false);
    setCodexOpen(false);
    setSettingsOpen(false);
    setLuckyWheelOpen(true);
  }, [updateSave]);

  const handleOpenLeaderboard = useCallback(() => {
    setWardrobeOpen(false);
    setDailyBonusOpen(false);
    setMissionsOpen(false);
    setWeeklyOpen(false);
    setLuckyWheelOpen(false);
    setCodexOpen(false);
    setSettingsOpen(false);
    setLeaderboardOpen(true);
  }, []);

  const handleOpenCodex = useCallback(() => {
    setWardrobeOpen(false);
    setDailyBonusOpen(false);
    setMissionsOpen(false);
    setWeeklyOpen(false);
    setLuckyWheelOpen(false);
    setLeaderboardOpen(false);
    setSettingsOpen(false);
    setCodexInitialLandmark(null);
    setCodexOpen(true);
  }, []);

  const handleInspectLandmarkInCodex = useCallback((landmark: LahoreLandmarkKind) => {
    setWardrobeOpen(false);
    setDailyBonusOpen(false);
    setMissionsOpen(false);
    setWeeklyOpen(false);
    setLuckyWheelOpen(false);
    setLeaderboardOpen(false);
    setSettingsOpen(false);
    setCodexInitialLandmark(landmark);
    setCodexOpen(true);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setWardrobeOpen(false);
    setDailyBonusOpen(false);
    setMissionsOpen(false);
    setWeeklyOpen(false);
    setLuckyWheelOpen(false);
    setLeaderboardOpen(false);
    setCodexOpen(false);
    setSettingsOpen(true);
  }, []);

  const handleCompleteLuckyWheelSpin = useCallback((slice: LuckyWheelSlice): LuckyWheelOutcome => {
    const { nextSave, outcome } = applyLuckyWheelSliceReward(saveRef.current, slice);
    saveRef.current = nextSave;
    setSave(nextSave);
    persistSaveData(nextSave);

    engineRef.current?.audio.playUnlock();
    if (outcome.cosmeticUnlocked) {
      engineRef.current?.setCosmetic(nextSave.equippedCosmeticId);
      setPreviewCosmeticId(nextSave.equippedCosmeticId);
    }
    return outcome;
  }, []);

  const handleWheelTick = useCallback(() => {
    engineRef.current?.audio.playWheelTick();
  }, []);

  const handleClaimWeeklyChallenge = useCallback(
    (challengeId: string) => {
      let claimedGems = 0;
      let nextEquippedCosmetic: SkinCosmeticId | null = saveRef.current.equippedCosmeticId;

      updateSave((prev) => {
        const normalized = normalizeWeeklyChallengeState(prev.weeklyChallenges);
        let badgeToAdd: ProfileBadgeId | null = null;
        let cosmeticToAdd: SkinCosmeticId | null = null;

        const challenges = normalized.challenges.map((ch) => {
          if (ch.id === challengeId && ch.progress >= ch.target && !ch.claimed) {
            claimedGems += ch.rewardGems;
            badgeToAdd = ch.rewardBadgeId;
            cosmeticToAdd = ch.rewardCosmeticId;
            return { ...ch, claimed: true };
          }
          return ch;
        });

        const unlockedBadgeIds = badgeToAdd
          ? Array.from(new Set([...prev.unlockedBadgeIds, badgeToAdd]))
          : prev.unlockedBadgeIds;
        const equippedBadgeId = prev.equippedBadgeId ?? badgeToAdd ?? null;

        const unlockedCosmeticIds = cosmeticToAdd
          ? Array.from(new Set([...prev.unlockedCosmeticIds, cosmeticToAdd]))
          : prev.unlockedCosmeticIds;
        const equippedCosmeticId = prev.equippedCosmeticId ?? cosmeticToAdd ?? null;
        nextEquippedCosmetic = equippedCosmeticId;

        return {
          ...prev,
          totalGems: prev.totalGems + claimedGems,
          weeklyChallenges: {
            weekKey: normalized.weekKey,
            challenges,
          },
          unlockedBadgeIds,
          equippedBadgeId,
          unlockedCosmeticIds,
          equippedCosmeticId,
        };
      });

      if (claimedGems > 0) {
        engineRef.current?.audio.playUnlock();
        engineRef.current?.setCosmetic(nextEquippedCosmetic);
        setPreviewCosmeticId(nextEquippedCosmetic);
      }
    },
    [updateSave],
  );

  const handleEquipBadge = useCallback(
    (badgeId: ProfileBadgeId | null) => {
      updateSave((prev) => ({
        ...prev,
        equippedBadgeId:
          badgeId && prev.unlockedBadgeIds.includes(badgeId) ? badgeId : null,
      }));
    },
    [updateSave],
  );

  const handlePreviewCosmetic = useCallback((cosmeticId: SkinCosmeticId | null) => {
    setPreviewCosmeticId(cosmeticId);
    engineRef.current?.setCosmetic(cosmeticId);
  }, []);

  const handleEquipCosmetic = useCallback(
    (cosmeticId: SkinCosmeticId | null) => {
      updateSave((prev) => ({
        ...prev,
        equippedCosmeticId:
          cosmeticId && prev.unlockedCosmeticIds.includes(cosmeticId) ? cosmeticId : null,
      }));
      setPreviewCosmeticId(cosmeticId);
      engineRef.current?.setCosmetic(cosmeticId);
    },
    [updateSave],
  );

  const handleOpenDailyBonus = useCallback(() => {
    updateSave((prev) => ({
      ...prev,
      dailyLogin: normalizeDailyLogin(prev.dailyLogin),
    }));
    setWardrobeOpen(false);
    setMissionsOpen(false);
    setWeeklyOpen(false);
    setLuckyWheelOpen(false);
    setLeaderboardOpen(false);
    setCodexOpen(false);
    setSettingsOpen(false);
    setDailyBonusOpen(true);
  }, [updateSave]);

  const handleClaimDailyBonus = useCallback(() => {
    let awarded = 0;
    updateSave((prev) => {
      const { nextState, gemsAwarded } = claimDailyLoginBonus(prev.dailyLogin);
      awarded = gemsAwarded;
      return {
        ...prev,
        totalGems: prev.totalGems + gemsAwarded,
        dailyLogin: nextState,
      };
    });
    if (awarded > 0) {
      engineRef.current?.audio.playUnlock();
    }
  }, [updateSave]);

  const handleClaimMission = useCallback(
    (missionId: string) => {
      let claimedReward = 0;
      updateSave((prev) => {
        const normalized = normalizeDailyMissionState(prev.dailyMissions);
        const missions = normalized.missions.map((m) => {
          if (m.id === missionId && m.progress >= m.target && !m.claimed) {
            claimedReward += m.rewardGems;
            return { ...m, claimed: true };
          }
          return m;
        });
        const nextDailyMissions = {
          dateKey: normalized.dateKey,
          missions,
        };
        return {
          ...prev,
          totalGems: prev.totalGems + claimedReward,
          dailyMissions: nextDailyMissions,
          missionArchive: syncMissionArchive(prev.missionArchive, nextDailyMissions),
        };
      });
      if (claimedReward > 0) {
        engineRef.current?.audio.playUnlock();
      }
    },
    [updateSave],
  );

  const handleClaimDailyRunObjective = useCallback(() => {
    let claimedOutcome = false;
    let nextCosmetic: SkinCosmeticId | null = saveRef.current.equippedCosmeticId;

    updateSave((prev) => {
      const outcome = claimDailyRunObjectiveReward(prev);
      claimedOutcome = outcome.claimed;
      nextCosmetic = outcome.nextSave.equippedCosmeticId;
      return outcome.nextSave;
    });

    if (claimedOutcome) {
      engineRef.current?.audio.playUnlock();
      engineRef.current?.setCosmetic(nextCosmetic);
      setPreviewCosmeticId(nextCosmetic);
    }
  }, [updateSave]);

  const handleClaimAllMissions = useCallback(() => {
    let totalBonus = 0;
    let claimedDailyObjective = false;
    let nextCosmetic: SkinCosmeticId | null = saveRef.current.equippedCosmeticId;

    updateSave((prev) => {
      const normalized = normalizeDailyMissionState(prev.dailyMissions);
      const missions = normalized.missions.map((m) => {
        if (m.progress >= m.target && !m.claimed) {
          totalBonus += m.rewardGems;
          return { ...m, claimed: true };
        }
        return m;
      });
      const nextDailyMissions = {
        dateKey: normalized.dateKey,
        missions,
      };
      const baseNext: SaveData = {
        ...prev,
        totalGems: prev.totalGems + totalBonus,
        dailyMissions: nextDailyMissions,
        missionArchive: syncMissionArchive(prev.missionArchive, nextDailyMissions),
      };
      const dailyOutcome = claimDailyRunObjectiveReward(baseNext);
      claimedDailyObjective = dailyOutcome.claimed;
      nextCosmetic = dailyOutcome.nextSave.equippedCosmeticId;
      return dailyOutcome.nextSave;
    });

    if (totalBonus > 0 || claimedDailyObjective) {
      engineRef.current?.audio.playUnlock();
      if (claimedDailyObjective) {
        engineRef.current?.setCosmetic(nextCosmetic);
        setPreviewCosmeticId(nextCosmetic);
      }
    }
  }, [updateSave]);

  const handlePreviewSkin = useCallback((skinId: string) => {
    setPreviewSkinId(skinId);
    engineRef.current?.setSkin(skinId);
  }, []);

  const handleSelectSkin = useCallback(
    (skinId: string) => {
      if (
        skinId === CARNIVAL_RUNNER_SKIN.id &&
        !getStreetCarnivalStatus(saveRef.current.eventMode).active
      ) {
        return;
      }
      updateSave((prev) => ({ ...prev, selectedSkinId: skinId }));
      setPreviewSkinId(skinId);
      engineRef.current?.setSkin(skinId);
    },
    [updateSave],
  );

  const handleUnlockWithGems = useCallback(
    (skin: CharacterSkin) => {
      if (saveRef.current.totalGems < skin.costGems) return;
      if (saveRef.current.unlockedSkinIds.includes(skin.id)) return;
      engineRef.current?.audio.playUnlock();
      updateSave((prev) => ({
        ...prev,
        totalGems: prev.totalGems - skin.costGems,
        unlockedSkinIds: Array.from(new Set([...prev.unlockedSkinIds, skin.id])),
        selectedSkinId: skin.id,
      }));
      setPreviewSkinId(skin.id);
      engineRef.current?.setSkin(skin.id);
    },
    [updateSave],
  );

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const currentPhase = phaseRef.current;
      const target = e.target as HTMLElement | null;
      const isInteractiveTarget = Boolean(
        target?.closest(
          'button, a, input, select, textarea, [role="button"], [role="radio"], [role="option"], [role="tab"]',
        ),
      );

      if (currentPhase === 'playing') {
        switch (e.code) {
          case 'ArrowLeft':
          case 'KeyA':
            e.preventDefault();
            engineRef.current?.moveLeft();
            break;
          case 'ArrowRight':
          case 'KeyD':
            e.preventDefault();
            engineRef.current?.moveRight();
            break;
          case 'ArrowUp':
          case 'KeyW':
          case 'Space':
            e.preventDefault();
            engineRef.current?.triggerJump();
            break;
          case 'ArrowDown':
          case 'KeyS':
          case 'ShiftLeft':
          case 'KeyC':
            e.preventDefault();
            engineRef.current?.triggerSlide();
            break;
          case 'KeyR':
            e.preventDefault();
            handleCycleRadioStation();
            break;
          case 'Escape':
          case 'KeyP':
            e.preventDefault();
            handlePause();
            break;
        }
      } else if (currentPhase === 'paused') {
        if (settingsOpenRef.current) {
          if (e.code === 'Escape') {
            e.preventDefault();
            setSettingsOpen(false);
          }
          return;
        }
        if (photoModeOpenRef.current) {
          if (e.code === 'Escape') {
            e.preventDefault();
            handleClosePhotoMode();
          }
          return;
        }
        if (
          e.code === 'Escape' ||
          e.code === 'KeyP' ||
          (!isInteractiveTarget && (e.code === 'Enter' || e.code === 'Space'))
        ) {
          e.preventDefault();
          handleResume();
        }
      } else if (e.code === 'Escape') {
        if (settingsOpenRef.current) {
          e.preventDefault();
          setSettingsOpen(false);
        } else if (codexOpenRef.current) {
          e.preventDefault();
          setCodexOpen(false);
        } else if (missionsOpenRef.current) {
          e.preventDefault();
          setMissionsOpen(false);
        } else if (dailyBonusOpenRef.current) {
          e.preventDefault();
          setDailyBonusOpen(false);
        } else if (weeklyOpenRef.current) {
          e.preventDefault();
          setWeeklyOpen(false);
        } else if (luckyWheelOpenRef.current) {
          e.preventDefault();
          setLuckyWheelOpen(false);
        } else if (leaderboardOpenRef.current) {
          e.preventDefault();
          setLeaderboardOpen(false);
        } else if (wardrobeOpenRef.current) {
          e.preventDefault();
          handleCloseWardrobe();
        }
      } else if (
        currentPhase === 'title' &&
        !isInteractiveTarget &&
        !wardrobeOpenRef.current &&
        !missionsOpenRef.current &&
        !dailyBonusOpenRef.current &&
        !weeklyOpenRef.current &&
        !luckyWheelOpenRef.current &&
        !leaderboardOpenRef.current &&
        !codexOpenRef.current &&
        !settingsOpenRef.current
      ) {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStartRun();
        }
      } else if (
        currentPhase === 'gameover' &&
        !isInteractiveTarget &&
        !missionsOpenRef.current &&
        !leaderboardOpenRef.current &&
        !codexOpenRef.current &&
        !settingsOpenRef.current
      ) {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStartRun();
        }
      }
    };

    const onWindowBlur = () => {
      swipeStateRef.current.active = false;
      if (phaseRef.current === 'playing') {
        handlePause();
      }
    };

    const onFirstGesture = () => {
      if (!saveRef.current.muted) {
        engineRef.current?.audio.unlock();
      }
    };

    window.addEventListener('pointerdown', onFirstGesture, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [
    handleClosePhotoMode,
    handleCloseWardrobe,
    handleCycleRadioStation,
    handlePause,
    handleResume,
    handleStartRun,
  ]);

  // Full-canvas swipe gesture handlers (zero-latency on pointermove!)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (phase !== 'playing') return;
    engineRef.current?.audio.unlock();
    swipeStateRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      triggered: false,
      pointerId: e.pointerId,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = swipeStateRef.current;
    if (!s.active || s.triggered || s.pointerId !== e.pointerId || phase !== 'playing') return;

    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    const threshold = 24;

    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;

    s.triggered = true;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) engineRef.current?.moveLeft();
      else engineRef.current?.moveRight();
    } else {
      if (dy < 0) engineRef.current?.triggerJump();
      else engineRef.current?.triggerSlide();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (swipeStateRef.current.pointerId === e.pointerId) {
      swipeStateRef.current.active = false;
    }
  };

  const effectiveSkinId = resolveActiveSkinId(
    save.selectedSkinId,
    save.unlockedSkinIds,
    globalEvent.active,
  );
  const activeSkin = getSkinById(effectiveSkinId);
  const equippedBadge = getBadgeById(save.equippedBadgeId);
  const dailyMissions = save.dailyMissions.missions;
  const missionsDoneCount = dailyMissions.filter((m) => m.progress >= m.target).length;
  const claimableMissionsCount = dailyMissions.filter(
    (m) => m.progress >= m.target && !m.claimed,
  ).length;
  const dailyRunObj = save.dailyRunObjective;
  const dailyRunObjTpl = getDailyRunObjectiveTemplateById(dailyRunObj.templateId);
  const dailyRunClaimable = dailyRunObj.completed && !dailyRunObj.claimed;
  const totalTodayDoneCount = missionsDoneCount + (dailyRunObj.completed ? 1 : 0);
  const totalClaimableDailyCount = claimableMissionsCount + (dailyRunClaimable ? 1 : 0);
  const weeklyChallenges = save.weeklyChallenges.challenges;
  const weeklyDoneCount = weeklyChallenges.filter((c) => c.progress >= c.target).length;
  const claimableWeeklyCount = weeklyChallenges.filter(
    (c) => c.progress >= c.target && !c.claimed,
  ).length;
  const todayDateKey = getLocalDateKey();
  const streakSecuredToday = save.dailyStreak.lastCompletedDateKey === todayDateKey;
  const loginBonusStatus = getDailyLoginStatus(save.dailyLogin);
  const luckyWheelStatus = getLuckyWheelStatus(save.luckyWheel);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0e1726]">
      {/* Isolated WebGL Mount (never re-rendered on HUD state changes) */}
      <div
        ref={mountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="fixed inset-0 touch-none"
      />

      {/* WEBGL CONTEXT RECOVERY / UNAVAILABLE NOTICE */}
      {webglStatus !== 'ok' && (
        <div
          role="alert"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#060b14]/92 p-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-[#0b1322] border border-amber-400/40 p-6 text-center text-white shadow-2xl">
            <div className="mx-auto w-11 h-11 rounded-xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="mt-3 text-lg font-black uppercase tracking-wide">
              {webglStatus === 'lost' ? '3D Graphics Paused' : 'WebGL Graphics Unavailable'}
            </h2>
            <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
              {webglStatus === 'lost'
                ? 'Your browser temporarily reset the 3D graphics context. Waiting for automatic recovery or reload below.'
                : 'Hardware or software WebGL acceleration could not be initialized in this browser view.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black uppercase tracking-wider text-xs px-4 py-2.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reload Lahore Bound</span>
            </button>
          </div>
        </div>
      )}

      {/* TITLE SCREEN */}
      {phase === 'title' && !wardrobeOpen && (
        <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 sm:p-6">
          {/* Top bar: Gems, Daily Streak, Best Distance & Audio Mute */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
              <div className="inline-flex items-center gap-1.5 rounded-xl bg-[#0b1322]/85 border border-white/15 px-3 py-2 text-xs sm:text-sm font-black text-sky-200 tabular-nums shadow-lg">
                <Gem className="w-4 h-4 text-sky-400" />
                <span>{save.totalGems}</span>
              </div>
              <button
                type="button"
                onClick={handleOpenMissions}
                title={
                  streakSecuredToday
                    ? 'Daily Streak secured for today!'
                    : 'Complete at least 1 Daily Mission today to extend your streak'
                }
                className={`inline-flex items-center gap-1.5 rounded-xl bg-[#0b1322]/85 border px-3 py-2 text-xs sm:text-sm font-black tabular-nums shadow-lg transition-colors cursor-pointer ${
                  streakSecuredToday
                    ? 'border-orange-400/55 text-orange-200 hover:bg-[#162238]'
                    : 'border-white/15 text-slate-200 hover:bg-[#162238]'
                }`}
              >
                <Flame
                  className={`w-4 h-4 ${
                    save.dailyStreak.count > 0 ? 'text-orange-400' : 'text-slate-400'
                  }`}
                />
                <span className="hidden sm:inline text-[11px] font-bold uppercase tracking-wider text-slate-300/85">
                  Daily Streak
                </span>
                <span className="sm:hidden text-[10px] font-bold uppercase tracking-wider text-slate-300/85">
                  Streak
                </span>
                <span className={streakSecuredToday ? 'text-orange-300' : 'text-white'}>
                  {save.dailyStreak.count}
                </span>
              </button>
              <button
                type="button"
                onClick={handleOpenLeaderboard}
                title="Open Local & Global Leaderboards"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0b1322]/85 hover:bg-[#162238] border border-white/15 px-3 py-2 text-xs sm:text-sm font-bold text-amber-200 tabular-nums shadow-lg transition-colors cursor-pointer"
              >
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>{save.bestDistance > 0 ? `${save.bestDistance}m` : 'Ranks'}</span>
              </button>
              <button
                type="button"
                onClick={handleOpenCodex}
                title="Open Lahore Landmark Codex"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0b1322]/85 hover:bg-[#162238] border border-white/15 px-3 py-2 text-xs sm:text-sm font-bold text-emerald-200 tabular-nums shadow-lg transition-colors cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Codex</span>
                <span className="text-emerald-300">
                  {save.unlockedLandmarkIds.length}/{LAHORE_TRACK_STOPS.length}
                </span>
              </button>
              {equippedBadge && (
                <button
                  type="button"
                  onClick={handleOpenWeekly}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#0b1322]/85 hover:bg-[#162238] border px-3 py-2 text-xs font-black shadow-lg transition-colors cursor-pointer"
                  style={{
                    borderColor: `${equippedBadge.accentHex}66`,
                    color: equippedBadge.accentHex,
                  }}
                >
                  <Award className="w-4 h-4 shrink-0" />
                  <span>{equippedBadge.name}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                type="button"
                onClick={handleOpenDailyBonus}
                className={`relative inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-wider shadow-lg transition-colors cursor-pointer ${
                  loginBonusStatus.canClaimToday
                    ? 'bg-emerald-500/90 hover:bg-emerald-400 border-emerald-200/70 text-slate-950'
                    : 'bg-[#0b1322]/85 hover:bg-[#162238] border-white/15 text-slate-200'
                }`}
              >
                <Gift
                  className={`w-4 h-4 ${
                    loginBonusStatus.canClaimToday ? 'text-slate-950' : 'text-emerald-300'
                  }`}
                />
                <span className="hidden sm:inline">Daily Bonus</span>
                <span className="sm:hidden">Bonus</span>
                {loginBonusStatus.canClaimToday && (
                  <span className="absolute -top-2 -right-2 rounded-full bg-amber-400 border-2 border-[#0b1322] px-1.5 py-0.5 text-[10px] font-black leading-none text-slate-950 tabular-nums shadow">
                    +{loginBonusStatus.rewardGems}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={handleCycleRadioStation}
                aria-label={`Radio Mode: ${RADIO_STATION_MAP[save.radioStation].name}. Click to switch station`}
                title={`Radio: ${RADIO_STATION_MAP[save.radioStation].name} (${RADIO_STATION_MAP[save.radioStation].frequency})`}
                className="h-10 rounded-xl bg-[#0b1322]/85 hover:bg-[#162238] border px-3 text-xs font-bold text-white flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer shadow-lg whitespace-nowrap shrink-0"
                style={{
                  borderColor: `${RADIO_STATION_MAP[save.radioStation].accentHex}55`,
                }}
              >
                <Radio
                  className="w-3.5 h-3.5 shrink-0"
                  style={{
                    color: save.muted
                      ? '#64748b'
                      : RADIO_STATION_MAP[save.radioStation].accentHex,
                  }}
                />
                <span className="hidden md:inline text-slate-300 font-semibold">Radio</span>
                <span
                  className="font-black"
                  style={{
                    color: save.muted
                      ? '#94a3b8'
                      : RADIO_STATION_MAP[save.radioStation].accentHex,
                  }}
                >
                  {RADIO_STATION_MAP[save.radioStation].shortName}
                </span>
              </button>

              <button
                type="button"
                onClick={handleToggleMute}
                aria-label={save.muted ? 'Unmute audio' : 'Mute audio'}
                className="w-10 h-10 rounded-xl bg-[#0b1322]/85 border border-white/15 text-white flex items-center justify-center hover:bg-[#162238] active:scale-95 transition-transform cursor-pointer shadow-lg"
              >
                {save.muted ? (
                  <VolumeX className="w-4 h-4 text-slate-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-sky-300" />
                )}
              </button>

              <button
                type="button"
                onClick={handleOpenSettings}
                aria-label="Open settings"
                title="Settings (Audio, Radio, Sky Lighting & Controls)"
                className="w-10 h-10 rounded-xl bg-[#0b1322]/85 border border-white/15 text-white flex items-center justify-center hover:bg-[#162238] active:scale-95 transition-transform cursor-pointer shadow-lg"
              >
                <Settings className="w-4 h-4 text-slate-200" />
              </button>
            </div>
          </div>

          {/* Upper-Sky Bespoke Title Lockup (keeps center-bottom runner visible!) */}
          <div className="flex flex-col items-center -mt-6 sm:-mt-14">
            <TitleLogo />
          </div>

          {/* Lahore Tourist Guide (docked cleanly on right margin on desktop, compact strip above controls on mobile) */}
          <div className="flex justify-center lg:block lg:fixed lg:right-6 lg:top-1/2 lg:-translate-y-1/2 lg:z-20 my-1 lg:my-0">
            <LahoreTouristGuide
              unlockedLandmarkIds={save.unlockedLandmarkIds}
              onInspectInCodex={handleInspectLandmarkInCodex}
            />
          </div>

          {/* Bottom Action Cluster */}
          <div className="flex flex-col items-center gap-3 pb-2 sm:pb-4">
            {/* Difficulty Selector */}
            <div className="flex flex-col items-center gap-1.5 pointer-events-auto">
              <div
                role="radiogroup"
                aria-label="Difficulty Mode"
                className="inline-flex items-center gap-1 rounded-2xl bg-[#0b1322]/88 border border-white/15 p-1 shadow-lg"
              >
                {DIFFICULTY_MODES.map((mode) => {
                  const cfg = DIFFICULTY_CONFIGS[mode];
                  const active = save.difficulty === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => handleSelectDifficulty(mode)}
                      className={`rounded-xl px-3.5 sm:px-4 py-1.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                        active
                          ? 'text-slate-950 shadow-sm'
                          : 'text-slate-300 hover:text-white hover:bg-white/8'
                      }`}
                      style={active ? { backgroundColor: cfg.accentHex } : undefined}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
              <div
                className="text-[11px] font-bold tracking-wide px-2.5 py-0.5 rounded-lg bg-[#0b1322]/75 border border-white/10"
                style={{ color: DIFFICULTY_CONFIGS[save.difficulty].accentHex }}
              >
                {DIFFICULTY_CONFIGS[save.difficulty].tagline}
              </div>
            </div>

            {globalEvent.active && (
              <button
                type="button"
                onClick={() => handleOpenWardrobe(CARNIVAL_RUNNER_SKIN.id)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#160b29]/90 hover:bg-[#23103f] border border-pink-400/55 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg transition-colors cursor-pointer pointer-events-auto"
              >
                <PartyPopper className="w-3.5 h-3.5 text-pink-300 shrink-0" />
                <span className="font-black uppercase tracking-wider text-pink-300">
                  {globalEvent.name}
                </span>
                <span aria-hidden="true" className="text-white/25">
                  ·
                </span>
                <span className="text-amber-300 font-bold">{globalEvent.triggerLabel}</span>
                <span aria-hidden="true" className="text-white/25 hidden sm:inline">
                  ·
                </span>
                <span className="hidden sm:inline text-cyan-300 font-bold">
                  {activeSkin.id === CARNIVAL_RUNNER_SKIN.id
                    ? 'Carnival Runner Equipped'
                    : 'Unlock Carnival Skin'}
                </span>
              </button>
            )}

            {save.pendingSpeedBoost && (
              <div className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400/95 border border-amber-200/70 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-950 shadow-lg pointer-events-auto">
                <Flame className="w-3.5 h-3.5" />
                <span>
                  Next Run Primed: +{Math.round((save.pendingSpeedBoost.multiplier - 1) * 100)}%
                  Speed ({save.pendingSpeedBoost.durationSeconds}s)
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={handleOpenMissions}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-bold shadow-lg transition-colors cursor-pointer pointer-events-auto ${
                dailyRunClaimable
                  ? 'bg-amber-400 hover:bg-amber-300 border-amber-200 text-slate-950'
                  : dailyRunObj.claimed
                    ? 'bg-emerald-950/85 hover:bg-emerald-900/85 border-emerald-400/45 text-emerald-200'
                    : 'bg-[#0b1322]/88 hover:bg-[#162238] border-white/15 text-slate-200'
              }`}
            >
              <Trophy
                className={`w-3.5 h-3.5 shrink-0 ${
                  dailyRunClaimable
                    ? 'text-slate-950'
                    : dailyRunObj.claimed
                      ? 'text-emerald-300'
                      : 'text-emerald-300'
                }`}
              />
              <span className="font-extrabold">Daily Run Goal:</span>
              <span className="truncate max-w-[210px] sm:max-w-none">{dailyRunObjTpl.label}</span>
              <span aria-hidden="true" className="opacity-40">
                ·
              </span>
              <span className="font-black tabular-nums shrink-0">
                {dailyRunClaimable
                  ? 'Claim Unique Reward!'
                  : dailyRunObj.claimed
                    ? 'Completed'
                    : `${dailyRunObj.bestProgress}/${dailyRunObjTpl.target}`}
              </span>
            </button>

            <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 pointer-events-auto">
              <button
                type="button"
                onClick={handleStartRun}
                className="inline-flex items-center gap-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black uppercase tracking-wider text-base sm:text-lg px-7 sm:px-8 py-3.5 shadow-[0_10px_28px_rgba(245,158,11,0.45)] transition-transform cursor-pointer"
              >
                <Play className="w-5 h-5 fill-slate-950" />
                <span>Start Run</span>
              </button>

              <button
                type="button"
                onClick={handleOpenLuckyWheel}
                className={`relative inline-flex items-center gap-2 rounded-2xl active:scale-95 border font-extrabold uppercase tracking-wider text-sm px-4 sm:px-5 py-3.5 shadow-lg transition-transform cursor-pointer ${
                  luckyWheelStatus.canSpinToday
                    ? 'bg-purple-600/92 hover:bg-purple-500 border-purple-200/65 text-white'
                    : 'bg-[#0b1322]/90 hover:bg-[#162238] border-white/20 text-white'
                }`}
              >
                <Sparkles
                  className={`w-4 h-4 ${
                    luckyWheelStatus.canSpinToday ? 'text-amber-300' : 'text-purple-300'
                  }`}
                />
                <span>Lucky Wheel</span>
                {luckyWheelStatus.canSpinToday && (
                  <span className="absolute -top-2 -right-2 rounded-full bg-amber-400 border-2 border-[#0b1322] px-1.5 py-0.5 text-[10px] font-black leading-none text-slate-950 shadow">
                    SPIN
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={handleOpenMissions}
                className={`relative inline-flex items-center gap-2 rounded-2xl active:scale-95 border font-extrabold uppercase tracking-wider text-sm px-4 sm:px-5 py-3.5 shadow-lg transition-transform cursor-pointer ${
                  totalClaimableDailyCount > 0
                    ? 'bg-emerald-500/90 hover:bg-emerald-400 border-emerald-200/60 text-slate-950'
                    : 'bg-[#0b1322]/90 hover:bg-[#162238] border-white/20 text-white'
                }`}
              >
                <Target
                  className={`w-4 h-4 ${
                    totalClaimableDailyCount > 0 ? 'text-slate-950' : 'text-amber-300'
                  }`}
                />
                <span>Missions</span>
                <span
                  className={`ml-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-black tabular-nums ${
                    totalClaimableDailyCount > 0
                      ? 'bg-slate-950/20 text-slate-950'
                      : 'bg-white/10 text-amber-200'
                  }`}
                >
                  {totalClaimableDailyCount > 0
                    ? `Claim ${totalClaimableDailyCount}`
                    : `${totalTodayDoneCount}/4`}
                </span>
                {totalClaimableDailyCount > 0 && (
                  <span
                    aria-label={`${totalClaimableDailyCount} mission rewards ready`}
                    className="absolute -top-2 -right-2 min-w-5 h-5 px-1.5 rounded-full bg-amber-400 border-2 border-[#0b1322] text-[11px] font-black leading-none text-slate-950 flex items-center justify-center tabular-nums shadow"
                  >
                    {totalClaimableDailyCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={handleOpenWeekly}
                className={`relative inline-flex items-center gap-2 rounded-2xl active:scale-95 border font-extrabold uppercase tracking-wider text-sm px-4 sm:px-5 py-3.5 shadow-lg transition-transform cursor-pointer ${
                  claimableWeeklyCount > 0
                    ? 'bg-amber-400 hover:bg-amber-300 border-amber-200/60 text-slate-950'
                    : 'bg-[#0b1322]/90 hover:bg-[#162238] border-white/20 text-white'
                }`}
              >
                <Crown
                  className={`w-4 h-4 ${
                    claimableWeeklyCount > 0 ? 'text-slate-950' : 'text-amber-300'
                  }`}
                />
                <span>Weekly</span>
                <span
                  className={`ml-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-black tabular-nums ${
                    claimableWeeklyCount > 0
                      ? 'bg-slate-950/20 text-slate-950'
                      : 'bg-white/10 text-amber-200'
                  }`}
                >
                  {claimableWeeklyCount > 0 ? `Claim ${claimableWeeklyCount}` : `${weeklyDoneCount}/3`}
                </span>
                {claimableWeeklyCount > 0 && (
                  <span
                    aria-label={`${claimableWeeklyCount} weekly challenge rewards ready`}
                    className="absolute -top-2 -right-2 min-w-5 h-5 px-1.5 rounded-full bg-emerald-400 border-2 border-[#0b1322] text-[11px] font-black leading-none text-slate-950 flex items-center justify-center tabular-nums shadow"
                  >
                    {claimableWeeklyCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleOpenWardrobe()}
                className={`relative inline-flex items-center gap-2 rounded-2xl active:scale-95 border font-extrabold uppercase tracking-wider text-sm px-4 sm:px-5 py-3.5 shadow-lg transition-transform cursor-pointer ${
                  globalEvent.active
                    ? 'bg-[#170c2b]/92 hover:bg-[#231140] border-pink-400/55 text-white'
                    : 'bg-[#0b1322]/90 hover:bg-[#162238] border-white/20 text-white'
                }`}
              >
                <Shirt
                  className={`w-4 h-4 ${
                    globalEvent.active ? 'text-pink-300' : 'text-sky-300'
                  }`}
                />
                <span>Skins</span>
                <span className="ml-0.5 rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-black text-sky-200 tabular-nums">
                  {save.unlockedSkinIds.length}/{CHARACTER_SKINS.length}
                </span>
                {globalEvent.active && (
                  <span className="absolute -top-2 -right-2 rounded-full bg-pink-500 border-2 border-[#0b1322] px-1.5 py-0.5 text-[9px] font-black uppercase leading-none text-white shadow">
                    Event
                  </span>
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] sm:text-xs font-semibold text-white/90 bg-[#0b1322]/75 border border-white/10 rounded-xl px-3.5 py-1.5">
              <span>Swipe / Arrows Move</span>
              <span className="text-white/40">·</span>
              <span>Up / Space Jump</span>
              <span className="text-white/40">·</span>
              <span>Down / S Slide</span>
              <span className="text-white/40 hidden sm:inline">·</span>
              <span
                className={`hidden sm:inline font-bold ${
                  activeSkin.id === CARNIVAL_RUNNER_SKIN.id ? 'text-pink-300' : 'text-sky-300'
                }`}
              >
                Runner: {activeSkin.name}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SKIN WARDROBE (Live 3D Turntable) */}
      {phase === 'title' && wardrobeOpen && (
        <SkinWardrobe
          totalGems={save.totalGems}
          bestDistance={save.bestDistance}
          unlockedSkinIds={save.unlockedSkinIds}
          selectedSkinId={effectiveSkinId}
          previewSkinId={previewSkinId}
          unlockedCosmeticIds={save.unlockedCosmeticIds}
          equippedCosmeticId={save.equippedCosmeticId}
          previewCosmeticId={previewCosmeticId}
          carnivalEvent={globalEvent}
          onPreviewSkin={handlePreviewSkin}
          onSelectSkin={handleSelectSkin}
          onUnlockWithGems={handleUnlockWithGems}
          onPreviewCosmetic={handlePreviewCosmetic}
          onEquipCosmetic={handleEquipCosmetic}
          onClose={handleCloseWardrobe}
        />
      )}

      {/* IN-GAME HUD */}
      {phase === 'playing' && (
        <GameHUD
          hud={hud}
          muted={save.muted}
          radioStation={save.radioStation}
          showTouchButtons={save.showTouchButtons}
          onToggleMute={handleToggleMute}
          onSelectRadioStation={handleSelectRadioStation}
          onCycleRadioStation={handleCycleRadioStation}
          onPause={handlePause}
          onJump={() => engineRef.current?.triggerJump()}
          onSlide={() => engineRef.current?.triggerSlide()}
          onLeft={() => engineRef.current?.moveLeft()}
          onRight={() => engineRef.current?.moveRight()}
        />
      )}

      {/* PAUSE MODAL */}
      {phase === 'paused' && !photoModeOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#060b14]/65 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pause-modal-title"
            className="w-full max-w-sm rounded-2xl bg-[#0b1322] border border-white/15 p-6 shadow-2xl text-white"
          >
            <h2
              id="pause-modal-title"
              className="text-2xl font-black uppercase tracking-wider text-center"
            >
              Paused
            </h2>
            <p className="text-xs text-slate-400 text-center mt-1 tabular-nums">
              {hud.distance}m · {hud.score.toLocaleString()} pts
            </p>
            <div className="mt-2.5 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-center text-[11px] tabular-nums">
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
                onClick={handleResume}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-black uppercase tracking-wider text-sm py-3 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Resume</span>
              </button>

              <button
                type="button"
                onClick={handleOpenPhotoMode}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-200 font-black uppercase tracking-wider text-xs py-2.5 cursor-pointer"
              >
                <Camera className="w-4 h-4 text-amber-300" />
                <span>Photo Mode</span>
              </button>

              <button
                type="button"
                onClick={handleStartRun}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold uppercase tracking-wider text-xs py-2.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restart Run</span>
              </button>

              <button
                type="button"
                onClick={handleToggleMute}
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
                onClick={handleCycleRadioStation}
                className="w-full flex items-center justify-between rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2.5 text-xs font-bold text-slate-200 cursor-pointer"
              >
                <span className="inline-flex items-center gap-2">
                  <Radio
                    className="w-4 h-4"
                    style={{ color: RADIO_STATION_MAP[save.radioStation].accentHex }}
                  />
                  <span>Radio Station</span>
                </span>
                <span style={{ color: RADIO_STATION_MAP[save.radioStation].accentHex }}>
                  {RADIO_STATION_MAP[save.radioStation].name}
                </span>
              </button>

              <button
                type="button"
                onClick={handleToggleTouchButtons}
                className="w-full flex items-center justify-between rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2.5 text-xs font-bold text-slate-200 cursor-pointer"
              >
                <span>On-Screen Touch Buttons</span>
                <span className={save.showTouchButtons ? 'text-emerald-400' : 'text-slate-400'}>
                  {save.showTouchButtons ? 'ON' : 'SWIPE ONLY'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleToggleHaptics}
                className="w-full flex items-center justify-between rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2.5 text-xs font-bold text-slate-200 cursor-pointer"
              >
                <span>Haptic Vibration</span>
                <span className={save.hapticsEnabled ? 'text-emerald-400' : 'text-slate-400'}>
                  {save.hapticsEnabled ? 'ON' : 'OFF'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleOpenSettings}
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
                onClick={handleReturnToTitle}
                className="w-full rounded-xl bg-transparent hover:bg-white/5 text-slate-300 font-bold uppercase tracking-wider text-xs py-2.5 cursor-pointer"
              >
                Back to Title
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHOTO MODE OVERLAY */}
      {phase === 'paused' && photoModeOpen && photoSnapshotUrl && (
        <PhotoModeModal
          rawSnapshotUrl={photoSnapshotUrl}
          hud={hud}
          skin={activeSkin}
          bestDistance={save.bestDistance}
          dailyStreakCount={save.dailyStreak.count}
          lightingMode={save.lightingMode}
          onChangeLightingMode={handleSelectLightingMode}
          onSelectCameraPreset={handleSelectPhotoCameraPreset}
          onRecapture={handleRecapturePhoto}
          onBackToPause={handleClosePhotoMode}
          onResumeRun={handleResume}
        />
      )}

      {/* GAME OVER MODAL */}
      {phase === 'gameover' && runSummary && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#060b14]/70 p-4 overflow-y-auto">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="gameover-modal-title"
            className="w-full max-w-md rounded-2xl bg-[#0b1322] border border-white/15 p-5 sm:p-6 shadow-2xl text-white my-auto"
          >
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <span className="inline-block rounded-lg bg-rose-500/20 border border-rose-400/40 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-widest text-rose-300">
                  {runSummary.reason === 'fall' ? 'Missed the Bridge' : 'Obstacle Impact'}
                </span>
                <span
                  className="inline-block rounded-lg bg-white/5 border px-2.5 py-0.5 text-[11px] font-black uppercase tracking-widest"
                  style={{
                    borderColor: `${DIFFICULTY_CONFIGS[runSummary.difficulty].accentHex}55`,
                    color: DIFFICULTY_CONFIGS[runSummary.difficulty].accentHex,
                  }}
                >
                  {DIFFICULTY_CONFIGS[runSummary.difficulty].label} Mode
                </span>
              </div>
              <h2
                id="gameover-modal-title"
                className="text-2xl sm:text-3xl font-black uppercase tracking-wide mt-2"
              >
                Run Complete
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mt-4">
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Distance
                  </span>
                  {runSummary.isNewBestDistance && (
                    <span className="text-[10px] font-black uppercase bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded">
                      New Best
                    </span>
                  )}
                </div>
                <div className="text-2xl font-black tabular-nums mt-0.5">
                  {runSummary.distance}m
                </div>
              </div>

              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Score
                </span>
                <div className="text-2xl font-black tabular-nums mt-0.5 text-amber-300">
                  {runSummary.score.toLocaleString()}
                </div>
              </div>

              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Gems Collected
                </span>
                <div className="flex items-center gap-1.5 text-xl font-black tabular-nums mt-0.5 text-sky-300">
                  <Gem className="w-4 h-4 text-sky-400" />
                  <span>+{runSummary.gemsEarned}</span>
                </div>
              </div>

              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Best Combo
                  </span>
                  <span className="text-[10px] font-bold text-amber-300 tabular-nums">
                    Peak {runSummary.peakSpeedMultiplier.toFixed(2)}×
                  </span>
                </div>
                <div className="text-xl font-black tabular-nums mt-0.5 text-emerald-300">
                  ×{runSummary.maxCombo}
                </div>
              </div>
            </div>

            {/* Furthest Landmark & Weather Reached */}
            <button
              type="button"
              onClick={() => handleInspectLandmarkInCodex(runSummary.landmarkReached)}
              className="mt-2.5 w-full rounded-xl bg-[#07101f] hover:bg-[#0e1a30] border border-white/12 px-3.5 py-2.5 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="w-4 h-4 text-amber-300 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Furthest Site Reached
                  </div>
                  <div className="text-xs sm:text-sm font-black text-white truncate">
                    {runSummary.landmarkReachedName} ·{' '}
                    <span className="text-sky-300 font-bold">{runSummary.weatherLabel}</span>
                  </div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 shrink-0">
                <Landmark className="w-3.5 h-3.5" />
                <span>Codex</span>
              </span>
            </button>

            {/* Local & Global Top 5 Leaderboard */}
            <LeaderboardPanel
              className="mt-3.5"
              localEntries={save.leaderboard}
              highlightEntryId={runSummary.entryId}
              localRank={runSummary.leaderboardRank}
              playerBestScore={save.bestScore}
              playerBestDistance={save.bestDistance}
              playerSkinId={effectiveSkinId}
            />

            {/* Daily Missions & Daily Run Objective Summary */}
            <div className="mt-3.5 rounded-xl bg-white/5 border border-white/10 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-amber-300">
                  <Target className="w-3.5 h-3.5" />
                  <span>Daily Objectives</span>
                </div>
                {totalClaimableDailyCount > 0 ? (
                  <button
                    type="button"
                    onClick={handleClaimAllMissions}
                    className="inline-flex items-center gap-1 rounded-md bg-amber-400 hover:bg-amber-300 px-2 py-0.5 text-[11px] font-black uppercase text-slate-950 cursor-pointer"
                  >
                    <Gem className="w-3 h-3" />
                    <span>Claim All</span>
                  </button>
                ) : (
                  <span className="text-[11px] font-bold text-slate-400 tabular-nums">
                    {totalTodayDoneCount}/4 Complete
                  </span>
                )}
              </div>

              {/* Featured Daily Single-Run Objective Row */}
              <div className="mb-2 pb-2 border-b border-white/10 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <div className="text-emerald-300 font-bold truncate">
                    Run Goal: {dailyRunObjTpl.label}
                  </div>
                  {!dailyRunObj.completed && (
                    <div className="text-[11px] text-slate-400 tabular-nums">
                      {dailyRunAttempt.disqualified
                        ? `Rule broken this run · Best today: ${dailyRunObj.bestProgress}/${dailyRunObjTpl.target}`
                        : `This run: ${dailyRunAttempt.progress}/${dailyRunObjTpl.target} · Best today: ${dailyRunObj.bestProgress}/${dailyRunObjTpl.target}`}
                    </div>
                  )}
                </div>
                {dailyRunClaimable ? (
                  <button
                    type="button"
                    onClick={handleClaimDailyRunObjective}
                    className="inline-flex items-center gap-1 rounded bg-amber-400 hover:bg-amber-300 px-2 py-0.5 text-[11px] font-black text-slate-950 cursor-pointer shrink-0"
                  >
                    <Trophy className="w-3 h-3" />
                    <span>Claim Reward</span>
                  </button>
                ) : dailyRunObj.claimed ? (
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-400 shrink-0">
                    <Check className="w-3 h-3" />
                    <span>Claimed</span>
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-emerald-300 tabular-nums shrink-0">
                    {dailyRunObj.bestProgress}/{dailyRunObjTpl.target}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                {dailyMissions.map((m) => {
                  const done = m.progress >= m.target;
                  const canClaim = done && !m.claimed;
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="text-slate-200 font-semibold truncate">
                        {m.label}
                      </span>
                      {canClaim ? (
                        <button
                          type="button"
                          onClick={() => handleClaimMission(m.id)}
                          className="inline-flex items-center gap-1 rounded bg-amber-400 hover:bg-amber-300 px-2 py-0.5 text-[11px] font-black text-slate-950 cursor-pointer shrink-0"
                        >
                          <Gem className="w-3 h-3" />
                          <span>+{m.rewardGems}</span>
                        </button>
                      ) : m.claimed ? (
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-400 shrink-0">
                          <Check className="w-3 h-3" />
                          <span>Claimed</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-sky-300 tabular-nums shrink-0">
                          {m.progress}/{m.target}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Newly Unlocked Milestone Skins */}
            {runSummary.newlyUnlockedSkins.length > 0 && (
              <div className="mt-3.5 rounded-xl bg-amber-400/15 border border-amber-400/40 p-3">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-300">
                  <Sparkles className="w-4 h-4" />
                  <span>Skin Unlocked!</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {runSummary.newlyUnlockedSkins.map((skin) => (
                    <button
                      key={skin.id}
                      type="button"
                      onClick={() => handleSelectSkin(skin.id)}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#0b1322] border border-amber-300/50 px-3 py-1.5 text-xs font-bold text-white hover:bg-[#162238] cursor-pointer"
                    >
                      <span
                        className="w-3 h-3 rounded-xs"
                        style={{ backgroundColor: skin.swatchHex }}
                      />
                      <span>{skin.name}</span>
                      <span className="text-amber-300 font-black">
                        {save.selectedSkinId === skin.id ? 'Equipped' : 'Equip'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleStartRun}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black uppercase tracking-wider text-sm py-3.5 transition-transform cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Run Again</span>
              </button>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenWardrobe()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold uppercase tracking-wider text-xs py-2.5 cursor-pointer"
                >
                  <Shirt className="w-4 h-4 text-sky-300" />
                  <span>Skins ({save.totalGems})</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenCodex}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/35 text-emerald-200 font-bold uppercase tracking-wider text-xs py-2.5 tabular-nums cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-emerald-300" />
                  <span>
                    Codex {save.unlockedLandmarkIds.length}/{LAHORE_TRACK_STOPS.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleReturnToTitle}
                  className="rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold uppercase tracking-wider text-xs py-2.5 cursor-pointer"
                >
                  Title
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DAILY MISSIONS MODAL */}
      {missionsOpen && (
        <MissionsModal
          missions={save.dailyMissions.missions}
          dailyRunObjective={save.dailyRunObjective}
          unlockedBadgeIds={save.unlockedBadgeIds}
          unlockedCosmeticIds={save.unlockedCosmeticIds}
          lastAttemptProgress={dailyRunAttempt.progress}
          lastAttemptDisqualified={dailyRunAttempt.disqualified}
          missionArchive={save.missionArchive}
          dailyStreak={save.dailyStreak}
          totalGems={save.totalGems}
          dateKey={save.dailyMissions.dateKey}
          onClaimMission={handleClaimMission}
          onClaimDailyRunObjective={handleClaimDailyRunObjective}
          onClaimAll={handleClaimAllMissions}
          onClose={() => setMissionsOpen(false)}
        />
      )}

      {/* DAILY LOGIN BONUS MODAL */}
      {dailyBonusOpen && (
        <DailyBonusModal
          dailyLogin={save.dailyLogin}
          totalGems={save.totalGems}
          onClaim={handleClaimDailyBonus}
          onClose={() => setDailyBonusOpen(false)}
        />
      )}

      {/* WEEKLY CHALLENGE MODAL */}
      {weeklyOpen && (
        <WeeklyChallengeModal
          weekKey={save.weeklyChallenges.weekKey}
          challenges={save.weeklyChallenges.challenges}
          unlockedBadgeIds={save.unlockedBadgeIds}
          equippedBadgeId={save.equippedBadgeId}
          unlockedCosmeticIds={save.unlockedCosmeticIds}
          equippedCosmeticId={save.equippedCosmeticId}
          totalGems={save.totalGems}
          onClaimChallenge={handleClaimWeeklyChallenge}
          onEquipBadge={handleEquipBadge}
          onEquipCosmetic={handleEquipCosmetic}
          onClose={() => setWeeklyOpen(false)}
        />
      )}

      {/* LUCKY WHEEL MODAL */}
      {luckyWheelOpen && (
        <LuckyWheelModal
          luckyWheel={save.luckyWheel}
          pendingSpeedBoost={save.pendingSpeedBoost}
          totalGems={save.totalGems}
          onSpinComplete={handleCompleteLuckyWheelSpin}
          onWheelTick={handleWheelTick}
          onClose={() => setLuckyWheelOpen(false)}
        />
      )}

      {/* LEADERBOARD MODAL (TITLE SCREEN) */}
      {leaderboardOpen && (
        <LeaderboardModal
          localEntries={save.leaderboard}
          playerBestScore={save.bestScore}
          playerBestDistance={save.bestDistance}
          playerSkinId={effectiveSkinId}
          onClose={() => setLeaderboardOpen(false)}
        />
      )}

      {/* LANDMARK CODEX MODAL */}
      {codexOpen && (
        <LandmarkCodexModal
          unlockedLandmarkIds={save.unlockedLandmarkIds}
          landmarkForecasts={engineRef.current?.getAllLandmarkForecasts()}
          initialLandmark={codexInitialLandmark}
          onClose={() => setCodexOpen(false)}
        />
      )}

      {/* SETTINGS MODAL */}
      {settingsOpen && (
        <SettingsModal
          muted={save.muted}
          radioStation={save.radioStation}
          lightingMode={save.lightingMode}
          eventMode={save.eventMode}
          ambientWeatherOverlay={save.ambientWeatherOverlay}
          showTouchButtons={save.showTouchButtons}
          hapticsEnabled={save.hapticsEnabled}
          onToggleMute={handleToggleMute}
          onSelectRadioStation={handleSelectRadioStation}
          onSelectLightingMode={handleSelectLightingMode}
          onSelectEventMode={handleSelectEventMode}
          onToggleAmbientOverlay={handleToggleAmbientOverlay}
          onToggleTouchButtons={handleToggleTouchButtons}
          onToggleHaptics={handleToggleHaptics}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
