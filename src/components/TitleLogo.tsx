import React from 'react';

export const TitleLogo: React.FC = () => {
  return (
    <div className="flex flex-col items-center select-none">
      <svg
        viewBox="0 0 460 128"
        className="w-[min(86vw,430px)] h-auto drop-shadow-[0_6px_18px_rgba(12,24,44,0.45)]"
        aria-label="Lahore Bound"
      >
        <defs>
          <linearGradient id="skyTitleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="65%" stopColor="#e0f2fe" />
            <stop offset="100%" stopColor="#7dd3fc" />
          </linearGradient>
          <linearGradient id="strideAccentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>

        {/* Faceted geometric wing emblem */}
        <polygon points="230,4 246,18 230,28 214,18" fill="#fbbf24" />
        <polygon points="208,18 164,12 184,28 212,26" fill="#38bdf8" />
        <polygon points="252,18 296,12 276,28 248,26" fill="#38bdf8" />
        <polygon points="196,29 148,28 172,38 205,34" fill="#e0f2fe" opacity="0.85" />
        <polygon points="264,29 312,28 288,38 255,34" fill="#e0f2fe" opacity="0.85" />

        {/* Main wordmark */}
        <text
          x="230"
          y="78"
          textAnchor="middle"
          fill="url(#skyTitleGrad)"
          stroke="#0f172a"
          strokeWidth="4"
          paintOrder="stroke"
          fontFamily="'Chakra Petch', 'Plus Jakarta Sans', sans-serif"
          fontWeight="700"
          fontSize="54"
          letterSpacing="5"
        >
          LAHORE
        </text>

        {/* Subtitle ribbon */}
        <polygon points="122,90 338,90 326,118 134,118" fill="#0f172a" opacity="0.88" />
        <polygon points="126,92 334,92 324,115 136,115" fill="none" stroke="url(#strideAccentGrad)" strokeWidth="2" />
        <text
          x="230"
          y="110"
          textAnchor="middle"
          fill="url(#strideAccentGrad)"
          fontFamily="'Chakra Petch', 'Plus Jakarta Sans', sans-serif"
          fontWeight="700"
          fontSize="19"
          letterSpacing="9"
        >
          BOUND
        </text>
      </svg>
      <div className="-mt-1 inline-flex items-center gap-1.5 rounded-lg bg-[#0b1322]/90 border border-emerald-400/45 px-3 py-0.5 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300 shadow">
        <span>Walled City Runner</span>
      </div>
    </div>
  );
};
