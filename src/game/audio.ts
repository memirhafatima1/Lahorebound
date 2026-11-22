import type { BiomeId, GamePhase, LahoreLandmarkKind, WeatherCondition } from './types';

const PENTATONIC_RATIOS = [1, 1.125, 1.25, 1.5, 1.667, 2, 2.25, 2.5];

// Raag Bhupali / Yaman warm frequencies for Lahore atmospheric accents
const BANSURI_NOTES = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33];
const SITAR_NOTES = [369.99, 440.0, 493.88, 587.33, 659.25];

const COMBO_VOICEOVER_POOLS: Record<number, readonly string[]> = {
  2: ['Nice Move!', 'Clean Flow!'],
  3: ['Amazing!', 'On Fire!'],
  4: ['Super Stride!', 'Lahore Lightning!'],
  5: ['Unstoppable!', 'Street Legend!'],
  6: ['Incredible!', 'Skybound Fury!'],
  7: ['Phenomenal!', 'Pure Mastery!'],
  8: ['Maximum Stride!', 'Supreme Champion!'],
};

export function pickComboVoiceoverPhrase(combo: number): string | null {
  const pool = COMBO_VOICEOVER_POOLS[combo];
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

interface BiomeAmbientChannel {
  gain: GainNode;
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
}

export class GameAudio {
  private ctx: AudioContext | null = null;
  private muted = false;
  private gemStreak = 0;
  private lastGemTime = 0;

  // Dynamic ambient system state
  private ambientReady = false;
  private ambientMasterGain: GainNode | null = null;
  private ambientDilationFilter: BiquadFilterNode | null = null;
  private speedBreezeGain: GainNode | null = null;
  private speedBreezeFilter: BiquadFilterNode | null = null;
  private rainBedGain: GainNode | null = null;
  private rainBedSources: AudioScheduledSourceNode[] = [];
  private rainBedNodes: AudioNode[] = [];
  private ambientChannels: Record<BiomeId, BiomeAmbientChannel> | null = null;
  private whiteNoiseBuffer: AudioBuffer | null = null;
  private currentBiome: BiomeId = 'canyon';
  private currentLandmark: LahoreLandmarkKind = 'gate';
  private currentWeather: WeatherCondition = 'sunny_haze';
  private currentPhase: GamePhase = 'title';
  private accentCooldown = 1.6;
  private disposed = false;

  // Dynamic voiceover state
  private preferredVoice: SpeechSynthesisVoice | null = null;
  private lastVoiceoverTime = 0;
  private handleVoicesChangedBound: (() => void) | null = null;

  constructor(muted = false) {
    this.muted = muted;
    this.initVoices();
  }

  private initVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const selectVoice = () => {
      try {
        const voices = window.speechSynthesis.getVoices();
        if (!voices || voices.length === 0) return;
        const englishVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
        const pool = englishVoices.length > 0 ? englishVoices : voices;
        this.preferredVoice =
          pool.find((v) => /google|natural|neural|samantha|daniel|aria|jenny|rishi/i.test(v.name)) ||
          pool[0];
      } catch {
        // ignore sandboxed speechSynthesis errors
      }
    };
    selectVoice();
    this.handleVoicesChangedBound = selectVoice;
    try {
      window.speechSynthesis.addEventListener?.('voiceschanged', selectVoice);
    } catch {
      // ignore
    }
  }

  public stopVoiceover(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.stopVoiceover();
    }
    if (this.ctx && this.ambientMasterGain) {
      const now = this.ctx.currentTime;
      const target = muted ? 0 : this.getPhaseAmbientLevel(this.currentPhase);
      this.ambientMasterGain.gain.cancelScheduledValues(now);
      this.ambientMasterGain.gain.setTargetAtTime(target, now, 0.06);
    }
    if (!muted) {
      this.ensureCtx();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public getContext(): AudioContext | null {
    return this.ctx;
  }

  private getPhaseAmbientLevel(phase: GamePhase): number {
    switch (phase) {
      case 'playing':
        return 1.0;
      case 'title':
        return 0.45;
      case 'paused':
      case 'gameover':
        return 0.24;
    }
  }

  private ensureCtx(): AudioContext | null {
    if (this.disposed || this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    if (this.ctx && !this.ambientReady) {
      this.initAmbientGraph(this.ctx);
    }
    return this.ctx;
  }

  public unlock(): void {
    const ctx = this.ensureCtx();
    if (ctx && this.ambientMasterGain && !this.muted) {
      const now = ctx.currentTime;
      this.ambientMasterGain.gain.setTargetAtTime(
        this.getPhaseAmbientLevel(this.currentPhase),
        now,
        0.25,
      );
    }
  }

  public setAmbientBiome(biome: BiomeId): void {
    if (this.currentBiome === biome) return;
    this.currentBiome = biome;
    this.accentCooldown = Math.min(this.accentCooldown, 1.1);

    if (!this.ctx || !this.ambientChannels) return;
    const now = this.ctx.currentTime;
    (['canyon', 'skybridge', 'obsidian'] as BiomeId[]).forEach((id) => {
      const ch = this.ambientChannels![id];
      ch.gain.gain.cancelScheduledValues(now);
      ch.gain.gain.setTargetAtTime(id === biome ? 1.0 : 0.0, now, 0.48);
    });
  }

  public setAmbientLandmark(landmark: LahoreLandmarkKind, playEntryClip = false): void {
    const changed = this.currentLandmark !== landmark;
    this.currentLandmark = landmark;
    if (!changed) return;

    // Enter right after any landmark arrival chime fades, or immediately if requested
    if (playEntryClip && this.ctx && this.ambientReady && !this.muted && this.ctx.state === 'running') {
      this.triggerLandmarkAmbientClip(landmark, true);
      this.accentCooldown = this.getLandmarkClipInterval(landmark);
    } else {
      this.accentCooldown = 0.48;
    }
  }

  public setAmbientWeather(weather: WeatherCondition): void {
    this.currentWeather = weather;
    if (!this.ctx || !this.rainBedGain) return;
    const now = this.ctx.currentTime;
    const targetGain = weather === 'light_rain' ? 0.056 : 0;
    this.rainBedGain.gain.cancelScheduledValues(now);
    this.rainBedGain.gain.setTargetAtTime(targetGain, now, 0.55);
  }

  private getLandmarkClipInterval(landmark: LahoreLandmarkKind): number {
    switch (landmark) {
      case 'bazaar':
        return 1.65 + Math.random() * 1.45; // lively bustling market cadence
      case 'gardens':
        return 1.85 + Math.random() * 1.65; // tranquil birdsong & fountains
      case 'liberty':
        return 1.9 + Math.random() * 1.7;
      case 'canal':
        return 2.1 + Math.random() * 1.8;
      case 'minar':
        return 2.3 + Math.random() * 1.9;
      case 'mosque':
        return 2.6 + Math.random() * 2.1; // spacious reverent courtyard resonance
      case 'gate':
      default:
        return 2.2 + Math.random() * 1.9;
    }
  }

  public setTimeDilation(intensity: number): void {
    if (!this.ctx || !this.ambientDilationFilter) return;
    const clamped = Math.max(0, Math.min(1, intensity));
    const now = this.ctx.currentTime;
    const targetFreq = 18000 * Math.pow(620 / 18000, clamped);
    this.ambientDilationFilter.frequency.setTargetAtTime(targetFreq, now, 0.14);
  }

  public updateAmbient(dt: number, phase: GamePhase, speedRatio: number): void {
    if (this.disposed) return;

    const phaseChanged = phase !== this.currentPhase;
    this.currentPhase = phase;

    if (!this.ctx || !this.ambientReady || !this.ambientMasterGain) return;
    const now = this.ctx.currentTime;

    if (phaseChanged) {
      const target = this.muted ? 0 : this.getPhaseAmbientLevel(phase);
      this.ambientMasterGain.gain.cancelScheduledValues(now);
      this.ambientMasterGain.gain.setTargetAtTime(target, now, 0.16);
    }

    if (this.muted || this.ctx.state !== 'running') return;

    // Speed-responsive city wind layer (audible as pace builds during gameplay)
    if (this.speedBreezeGain && this.speedBreezeFilter) {
      const activeSpeed = phase === 'playing' ? Math.max(0, Math.min(1, speedRatio)) : 0;
      const targetWindGain = activeSpeed > 0.08 ? activeSpeed * 0.045 : 0;
      const targetWindFreq = 420 + activeSpeed * 980;
      this.speedBreezeGain.gain.setTargetAtTime(targetWindGain, now, 0.18);
      this.speedBreezeFilter.frequency.setTargetAtTime(targetWindFreq, now, 0.18);
    }

    // Periodic landmark-unique ambient sound clips
    if (phase === 'paused') return;
    const rate = phase === 'title' ? 0.6 : 1.0;
    this.accentCooldown -= dt * rate;
    if (this.accentCooldown <= 0) {
      this.triggerLandmarkAmbientClip(this.currentLandmark, false);
      this.accentCooldown = this.getLandmarkClipInterval(this.currentLandmark);
    }
  }

  private createSeamlessPinkNoiseBuffer(ctx: AudioContext, seconds = 3.0): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;

    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
      data[i] = pink;
    }

    // Crossfade edges over 80ms so the loop never clicks
    const fadeSamples = Math.min(Math.floor(ctx.sampleRate * 0.08), Math.floor(length / 4));
    for (let i = 0; i < fadeSamples; i++) {
      const t = i / fadeSamples;
      const tailIdx = length - fadeSamples + i;
      const blended = data[i] * t + data[tailIdx] * (1 - t);
      data[i] = blended;
      data[tailIdx] = blended;
    }
    return buffer;
  }

  private createWhiteNoiseBuffer(ctx: AudioContext, seconds = 1.6): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private initAmbientGraph(ctx: AudioContext): void {
    this.ambientReady = true;
    const now = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0, now);
    master.gain.setTargetAtTime(
      this.muted ? 0 : this.getPhaseAmbientLevel(this.currentPhase),
      now,
      0.35,
    );

    const dilationFilter = ctx.createBiquadFilter();
    dilationFilter.type = 'lowpass';
    dilationFilter.frequency.setValueAtTime(18000, now);
    dilationFilter.Q.value = 0.7;

    master.connect(dilationFilter);
    dilationFilter.connect(ctx.destination);
    this.ambientMasterGain = master;
    this.ambientDilationFilter = dilationFilter;

    const pinkBuf = this.createSeamlessPinkNoiseBuffer(ctx, 3.2);
    this.whiteNoiseBuffer = this.createWhiteNoiseBuffer(ctx, 1.5);

    // Dynamic speed breeze routed through ambientMasterGain
    const breezeSrc = ctx.createBufferSource();
    breezeSrc.buffer = pinkBuf;
    breezeSrc.loop = true;

    const breezeFilter = ctx.createBiquadFilter();
    breezeFilter.type = 'bandpass';
    breezeFilter.frequency.setValueAtTime(480, now);
    breezeFilter.Q.value = 0.85;

    const breezeGain = ctx.createGain();
    breezeGain.gain.setValueAtTime(0, now);

    breezeSrc.connect(breezeFilter);
    breezeFilter.connect(breezeGain);
    breezeGain.connect(master);
    breezeSrc.start(now);

    this.speedBreezeFilter = breezeFilter;
    this.speedBreezeGain = breezeGain;

    // 1. Androon Lahore ('canyon') — warm walled-city street murmur & alley resonance
    const canyonGain = ctx.createGain();
    canyonGain.gain.setValueAtTime(this.currentBiome === 'canyon' ? 1 : 0, now);
    canyonGain.connect(master);

    const canyonSrc = ctx.createBufferSource();
    canyonSrc.buffer = pinkBuf;
    canyonSrc.loop = true;

    const canyonBand = ctx.createBiquadFilter();
    canyonBand.type = 'bandpass';
    canyonBand.frequency.setValueAtTime(320, now);
    canyonBand.Q.value = 0.75;

    const canyonLowpass = ctx.createBiquadFilter();
    canyonLowpass.type = 'lowpass';
    canyonLowpass.frequency.setValueAtTime(980, now);

    const canyonBedLevel = ctx.createGain();
    canyonBedLevel.gain.setValueAtTime(0.085, now);

    const canyonLfo = ctx.createOscillator();
    canyonLfo.type = 'sine';
    canyonLfo.frequency.setValueAtTime(0.14, now);
    const canyonLfoDepth = ctx.createGain();
    canyonLfoDepth.gain.setValueAtTime(75, now);
    canyonLfo.connect(canyonLfoDepth);
    canyonLfoDepth.connect(canyonBand.frequency);

    canyonSrc.connect(canyonBand);
    canyonBand.connect(canyonLowpass);
    canyonLowpass.connect(canyonBedLevel);
    canyonBedLevel.connect(canyonGain);
    canyonSrc.start(now);
    canyonLfo.start(now);

    // 2. Canal Road & Mall Flyover ('skybridge') — open breeze & shimmering canal water flow
    const skyGain = ctx.createGain();
    skyGain.gain.setValueAtTime(this.currentBiome === 'skybridge' ? 1 : 0, now);
    skyGain.connect(master);

    const skyWindSrc = ctx.createBufferSource();
    skyWindSrc.buffer = pinkBuf;
    skyWindSrc.loop = true;

    const skyBand = ctx.createBiquadFilter();
    skyBand.type = 'bandpass';
    skyBand.frequency.setValueAtTime(640, now);
    skyBand.Q.value = 0.65;

    const skyBedLevel = ctx.createGain();
    skyBedLevel.gain.setValueAtTime(0.068, now);

    const skyLfo = ctx.createOscillator();
    skyLfo.type = 'sine';
    skyLfo.frequency.setValueAtTime(0.19, now);
    const skyLfoDepth = ctx.createGain();
    skyLfoDepth.gain.setValueAtTime(160, now);
    skyLfo.connect(skyLfoDepth);
    skyLfoDepth.connect(skyBand.frequency);

    // Subtle canal water sheen
    const waterSrc = ctx.createBufferSource();
    waterSrc.buffer = pinkBuf;
    waterSrc.loop = true;
    waterSrc.playbackRate.setValueAtTime(1.18, now);

    const waterHigh = ctx.createBiquadFilter();
    waterHigh.type = 'bandpass';
    waterHigh.frequency.setValueAtTime(2150, now);
    waterHigh.Q.value = 0.9;

    const waterLevel = ctx.createGain();
    waterLevel.gain.setValueAtTime(0.028, now);

    skyWindSrc.connect(skyBand);
    skyBand.connect(skyBedLevel);
    skyBedLevel.connect(skyGain);
    waterSrc.connect(waterHigh);
    waterHigh.connect(waterLevel);
    waterLevel.connect(skyGain);
    skyWindSrc.start(now);
    waterSrc.start(now);
    skyLfo.start(now);

    // 3. Food Street & Liberty Nights ('obsidian') — warm night bazaar hum & subtle street-grill sizzle
    const nightGain = ctx.createGain();
    nightGain.gain.setValueAtTime(this.currentBiome === 'obsidian' ? 1 : 0, now);
    nightGain.connect(master);

    const nightBedSrc = ctx.createBufferSource();
    nightBedSrc.buffer = pinkBuf;
    nightBedSrc.loop = true;
    nightBedSrc.playbackRate.setValueAtTime(0.86, now);

    const nightLow = ctx.createBiquadFilter();
    nightLow.type = 'lowpass';
    nightLow.frequency.setValueAtTime(420, now);

    const nightBedLevel = ctx.createGain();
    nightBedLevel.gain.setValueAtTime(0.088, now);

    const sizzleSrc = ctx.createBufferSource();
    sizzleSrc.buffer = pinkBuf;
    sizzleSrc.loop = true;
    sizzleSrc.playbackRate.setValueAtTime(1.35, now);

    const sizzleHigh = ctx.createBiquadFilter();
    sizzleHigh.type = 'highpass';
    sizzleHigh.frequency.setValueAtTime(3400, now);

    const sizzleLevel = ctx.createGain();
    sizzleLevel.gain.setValueAtTime(0.018, now);

    const sizzleLfo = ctx.createOscillator();
    sizzleLfo.type = 'sine';
    sizzleLfo.frequency.setValueAtTime(0.32, now);
    const sizzleLfoDepth = ctx.createGain();
    sizzleLfoDepth.gain.setValueAtTime(0.009, now);
    sizzleLfo.connect(sizzleLfoDepth);
    sizzleLfoDepth.connect(sizzleLevel.gain);

    nightBedSrc.connect(nightLow);
    nightLow.connect(nightBedLevel);
    nightBedLevel.connect(nightGain);
    sizzleSrc.connect(sizzleHigh);
    sizzleHigh.connect(sizzleLevel);
    sizzleLevel.connect(nightGain);
    nightBedSrc.start(now);
    sizzleSrc.start(now);
    sizzleLfo.start(now);

    // 4. Weather rainfall ambience bed (active during light_rain)
    const rainBedGain = ctx.createGain();
    rainBedGain.gain.setValueAtTime(this.currentWeather === 'light_rain' ? 0.056 : 0, now);
    rainBedGain.connect(master);

    const rainSrcA = ctx.createBufferSource();
    rainSrcA.buffer = pinkBuf;
    rainSrcA.loop = true;
    rainSrcA.playbackRate.setValueAtTime(1.42, now);

    const rainBand = ctx.createBiquadFilter();
    rainBand.type = 'bandpass';
    rainBand.frequency.setValueAtTime(1750, now);
    rainBand.Q.value = 0.65;

    const rainHigh = ctx.createBiquadFilter();
    rainHigh.type = 'highpass';
    rainHigh.frequency.setValueAtTime(520, now);

    rainSrcA.connect(rainBand);
    rainBand.connect(rainHigh);
    rainHigh.connect(rainBedGain);
    rainSrcA.start(now);

    this.rainBedGain = rainBedGain;
    this.rainBedSources = [rainSrcA];
    this.rainBedNodes = [rainBand, rainHigh, rainBedGain];

    this.ambientChannels = {
      canyon: {
        gain: canyonGain,
        sources: [canyonSrc, canyonLfo, breezeSrc],
        nodes: [canyonBand, canyonLowpass, canyonBedLevel, canyonLfoDepth, breezeFilter, breezeGain],
      },
      skybridge: {
        gain: skyGain,
        sources: [skyWindSrc, waterSrc, skyLfo],
        nodes: [skyBand, skyBedLevel, skyLfoDepth, waterHigh, waterLevel],
      },
      obsidian: {
        gain: nightGain,
        sources: [nightBedSrc, sizzleSrc, sizzleLfo],
        nodes: [nightLow, nightBedLevel, sizzleHigh, sizzleLevel, sizzleLfoDepth],
      },
    };
  }

  private connectWithRandomPan(
    ctx: AudioContext,
    node: AudioNode,
    master: AudioNode,
    panSpread = 0.55,
  ): void {
    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime((Math.random() * 2 - 1) * panSpread, ctx.currentTime);
      node.connect(panner);
      panner.connect(master);
    } else {
      node.connect(master);
    }
  }

  private playGardenBirdsong(
    ctx: AudioContext,
    master: AudioNode,
    now: number,
    richTrill = true,
  ): void {
    const birdCount = richTrill ? 3 + Math.floor(Math.random() * 2) : 2;
    const baseFreq = 2150 + Math.random() * 950;
    const out = ctx.createGain();
    out.gain.setValueAtTime(1, now);
    this.connectWithRandomPan(ctx, out, master, 0.65);

    for (let i = 0; i < birdCount; i++) {
      const t = now + i * (0.095 + Math.random() * 0.05);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const startF = baseFreq + (i % 2 === 0 ? 140 : -90) + Math.random() * 180;
      const peakF = startF * (1.22 + Math.random() * 0.22);
      osc.frequency.setValueAtTime(startF, t);
      osc.frequency.exponentialRampToValueAtTime(peakF, t + 0.045);
      if (richTrill) {
        osc.frequency.exponentialRampToValueAtTime(startF * 1.08, t + 0.09);
      }

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(richTrill ? 0.02 : 0.014, t + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + (richTrill ? 0.105 : 0.08));
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.12);
    }
  }

  private playMarketBustle(ctx: AudioContext, master: AudioNode, now: number): void {
    if (!this.whiteNoiseBuffer) return;
    // Layered speech-band chatter syllables simulating bustling Anarkali Bazaar crowds
    const bursts = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < bursts; i++) {
      const t = now + i * (0.14 + Math.random() * 0.09);
      const src = ctx.createBufferSource();
      src.buffer = this.whiteNoiseBuffer;
      src.playbackRate.setValueAtTime(0.85 + Math.random() * 0.35, t);

      const formant = ctx.createBiquadFilter();
      formant.type = 'bandpass';
      formant.frequency.setValueAtTime(620 + Math.random() * 780, t);
      formant.Q.value = 3.2;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.032, t + 0.045);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);

      src.connect(formant);
      formant.connect(gain);
      this.connectWithRandomPan(ctx, gain, master, 0.72);
      src.start(t);
      src.stop(t + 0.26);
    }
  }

  private playFountainSplash(
    ctx: AudioContext,
    master: AudioNode,
    now: number,
    centerFreq = 2400,
    duration = 1.15,
  ): void {
    if (!this.whiteNoiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.whiteNoiseBuffer;
    src.playbackRate.setValueAtTime(1.12, now);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(centerFreq, now);
    bp.frequency.linearRampToValueAtTime(centerFreq * 1.25, now + duration * 0.45);
    bp.frequency.linearRampToValueAtTime(centerFreq * 0.88, now + duration);
    bp.Q.value = 0.85;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.026, now + 0.22);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(bp);
    bp.connect(gain);
    this.connectWithRandomPan(ctx, gain, master, 0.45);
    src.start(now);
    src.stop(now + duration + 0.04);
  }

  private triggerLandmarkAmbientClip(landmark: LahoreLandmarkKind, isArrival: boolean): void {
    const ctx = this.ctx;
    const master = this.ambientMasterGain;
    if (!ctx || !master || this.muted) return;
    const now = ctx.currentTime;
    const roll = Math.random();

    switch (landmark) {
      case 'gate': {
        // Delhi Gate: Old Walled City sandstone archway echo, street rickshaw horn, & rooftop bansuri
        if (isArrival || roll < 0.36) {
          // Warm rooftop bansuri flute phrase echoing inside the gate alley
          const base = BANSURI_NOTES[Math.floor(Math.random() * BANSURI_NOTES.length)];
          [0, 0.26].forEach((offset, idx) => {
            const t = now + offset;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            const f = idx === 0 ? base : base * 1.125;
            osc.frequency.setValueAtTime(f * 0.985, t);
            osc.frequency.linearRampToValueAtTime(f, t + 0.14);
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.linearRampToValueAtTime(0.02, t + 0.14);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.68);
            osc.connect(gain);
            this.connectWithRandomPan(ctx, gain, master, 0.4);
            osc.start(t);
            osc.stop(t + 0.72);
          });
        } else if (roll < 0.72) {
          // Distant Lahore auto-rickshaw double-chirp horn in Walled City traffic
          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(920, now);
          filter.Q.value = 2.0;
          this.connectWithRandomPan(ctx, filter, master, 0.6);

          [0, 0.14].forEach((offset, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const t = now + offset;
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(idx === 0 ? 415 : 495, t);
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.linearRampToValueAtTime(0.017, t + 0.018);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
            osc.connect(gain);
            gain.connect(filter);
            osc.start(t);
            osc.stop(t + 0.11);
          });
        } else if (this.whiteNoiseBuffer) {
          // Ancient wooden gate creak & archway breeze
          const osc = ctx.createOscillator();
          const bp = ctx.createBiquadFilter();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(118, now);
          osc.frequency.linearRampToValueAtTime(92, now + 0.45);
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(340, now);
          bp.Q.value = 4.2;
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(0.014, now + 0.12);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
          osc.connect(bp);
          bp.connect(gain);
          this.connectWithRandomPan(ctx, gain, master, 0.45);
          osc.start(now);
          osc.stop(now + 0.5);
        }
        return;
      }

      case 'bazaar': {
        // Anarkali Bazaar: Bustling market crowd noise, vendor brass bells, and chai-cup clinks
        if (isArrival || roll < 0.52) {
          this.playMarketBustle(ctx, master, now);
        }
        if (roll >= 0.35 && roll < 0.78) {
          // Brass cart / bicycle vendor double bell
          [0, 0.12].forEach((offset) => {
            const t = now + offset;
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();
            osc1.type = 'sine';
            osc2.type = 'triangle';
            osc1.frequency.setValueAtTime(1568, t);
            osc2.frequency.setValueAtTime(2349, t);
            gain.gain.setValueAtTime(0.016, t);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
            osc1.connect(gain);
            osc2.connect(gain);
            this.connectWithRandomPan(ctx, gain, master, 0.65);
            osc1.start(t);
            osc2.start(t);
            osc1.stop(t + 0.24);
            osc2.stop(t + 0.24);
          });
        } else if (roll >= 0.78) {
          // Roadside chai stall glass & spoon clink
          [0, 0.085, 0.19].forEach((offset, idx) => {
            const t = now + offset;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(2950 + idx * 320, t);
            gain.gain.setValueAtTime(0.012, t);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);
            osc.connect(gain);
            this.connectWithRandomPan(ctx, gain, master, 0.6);
            osc.start(t);
            osc.stop(t + 0.085);
          });
        }
        return;
      }

      case 'mosque': {
        // Badshahi Mosque: Reverent marble courtyard harmonic swell, fluttering pigeons, & quiet sitar
        if (isArrival || roll < 0.44) {
          // Spacious sandstone courtyard harmonic swell (warm fifth resonance)
          const freqs = [196.0, 293.66, 392.0];
          freqs.forEach((f, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = idx === 0 ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime(f, now);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.linearRampToValueAtTime(idx === 0 ? 0.016 : 0.009, now + 0.35);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.45);
            osc.connect(gain);
            gain.connect(master);
            osc.start(now);
            osc.stop(now + 1.5);
          });
        } else if (roll < 0.76 && this.whiteNoiseBuffer) {
          // Soft fluttering courtyard pigeon wing-beats
          for (let i = 0; i < 4; i++) {
            const t = now + i * 0.075;
            const src = ctx.createBufferSource();
            src.buffer = this.whiteNoiseBuffer;
            const lp = ctx.createBiquadFilter();
            lp.type = 'bandpass';
            lp.frequency.setValueAtTime(480 + i * 70, t);
            lp.Q.value = 1.6;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.linearRampToValueAtTime(0.022, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.068);
            src.connect(lp);
            lp.connect(gain);
            this.connectWithRandomPan(ctx, gain, master, 0.7);
            src.start(t);
            src.stop(t + 0.075);
          }
        } else {
          // Reverent acoustic sitar note
          const note = SITAR_NOTES[Math.floor(Math.random() * SITAR_NOTES.length)];
          const osc = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(note * 0.75, now);
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(1900, now);
          filter.frequency.exponentialRampToValueAtTime(520, now + 0.85);
          gain.gain.setValueAtTime(0.018, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(master);
          osc.start(now);
          osc.stop(now + 0.95);
        }
        return;
      }

      case 'minar': {
        // Minar-e-Pakistan: Greater Iqbal Park gusts, park birds, & festive dhol pulse
        if (isArrival || roll < 0.42) {
          if (this.whiteNoiseBuffer) {
            // Sweeping park wind & flagpole flutter
            const src = ctx.createBufferSource();
            src.buffer = this.whiteNoiseBuffer;
            const bp = ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.Q.value = 1.2;
            bp.frequency.setValueAtTime(280, now);
            bp.frequency.exponentialRampToValueAtTime(760, now + 0.5);
            bp.frequency.exponentialRampToValueAtTime(240, now + 1.2);
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.linearRampToValueAtTime(0.028, now + 0.42);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.25);
            src.connect(bp);
            bp.connect(gain);
            gain.connect(master);
            src.start(now);
            src.stop(now + 1.3);
          }
        }
        if (roll >= 0.35 && roll < 0.72) {
          this.playGardenBirdsong(ctx, master, now, false);
        } else if (roll >= 0.72) {
          // Distant celebratory park dholak beat
          [0, 0.16, 0.32].forEach((offset, idx) => {
            const t = now + offset;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(idx === 1 ? 230 : 124, t);
            osc.frequency.exponentialRampToValueAtTime(idx === 1 ? 170 : 78, t + 0.11);
            gain.gain.setValueAtTime(0.022, t);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
            osc.connect(gain);
            this.connectWithRandomPan(ctx, gain, master, 0.4);
            osc.start(t);
            osc.stop(t + 0.14);
          });
        }
        return;
      }

      case 'gardens': {
        // Shalimar Gardens: Tranquil garden birdsong & terraced marble fountain cascades
        if (isArrival || roll < 0.64) {
          this.playGardenBirdsong(ctx, master, now, true);
        }
        if (isArrival || roll >= 0.42) {
          this.playFountainSplash(ctx, master, now + (isArrival ? 0.12 : 0), 2650, 1.25);
        }
        return;
      }

      case 'canal': {
        // Canal Road: Flowing willow-lined waterway shimmer, gentle flyover pass-by, & riverside chirps
        if (isArrival || roll < 0.46) {
          this.playFountainSplash(ctx, master, now, 1650, 1.35);
        } else if (roll < 0.78 && this.whiteNoiseBuffer) {
          // Distant illuminated bridge breeze & passing vehicle air-whoosh
          const src = ctx.createBufferSource();
          src.buffer = this.whiteNoiseBuffer;
          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.Q.value = 1.4;
          filter.frequency.setValueAtTime(240, now);
          filter.frequency.exponentialRampToValueAtTime(860, now + 0.45);
          filter.frequency.exponentialRampToValueAtTime(210, now + 1.15);

          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(0.028, now + 0.45);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

          src.connect(filter);
          filter.connect(gain);
          this.connectWithRandomPan(ctx, gain, master, 0.55);
          src.start(now);
          src.stop(now + 1.25);
        } else {
          this.playGardenBirdsong(ctx, master, now, false);
        }
        return;
      }

      case 'liberty':
      default: {
        // Liberty Chowk & Gulberg Nights: Evening plaza murmur, tawa food-street sizzle, & tabla/sitar
        if (isArrival || roll < 0.36) {
          this.playMarketBustle(ctx, master, now);
          if (isArrival) {
            this.playFountainSplash(ctx, master, now + 0.1, 2200, 1.0);
          }
        } else if (roll < 0.64 && this.whiteNoiseBuffer) {
          // Street-food tawa / wok sizzle flare
          const src = ctx.createBufferSource();
          src.buffer = this.whiteNoiseBuffer;
          const filter = ctx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.setValueAtTime(2800, now);

          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(0.022, now + 0.08);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);

          src.connect(filter);
          filter.connect(gain);
          this.connectWithRandomPan(ctx, gain, master, 0.5);
          src.start(now);
          src.stop(now + 0.5);
        } else if (roll < 0.84) {
          // Warm evening dholak / tabla double-tap pulse
          [0, 0.16].forEach((offset, idx) => {
            const t = now + offset;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(idx === 0 ? 132 : 240, t);
            osc.frequency.exponentialRampToValueAtTime(idx === 0 ? 84 : 175, t + 0.11);
            gain.gain.setValueAtTime(0.025, t);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
            osc.connect(gain);
            gain.connect(master);
            osc.start(t);
            osc.stop(t + 0.16);
          });
        } else {
          // Warm Gulberg evening sitar pluck
          const note = SITAR_NOTES[Math.floor(Math.random() * SITAR_NOTES.length)];
          const osc = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(note, now);
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(2200, now);
          filter.frequency.exponentialRampToValueAtTime(620, now + 0.55);
          gain.gain.setValueAtTime(0.02, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(master);
          osc.start(now);
          osc.stop(now + 0.65);
        }
        return;
      }
    }
  }

  public dispose(): void {
    this.disposed = true;
    this.stopVoiceover();
    if (
      this.handleVoicesChangedBound &&
      typeof window !== 'undefined' &&
      'speechSynthesis' in window
    ) {
      try {
        window.speechSynthesis.removeEventListener?.(
          'voiceschanged',
          this.handleVoicesChangedBound,
        );
      } catch {
        // ignore
      }
      this.handleVoicesChangedBound = null;
    }
    if (this.ambientChannels) {
      (['canyon', 'skybridge', 'obsidian'] as BiomeId[]).forEach((id) => {
        const ch = this.ambientChannels![id];
        ch.sources.forEach((src) => {
          try {
            src.stop();
            src.disconnect();
          } catch {
            // already stopped
          }
        });
        ch.nodes.forEach((node) => {
          try {
            node.disconnect();
          } catch {
            // ignore
          }
        });
        try {
          ch.gain.disconnect();
        } catch {
          // ignore
        }
      });
      this.ambientChannels = null;
    }
    this.rainBedSources.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // already stopped
      }
    });
    this.rainBedSources = [];
    this.rainBedNodes.forEach((node) => {
      try {
        node.disconnect();
      } catch {
        // ignore
      }
    });
    this.rainBedNodes = [];
    this.rainBedGain = null;
    this.speedBreezeGain = null;
    this.speedBreezeFilter = null;
    if (this.ambientMasterGain) {
      try {
        this.ambientMasterGain.disconnect();
      } catch {
        // ignore
      }
      this.ambientMasterGain = null;
    }
    if (this.ambientDilationFilter) {
      try {
        this.ambientDilationFilter.disconnect();
      } catch {
        // ignore
      }
      this.ambientDilationFilter = null;
    }
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.whiteNoiseBuffer = null;
    this.ambientReady = false;
  }

  public playJump(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const pitchJitter = 0.97 + Math.random() * 0.06;

    // Subtle foot-push low transient
    const pushOsc = ctx.createOscillator();
    const pushGain = ctx.createGain();
    pushOsc.type = 'sine';
    pushOsc.frequency.setValueAtTime(160 * pitchJitter, now);
    pushOsc.frequency.exponentialRampToValueAtTime(88, now + 0.055);
    pushGain.gain.setValueAtTime(0.08, now);
    pushGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    pushOsc.connect(pushGain);
    pushGain.connect(ctx.destination);
    pushOsc.start(now);
    pushOsc.stop(now + 0.065);

    // Crisp upward kinetic arc
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(225 * pitchJitter, now);
    osc.frequency.exponentialRampToValueAtTime(560 * pitchJitter, now + 0.135);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.155);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.165);
  }

  public playSlide(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Soft low crouch tuck thud
    const tuckOsc = ctx.createOscillator();
    const tuckGain = ctx.createGain();
    tuckOsc.type = 'sine';
    tuckOsc.frequency.setValueAtTime(185, now);
    tuckOsc.frequency.exponentialRampToValueAtTime(76, now + 0.075);
    tuckGain.gain.setValueAtTime(0.075, now);
    tuckGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    tuckOsc.connect(tuckGain);
    tuckGain.connect(ctx.destination);
    tuckOsc.start(now);
    tuckOsc.stop(now + 0.085);

    // Filtered noise burst for low-poly skid/whoosh
    const duration = 0.2;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1450, now);
    filter.frequency.exponentialRampToValueAtTime(380, now + 0.19);
    filter.Q.value = 1.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.195);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + duration);
  }

  public playFastFall(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(460, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.095);

    gain.gain.setValueAtTime(0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.105);
  }

  public playLaneSwitch(direction: -1 | 1 = 1): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const outputNode: AudioNode = (() => {
      if (typeof ctx.createStereoPanner === 'function') {
        const panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(direction * 0.42, now);
        panner.connect(ctx.destination);
        return panner;
      }
      return ctx.destination;
    })();

    // Crisp micro-step tone subtly pitched per left/right direction
    const startFreq = direction < 0 ? 310 : 370;
    const endFreq = direction < 0 ? 430 : 510;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.05);

    gain.gain.setValueAtTime(0.065, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(outputNode);
    osc.start(now);
    osc.stop(now + 0.065);

    // Subtle lateral air flick
    const flickDur = 0.045;
    const bufLen = Math.floor(ctx.sampleRate * flickDur);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      ch[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(1900, now);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.032, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + flickDur);

    noise.connect(hp);
    hp.connect(nGain);
    nGain.connect(outputNode);
    noise.start(now);
    noise.stop(now + flickDur);
  }

  public playLand(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.08);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playGem(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (now - this.lastGemTime < 0.85) {
      this.gemStreak = Math.min(this.gemStreak + 1, PENTATONIC_RATIOS.length - 1);
    } else {
      this.gemStreak = 0;
    }
    this.lastGemTime = now;

    const baseFreq = 587.33 * PENTATONIC_RATIOS[this.gemStreak];

    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.03, now + 0.14);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(baseFreq * 2, now);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.17);
    osc2.stop(now + 0.17);
  }

  public playSpringPad(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const freqs = [280, 420, 640];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.04;
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 1.45, t + 0.16);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.19);
    });
  }

  public playPowerup(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.045;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  }

  public playWheelTick(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.028);

    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.036);
  }

  public playChronos(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Deep temporal slow-down sweep
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(420, now);
    bass.frequency.exponentialRampToValueAtTime(88, now + 0.45);
    bassGain.gain.setValueAtTime(0.16, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    bass.connect(bassGain);
    bassGain.connect(ctx.destination);
    bass.start(now);
    bass.stop(now + 0.5);

    // Ethereal descending crystalline chimes
    [1318.51, 987.77, 783.99, 659.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.055;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.96, t + 0.24);
      gain.gain.setValueAtTime(0.075, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.28);
    });
  }

  public playNearMiss(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.09);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playComboVoiceover(combo: number, phrase: string): void {
    if (this.disposed || this.muted) return;

    const nowMs = performance.now();
    // Avoid overlapping rapid-fire voice lines unless reaching top tier
    if (nowMs - this.lastVoiceoverTime < 1100 && combo < 8) return;
    this.lastVoiceoverTime = nowMs;

    // Crisp harmonic hype sting underneath the announcer voice
    const ctx = this.ensureCtx();
    if (ctx) {
      const now = ctx.currentTime;
      const root = 523.25 * (1 + Math.min(6, Math.max(0, combo - 2)) * 0.06);
      [root, root * 1.25, root * 1.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + idx * 0.04;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.055, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.24);
      });
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(phrase);
        if (this.preferredVoice) {
          utterance.voice = this.preferredVoice;
        }
        utterance.lang = this.preferredVoice?.lang || 'en-US';
        utterance.pitch = 1.12 + Math.min(0.24, Math.max(0, combo - 2) * 0.035);
        utterance.rate = 1.12 + Math.min(0.14, Math.max(0, combo - 2) * 0.022);
        utterance.volume = 0.88;
        window.speechSynthesis.speak(utterance);
      } catch {
        // Ignore if speechSynthesis is blocked by browser policy
      }
    }
  }

  public playSpeedUp(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    [440, 587.33, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.04;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.12, t + 0.14);
      gain.gain.setValueAtTime(0.075, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  }

  public playShieldBreak(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.25);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(240, now + 0.25);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.27);
  }

  public playCrash(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.34);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.38);
  }

  public playCityLandmark(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Warm resonant foundation chime (architectural gate arrival weight)
    const baseOsc = ctx.createOscillator();
    const baseGain = ctx.createGain();
    baseOsc.type = 'sine';
    baseOsc.frequency.setValueAtTime(146.83, now); // D3
    baseOsc.frequency.exponentialRampToValueAtTime(145.5, now + 0.55);
    baseGain.gain.setValueAtTime(0.001, now);
    baseGain.gain.linearRampToValueAtTime(0.11, now + 0.025);
    baseGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.58);
    baseOsc.connect(baseGain);
    baseGain.connect(ctx.destination);
    baseOsc.start(now);
    baseOsc.stop(now + 0.6);

    // Celebratory Raag Yaman ascending fanfare (D4 - F#4 - A4 - C#5 - D5)
    const warmthFilter = ctx.createBiquadFilter();
    warmthFilter.type = 'lowpass';
    warmthFilter.frequency.setValueAtTime(3400, now);
    warmthFilter.Q.value = 0.7;
    warmthFilter.connect(ctx.destination);

    const motifNotes = [293.66, 369.99, 440.0, 554.37, 587.33];
    motifNotes.forEach((freq, idx) => {
      const t = now + idx * 0.058;
      const isFinal = idx === motifNotes.length - 1;
      const dur = isFinal ? 0.44 : 0.22;

      const osc = ctx.createOscillator();
      const harmonic = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      harmonic.type = 'sine';
      harmonic.frequency.setValueAtTime(freq * 2, t);

      const harmGain = ctx.createGain();
      harmGain.gain.setValueAtTime(isFinal ? 0.35 : 0.22, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(isFinal ? 0.095 : 0.072, t + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + dur);

      osc.connect(gain);
      harmonic.connect(harmGain);
      harmGain.connect(gain);
      gain.connect(warmthFilter);

      osc.start(t);
      harmonic.start(t);
      osc.stop(t + dur + 0.02);
      harmonic.stop(t + dur + 0.02);
    });
  }

  public playUnlock(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    [440, 554.37, 659.25, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.065;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }
}
