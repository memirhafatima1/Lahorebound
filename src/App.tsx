import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { AuthProvider } from './components/AuthContext';
import { FirebaseErrorBoundary } from './components/FirebaseErrorBoundary';
import { GameHUD } from './components/GameHUD';
import { GameOverModal } from './components/GameOverModal';
import { PauseModal } from './components/PauseModal';
import type { PhotoCameraPreset } from './components/PhotoModeModal';
import { TitleScreen } from './components/TitleScreen';
import {
  claimDailyLoginBonus,
  getDailyLoginStatus,
  normalizeDailyLogin,
} from './game/dailyLogin';
import {
  claimDailyRunObjectiveReward,
  evaluateDailyRunObjectiveAttempt,
  getDailyRunObjectiveTemplateById,
  normalizeDailyRunObjectiveState,
} from './game/dailyRunObjective';
import { SkyboundEngine } from './game/engine';
import { auth } from './game/firebase';
import { getStreetCarnivalStatus, type GlobalEventStatus } from './game/globalEvents';
import {
  deriveDefaultHandle,
  submitGlobalLeaderboardRun,
} from './game/globalLeaderboard';
import { HapticFeedbackService } from './game/haptics';
import { hudStore } from './game/hudStore';
import {
  applyLuckyWheelSliceReward,
  getLuckyWheelStatus,
  normalizeLuckyWheel,
  type LuckyWheelOutcome,
} from './game/luckyWheel';
import { RADIO_STATIONS } from './game/music';
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
  flushPendingSaveData,
  getSkinById,
  loadSaveData,
  persistSaveData,
  recordLeaderboardRun,
  resolveActiveSkinId,
  schedulePersistSaveData,
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

