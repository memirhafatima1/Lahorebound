import type {
  GamePhase,
  LahoreLandmarkKind,
  MusicTrackId,
  RadioStationId,
} from './types';

export interface MusicMixState {
  street_ambient: number;
  qawwali: number;
  sufi_fusion: number;
}

export interface MusicTrackMeta {
  id: MusicTrackId;
  label: string;
  shortLabel: string;
}

export interface RadioStationMeta {
  id: RadioStationId;
  name: string;
  shortName: string;
  frequency: string;
  tagline: string;
  accentHex: string;
}

export const RADIO_STATIONS: readonly RadioStationMeta[] = [
  {
    id: 'auto',
    name: 'Auto Dynamic',
    shortName: 'Auto Mix',
    frequency: 'FM 98.0',
    tagline: 'Adapts to speed & landmark',
    accentHex: '#38bdf8',
  },
  {
    id: 'sufi_soul',
    name: 'Sufi Soul',
    shortName: 'Sufi Soul',
    frequency: 'FM 88.4',
    tagline: 'Qawwali · Harmonium & Taali',
    accentHex: '#f59e0b',
  },
  {
    id: 'lahore_pop',
    name: 'Modern Lahore Pop',
    shortName: 'Lahore Pop',
    frequency: 'FM 101.6',
    tagline: 'Upbeat · Dholak & Synth Hook',
    accentHex: '#ec4899',
  },
  {
    id: 'historical_instrumental',
    name: 'Historical Instrumental',
    shortName: 'Instrumental',
    frequency: 'FM 94.2',
    tagline: 'Classical · Bansuri & Rabab',
    accentHex: '#34d399',
  },
];

export const RADIO_STATION_MAP: Record<RadioStationId, RadioStationMeta> = {
  auto: RADIO_STATIONS[0],
  sufi_soul: RADIO_STATIONS[1],
  lahore_pop: RADIO_STATIONS[2],
  historical_instrumental: RADIO_STATIONS[3],
};

export const MUSIC_TRACK_META: Record<MusicTrackId, MusicTrackMeta> = {
  street_ambient: {
    id: 'street_ambient',
    label: 'Ambient Street Breeze',
    shortLabel: 'Street Breeze',
  },
  qawwali: {
    id: 'qawwali',
    label: 'Traditional Qawwali',
    shortLabel: 'Qawwali',
  },
  sufi_fusion: {
    id: 'sufi_fusion',
    label: 'Upbeat Sufi-Fusion',
    shortLabel: 'Sufi-Fusion',
  },
};

export interface MusicUpdateInput {
  phase: GamePhase;
  landmark: LahoreLandmarkKind;
  speedRatio: number; // 0..1 normalized runner pace
  speedBoostActive: boolean;
  comboStreak: number;
  chronosStrength: number; // 0..1 time dilation
  muted: boolean;
}

