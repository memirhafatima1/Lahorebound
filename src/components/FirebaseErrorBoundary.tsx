import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { FIRESTORE_UPGRADE_URL, isFirestoreQuotaError } from '../game/firebase';

interface FirebaseErrorBoundaryProps {
  children: React.ReactNode;
}

interface FirebaseErrorBoundaryState {
  error: Error | null;
}

export class FirebaseErrorBoundary extends React.Component<
  FirebaseErrorBoundaryProps,
  FirebaseErrorBoundaryState
> {
  constructor(props: FirebaseErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): FirebaseErrorBoundaryState {
    return { error };
  }

  override render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const quotaExceeded = isFirestoreQuotaError(this.state.error);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060b14] p-4 text-white">
        <div className="w-full max-w-md rounded-2xl bg-[#0b1322] border border-amber-400/40 p-6 text-center shadow-2xl">
          <div className="mx-auto w-11 h-11 rounded-xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-300">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h2 className="mt-3 text-lg font-black uppercase tracking-wide">
            {quotaExceeded ? 'Daily Leaderboard Quota Reached' : 'Something Went Wrong'}
          </h2>
          <p className="mt-2 text-xs text-slate-300 leading-relaxed">
            {quotaExceeded
              ? 'Firestore free-tier daily quota was exceeded and will reset tomorrow. Local gameplay remains available.'
              : 'An unexpected data error occurred while syncing your Lahore Bound profile.'}
          </p>
          {quotaExceeded && (
            <a
              href={FIRESTORE_UPGRADE_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-xs font-bold text-sky-300 underline"
            >
              View Firestore Database Plan
            </a>
          )}
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black uppercase tracking-wider text-xs px-4 py-2.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Continue</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
