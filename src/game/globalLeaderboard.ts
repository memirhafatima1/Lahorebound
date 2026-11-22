import type { LeaderboardEntry } from './types';

export interface GlobalLeaderboardResult {
  entries: LeaderboardEntry[];
  playerRank: number | null;
  totalRunners: number;
}

const MOCK_GLOBAL_ENTRIES: LeaderboardEntry[] = [
  {
    id: 'global_1',
    playerName: 'Zainab · LHE',
    score: 14850,
    distance: 1120,
    skinId: 'aether',
    recordedAt: '2026-11-19T18:20:00.000Z',
  },
  {
    id: 'global_2',
    playerName: 'Hamza · KHI',
    score: 11920,
    distance: 915,
    skinId: 'neon',
    recordedAt: '2026-11-19T14:05:00.000Z',
  },
  {
    id: 'global_3',
    playerName: 'Amina · ISB',
    score: 9460,
    distance: 740,
    skinId: 'solar',
    recordedAt: '2026-11-18T21:40:00.000Z',
  },
  {
    id: 'global_4',
    playerName: 'Bilal · DXB',
    score: 6840,
    distance: 545,
    skinId: 'warden',
    recordedAt: '2026-11-18T11:12:00.000Z',
  },
  {
    id: 'global_5',
    playerName: 'Sana · LDN',
    score: 4320,
    distance: 360,
    skinId: 'glacier',
    recordedAt: '2026-11-17T19:55:00.000Z',
  },
  {
    id: 'global_6',
    playerName: 'Tariq · YYZ',
    score: 2650,
    distance: 230,
    skinId: 'trailblazer',
    recordedAt: '2026-11-17T08:30:00.000Z',
  },
];

export async function fetchGlobalLeaderboard(
  playerBest?: { score: number; distance: number; skinId: string },
  signal?: AbortSignal,
): Promise<GlobalLeaderboardResult> {
  // Simulate async leaderboard fetch while honoring cancellation
  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, 240);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

  const baseEntries: LeaderboardEntry[] = MOCK_GLOBAL_ENTRIES.map((entry) => ({
    ...entry,
  }));

  let playerRank: number | null = null;
  if (playerBest && playerBest.score > 0) {
    const playerEntry: LeaderboardEntry = {
      id: 'global_player_best',
      playerName: 'You (Best)',
      score: playerBest.score,
      distance: playerBest.distance,
      skinId: playerBest.skinId,
      recordedAt: new Date().toISOString(),
      isPlayer: true,
    };
    const combined = [...baseEntries, playerEntry].sort(
      (a, b) => b.score - a.score || b.distance - a.distance,
    );
    const foundIndex = combined.findIndex((item) => item.id === playerEntry.id);
    playerRank = foundIndex >= 0 ? foundIndex + 1 : null;
    return {
      entries: combined.slice(0, 5),
      playerRank,
      totalRunners: combined.length,
    };
  }

  return {
    entries: baseEntries.slice(0, 5),
    playerRank: null,
    totalRunners: baseEntries.length,
  };
}
