import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import type { DifficultyMode, LeaderboardEntry, ProfileBadgeId } from './types';

export const HANDLE_MIN_LENGTH = 3;
export const HANDLE_MAX_LENGTH = 18;
export const HANDLE_REGEX = /^[a-zA-Z0-9_\-]+$/;
export const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
export const SKIN_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
export const BADGE_ID_REGEX = /^[a-zA-Z0-9_\-]*$/;

export const MAX_SCORE = 10_000_000;
export const MAX_DISTANCE = 500_000;
export const MAX_LANDMARK_NAME_LENGTH = 64;

export interface GlobalLeaderboardResult {
  entries: LeaderboardEntry[];
  playerEntry: LeaderboardEntry | null;
  playerRank: number | null;
  totalLoaded: number;
}

export function sanitizeRunnerHandleInput(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-]/g, '')
    .slice(0, HANDLE_MAX_LENGTH);
}

export function isValidRunnerHandle(handle: string): boolean {
  return (
    typeof handle === 'string' &&
    handle.length >= HANDLE_MIN_LENGTH &&
    handle.length <= HANDLE_MAX_LENGTH &&
    HANDLE_REGEX.test(handle)
  );
}

export function deriveDefaultHandle(displayName?: string | null, uid?: string | null): string {
  const fromName = displayName ? sanitizeRunnerHandleInput(displayName) : '';
  if (fromName.length >= HANDLE_MIN_LENGTH) {
    return fromName;
  }
  const suffix = (uid ?? 'runner')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 6) || 'LHE';
  const candidate = `Runner_${suffix}`.slice(0, HANDLE_MAX_LENGTH);
  return isValidRunnerHandle(candidate) ? candidate : 'Lahore_Runner';
}

function sanitizeSkinId(skinId: string): string {
  const clean = skinId.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 32);
  return clean.length >= 1 && SKIN_ID_REGEX.test(clean) ? clean : 'trailblazer';
}

function sanitizeBadgeId(badgeId: ProfileBadgeId | string | null | undefined): string {
  if (!badgeId) return '';
  const clean = String(badgeId).replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 40);
  return BADGE_ID_REGEX.test(clean) ? clean : '';
}

function sanitizeLandmarkName(name: string): string {
  const clean = name.trim().slice(0, MAX_LANDMARK_NAME_LENGTH);
  return clean.length >= 1 ? clean : 'Delhi Gate';
}

function toIsoTimestamp(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return new Date().toISOString();
}

function mapSnapshotDocToEntry(
  id: string,
  data: Record<string, unknown>,
  currentUid?: string | null,
): LeaderboardEntry | null {
  const uid = typeof data.uid === 'string' ? data.uid : '';
  const handle = typeof data.handle === 'string' ? data.handle : 'Runner';
  const difficulty =
    data.difficulty === 'zen' || data.difficulty === 'normal' || data.difficulty === 'turbo'
      ? data.difficulty
      : 'normal';
  const score = typeof data.score === 'number' ? Math.max(0, Math.floor(data.score)) : 0;
  const distance = typeof data.distance === 'number' ? Math.max(0, Math.floor(data.distance)) : 0;
  const skinId = typeof data.skinId === 'string' ? data.skinId : 'trailblazer';
  const badgeIdRaw = typeof data.badgeId === 'string' && data.badgeId.length > 0 ? data.badgeId : null;
  const peakSpeedMultiplier =
    typeof data.peakSpeedMultiplier === 'number' ? data.peakSpeedMultiplier : undefined;
  const landmarkReachedName =
    typeof data.landmarkReachedName === 'string' ? data.landmarkReachedName : undefined;

  return {
    id,
    uid,
    difficulty,
    playerName: handle,
    score,
    distance,
    skinId,
    badgeId: badgeIdRaw as ProfileBadgeId | null,
    peakSpeedMultiplier,
    landmarkReachedName,
    recordedAt: toIsoTimestamp(data.updatedAt ?? data.createdAt),
    isPlayer: Boolean(currentUid && uid === currentUid),
  };
}

function buildResultFromDocs(
  snap: QuerySnapshot,
  currentUid?: string | null,
  playerFallbackEntry?: LeaderboardEntry | null,
): GlobalLeaderboardResult {
  const allEntries: LeaderboardEntry[] = [];
  for (const docSnap of snap.docs) {
    const mapped = mapSnapshotDocToEntry(
      docSnap.id,
      docSnap.data() as Record<string, unknown>,
      currentUid,
    );
    if (mapped) {
      allEntries.push(mapped);
    }
  }

  allEntries.sort((a, b) => b.score - a.score || b.distance - a.distance);

  let playerIndex = currentUid
    ? allEntries.findIndex((entry) => entry.uid === currentUid)
    : -1;
  const playerEntry =
    playerIndex >= 0 ? allEntries[playerIndex] : playerFallbackEntry ?? null;

  return {
    entries: allEntries.slice(0, 10),
    playerEntry,
    playerRank: playerIndex >= 0 ? playerIndex + 1 : null,
    totalLoaded: allEntries.length,
  };
}

