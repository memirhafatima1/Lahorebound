# Security Specification — Lahore Bound Global Leaderboard

## 1. Data Invariants
1. **Authenticated Ownership & Verification**: No client may create, update, or delete any `runnerProfiles` or `leaderboardEntries` document without `request.auth != null && request.auth.token.email_verified == true`.
2. **One Entry Per Player Per Difficulty**: Every `leaderboardEntries/{entryId}` document ID must strictly equal `request.auth.uid + '_' + incoming().difficulty`, guaranteeing one authoritative personal-best record per player across `'zen'`, `'normal'`, and `'turbo'`.
3. **Referential Integrity**: A `leaderboardEntries` record cannot be created unless the user already owns a `runnerProfiles/{uid}` record.
4. **Monotonic Score Protection & Safe Handle Sync**: Updates to `leaderboardEntries` are strictly partitioned into:
   - **High-score improvement**: requires strictly higher `score` (or equal `score` with strictly higher `distance`).
   - **Profile handle/cosmetic sync**: requires `score`, `distance`, `peakSpeedMultiplier`, and `landmarkReachedName` to remain immutable while updating only `handle`, `skinId`, `badgeId`, and `updatedAt`.
5. **Immutable Identity & Server Timestamps**: `uid`, `difficulty`, and `createdAt` are immutable after creation; `createdAt` (on create) and `updatedAt` (on create/update) must equal `request.time`.
6. **Zero PII & Bounded Strings**: Neither collection stores email, phone, or address. Every string enforces `.size()` bounds and regex allowlists matching `firebase-blueprint.json`.

## 2. The "Dirty Dozen" Adversarial Payloads (All Expected: `PERMISSION_DENIED`)
1. **Unauthenticated leaderboard write**: `{ uid: "attacker", handle: "Hack1", difficulty: "normal", score: 99999, ... }` with `auth = null`.
2. **Unverified email write**: Same payload with `auth.token.email_verified = false`.
3. **UID spoofing**: Authenticated as `userA` writing `uid: "userB"` or targeting `/runnerProfiles/userB`.
4. **Ghost / shadow field injection**: Adding `isAdmin: true` or `verifiedRunner: true` to a `runnerProfiles` or `leaderboardEntries` write.
5. **Handle length/charset bypass**: `handle: "a"` (<3 chars), `handle: "WayTooLongRunnerHandle99"` (>18 chars), or `handle: "bad handle!"` (invalid chars).
6. **Difficulty enum tampering**: `difficulty: "godmode"` on `leaderboardEntries`.
7. **Deterministic ID bypass**: Creating `/leaderboardEntries/custom_spam_id_1` instead of `{uid}_{difficulty}`.
8. **Score inflation / negative score**: `score: -10`, `score: 999999999`, or float `score: 100.5`.
9. **Score downgrade / tamper during handle sync**: Updating `handle` while silently changing `score` from `1200` to `999999` without satisfying monotonic improvement + allowed keys.
10. **Client-forged timestamp**: Sending `updatedAt: Timestamp.fromMillis(0)` instead of `serverTimestamp()`.
11. **Orphaned leaderboard write**: Creating a `leaderboardEntries` document when `/runnerProfiles/{uid}` does not exist.
12. **PII / cross-user profile read**: Reading `/runnerProfiles/otherUserUid` or listing `/runnerProfiles`.
