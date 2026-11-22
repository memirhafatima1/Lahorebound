import type { GlobalEventMode } from './types';

export type GlobalEventId = 'street_carnival';

export type GlobalEventTriggerReason =
  | 'weekend'
  | 'afternoon_parade'
  | 'evening_carnival'
  | 'manual_preview'
  | 'none';

export interface GlobalEventStatus {
  id: GlobalEventId;
  active: boolean;
  mode: GlobalEventMode;
  reason: GlobalEventTriggerReason;
  name: string;
  shortName: string;
  tagline: string;
  triggerLabel: string;
  countdownLabel: string;
  scheduleSummary: string;
  remainingSeconds: number;
  accentHex: string;
  secondaryHex: string;
  cyanHex: string;
}

export const GLOBAL_EVENT_MODES: Array<{
  id: GlobalEventMode;
  label: string;
  shortLabel: string;
  description: string;
  accentHex: string;
}> = [
  {
    id: 'auto',
    label: 'Live Lahore Schedule',
    shortLabel: 'Auto',
    description: 'Weekends (Sat–Sun) & daily festival hours PKT',
    accentHex: '#ec4899',
  },
  {
    id: 'carnival',
    label: 'Street Carnival',
    shortLabel: 'Carnival',
    description: 'Festival sky palette & Carnival Runner skin active',
    accentHex: '#fbbf24',
  },
  {
    id: 'off',
    label: 'Standard Sky',
    shortLabel: 'Standard',
    description: 'Classic Lahore sky cycle without event overrides',
    accentHex: '#38bdf8',
  },
];

// Lahore (Asia/Karachi, UTC+5) calendar inspection
const lahoreCalendarFormatter =
  typeof Intl !== 'undefined'
    ? new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Karachi',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      })
    : null;

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export interface LahoreClockParts {
  weekdayIndex: number; // 0 = Sun ... 6 = Sat
  hour: number;
  minute: number;
  second: number;
  secondsIntoDay: number;
}

export function getLahoreClockParts(date = new Date()): LahoreClockParts {
  if (lahoreCalendarFormatter) {
    try {
      const parts = lahoreCalendarFormatter.formatToParts(date);
      let weekdayIndex = 0;
      let hour = 0;
      let minute = 0;
      let second = 0;
      for (const p of parts) {
        if (p.type === 'weekday' && p.value in WEEKDAY_INDEX) {
          weekdayIndex = WEEKDAY_INDEX[p.value];
        } else if (p.type === 'hour') {
          hour = Number(p.value) % 24;
        } else if (p.type === 'minute') {
          minute = Number(p.value);
        } else if (p.type === 'second') {
          second = Number(p.value);
        }
      }
      if (!Number.isNaN(hour) && !Number.isNaN(minute) && !Number.isNaN(second)) {
        return {
          weekdayIndex,
          hour,
          minute,
          second,
          secondsIntoDay: hour * 3600 + minute * 60 + second,
        };
      }
    } catch {
      // Fall back to UTC+5 calculation below
    }
  }

  const shifted = new Date(date.getTime() + 5 * 3600 * 1000);
  const weekdayIndex = shifted.getUTCDay();
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  const second = shifted.getUTCSeconds();
  return {
    weekdayIndex,
    hour,
    minute,
    second,
    secondsIntoDay: hour * 3600 + minute * 60 + second,
  };
}