// Raag Yaman / Kalyan & Bhupali tonal palettes rooted in D
const STREET_BANSURI = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33];
const QAWWALI_HARMONIUM_PHRASES: readonly number[][] = [
  [293.66, 369.99, 440.0], // D major/open
  [329.63, 415.3, 493.88], // E Yaman Ma# color
  [369.99, 440.0, 554.37], // F#m / C# leading
  [293.66, 440.0, 587.33], // D octave resolve
];
const QAWWALI_LEAD_STEPS = [
  293.66, 0, 329.63, 369.99, 415.3, 0, 440.0, 493.88, 554.37, 0, 587.33, 493.88, 440.0, 369.99,
  329.63, 0,
];
const SUFI_BASS_PATTERN = [
  73.42, 0, 73.42, 0, 110.0, 0, 98.0, 0, 73.42, 0, 82.41, 0, 110.0, 98.0, 82.41, 0,
];
const SUFI_LEAD_PATTERN = [
  587.33, 0, 440.0, 554.37, 587.33, 659.25, 0, 739.99, 659.25, 0, 587.33, 493.88, 440.0, 554.37,
  493.88, 440.0,
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

export class GlobalMusicManager {
  private ctx: AudioContext | null = null;
  private graphReady = false;
  private disposed = false;

  private masterGain: GainNode | null = null;
  private dilationFilter: BiquadFilterNode | null = null;
  private trackGains: Record<MusicTrackId, GainNode> | null = null;
  private droneSources: AudioScheduledSourceNode[] = [];
  private droneNodes: AudioNode[] = [];
  private noiseBuffer: AudioBuffer | null = null;

  private mixWeights: MusicMixState = {
    street_ambient: 1,
    qawwali: 0,
    sufi_fusion: 0,
  };
  private station: RadioStationId = 'auto';
  private lastMuted = false;
  private dominantTrack: MusicTrackId = 'street_ambient';
  private nextStepTime = 0;
  private stepIndex = 0;
  private barIndex = 0;
  private currentTempoBpm = 104;

  public getStation(): RadioStationId {
    return this.station;
  }

  public getStationMeta(): RadioStationMeta {
    return RADIO_STATION_MAP[this.station];
  }

  public setStation(station: RadioStationId, withChime = true): void {
    const changed = this.station !== station;
    this.station = station;
    if (changed && withChime) {
      this.playTuneChime(station);
    }
  }

  public cycleStation(withChime = true): RadioStationId {
    const idx = RADIO_STATIONS.findIndex((s) => s.id === this.station);
    const next = RADIO_STATIONS[(idx + 1) % RADIO_STATIONS.length].id;
    this.setStation(next, withChime);
    return next;
  }

  public getDominantTrack(): MusicTrackId {
    return this.dominantTrack;
  }

  public getDominantTrackMeta(): MusicTrackMeta {
    return MUSIC_TRACK_META[this.dominantTrack];
  }

  public getMixWeights(): MusicMixState {
    return { ...this.mixWeights };
  }

  public update(ctx: AudioContext | null, dt: number, input: MusicUpdateInput): void {
    if (this.disposed) return;

    this.lastMuted = input.muted;
    this.computeTargetMix(input, dt);

    if (!ctx) return;
    if (this.ctx !== ctx || !this.graphReady) {
      this.initGraph(ctx);
    }
    if (!this.graphReady || !this.masterGain || !this.trackGains || !this.dilationFilter) return;

    const now = ctx.currentTime;
    const targetMaster = this.getPhaseMasterVolume(input.phase, input.muted);
    this.masterGain.gain.setTargetAtTime(targetMaster, now, input.muted ? 0.05 : 0.28);

    // Smooth Chronos Crystal low-pass warp on music
    const chrono = Math.max(0, Math.min(1, input.chronosStrength));
    const targetCutoff = 18500 * Math.pow(520 / 18500, chrono);
    this.dilationFilter.frequency.setTargetAtTime(targetCutoff, now, 0.14);

    // Equal-power-like gain curve across the 3 music track buses
    (['street_ambient', 'qawwali', 'sufi_fusion'] as MusicTrackId[]).forEach((id) => {
      const w = this.mixWeights[id];
      const curved = Math.sqrt(Math.max(0, Math.min(1, w)));
      this.trackGains![id].gain.setTargetAtTime(curved, now, 0.42);
    });

    if (input.muted || ctx.state !== 'running') {
      this.nextStepTime = now + 0.08;
      return;
    }

    // Pause pauses melodic groove step progression cleanly without losing position
    if (input.phase === 'paused') {
      this.nextStepTime = now + 0.08;
      return;
    }

    // Adapt tempo smoothly between tracks & selected radio station
    let targetBpm =
      this.mixWeights.street_ambient * 96 +
      this.mixWeights.qawwali * 114 +
      this.mixWeights.sufi_fusion * 136;
    if (this.station === 'lahore_pop') {
      targetBpm = 136 + input.speedRatio * 6;
    } else if (this.station === 'sufi_soul') {
      targetBpm = 112 + input.speedRatio * 8;
    } else if (this.station === 'historical_instrumental') {
      targetBpm = 92 + input.speedRatio * 6;
    }
    const dilatedBpm = targetBpm * (1 - 0.32 * chrono);
    this.currentTempoBpm = lerp(this.currentTempoBpm, dilatedBpm, 1 - Math.exp(-3.5 * dt));

    if (this.nextStepTime < now - 0.25 || this.nextStepTime === 0) {
      this.nextStepTime = now + 0.04;
    }

    const sixteenthDur = 60 / Math.max(60, this.currentTempoBpm) / 4;
    const scheduleHorizon = now + 0.14;

    while (this.nextStepTime < scheduleHorizon) {
      this.scheduleStep(ctx, this.nextStepTime, this.stepIndex, this.barIndex, input.phase);
      this.nextStepTime += sixteenthDur;
      this.stepIndex = (this.stepIndex + 1) % 16;
      if (this.stepIndex === 0) {
        this.barIndex++;
      }
    }
  }

  private getPhaseMasterVolume(phase: GamePhase, muted: boolean): number {
    if (muted) return 0;
    switch (phase) {
      case 'playing':
        return 0.46;
      case 'title':
        return 0.26;
      case 'paused':
      case 'gameover':
        return 0.14;
    }
  }

  private computeTargetMix(input: MusicUpdateInput, dt: number): void {
    let targetStreet = 0;
    let targetQawwali = 0;
    let targetSufi = 0;

    if (this.station === 'sufi_soul') {
      const energy = input.phase === 'playing' ? Math.min(1, input.speedRatio + (input.speedBoostActive ? 0.25 : 0)) : 0.25;
      targetStreet = lerp(0.24, 0.12, energy);
      targetQawwali = lerp(0.76, 0.78, energy);
      targetSufi = input.speedBoostActive || input.comboStreak >= 6 ? 0.1 : 0;
    } else if (this.station === 'lahore_pop') {
      const energy = input.phase === 'playing' ? Math.min(1, input.speedRatio + (input.speedBoostActive ? 0.3 : 0)) : 0.35;
      targetStreet = 0;
      targetQawwali = lerp(0.18, 0.08, energy);
      targetSufi = lerp(0.82, 0.92, energy);
    } else if (this.station === 'historical_instrumental') {
      const energy = input.phase === 'playing' ? input.speedRatio : 0.15;
      targetStreet = lerp(0.88, 0.76, energy);
      targetQawwali = lerp(0.12, 0.24, energy);
      targetSufi = 0;
    } else if (input.phase === 'title') {
      // Gentle scenic crossfade on title screen driven by landmark previewed
      if (input.landmark === 'bazaar' || input.landmark === 'mosque') {
        targetStreet = 0.48;
        targetQawwali = 0.52;
      } else if (input.landmark === 'liberty') {
        targetStreet = 0.55;
        targetQawwali = 0.2;
        targetSufi = 0.25;
      } else {
        targetStreet = 0.85;
        targetQawwali = 0.15;
      }
    } else if (input.phase === 'gameover' || input.phase === 'paused') {
      targetStreet = 0.72;
      targetQawwali = 0.28;
    } else {
      // Dynamic gameplay intensity combining speed progress, Lucky Boost, combo energy, & landmark
      const comboBoost = input.comboStreak >= 4 ? Math.min(0.14, (input.comboStreak - 3) * 0.035) : 0;
      const boostBonus = input.speedBoostActive ? 0.34 : 0;
      const landmarkShift = this.getLandmarkIntensityBias(input.landmark);
      const effectiveIntensity = Math.max(
        0,
        Math.min(1, input.speedRatio + boostBonus + comboBoost + landmarkShift),
      );

      // Heritage landmarks hold Qawwali character slightly longer; Liberty/Minar ignite Sufi-Fusion earlier
      const isQawwaliZone =
        input.landmark === 'bazaar' || input.landmark === 'mosque' || input.landmark === 'gate';
      const isFusionZone = input.landmark === 'liberty' || input.landmark === 'minar';

      if (effectiveIntensity < 0.32) {
        const u = effectiveIntensity / 0.32;
        targetStreet = isQawwaliZone ? lerp(0.68, 0.22, u) : lerp(0.92, 0.35, u);
        targetQawwali = 1 - targetStreet;
        targetSufi = 0;
      } else if (effectiveIntensity < 0.66) {
        const u = (effectiveIntensity - 0.32) / 0.34;
        targetStreet = isQawwaliZone ? lerp(0.22, 0.04, u) : lerp(0.35, 0.06, u);
        targetQawwali = isFusionZone ? lerp(0.62, 0.22, u) : lerp(0.74, 0.42, u);
        targetSufi = Math.max(0, 1 - targetStreet - targetQawwali);
      } else {
        const u = (effectiveIntensity - 0.66) / 0.34;
        targetStreet = 0;
        targetQawwali = isQawwaliZone ? lerp(0.42, 0.18, u) : lerp(0.24, 0.06, u);
        targetSufi = 1 - targetQawwali;
      }
    }

    const total = Math.max(0.0001, targetStreet + targetQawwali + targetSufi);
    targetStreet /= total;
    targetQawwali /= total;
    targetSufi /= total;

    const blendAlpha = 1 - Math.exp(-1.8 * Math.max(0.001, dt));
    this.mixWeights.street_ambient = lerp(this.mixWeights.street_ambient, targetStreet, blendAlpha);
    this.mixWeights.qawwali = lerp(this.mixWeights.qawwali, targetQawwali, blendAlpha);
    this.mixWeights.sufi_fusion = lerp(this.mixWeights.sufi_fusion, targetSufi, blendAlpha);

    if (
      this.mixWeights.sufi_fusion >= this.mixWeights.qawwali &&
      this.mixWeights.sufi_fusion >= this.mixWeights.street_ambient
    ) {
      this.dominantTrack = 'sufi_fusion';
    } else if (this.mixWeights.qawwali >= this.mixWeights.street_ambient) {
      this.dominantTrack = 'qawwali';
    } else {
      this.dominantTrack = 'street_ambient';
    }
  }

  private getLandmarkIntensityBias(landmark: LahoreLandmarkKind): number {
    switch (landmark) {
      case 'gardens':
      case 'canal':
        return -0.1;
      case 'gate':
        return -0.04;
      case 'mosque':
        return 0.06;
      case 'bazaar':
        return 0.12;
      case 'minar':
        return 0.18;
      case 'liberty':
        return 0.26;
    }
  }

  private initGraph(ctx: AudioContext): void {
    this.teardownGraph();
    this.ctx = ctx;
    this.graphReady = true;
    const now = ctx.currentTime;

    const dilationFilter = ctx.createBiquadFilter();
    dilationFilter.type = 'lowpass';
    dilationFilter.frequency.setValueAtTime(18500, now);
    dilationFilter.Q.value = 0.7;
    dilationFilter.connect(ctx.destination);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.connect(dilationFilter);

    const streetGain = ctx.createGain();
    streetGain.gain.setValueAtTime(1, now);
    streetGain.connect(masterGain);

    const qawwaliGain = ctx.createGain();
    qawwaliGain.gain.setValueAtTime(0, now);
    qawwaliGain.connect(masterGain);

    const sufiGain = ctx.createGain();
    sufiGain.gain.setValueAtTime(0, now);
    sufiGain.connect(masterGain);

    // Pre-generate crisp percussion noise buffer (taali claps / fusion shakers)
    const bufLen = Math.floor(ctx.sampleRate * 0.14);
    const nBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const ch = nBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      ch[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = nBuf;

    // Warm resonant D-A tanpura drone on the street_ambient bus
    const droneLowpass = ctx.createBiquadFilter();
    droneLowpass.type = 'lowpass';
    droneLowpass.frequency.setValueAtTime(420, now);
    const droneLevel = ctx.createGain();
    droneLevel.gain.setValueAtTime(0.055, now);
    droneLowpass.connect(droneLevel);
    droneLevel.connect(streetGain);

    const droneFreqs = [73.42, 110.0, 146.83];
    const droneOscs: AudioScheduledSourceNode[] = [];
    droneFreqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, now);
      const voiceGain = ctx.createGain();
      voiceGain.gain.setValueAtTime(idx === 0 ? 0.55 : 0.24, now);
      osc.connect(voiceGain);
      voiceGain.connect(droneLowpass);
      osc.start(now);
      droneOscs.push(osc);
      this.droneNodes.push(voiceGain);
    });

    this.masterGain = masterGain;
    this.dilationFilter = dilationFilter;
    this.trackGains = {
      street_ambient: streetGain,
      qawwali: qawwaliGain,
      sufi_fusion: sufiGain,
    };
    this.droneSources = droneOscs;
    this.droneNodes.push(droneLowpass, droneLevel);
    this.nextStepTime = now + 0.05;
  }

  private scheduleStep(
    ctx: AudioContext,
    t: number,
    step: number,
    bar: number,
    phase: GamePhase,
  ): void {
    if (!this.trackGains) return;

    // 1. Ambient Street Breeze / Historical Instrumental (bansuri & rabab pluck motifs)
    if (this.mixWeights.street_ambient > 0.04) {
      const streetBus = this.trackGains.street_ambient;
      if (step === 0 || step === 6 || step === 11 || (this.station === 'historical_instrumental' && step === 9)) {
        const noteIdx = (bar * 3 + step) % STREET_BANSURI.length;
        this.triggerBansuriNote(ctx, streetBus, t, STREET_BANSURI[noteIdx], step === 0 ? 0.58 : 0.36);
      }
      if (
        step === 4 ||
        step === 12 ||
        (this.station === 'historical_instrumental' && (step === 2 || step === 8 || step === 14))
      ) {
        const pluckFreq = STREET_BANSURI[(bar + step) % STREET_BANSURI.length] * (step === 14 ? 1 : 0.5);
        this.triggerPluck(ctx, streetBus, t, pluckFreq, 0.068, 0.28);
      }
    }

    // 2. Traditional Qawwali / Sufi Soul (harmonium chords, tabla groove, & taali handclaps)
    if (this.mixWeights.qawwali > 0.04) {
      const qawwaliBus = this.trackGains.qawwali;
      if (step === 0 || step === 8) {
        const chord = QAWWALI_HARMONIUM_PHRASES[(bar + (step === 8 ? 1 : 0)) % QAWWALI_HARMONIUM_PHRASES.length];
        this.triggerHarmoniumChord(ctx, qawwaliBus, t, chord, 0.62);
      }
      const leadFreq = QAWWALI_LEAD_STEPS[step];
      if (leadFreq > 0 && (phase === 'playing' || this.station === 'sufi_soul')) {
        this.triggerHarmoniumNote(ctx, qawwaliBus, t, leadFreq, 0.22);
      }
      // Tabla bass & treble pattern + Qawwali taali claps on beats 2 & 4 (steps 4, 12)
      if (step === 0 || step === 6 || step === 10) {
        this.triggerTablaBass(ctx, qawwaliBus, t, step === 0 ? 0.14 : 0.09);
      }
      if (step === 2 || step === 4 || step === 8 || step === 12 || step === 14) {
        this.triggerTablaTreble(ctx, qawwaliBus, t, step % 4 === 0 ? 0.08 : 0.05);
      }
      if (
        this.station !== 'historical_instrumental' &&
        (step === 4 || step === 12 || (bar % 2 === 1 && step === 14))
      ) {
        this.triggerTaaliClap(ctx, qawwaliBus, t, this.station === 'sufi_soul' ? 0.09 : 0.075);
      }
    }

    // 3. Upbeat Sufi-Fusion / Modern Lahore Pop (driving dholak + punchy bass + electric tumbi/pop hook)
    if (this.mixWeights.sufi_fusion > 0.04) {
      const sufiBus = this.trackGains.sufi_fusion;
      // Four-on-the-floor dholak/kick pulse on 0, 4, 8, 12 + syncopation on 10
      if (step % 4 === 0 || step === 10) {
        this.triggerFusionKick(ctx, sufiBus, t, step % 4 === 0 ? 0.19 : 0.12);
      }
      // Crisp snare/clap & fusion shaker hi-hat
      if (step === 4 || step === 12) {
        this.triggerTaaliClap(ctx, sufiBus, t, 0.095);
      }
      if (step % 2 === 1) {
        this.triggerFusionHiHat(ctx, sufiBus, t, this.station === 'lahore_pop' ? 0.042 : 0.032);
      }
      // Driving sub-bass line
      const bassFreq = SUFI_BASS_PATTERN[step];
      if (bassFreq > 0) {
        this.triggerFusionBass(ctx, sufiBus, t, bassFreq, 0.15);
      }
      // Soaring Sufi-fusion / Modern Lahore Pop lead hook
      const riffFreq = SUFI_LEAD_PATTERN[step];
      if (riffFreq > 0) {
        this.triggerPluck(ctx, sufiBus, t, riffFreq, this.station === 'lahore_pop' ? 0.11 : 0.095, 0.22);
      }
      if (this.station === 'lahore_pop' && (step === 2 || step === 10)) {
        const octavePop = SUFI_LEAD_PATTERN[(step + 2) % SUFI_LEAD_PATTERN.length] || 587.33;
        this.triggerPluck(ctx, sufiBus, t, octavePop * 1.5, 0.055, 0.16);
      }
    }
  }

  private playTuneChime(station: RadioStationId): void {
    const ctx = this.ctx;
    if (!ctx || this.disposed || this.lastMuted || ctx.state !== 'running' || !this.masterGain) return;
    const now = ctx.currentTime;
    const baseFreq =
      station === 'sufi_soul'
        ? 440
        : station === 'lahore_pop'
          ? 587.33
          : station === 'historical_instrumental'
            ? 369.99
            : 493.88;

    [baseFreq, baseFreq * 1.25].forEach((freq, idx) => {
      const start = now + idx * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.16, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  }

  private triggerBansuriNote(
    ctx: AudioContext,
    dest: AudioNode,
    t: number,
    freq: number,
    dur: number,
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 0.98, t);
    osc.frequency.linearRampToValueAtTime(freq, t + 0.09);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.065, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  private triggerPluck(
    ctx: AudioContext,
    dest: AudioNode,
    t: number,
    freq: number,
    peakGain: number,
    dur: number,
  ): void {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2800, t);
    filter.frequency.exponentialRampToValueAtTime(640, t + dur);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peakGain, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private triggerHarmoniumChord(
    ctx: AudioContext,
    dest: AudioNode,
    t: number,
    freqs: readonly number[],
    dur: number,
  ): void {
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(740, t);
    filter.Q.value = 0.9;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.052, t + 0.06);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    filter.connect(env);
    env.connect(dest);

    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f * 0.5, t);
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + dur + 0.03);
    }
  }

  private triggerHarmoniumNote(
    ctx: AudioContext,
    dest: AudioNode,
    t: number,
    freq: number,
    dur: number,
  ): void {
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);

    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1450, t);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.048, t + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(lp);
    lp.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private triggerTablaBass(ctx: AudioContext, dest: AudioNode, t: number, level: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(128, t);
    osc.frequency.exponentialRampToValueAtTime(68, t + 0.14);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(level, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  private triggerTablaTreble(ctx: AudioContext, dest: AudioNode, t: number, level: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(275, t + 0.07);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(level, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  private triggerTaaliClap(ctx: AudioContext, dest: AudioNode, t: number, level: number): void {
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1550, t);
    bp.Q.value = 1.3;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(level, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

    src.connect(bp);
    bp.connect(gain);
    gain.connect(dest);
    src.start(t);
    src.stop(t + 0.11);
  }

  private triggerFusionKick(ctx: AudioContext, dest: AudioNode, t: number, level: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.11);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(level, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  private triggerFusionHiHat(ctx: AudioContext, dest: AudioNode, t: number, level: number): void {
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(5200, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(level, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);

    src.connect(hp);
    hp.connect(gain);
    gain.connect(dest);
    src.start(t);
    src.stop(t + 0.05);
  }

  private triggerFusionBass(
    ctx: AudioContext,
    dest: AudioNode,
    t: number,
    freq: number,
    dur: number,
  ): void {
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);

    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(340, t);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.11, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(lp);
    lp.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private teardownGraph(): void {
    for (const src of this.droneSources) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // already stopped
      }
    }
    this.droneSources = [];
    for (const node of this.droneNodes) {
      try {
        node.disconnect();
      } catch {
        // ignore
      }
    }
    this.droneNodes = [];
    if (this.trackGains) {
      (['street_ambient', 'qawwali', 'sufi_fusion'] as MusicTrackId[]).forEach((id) => {
        try {
          this.trackGains![id].disconnect();
        } catch {
          // ignore
        }
      });
      this.trackGains = null;
    }
    if (this.masterGain) {
      try {
        this.masterGain.disconnect();
      } catch {
        // ignore
      }
      this.masterGain = null;
    }
    if (this.dilationFilter) {
      try {
        this.dilationFilter.disconnect();
      } catch {
        // ignore
      }
      this.dilationFilter = null;
    }
    this.noiseBuffer = null;
    this.graphReady = false;
  }

  public dispose(): void {
    this.disposed = true;
    this.teardownGraph();
    this.ctx = null;
  }
}