const DailyBonusModal = React.lazy(() =>
  import('./components/DailyBonusModal').then((m) => ({ default: m.DailyBonusModal })),
);
const LandmarkCodexModal = React.lazy(() =>
  import('./components/LandmarkCodexModal').then((m) => ({ default: m.LandmarkCodexModal })),
);
const LeaderboardModal = React.lazy(() =>
  import('./components/LeaderboardModal').then((m) => ({ default: m.LeaderboardModal })),
);
const LuckyWheelModal = React.lazy(() =>
  import('./components/LuckyWheelModal').then((m) => ({ default: m.LuckyWheelModal })),
);
const MissionsModal = React.lazy(() =>
  import('./components/MissionsModal').then((m) => ({ default: m.MissionsModal })),
);
const PhotoModeModal = React.lazy(() =>
  import('./components/PhotoModeModal').then((m) => ({ default: m.PhotoModeModal })),
);
const SettingsModal = React.lazy(() =>
  import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal })),
);
const SkinWardrobe = React.lazy(() =>
  import('./components/SkinWardrobe').then((m) => ({ default: m.SkinWardrobe })),
);
const WeeklyChallengeModal = React.lazy(() =>
  import('./components/WeeklyChallengeModal').then((m) => ({ default: m.WeeklyChallengeModal })),
);

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
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [webglStatus, setWebglStatus] = useState<'ok' | 'lost' | 'unavailable'>('ok');

  // Tracks metrics already applied to dailyMissions during the current run so we never double-count
  const flushedMetricsRef = useRef<RunMetrics>({ ...ZERO_METRICS });
  const lastReactSaveSyncAtRef = useRef(0);
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

  const handleRunnerHandleResolved = useCallback(
    (resolvedHandle: string) => {
      if (saveRef.current.runnerHandle === resolvedHandle) return;
      updateSave((prev) => ({
        ...prev,
        runnerHandle: resolvedHandle,
      }));
    },
    [updateSave],
  );

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
    schedulePersistSaveData(nextSave, 2000);

    const anyCompletion =
      dailyEval.newlyCompleted || newlyCompletedWeekly.length > 0 || newlyCompleted.length > 0;
    const now = performance.now();
    if (anyCompletion || now - lastReactSaveSyncAtRef.current >= 1500) {
      lastReactSaveSyncAtRef.current = now;
      setSave(nextSave);
    }

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
            hudStore.setSnapshot(snapshot);
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
              difficulty: stats.difficulty,
              score: stats.score,
              distance: stats.distance,
              skinId: recordedSkinId,
              badgeId: prev.equippedBadgeId,
              peakSpeedMultiplier: stats.peakSpeedMultiplier,
              landmarkReachedName: stats.landmarkReachedName,
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

            if (
              auth.currentUser &&
              auth.currentUser.emailVerified &&
              (stats.score > 0 || stats.distance > 0)
            ) {
              const handleForRun =
                prev.runnerHandle ||
                deriveDefaultHandle(auth.currentUser.displayName, auth.currentUser.uid);
              void submitGlobalLeaderboardRun({
                uid: auth.currentUser.uid,
                handle: handleForRun,
                difficulty: stats.difficulty,
                score: stats.score,
                distance: stats.distance,
                skinId: recordedSkinId,
                badgeId: prev.equippedBadgeId,
                peakSpeedMultiplier: stats.peakSpeedMultiplier,
                landmarkReachedName: stats.landmarkReachedName,
              }).catch(() => {
                // Global sync failures never block local run summary
              });
            }

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
      flushPendingSaveData();
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
    lastReactSaveSyncAtRef.current = 0;
    dailyRunAttemptRef.current = { progress: 0, disqualified: false };
    setDailyRunAttempt({ progress: 0, disqualified: false });
    hudStore.reset();
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
    flushPendingSaveData();
    setSave(saveRef.current);
    setPhotoModeOpen(false);
    engineRef.current?.setPhase('paused');
    setPhase('paused');
  }, []);

  const handleResume = useCallback(() => {
    if (phaseRef.current !== 'paused') return;
    setPhotoModeOpen(false);
    engineRef.current?.exitPhotoMode();
    engineRef.current?.audio.resume();
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
    flushPendingSaveData();
    setSave(saveRef.current);
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

    const onVisibilityChange = () => {
      if (document.hidden) {
        swipeStateRef.current.active = false;
        vibrationServiceRef.current?.cancel();
        flushPendingSaveData();
        engineRef.current?.audio.suspend();
        if (phaseRef.current === 'playing') {
          handlePause();
        }
      } else {
        engineRef.current?.resyncClock();
        if (!saveRef.current.muted) {
          engineRef.current?.audio.resume();
        }
      }
    };

    const onPageHide = () => {
      swipeStateRef.current.active = false;
      vibrationServiceRef.current?.cancel();
      flushPendingSaveData();
      engineRef.current?.audio.suspend();
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
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onWindowBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
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
    <FirebaseErrorBoundary>
      <AuthProvider
        savedHandle={save.runnerHandle ?? null}
        activeSkinId={effectiveSkinId}
        equippedBadgeId={save.equippedBadgeId}
        onHandleResolved={handleRunnerHandleResolved}
      >
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
        <TitleScreen
          save={save}
          activeSkin={activeSkin}
          equippedBadge={equippedBadge}
          globalEvent={globalEvent}
          streakSecuredToday={streakSecuredToday}
          loginBonusStatus={loginBonusStatus}
          luckyWheelStatus={luckyWheelStatus}
          dailyRunObjTpl={dailyRunObjTpl}
          dailyRunClaimable={dailyRunClaimable}
          totalTodayDoneCount={totalTodayDoneCount}
          totalClaimableDailyCount={totalClaimableDailyCount}
          weeklyDoneCount={weeklyDoneCount}
          claimableWeeklyCount={claimableWeeklyCount}
          onStartRun={handleStartRun}
          onOpenMissions={handleOpenMissions}
          onOpenLeaderboard={handleOpenLeaderboard}
          onOpenCodex={handleOpenCodex}
          onInspectLandmarkInCodex={handleInspectLandmarkInCodex}
          onOpenWeekly={handleOpenWeekly}
          onOpenDailyBonus={handleOpenDailyBonus}
          onCycleRadioStation={handleCycleRadioStation}
          onToggleMute={handleToggleMute}
          onOpenSettings={handleOpenSettings}
          onSelectDifficulty={handleSelectDifficulty}
          onOpenWardrobe={handleOpenWardrobe}
          onOpenLuckyWheel={handleOpenLuckyWheel}
        />
      )}

      {/* IN-GAME HUD */}
      {phase === 'playing' && (
        <GameHUD
          muted={save.muted}
          radioStation={save.radioStation}
          showTouchButtons={save.showTouchButtons}
          showOnboardingHint={save.bestDistance < 80}
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
        <PauseModal
          save={save}
          dailyRunObjTpl={dailyRunObjTpl}
          dailyRunAttempt={dailyRunAttempt}
          onResume={handleResume}
          onOpenPhotoMode={handleOpenPhotoMode}
          onStartRun={handleStartRun}
          onToggleMute={handleToggleMute}
          onCycleRadioStation={handleCycleRadioStation}
          onToggleTouchButtons={handleToggleTouchButtons}
          onToggleHaptics={handleToggleHaptics}
          onOpenSettings={handleOpenSettings}
          onReturnToTitle={handleReturnToTitle}
        />
      )}

      {/* GAME OVER MODAL */}
      {phase === 'gameover' && runSummary && (
        <GameOverModal
          save={save}
          runSummary={runSummary}
          effectiveSkinId={effectiveSkinId}
          dailyRunObjTpl={dailyRunObjTpl}
          dailyRunAttempt={dailyRunAttempt}
          dailyRunClaimable={dailyRunClaimable}
          totalTodayDoneCount={totalTodayDoneCount}
          totalClaimableDailyCount={totalClaimableDailyCount}
          onInspectLandmarkInCodex={handleInspectLandmarkInCodex}
          onClaimAllMissions={handleClaimAllMissions}
          onClaimDailyRunObjective={handleClaimDailyRunObjective}
          onClaimMission={handleClaimMission}
          onSelectSkin={handleSelectSkin}
          onStartRun={handleStartRun}
          onOpenWardrobe={handleOpenWardrobe}
          onOpenCodex={handleOpenCodex}
          onReturnToTitle={handleReturnToTitle}
        />
      )}

      {/* CODE-SPLIT LAZY SECONDARY MODALS */}
      <Suspense fallback={null}>
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

        {phase === 'paused' && photoModeOpen && photoSnapshotUrl && (
          <PhotoModeModal
            rawSnapshotUrl={photoSnapshotUrl}
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

        {dailyBonusOpen && (
          <DailyBonusModal
            dailyLogin={save.dailyLogin}
            totalGems={save.totalGems}
            onClaim={handleClaimDailyBonus}
            onClose={() => setDailyBonusOpen(false)}
          />
        )}

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

        {leaderboardOpen && (
          <LeaderboardModal
            localEntries={save.leaderboard}
            difficulty={save.difficulty}
            playerBestScore={save.bestScore}
            playerBestDistance={save.bestDistance}
            playerSkinId={effectiveSkinId}
            playerBadgeId={save.equippedBadgeId}
            onClose={() => setLeaderboardOpen(false)}
          />
        )}

        {codexOpen && (
          <LandmarkCodexModal
            unlockedLandmarkIds={save.unlockedLandmarkIds}
            landmarkForecasts={engineRef.current?.getAllLandmarkForecasts()}
            initialLandmark={codexInitialLandmark}
            onClose={() => setCodexOpen(false)}
          />
        )}

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
      </Suspense>
        </div>
      </AuthProvider>
    </FirebaseErrorBoundary>
  );
}
