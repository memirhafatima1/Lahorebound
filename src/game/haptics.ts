export type HapticEvent = 'jump_land' | 'slide_start' | 'slide_end' | 'lane_switch';

export type HapticPatternKind = 'heavy' | 'continuous' | 'double-tap';

export interface HapticPatternMap {
  heavy: number | number[];
  continuous: number | number[];
  'double-tap': number | number[];
}

export const DEFAULT_HAPTIC_PATTERNS: HapticPatternMap = {
  // Solid heavy pulse on landing after a jump
  heavy: [48],
  // Sustained ~25Hz low-frequency pulsed rumble for the slide duration
  continuous: [18, 22, 18, 22, 18, 22, 18, 22, 18, 22, 18, 22, 18, 22, 18],
  // Crisp double-tap sequence for lateral lane switches
  'double-tap': [12, 34, 12],
};

export class HapticFeedbackService {
  private enabled = true;
  private lastPulseMs = 0;
  private readonly patterns: HapticPatternMap;

  constructor(patterns: Partial<HapticPatternMap> = {}) {
    this.patterns = {
      heavy: patterns.heavy ?? DEFAULT_HAPTIC_PATTERNS.heavy,
      continuous: patterns.continuous ?? DEFAULT_HAPTIC_PATTERNS.continuous,
      'double-tap': patterns['double-tap'] ?? DEFAULT_HAPTIC_PATTERNS['double-tap'],
    };
  }

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.cancel();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public triggerPattern(kind: HapticPatternKind): boolean {
    return this.trigger(this.patterns[kind]);
  }

  public triggerEvent(event: HapticEvent): void {
    switch (event) {
      case 'jump_land':
        this.triggerPattern('heavy');
        break;
      case 'slide_start':
        this.triggerPattern('continuous');
        break;
      case 'slide_end':
        this.cancel();
        break;
      case 'lane_switch':
        this.triggerPattern('double-tap');
        break;
    }
  }

  private trigger(pattern: number | number[]): boolean {
    if (!this.enabled || !this.isSupported()) return false;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - this.lastPulseMs < 18) return false;
    this.lastPulseMs = now;

    try {
      return navigator.vibrate(pattern);
    } catch {
      return false;
    }
  }

  public cancel(): void {
    if (!this.isSupported()) return;
    try {
      navigator.vibrate(0);
    } catch {
      // Ignore browser/iframe vibration restrictions
    }
  }
}