export async function ensureRunnerProfile(
  uid: string,
  preferredHandle: string,
  skinId: string,
  badgeId: ProfileBadgeId | null,
): Promise<string> {
  const path = `runnerProfiles/${uid}`;
  const ref = doc(db, 'runnerProfiles', uid);
  let snap;
  try {
    snap = await getDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (snap.exists()) {
    const data = snap.data() as Record<string, unknown>;
    if (typeof data.handle === 'string' && isValidRunnerHandle(data.handle)) {
      return data.handle;
    }
  }

  const validHandle = isValidRunnerHandle(preferredHandle)
    ? preferredHandle
    : deriveDefaultHandle(preferredHandle, uid);
  try {
    await setDoc(ref, {
      uid,
      handle: validHandle,
      skinId: sanitizeSkinId(skinId),
      badgeId: sanitizeBadgeId(badgeId),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
  return validHandle;
}

export async function updateRunnerHandle(
  uid: string,
  rawHandle: string,
  skinId: string,
  badgeId: ProfileBadgeId | null,
): Promise<string> {
  const cleanHandle = sanitizeRunnerHandleInput(rawHandle);
  if (!isValidRunnerHandle(cleanHandle)) {
    throw new Error(
      `Runner handle must be ${HANDLE_MIN_LENGTH}-${HANDLE_MAX_LENGTH} characters (letters, numbers, _ or -).`,
    );
  }

  const cleanSkin = sanitizeSkinId(skinId);
  const cleanBadge = sanitizeBadgeId(badgeId);
  const profilePath = `runnerProfiles/${uid}`;
  const profileRef = doc(db, 'runnerProfiles', uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(profileRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, profilePath);
  }

  try {
    if (existingSnap.exists()) {
      await updateDoc(profileRef, {
        handle: cleanHandle,
        skinId: cleanSkin,
        badgeId: cleanBadge,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(profileRef, {
        uid,
        handle: cleanHandle,
        skinId: cleanSkin,
        badgeId: cleanBadge,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }

  // Sync updated handle & cosmetics across any existing difficulty leaderboard docs owned by uid
  const difficulties: DifficultyMode[] = ['zen', 'normal', 'turbo'];
  const existingEntryDocs = await Promise.all(
    difficulties.map(async (diff) => {
      const entryId = `${uid}_${diff}`;
      const entryPath = `leaderboardEntries/${entryId}`;
      try {
        const entrySnap = await getDoc(doc(db, 'leaderboardEntries', entryId));
        return entrySnap.exists() ? entrySnap : null;
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, entryPath);
      }
    }),
  );

  const docsToSync = existingEntryDocs.filter((d): d is NonNullable<typeof d> => d !== null);
  if (docsToSync.length > 0) {
    const batch = writeBatch(db);
    for (const d of docsToSync) {
      batch.update(d.ref, {
        handle: cleanHandle,
        skinId: cleanSkin,
        badgeId: cleanBadge,
        updatedAt: serverTimestamp(),
      });
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `leaderboardEntries/${uid}_*`);
    }
  }

  return cleanHandle;
}

export interface SubmitGlobalRunParams {
  uid: string;
  handle: string;
  difficulty: DifficultyMode;
  score: number;
  distance: number;
  skinId: string;
  badgeId: ProfileBadgeId | null;
  peakSpeedMultiplier: number;
  landmarkReachedName: string;
}

export async function submitGlobalLeaderboardRun(
  params: SubmitGlobalRunParams,
): Promise<{ submitted: boolean; isNewPersonalBest: boolean; handle: string }> {
  const safeScore = Math.max(0, Math.min(MAX_SCORE, Math.floor(params.score)));
  const safeDistance = Math.max(0, Math.min(MAX_DISTANCE, Math.floor(params.distance)));
  if (safeScore <= 0 && safeDistance <= 0) {
    return { submitted: false, isNewPersonalBest: false, handle: params.handle };
  }

  const validHandle = await ensureRunnerProfile(
    params.uid,
    params.handle,
    params.skinId,
    params.badgeId,
  );
  const safeSkin = sanitizeSkinId(params.skinId);
  const safeBadge = sanitizeBadgeId(params.badgeId);
  const safePeakSpeed = Math.max(1.0, Math.min(10.0, Number(params.peakSpeedMultiplier.toFixed(2))));
  const safeLandmark = sanitizeLandmarkName(params.landmarkReachedName);

  const entryId = `${params.uid}_${params.difficulty}`;
  const path = `leaderboardEntries/${entryId}`;
  const ref = doc(db, 'leaderboardEntries', entryId);

  let existingSnap;
  try {
    existingSnap = await getDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!existingSnap.exists()) {
    try {
      await setDoc(ref, {
        uid: params.uid,
        handle: validHandle,
        difficulty: params.difficulty,
        score: safeScore,
        distance: safeDistance,
        skinId: safeSkin,
        badgeId: safeBadge,
        peakSpeedMultiplier: safePeakSpeed,
        landmarkReachedName: safeLandmark,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { submitted: true, isNewPersonalBest: true, handle: validHandle };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  const prev = existingSnap.data() as Record<string, unknown>;
  const prevScore = typeof prev.score === 'number' ? prev.score : 0;
  const prevDistance = typeof prev.distance === 'number' ? prev.distance : 0;
  const strictlyBetter =
    safeScore > prevScore || (safeScore === prevScore && safeDistance > prevDistance);

  if (!strictlyBetter) {
    return { submitted: false, isNewPersonalBest: false, handle: validHandle };
  }

  try {
    await updateDoc(ref, {
      handle: validHandle,
      score: safeScore,
      distance: safeDistance,
      skinId: safeSkin,
      badgeId: safeBadge,
      peakSpeedMultiplier: safePeakSpeed,
      landmarkReachedName: safeLandmark,
      updatedAt: serverTimestamp(),
    });
    return { submitted: true, isNewPersonalBest: true, handle: validHandle };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fetchPlayerDifficultyEntry(
  uid: string,
  difficulty: DifficultyMode,
): Promise<LeaderboardEntry | null> {
  const entryId = `${uid}_${difficulty}`;
  const path = `leaderboardEntries/${entryId}`;
  try {
    const snap = await getDoc(doc(db, 'leaderboardEntries', entryId));
    if (!snap.exists()) return null;
    return mapSnapshotDocToEntry(snap.id, snap.data() as Record<string, unknown>, uid);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchGlobalLeaderboard(
  difficulty: DifficultyMode,
  currentUid?: string | null,
  signal?: AbortSignal,
): Promise<GlobalLeaderboardResult> {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const colRef = collection(db, 'leaderboardEntries');
  const collectionPath = 'leaderboardEntries';
  let snap: QuerySnapshot;

  try {
    const indexedQuery = query(
      colRef,
      where('difficulty', '==', difficulty),
      orderBy('score', 'desc'),
      limit(25),
    );
    snap = await getDocs(indexedQuery);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('failed-precondition') || msg.includes('index')) {
      try {
        const fallbackQuery = query(colRef, where('difficulty', '==', difficulty), limit(100));
        snap = await getDocs(fallbackQuery);
      } catch (fallbackErr) {
        handleFirestoreError(fallbackErr, OperationType.LIST, collectionPath);
      }
    } else {
      handleFirestoreError(error, OperationType.LIST, collectionPath);
    }
  }

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  let playerFallback: LeaderboardEntry | null = null;
  if (currentUid) {
    const inPage = snap.docs.some(
      (d) => (d.data() as Record<string, unknown>).uid === currentUid,
    );
    if (!inPage) {
      playerFallback = await fetchPlayerDifficultyEntry(currentUid, difficulty);
    }
  }

  return buildResultFromDocs(snap, currentUid, playerFallback);
}

export function subscribeGlobalLeaderboard(
  difficulty: DifficultyMode,
  currentUid: string,
  onData: (result: GlobalLeaderboardResult) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const colRef = collection(db, 'leaderboardEntries');
  const q = query(
    colRef,
    where('difficulty', '==', difficulty),
    orderBy('score', 'desc'),
    limit(25),
  );

  let activeUnsub: Unsubscribe | null = null;
  let cancelled = false;

  const attachFallback = () => {
    if (cancelled) return;
    const fallbackQ = query(colRef, where('difficulty', '==', difficulty), limit(100));
    activeUnsub = onSnapshot(
      fallbackQ,
      (snap) => {
        if (cancelled) return;
        onData(buildResultFromDocs(snap, currentUid));
      },
      (err) => {
        if (cancelled) return;
        try {
          handleFirestoreError(err, OperationType.LIST, 'leaderboardEntries');
        } catch (wrapped) {
          onError(wrapped);
        }
      },
    );
  };

  activeUnsub = onSnapshot(
    q,
    (snap) => {
      if (cancelled) return;
      const inTop = snap.docs.some(
        (d) => (d.data() as Record<string, unknown>).uid === currentUid,
      );
      if (inTop) {
        onData(buildResultFromDocs(snap, currentUid));
      } else {
        void fetchPlayerDifficultyEntry(currentUid, difficulty)
          .then((fallbackEntry) => {
            if (!cancelled) {
              onData(buildResultFromDocs(snap, currentUid, fallbackEntry));
            }
          })
          .catch(() => {
            if (!cancelled) {
              onData(buildResultFromDocs(snap, currentUid));
            }
          });
      }
    },
    (err) => {
      if (cancelled) return;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('failed-precondition') || msg.includes('index')) {
        activeUnsub?.();
        attachFallback();
        return;
      }
      try {
        handleFirestoreError(err, OperationType.LIST, 'leaderboardEntries');
      } catch (wrapped) {
        onError(wrapped);
      }
    },
  );

  return () => {
    cancelled = true;
    activeUnsub?.();
  };
}