export function formatEventCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(clamped / 86400);
  const hours = Math.floor((clamped % 86400) / 3600);
  const mins = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${String(mins).padStart(2, '0')}m`;
  }
  if (mins > 0) {
    return `${mins}m ${String(secs).padStart(2, '0')}s`;
  }
  return `${secs}s`;
}

// Daily Street Carnival windows (Lahore PKT):
// 1) Weekends: Saturday (6) & Sunday (0) full day
// 2) Weekday Midday Bazaar Parade: 13:00 - 14:59 PKT
// 3) Weekday Night Street Carnival: 18:00 - 22:59 PKT
const AFTERNOON_START_SEC = 13 * 3600;
const AFTERNOON_END_SEC = 15 * 3600;
const EVENING_START_SEC = 18 * 3600;
const EVENING_END_SEC = 23 * 3600;
const DAY_SECONDS = 86400;

export function getStreetCarnivalStatus(
  mode: GlobalEventMode = 'auto',
  date = new Date(),
): GlobalEventStatus {
  const base = {
    id: 'street_carnival' as const,
    mode,
    name: 'Street Carnival',
    shortName: 'Carnival',
    scheduleSummary: 'Sat–Sun all day · Mon–Fri 1–3 PM & 6–11 PM PKT',
    accentHex: '#ec4899',
    secondaryHex: '#fbbf24',
    cyanHex: '#22d3ee',
  };

  if (mode === 'off') {
    return {
      ...base,
      active: false,
      reason: 'none',
      tagline: 'Standard Lahore Skies',
      triggerLabel: 'Event Off (Settings)',
      countdownLabel: 'Switch to Auto or Carnival in Settings',
      remainingSeconds: 0,
    };
  }

  if (mode === 'carnival') {
    return {
      ...base,
      active: true,
      reason: 'manual_preview',
      tagline: 'Lahore Truck-Art Festival Skies',
      triggerLabel: 'Festival Preview Active',
      countdownLabel: 'Enabled via Settings',
      remainingSeconds: DAY_SECONDS,
    };
  }

  const clock = getLahoreClockParts(date);
  const { weekdayIndex, secondsIntoDay } = clock;
  const isWeekend = weekdayIndex === 0 || weekdayIndex === 6;

  if (isWeekend) {
    // Saturday counts remaining of Sat + all of Sunday (24h); Sunday counts until Monday 00:00
    const remainingSeconds =
      weekdayIndex === 6
        ? DAY_SECONDS - secondsIntoDay + DAY_SECONDS
        : DAY_SECONDS - secondsIntoDay;
    return {
      ...base,
      active: true,
      reason: 'weekend',
      tagline: 'Weekend Basant & Truck-Art Mela',
      triggerLabel: 'Weekend Carnival',
      countdownLabel: `${formatEventCountdown(remainingSeconds)} left`,
      remainingSeconds,
    };
  }

  if (secondsIntoDay >= AFTERNOON_START_SEC && secondsIntoDay < AFTERNOON_END_SEC) {
    const remainingSeconds = AFTERNOON_END_SEC - secondsIntoDay;
    return {
      ...base,
      active: true,
      reason: 'afternoon_parade',
      tagline: 'Midday Bazaar Street Parade',
      triggerLabel: 'Afternoon Mela',
      countdownLabel: `${formatEventCountdown(remainingSeconds)} left`,
      remainingSeconds,
    };
  }

  if (secondsIntoDay >= EVENING_START_SEC && secondsIntoDay < EVENING_END_SEC) {
    const remainingSeconds = EVENING_END_SEC - secondsIntoDay;
    return {
      ...base,
      active: true,
      reason: 'evening_carnival',
      tagline: 'Lantern & Dhol Night Celebration',
      triggerLabel: 'Evening Carnival',
      countdownLabel: `${formatEventCountdown(remainingSeconds)} left`,
      remainingSeconds,
    };
  }

  // Inactive on weekday outside windows: compute time until next window
  let secondsUntilNext = 0;
  let nextLabel = '1:00 PM PKT';
  if (secondsIntoDay < AFTERNOON_START_SEC) {
    secondsUntilNext = AFTERNOON_START_SEC - secondsIntoDay;
    nextLabel = '1:00 PM PKT';
  } else if (secondsIntoDay < EVENING_START_SEC) {
    secondsUntilNext = EVENING_START_SEC - secondsIntoDay;
    nextLabel = '6:00 PM PKT';
  } else {
    // After 23:00 Mon-Thu -> next is tomorrow 13:00; after 23:00 Fri -> Saturday 00:00
    if (weekdayIndex === 5) {
      secondsUntilNext = DAY_SECONDS - secondsIntoDay;
      nextLabel = 'Weekend 12:00 AM PKT';
    } else {
      secondsUntilNext = DAY_SECONDS - secondsIntoDay + AFTERNOON_START_SEC;
      nextLabel = 'Tomorrow 1:00 PM PKT';
    }
  }

  return {
    ...base,
    active: false,
    reason: 'none',
    tagline: 'Weekend & Festive Hours Event',
    triggerLabel: `Next: ${nextLabel}`,
    countdownLabel: `Starts in ${formatEventCountdown(secondsUntilNext)}`,
    remainingSeconds: secondsUntilNext,
  };
}
