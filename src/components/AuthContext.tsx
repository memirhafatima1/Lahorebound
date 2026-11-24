import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleProvider } from '../game/firebase';
import {
  deriveDefaultHandle,
  ensureRunnerProfile,
  updateRunnerHandle,
} from '../game/globalLeaderboard';
import type { ProfileBadgeId } from '../game/types';

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  runnerHandle: string;
  authBusy: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<User | null>;
  signOutRunner: () => Promise<void>;
  saveRunnerHandle: (
    nextHandle: string,
    skinId: string,
    badgeId: ProfileBadgeId | null,
  ) => Promise<string>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  savedHandle: string | null;
  activeSkinId: string;
  equippedBadgeId: ProfileBadgeId | null;
  onHandleResolved: (handle: string) => void;
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  savedHandle,
  activeSkinId,
  equippedBadgeId,
  onHandleResolved,
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [runnerHandle, setRunnerHandle] = useState<string>(savedHandle ?? 'Lahore_Runner');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const savedHandleRef = useRef(savedHandle);
  savedHandleRef.current = savedHandle;
  const activeSkinIdRef = useRef(activeSkinId);
  activeSkinIdRef.current = activeSkinId;
  const equippedBadgeIdRef = useRef(equippedBadgeId);
  equippedBadgeIdRef.current = equippedBadgeId;
  const onHandleResolvedRef = useRef(onHandleResolved);
  onHandleResolvedRef.current = onHandleResolved;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);

      if (!nextUser) {
        setRunnerHandle(savedHandleRef.current ?? 'Lahore_Runner');
        return;
      }

      const preferred =
        savedHandleRef.current || deriveDefaultHandle(nextUser.displayName, nextUser.uid);
      void ensureRunnerProfile(
        nextUser.uid,
        preferred,
        activeSkinIdRef.current,
        equippedBadgeIdRef.current,
      )
        .then((resolvedHandle) => {
          setRunnerHandle(resolvedHandle);
          onHandleResolvedRef.current(resolvedHandle);
        })
        .catch(() => {
          setRunnerHandle(preferred);
        });
    });

    return () => unsub();
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<User | null> => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const preferred =
        savedHandleRef.current || deriveDefaultHandle(cred.user.displayName, cred.user.uid);
      const resolved = await ensureRunnerProfile(
        cred.user.uid,
        preferred,
        activeSkinIdRef.current,
        equippedBadgeIdRef.current,
      );
      setRunnerHandle(resolved);
      onHandleResolvedRef.current(resolved);
      return cred.user;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('popup-closed-by-user') && !msg.includes('cancelled-popup-request')) {
        setAuthError('Could not complete Google sign-in. Please allow popups and try again.');
      }
      return null;
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const signOutRunner = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signOut(auth);
    } catch {
      setAuthError('Sign-out failed. Please try again.');
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const saveRunnerHandle = useCallback(
    async (
      nextHandle: string,
      skinId: string,
      badgeId: ProfileBadgeId | null,
    ): Promise<string> => {
      if (!auth.currentUser) {
        throw new Error('Sign in with Google first to save your global runner handle.');
      }
      setAuthBusy(true);
      setAuthError(null);
      try {
        const saved = await updateRunnerHandle(
          auth.currentUser.uid,
          nextHandle,
          skinId,
          badgeId,
        );
        setRunnerHandle(saved);
        onHandleResolvedRef.current(saved);
        return saved;
      } finally {
        setAuthBusy(false);
      }
    },
    [],
  );

  const clearAuthError = useCallback(() => setAuthError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        runnerHandle,
        authBusy,
        authError,
        signInWithGoogle,
        signOutRunner,
        saveRunnerHandle,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useRunnerAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useRunnerAuth must be used inside AuthProvider');
  }
  return ctx;
}
