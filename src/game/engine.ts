import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AmbientWeatherOverlay } from './ambientWeatherOverlay';
import { GameAudio, pickComboVoiceoverPhrase } from './audio';
import { LowPolyCharacter } from './character';
import {
  createDayNightState,
  getHourForLightingMode,
  sampleDayNightState,
  type DayNightState,
} from './dayNightCycle';
import { DIFFICULTY_CONFIGS } from './difficulty';
import { getStreetCarnivalStatus, type GlobalEventStatus } from './globalEvents';
import { HapticFeedbackService, type HapticEvent } from './haptics';
import {
  LAHORE_LANDMARK_THEMES,
  getJourneyProgressForDistance,
} from './lahoreJourney';
import { GlobalMusicManager } from './music';
import { ParticlePool } from './particles';
import { PowerupVfxSystem } from './powerupVfx';
import { CARNIVAL_RUNNER_SKIN, getSkinById } from './skins';
import {
  WeatherSystem,
  getAllLandmarkForecasts,
  getLandmarkForecast,
  pickWeatherForLandmark,
  type LandmarkForecast,
  type WeatherLightingModifiers,
} from './weather';
import type {
  BiomeId,
  CharacterSkin,
  DifficultyMode,
  GamePhase,
  GlobalEventMode,
  HudSnapshot,
  LahoreLandmarkKind,
  LightingMode,
  PowerupType,
  RadioStationId,
  SkinCosmeticId,
  WeatherCondition,
} from './types';
import {
  BIOME_PALETTES,
  CHUNK_LENGTH,
  LANE_X,
  TrackChunk,
  WorldBuilder,
  getBiomeForDistance,
} from './world';

const _targetSky = new THREE.Color();
const _targetFog = new THREE.Color();
const _targetHemiSky = new THREE.Color();
const _targetHemiGround = new THREE.Color();
const _targetSun = new THREE.Color();
const _targetRim = new THREE.Color();
const _biomeSky = new THREE.Color();
const _biomeFog = new THREE.Color();
const _biomeHemiSky = new THREE.Color();
const _biomeHemiGround = new THREE.Color();
const _biomeSun = new THREE.Color();
const _sunMiddayColor = new THREE.Color(0xfffbeb);
const _sunHorizonColor = new THREE.Color(0xfb923c);
const _chronosSky = new THREE.Color(0x281e5c);
const _chronosFog = new THREE.Color(0x3b2778);
const _chronosHemiSky = new THREE.Color(0xa5b4fc);
const _chronosHemiGround = new THREE.Color(0x1e1b4b);
const _chronosSun = new THREE.Color(0xc4b5fd);
const _landmarkSky = new THREE.Color();
const _landmarkFog = new THREE.Color();
const _landmarkHemiSky = new THREE.Color();
const _landmarkHemiGround = new THREE.Color();
const _landmarkNightGlow = new THREE.Color();
const _goldenRimColor = new THREE.Color(0xfdba74);
const _carnivalDaySky = new THREE.Color(0x9d2b6b);
const _carnivalDayFog = new THREE.Color(0xf472b6);
const _carnivalNightSky = new THREE.Color(0x280d4e);
const _carnivalNightFog = new THREE.Color(0x6d1b7b);
const _carnivalHemiSky = new THREE.Color(0xfef08a);
const _carnivalHemiGround = new THREE.Color(0x4c1d95);
const _carnivalSun = new THREE.Color(0xfde047);
const _carnivalRim = new THREE.Color(0x22d3ee);
const _carnivalGlow = new THREE.Color(0xf43f5e);
const _carnivalSky = new THREE.Color();
const _carnivalFog = new THREE.Color();
const _lookAtTarget = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _weatherModifiers: WeatherLightingModifiers = {
  fogNear: 42,
  fogFar: 138,
  skyTint: new THREE.Color(),
  skyTintWeight: 0,
  fogTint: new THREE.Color(),
  fogTintWeight: 0,
  sunIntensityMul: 1,
  hemiIntensityMul: 1,
  exposureOffset: 0,
};

const GRAVITY = 36;
const JUMP_VELOCITY = 14.5;
const SPRING_VELOCITY = 20.5;
const SLIDE_DURATION = 0.65;
const BASE_FOV = 58;
const MAX_FOV = 68;
const LANDMARK_TRANSITION_DURATION = 0.92;
const CARNIVAL_CONFETTI_COLORS = [0xec4899, 0xfbbf24, 0x22d3ee] as const;

export interface EngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onHapticEvent?: (event: HapticEvent) => void;
  onLandmarkEncountered?: (landmark: LahoreLandmarkKind) => boolean | void;
  onGlobalEventChange?: (status: GlobalEventStatus) => void;
  onWebGlStatusChange?: (status: 'lost' | 'restored') => void;
  onGameOver: (stats: {
    distance: number;
    score: number;
    gemsEarned: number;
    maxCombo: number;
    peakSpeedMultiplier: number;
    biomeReached: BiomeId;
    landmarkReached: LahoreLandmarkKind;
    landmarkReachedName: string;
    weatherReached: WeatherCondition;
    weatherLabel: string;
    difficulty: DifficultyMode;
    reason: 'obstacle' | 'fall';
  }) => void;
}

export class SkyboundEngine {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly isSoftwareGl: boolean;

  private readonly hemiLight: THREE.HemisphereLight;
  private readonly keyLight: THREE.DirectionalLight;
  private readonly rimLight: THREE.DirectionalLight;
  private readonly nightGlowLight: THREE.PointLight;
  private readonly horizonRing: THREE.Group;
  private readonly celestialGroup: THREE.Group;
  private readonly sunGroup: THREE.Group;
  private readonly sunDiscMat: THREE.MeshBasicMaterial;
  private readonly sunHaloMat: THREE.MeshBasicMaterial;
  private readonly moonGroup: THREE.Group;
  private readonly moonMat: THREE.MeshBasicMaterial;
  private readonly moonHaloMat: THREE.MeshBasicMaterial;
  private readonly starField: THREE.Points;
  private readonly starMat: THREE.PointsMaterial;
  private readonly dayNightState: DayNightState = createDayNightState();
  private lightingMode: LightingMode = 'auto';
  private eventMode: GlobalEventMode = 'auto';
  private globalEventStatus: GlobalEventStatus = getStreetCarnivalStatus('auto');
  private carnivalBlend = this.globalEventStatus.active ? 1 : 0;
  private timeCheckAccum = 0;
  private eventCheckAccum = 0;
  private carnivalConfettiAccum = 0;
  private currentNightFactor = 0;
  private activeSkinId = 'trailblazer';
  private readonly chronosOverlayMesh: THREE.Mesh;
  private readonly chronosOverlayMat: THREE.ShaderMaterial;
  private readonly transitionTarget: THREE.WebGLRenderTarget;
  private readonly blurZoomScene: THREE.Scene;
  private readonly blurZoomCamera: THREE.OrthographicCamera;
  private readonly blurZoomQuad: THREE.Mesh;
  private readonly blurZoomMat: THREE.ShaderMaterial;
  private landmarkTransitionTimer = 0;
  private landmarkTransitionPhase = 0;
  private landmarkTransitionIntensity = 0;
  private readonly landmarkTransitionAccent = new THREE.Color(0xfbbf24);

  private readonly character: LowPolyCharacter;
  private readonly worldBuilder: WorldBuilder;
  private readonly particles = new ParticlePool();
  private readonly powerupVfx = new PowerupVfxSystem();
  private readonly weatherSystem = new WeatherSystem(pickWeatherForLandmark('gate', undefined, true));
  private readonly ambientWeatherOverlay = new AmbientWeatherOverlay(
    getLandmarkForecast('gate'),
    'gate',
    true,
  );
  public readonly audio: GameAudio;
  public readonly music = new GlobalMusicManager();
  public readonly haptics = new HapticFeedbackService();
  private readonly callbacks: EngineCallbacks;

  private readonly chunks: TrackChunk[] = [];
  private nextChunkIndex = 0;
  private nextChunkZ = 12;

  private phase: GamePhase = 'title';
  private showcaseMode = false;
  private showcaseAngle = 0;
  private photoFrozen = false;
  private savedPhotoCam: { pos: THREE.Vector3; quat: THREE.Quaternion; fov: number } | null = null;

  // Player physics & action state
  private laneIndex = 1; // 0=left, 1=center, 2=right
  private playerX = 0;
  private playerY = 0;
  private playerZ = 0;
  private laneVelX = 0;
  private vy = 0;
  private isGrounded = true;
  private isSliding = false;
  private slideTimer = 0;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private slideBufferTimer = 0;
  private fastFallQueued = false;
  private jumpedInAir = false;
  private runCycle = 0;
  private squashY = 1;
  private trailAccum = 0;

  // Run metrics & powerups
  private difficultyMode: DifficultyMode = 'normal';
  private speed = DIFFICULTY_CONFIGS.normal.baseSpeed;
  private speedMultiplier = 1.0;
  private peakSpeedMultiplier = 1.0;
  private nextSpeedTier = 1.2;
  private elapsedRunTime = 0;
  private cameraRoll = 0;
  private distance = 0;
  private bonusScore = 0;
  private runGems = 0;
  private combo = 1;
  private maxCombo = 1;
  private comboDecayTimer = 0;
  private comboStreak = 0;
  private comboPopSeq = 0;
  private comboActionLabel: string | null = null;
  private hasShield = false;
  private invulnTimer = 0;
  private magnetTimer = 0;
  private multiplierTimer = 0;
  private chronosTimer = 0;
  private chronosStrength = 0;
  private chronosPulseAccum = 0;
  private speedBoostTimer = 0;
  private speedBoostFactor = 1.0;
  private simTime = 0;
  private magnetPulseAccum = 0;
  private powerupSurge = 0;
  private powerupFlashType: PowerupType | null = null;
  private powerupFlashSeq = 0;
  private currentBiome: BiomeId = 'canyon';
  private currentLandmarkKind: LahoreLandmarkKind = 'gate';
  private eventBanner: string | null = null;
  private eventBannerTimer = 0;
  private landmarkPopupName: string | null = null;
  private landmarkPopupSubtitle: string | null = null;
  private landmarkPopupAccent: string | null = null;
  private landmarkPopupDistance = 0;
  private landmarkPopupTimer = 0;
  private landmarkPopupSeq = 0;
  private landmarkPopupIsNew = false;
  private voiceoverCallout: string | null = null;
  private voiceoverTimer = 0;
  private voiceoverSeq = 0;

  // Mission action counters
  private runJumps = 0;
  private runSlides = 0;
  private runStyleBonuses = 0;
  private runSpringHits = 0;

  // Juice
  private hitstopTimer = 0;
  private shakeIntensity = 0;
  private hitFlash = 0;

  private readonly clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;
  private contextLost = false;
  private hudEmitAccum = 0;

  constructor(
    container: HTMLElement,
    initialSkin: CharacterSkin,
    initialMuted: boolean,
    initialDifficulty: DifficultyMode,
    callbacks: EngineCallbacks,
    initialCosmeticId: SkinCosmeticId | null = null,
    initialRadioStation: RadioStationId = 'auto',
    initialLightingMode: LightingMode = 'auto',
    initialEventMode: GlobalEventMode = 'auto',
    initialAmbientOverlay = true,
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.difficultyMode = initialDifficulty;
    this.lightingMode = initialLightingMode;
    this.eventMode = initialEventMode;
    this.ambientWeatherOverlay.setEnabled(initialAmbientOverlay);
    this.globalEventStatus = getStreetCarnivalStatus(initialEventMode);
    this.carnivalBlend = this.globalEventStatus.active ? 1 : 0;
    this.activeSkinId = initialSkin.id;
    this.speed = DIFFICULTY_CONFIGS[initialDifficulty].baseSpeed;
    this.audio = new GameAudio(initialMuted);
    this.music.setStation(initialRadioStation, false);

    // Software WebGL guard per Three.js skill
    this.isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: !this.isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch (err) {
      this.audio.dispose();
      this.music.dispose();
      throw err;
    }
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.worldBuilder = new WorldBuilder(this.renderer.capabilities.getMaxAnisotropy());

    this.scene = new THREE.Scene();
    const initPalette = BIOME_PALETTES.canyon;
    this.scene.background = new THREE.Color(initPalette.sky);
    this.scene.fog = new THREE.Fog(initPalette.fog, 42, 138);

    // Mandatory Studio Environment Reflection (RoomEnvironment)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(58, width / height, 0.2, 220);
    this.camera.position.set(0, 4.6, 8.2);

    // Warm/cool 3-point lighting rig
    this.hemiLight = new THREE.HemisphereLight(initPalette.hemiSky, initPalette.hemiGround, 0.85);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(initPalette.sun, 1.55);
    this.keyLight.position.set(14, 24, 12);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.bias = -0.0004;
    this.keyLight.shadow.normalBias = 0.025;
    const d = 24;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 92;
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    this.rimLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
    this.rimLight.position.set(-12, 10, -18);
    this.scene.add(this.rimLight);

    // Soft nocturnal glow pool synchronized with the active Lahore landmark theme
    this.nightGlowLight = new THREE.PointLight(0xfb923c, 0, 28, 1.45);
    this.nightGlowLight.position.set(0, 3.4, -4);
    this.scene.add(this.nightGlowLight);

    // Distant celestial sky dome (sun, crescent moon, and stars synced to real local time)
    const celestial = this.createCelestialDome();
    this.celestialGroup = celestial.group;
    this.sunGroup = celestial.sunGroup;
    this.sunDiscMat = celestial.sunDiscMat;
    this.sunHaloMat = celestial.sunHaloMat;
    this.moonGroup = celestial.moonGroup;
    this.moonMat = celestial.moonMat;
    this.moonHaloMat = celestial.moonHaloMat;
    this.starField = celestial.starField;
    this.starMat = celestial.starMat;
    this.scene.add(this.celestialGroup);

    // Distant Lahore horizon landmarks (Minar-e-Pakistan, Badshahi Domes & skyline following player Z)
    this.horizonRing = this.createLahoreSkyline();
    this.scene.add(this.horizonRing);

    // Character & pooled particles / power-up VFX
    this.character = new LowPolyCharacter(initialSkin, initialCosmeticId);
    this.scene.add(this.character.root);
    this.scene.add(this.particles.mesh);
    this.scene.add(this.powerupVfx.group);
    this.scene.add(this.weatherSystem.group);
    this.scene.add(this.ambientWeatherOverlay.group);

    // Clip-space Time-Dilation Shader Veil (radial chrono-ripples & violet-cyan rim)
    this.chronosOverlayMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uWarning: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        uniform float uWarning;
        varying vec2 vUv;

        void main() {
          vec2 centered = vUv * 2.0 - 1.0;
          float dist = length(centered);
          float angle = atan(centered.y, centered.x);

          // Keep center clear for crisp obstacle readability; concentrate warp on outer rim
          float rimMask = smoothstep(0.36, 1.18, dist);
          float ripple = 0.5 + 0.5 * sin(dist * 24.0 - uTime * 3.6);
          float ringWave = pow(ripple, 3.0) * smoothstep(0.28, 0.92, dist) * (1.0 - smoothstep(1.05, 1.45, dist));
          float rays = 0.5 + 0.5 * cos(angle * 16.0 + uTime * 1.2);
          float streakMask = rimMask * rays * 0.45;

          vec3 violetTint = vec3(0.45, 0.22, 0.92);
          vec3 cyanTint = vec3(0.22, 0.82, 0.98);
          vec3 color = mix(violetTint, cyanTint, ripple * 0.65 + rays * 0.25);

          float warnFlicker = 1.0 - uWarning * (0.28 * (0.5 + 0.5 * sin(uTime * 18.0)));
          float alpha = (rimMask * 0.34 + ringWave * 0.16 + streakMask * 0.18) * uIntensity * warnFlicker;
          gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.62));
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.chronosOverlayMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      this.chronosOverlayMat,
    );
    this.chronosOverlayMesh.frustumCulled = false;
    this.chronosOverlayMesh.renderOrder = 999;
    this.chronosOverlayMesh.visible = false;
    this.scene.add(this.chronosOverlayMesh);

    // Zone-change radial Blur-Zoom post-pass (renders only during landmark transitions)
    const gl = this.renderer.getContext();
    const supportsHalfFloat =
      !this.isSoftwareGl &&
      Boolean(gl.getExtension('EXT_color_buffer_half_float') || gl.getExtension('EXT_color_buffer_float'));
    const rtScale = this.isSoftwareGl ? 0.65 : Math.min(window.devicePixelRatio, 1.5);
    this.transitionTarget = new THREE.WebGLRenderTarget(
      Math.max(1, Math.floor(width * rtScale)),
      Math.max(1, Math.floor(height * rtScale)),
      {
        type: supportsHalfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: true,
        stencilBuffer: false,
      },
    );

    this.blurZoomScene = new THREE.Scene();
    this.blurZoomCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.blurZoomMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.transitionTarget.texture },
        uIntensity: { value: 0 },
        uZoomAmount: { value: 0 },
        uTime: { value: 0 },
        uPhase: { value: 0 },
        uAccentColor: { value: new THREE.Color(0xfbbf24) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uIntensity;
        uniform float uZoomAmount;
        uniform float uTime;
        uniform float uPhase;
        uniform vec3 uAccentColor;
        varying vec2 vUv;

        void main() {
          vec2 center = vec2(0.5, 0.56);
          vec2 dir = vUv - center;
          float dist = length(dir);
          vec2 dirNorm = dir / max(dist, 0.0001);
          vec2 tangent = vec2(-dirNorm.y, dirNorm.x);
          float edgeMask = smoothstep(0.08, 0.78, dist);
          float angle = atan(dirNorm.y, dirNorm.x + 0.0001 * step(dist, 0.0001));

          // Screen-wide magical heat/speed shimmer: expanding horizon pulse + fluid interference ripples
          float waveFront = exp(-pow((dist - uPhase * 1.28) * 6.5, 2.0));
          float radialRipple = sin(dist * 28.0 - uTime * 15.0);
          float fluidWaveA = sin(vUv.y * 32.0 - uTime * 13.5 + cos(vUv.x * 20.0 + uTime * 7.5));
          float fluidWaveB = cos(vUv.x * 26.0 + uTime * 11.0 - sin(vUv.y * 18.0 - uTime * 8.5));
          float speedStreams = 0.5 + 0.5 * cos(angle * 18.0 + uTime * 9.0);

          // Subtle across the whole frame while slightly calmer right on central lane obstacles
          float shimmerMask = mix(0.32, 1.0, edgeMask);
          vec2 shimmerOffset =
            dirNorm * (radialRipple * 0.0032 + waveFront * 0.0068) * uIntensity * shimmerMask +
            tangent * ((fluidWaveA + fluidWaveB * 0.65) * 0.0018) * uIntensity * shimmerMask;

          // Gentle forward optical zoom toward horizon vanishing point with shimmer warp
          vec2 baseUv = clamp(
            center + dir * (1.0 - uZoomAmount * 0.085) + shimmerOffset,
            0.001,
            0.999
          );

          // 8-tap radial zoom blur weighted toward outer screen periphery to keep lane obstacles sharp
          vec3 accum = vec3(0.0);
          float totalWeight = 0.0;
          float blurSpread = uIntensity * (0.045 + 0.085 * edgeMask + waveFront * 0.022);

          for (int i = 0; i < 8; i++) {
            float t = float(i) / 7.0;
            float w = 1.0 - t * 0.45;
            vec2 sampleUv = clamp(
              center + (baseUv - center) * (1.0 - t * blurSpread) + shimmerOffset * (t * 0.45),
              0.001,
              0.999
            );
            accum += texture2D(tDiffuse, sampleUv).rgb * w;
            totalWeight += w;
          }
          vec3 blurred = accum / totalWeight;

          // Subtle directional & shimmer-modulated chromatic prism fringe
          float shimmerChroma = (0.65 + 0.35 * fluidWaveA + waveFront * 0.55);
          float chromaShift = uIntensity * (0.0022 + edgeMask * 0.0075) * shimmerChroma;
          vec2 rUv = clamp(baseUv + dir * chromaShift + tangent * (fluidWaveB * 0.0015 * uIntensity), 0.001, 0.999);
          vec2 bUv = clamp(baseUv - dir * chromaShift - tangent * (fluidWaveB * 0.0015 * uIntensity), 0.001, 0.999);
          float chromaMix = (0.14 + 0.36 * edgeMask) * uIntensity;
          blurred.r = mix(blurred.r, texture2D(tDiffuse, rUv).r, chromaMix);
          blurred.b = mix(blurred.b, texture2D(tDiffuse, bUv).b, chromaMix);

          // Delicate magical iridescent shimmer veil along the expanding wave crest & speed streaks
          float shimmerGlint =
            (waveFront * (0.55 + 0.45 * speedStreams) + max(0.0, fluidWaveA * fluidWaveB) * 0.28 * edgeMask) *
            uIntensity;
          vec3 prismTint = mix(uAccentColor, vec3(0.76, 0.95, 1.0), 0.38 + 0.25 * speedStreams);
          blurred += prismTint * shimmerGlint * 0.14;

          float rimAura = smoothstep(0.42, 1.15, dist) * uIntensity * 0.2;
          vec3 finalRgb = mix(blurred, uAccentColor, rimAura);

          gl_FragColor = vec4(finalRgb, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      depthTest: false,
      depthWrite: false,
      toneMapped: true,
    });
    this.blurZoomQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blurZoomMat);
    this.blurZoomQuad.frustumCulled = false;
    this.blurZoomScene.add(this.blurZoomQuad);

    this.resetWorld();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
      this.renderer.compile(this.blurZoomScene, this.blurZoomCamera);
    }

    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);
    window.addEventListener('resize', this.handleResize);
    this.clock.start();
    this.tick();
  }

  private createCelestialDome(): {
    group: THREE.Group;
    sunGroup: THREE.Group;
    sunDiscMat: THREE.MeshBasicMaterial;
    sunHaloMat: THREE.MeshBasicMaterial;
    moonGroup: THREE.Group;
    moonMat: THREE.MeshBasicMaterial;
    moonHaloMat: THREE.MeshBasicMaterial;
    starField: THREE.Points;
    starMat: THREE.PointsMaterial;
  } {
    const group = new THREE.Group();

    // Sun + soft warm atmospheric halo
    const sunGroup = new THREE.Group();
    sunGroup.position.set(16, 36, -134);
    const sunDiscMat = new THREE.MeshBasicMaterial({
      color: 0xfff3b0,
      transparent: true,
      opacity: 1,
      fog: false,
      toneMapped: false,
    });
    const sunHaloMat = new THREE.MeshBasicMaterial({
      color: 0xfdba74,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(4.4, 24), sunDiscMat);
    const sunHalo = new THREE.Mesh(new THREE.CircleGeometry(8.8, 24), sunHaloMat);
    sunHalo.position.z = -0.2;
    sunGroup.add(sunHalo, sunDisc);
    group.add(sunGroup);

    // Crescent Moon silhouette + cool lunar halo
    const moonGroup = new THREE.Group();
    moonGroup.position.set(-24, 34, -132);
    const crescentShape = new THREE.Shape();
    crescentShape.absarc(0, 0, 3.2, -Math.PI * 0.42, Math.PI * 0.58, false);
    crescentShape.absarc(1.15, 0.55, 2.55, Math.PI * 0.62, -Math.PI * 0.36, true);
    crescentShape.closePath();

    const moonMat = new THREE.MeshBasicMaterial({
      color: 0xfef3c7,
      transparent: true,
      opacity: 1,
      fog: false,
      toneMapped: false,
    });
    const moonHaloMat = new THREE.MeshBasicMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    const moonMesh = new THREE.Mesh(new THREE.ShapeGeometry(crescentShape, 20), moonMat);
    const moonHalo = new THREE.Mesh(new THREE.CircleGeometry(6.4, 20), moonHaloMat);
    moonHalo.position.z = -0.2;
    moonGroup.add(moonHalo, moonMesh);
    group.add(moonGroup);

    // Starfield across upper sky hemisphere
    const starCount = 210;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const starPalette = [
      new THREE.Color(0xffffff),
      new THREE.Color(0xbae6fd),
      new THREE.Color(0xfef3c7),
      new THREE.Color(0xc7d2fe),
    ];

    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * (Math.PI * 0.42); // upper hemisphere well above horizon
      const radius = 128 + Math.random() * 24;
      positions[i * 3] = Math.sin(theta) * Math.cos(phi) * radius;
      positions[i * 3 + 1] = 10 + Math.sin(phi) * radius * 0.85;
      positions[i * 3 + 2] = -Math.abs(Math.cos(theta) * Math.cos(phi) * radius) - 12;

      const c = starPalette[i % starPalette.length];
      const brightness = 0.72 + Math.random() * 0.28;
      colors[i * 3] = c.r * brightness;
      colors[i * 3 + 1] = c.g * brightness;
      colors[i * 3 + 2] = c.b * brightness;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 1.15,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    const starField = new THREE.Points(starGeo, starMat);
    starField.frustumCulled = false;
    group.add(starField);

    return {
      group,
      sunGroup,
      sunDiscMat,
      sunHaloMat,
      moonGroup,
      moonMat,
      moonHaloMat,
      starField,
      starMat,
    };
  }

  private createLahoreSkyline(): THREE.Group {
    const g = new THREE.Group();
    const sandstoneMat = new THREE.MeshStandardMaterial({
      color: 0x8b4536,
      roughness: 0.88,
      metalness: 0.04,
      flatShading: true,
    });
    const marbleMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.45,
      metalness: 0.12,
      flatShading: true,
    });
    const citySilhouetteMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.9,
      metalness: 0.05,
      flatShading: true,
    });

    // Iconic Minar-e-Pakistan silhouette ahead & slightly left of track vista
    const minarGroup = new THREE.Group();
    minarGroup.position.set(-18, -2, -96);

    const minarBase = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 6.2, 4.5, 8), marbleMat);
    minarBase.position.y = 2.25;
    minarGroup.add(minarBase);

    const minarShaft = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 3.0, 26, 8), marbleMat);
    minarShaft.position.y = 17.5;
    minarGroup.add(minarShaft);

    const minarCrown = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), marbleMat);
    minarCrown.position.y = 31.2;
    minarGroup.add(minarCrown);

    const minarSpire = new THREE.Mesh(new THREE.ConeGeometry(0.45, 5.5, 6), marbleMat);
    minarSpire.position.y = 35.0;
    minarGroup.add(minarSpire);
    g.add(minarGroup);

    // Distant Badshahi Mosque silhouette ahead & right
    const mosqueGroup = new THREE.Group();
    mosqueGroup.position.set(24, -2, -94);

    const hall = new THREE.Mesh(new THREE.BoxGeometry(16, 7, 10), sandstoneMat);
    hall.position.y = 3.5;
    mosqueGroup.add(hall);

    for (const dx of [-4.6, 0, 4.6]) {
      const domeSize = dx === 0 ? 3.2 : 2.3;
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(domeSize, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.62),
        marbleMat,
      );
      dome.position.set(dx, 7.0, 0);
      mosqueGroup.add(dome);
    }

    for (const mx of [-9.2, 9.2]) {
      const min = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.15, 18, 8), sandstoneMat);
      min.position.set(mx, 9, 3.5);
      mosqueGroup.add(min);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(1.0, 8, 6), marbleMat);
      cap.position.set(mx, 18.4, 3.5);
      mosqueGroup.add(cap);
    }
    g.add(mosqueGroup);

    // Low-poly Lahore city skyline blocks framing the distant perimeter
    const towerGeo = new THREE.BoxGeometry(8, 16, 8);
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      if (Math.abs(Math.sin(angle)) < 0.28 && Math.cos(angle) < 0) continue;
      const block = new THREE.Mesh(towerGeo, citySilhouetteMat);
      const radius = 86 + (i % 3) * 12;
      const hScale = 0.5 + (i % 4) * 0.26;
      block.position.set(Math.sin(angle) * radius, -6 + hScale * 4, Math.cos(angle) * radius);
      block.scale.set(0.85 + (i % 3) * 0.25, hScale, 0.85);
      block.rotation.y = i * 0.4;
      g.add(block);
    }
    return g;
  }

  public setSkin(skinId: string): void {
    const skin = getSkinById(skinId);
    this.activeSkinId = skin.id;
    this.character.applySkin(skin);
  }

  public setCosmetic(cosmeticId: SkinCosmeticId | null): void {
    this.character.applyCosmetic(cosmeticId);
  }

  public setDifficulty(mode: DifficultyMode): void {
    if (this.difficultyMode === mode) return;
    this.difficultyMode = mode;
    if (this.phase === 'title') {
      this.resetWorld();
    }
  }

  public setShowcaseMode(enabled: boolean): void {
    this.showcaseMode = enabled;
    if (enabled) {
      this.showcaseAngle = 0.45;
    }
  }

  public setRadioStation(station: RadioStationId): void {
    this.audio.unlock();
    this.music.setStation(station, !this.audio.isMuted());
    this.emitHud();
  }

  public cycleRadioStation(): RadioStationId {
    this.audio.unlock();
    const next = this.music.cycleStation(!this.audio.isMuted());
    this.emitHud();
    return next;
  }

  public setLightingMode(mode: LightingMode): void {
    this.lightingMode = mode;
    this.updateEnvironmentLighting(0, true);
    if (this.photoFrozen) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public setEventMode(mode: GlobalEventMode): void {
    this.eventMode = mode;
    this.refreshGlobalEventStatus(true);
    this.updateEnvironmentLighting(0, true);
    if (this.photoFrozen) {
      this.renderer.render(this.scene, this.camera);
    }
    this.emitHud();
  }

  public getGlobalEventStatus(): GlobalEventStatus {
    return this.globalEventStatus;
  }

  private refreshGlobalEventStatus(announceOnChange = true): void {
    const prevActive = this.globalEventStatus.active;
    const next = getStreetCarnivalStatus(this.eventMode);
    this.globalEventStatus = next;
    if (prevActive !== next.active) {
      this.callbacks.onGlobalEventChange?.(next);
      if (announceOnChange) {
        if (next.active) {
          this.showBanner('STREET CARNIVAL LIVE!');
          if (this.phase === 'playing' || this.phase === 'title') {
            this.particles.spawnBurst(this.playerX - 2.2, this.playerY + 2.2, this.playerZ - 2.5, 0xec4899, 10, 5.2, 1.0);
            this.particles.spawnBurst(this.playerX + 2.2, this.playerY + 2.2, this.playerZ - 2.5, 0x22d3ee, 10, 5.2, 1.0);
          }
        } else {
          this.showBanner('STREET CARNIVAL ENDED');
        }
      }
    }
  }

  public getLandmarkForecast(landmark: LahoreLandmarkKind): LandmarkForecast {
    return getLandmarkForecast(landmark);
  }

  public getAllLandmarkForecasts(): Record<LahoreLandmarkKind, LandmarkForecast> {
    return getAllLandmarkForecasts();
  }

  public setAmbientOverlayEnabled(enabled: boolean): void {
    this.ambientWeatherOverlay.setEnabled(enabled);
    if (this.photoFrozen) {
      this.renderer.render(this.scene, this.camera);
    }
    this.emitHud();
  }

  public isAmbientOverlayEnabled(): boolean {
    return this.ambientWeatherOverlay.isEnabled();
  }

  public getAmbientOverlaySummary(): string {
    return this.ambientWeatherOverlay.getSummary();
  }

  public setPhase(phase: GamePhase): void {
    this.phase = phase;
    if (phase === 'playing') {
      this.exitPhotoMode();
      this.showcaseMode = false;
      this.clock.getDelta(); // clear delta spike
    } else {
      this.audio.stopVoiceover();
      this.haptics.cancel();
    }
  }

  public enterPhotoMode(): void {
    if (!this.savedPhotoCam) {
      this.savedPhotoCam = {
        pos: this.camera.position.clone(),
        quat: this.camera.quaternion.clone(),
        fov: this.camera.fov,
      };
    }
    this.photoFrozen = true;
  }

  public exitPhotoMode(): void {
    if (this.savedPhotoCam) {
      this.camera.position.copy(this.savedPhotoCam.pos);
      this.camera.quaternion.copy(this.savedPhotoCam.quat);
      if (Math.abs(this.camera.fov - this.savedPhotoCam.fov) > 0.01) {
        this.camera.fov = this.savedPhotoCam.fov;
        this.camera.updateProjectionMatrix();
      }
      this.savedPhotoCam = null;
    }
    this.photoFrozen = false;
  }

  public setPhotoCameraPreset(preset: 'current' | 'hero' | 'wide'): void {
    if (!this.savedPhotoCam) {
      this.enterPhotoMode();
    }
    if (preset === 'current' && this.savedPhotoCam) {
      this.camera.position.copy(this.savedPhotoCam.pos);
      this.camera.quaternion.copy(this.savedPhotoCam.quat);
      this.camera.fov = this.savedPhotoCam.fov;
      this.camera.updateProjectionMatrix();
    } else if (preset === 'hero') {
      // Dynamic low 3/4 hero angle showcasing runner + Lahore skyline ahead
      const sideSign = this.playerX >= 0 ? -1 : 1;
      this.camera.position.set(
        this.playerX + sideSign * 2.55,
        Math.max(1.15, this.playerY + 1.25),
        this.playerZ + 3.4,
      );
      _lookAtTarget.set(this.playerX * 0.4, this.playerY + 1.2, this.playerZ - 6.5);
      this.camera.lookAt(_lookAtTarget);
      this.camera.fov = 52;
      this.camera.updateProjectionMatrix();
    } else if (preset === 'wide') {
      // Elevated panoramic vista of the Lahore street track & horizon landmarks
      this.camera.position.set(
        this.playerX * 0.35 + 3.8,
        Math.max(5.2, this.playerY + 4.9),
        this.playerZ + 9.2,
      );
      _lookAtTarget.set(0, this.playerY + 1.4, this.playerZ - 14);
      this.camera.lookAt(_lookAtTarget);
      this.camera.fov = 62;
      this.camera.updateProjectionMatrix();
    }
    this.renderer.render(this.scene, this.camera);
  }

  public captureSnapshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  public startNewRun(
    boost?: { multiplier: number; durationSeconds: number; label?: string } | null,
  ): void {
    this.audio.unlock();
    this.resetWorld();
    if (boost && boost.durationSeconds > 0 && boost.multiplier > 1) {
      this.speedBoostTimer = boost.durationSeconds;
      this.speedBoostFactor = boost.multiplier;
      this.powerupSurge = 1.0;
      this.audio.playSpeedUp();
      this.particles.spawnBurst(0, 1.0, 0, 0xfbbf24, 18, 6.2, 1.1);
      this.eventBanner = `LUCKY BOOST · ${boost.durationSeconds}S`;
      this.eventBannerTimer = 2.4;
    }
    this.phase = 'playing';
    this.showcaseMode = false;
    this.emitHud();
  }

  private resetWorld(): void {
    for (const c of this.chunks) {
      this.scene.remove(c.group);
      this.worldBuilder.disposeChunk(c);
    }
    this.chunks.length = 0;
    this.particles.clear();
    this.powerupVfx.clear();

    this.laneIndex = 1;
    this.playerX = 0;
    this.playerY = 0;
    this.playerZ = 0;
    this.laneVelX = 0;
    this.vy = 0;
    this.isGrounded = true;
    this.isSliding = false;
    this.slideTimer = 0;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.slideBufferTimer = 0;
    this.fastFallQueued = false;
    this.jumpedInAir = false;
    this.runCycle = 0;
    this.squashY = 1;

    const diffCfg = DIFFICULTY_CONFIGS[this.difficultyMode];
    this.speed = diffCfg.baseSpeed;
    this.speedMultiplier = 1.0;
    this.peakSpeedMultiplier = 1.0;
    this.nextSpeedTier = 1.2;
    this.elapsedRunTime = 0;
    this.cameraRoll = 0;
    this.distance = 0;
    this.bonusScore = 0;
    this.runGems = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.comboDecayTimer = 0;
    this.comboStreak = 0;
    this.comboPopSeq = 0;
    this.comboActionLabel = null;
    this.hasShield = false;
    this.invulnTimer = 0;
    this.magnetTimer = 0;
    this.multiplierTimer = 0;
    this.chronosTimer = 0;
    this.chronosStrength = 0;
    this.chronosPulseAccum = 0;
    this.speedBoostTimer = 0;
    this.speedBoostFactor = 1.0;
    this.simTime = 0;
    this.magnetPulseAccum = 0;
    this.powerupSurge = 0;
    this.powerupFlashType = null;
    this.chronosOverlayMesh.visible = false;
    this.chronosOverlayMat.uniforms.uIntensity.value = 0;
    this.audio.setTimeDilation(0);
    this.currentBiome = 'canyon';
    this.currentLandmarkKind = 'gate';
    const initialWeather = pickWeatherForLandmark('gate', this.weatherSystem.getWeather(), true);
    this.weatherSystem.setWeather(initialWeather, true);
    this.ambientWeatherOverlay.setForecast(getLandmarkForecast('gate'), 'gate', true);
    this.audio.setAmbientBiome('canyon');
    this.audio.setAmbientLandmark('gate');
    this.audio.setAmbientWeather(initialWeather);
    this.eventBanner = null;
    this.eventBannerTimer = 0;
    this.landmarkPopupName = null;
    this.landmarkPopupSubtitle = null;
    this.landmarkPopupAccent = null;
    this.landmarkPopupDistance = 0;
    this.landmarkPopupTimer = 0;
    this.landmarkPopupSeq = 0;
    this.landmarkPopupIsNew = false;
    this.voiceoverCallout = null;
    this.voiceoverTimer = 0;
    this.voiceoverSeq = 0;
    this.runJumps = 0;
    this.runSlides = 0;
    this.runStyleBonuses = 0;
    this.runSpringHits = 0;
    this.hitstopTimer = 0;
    this.shakeIntensity = 0;
    this.hitFlash = 0;
    this.landmarkTransitionTimer = 0;
    this.landmarkTransitionPhase = 0;
    this.landmarkTransitionIntensity = 0;
    this.photoFrozen = false;
    this.savedPhotoCam = null;

    if (Math.abs(this.camera.fov - BASE_FOV) > 0.05) {
      this.camera.fov = BASE_FOV;
      this.camera.updateProjectionMatrix();
    }

    this.nextChunkIndex = 0;
    this.nextChunkZ = 14;
    for (let i = 0; i < 6; i++) {
      this.spawnNextChunk();
    }

    this.character.root.position.set(0, 0, 0);
    this.updateEnvironmentLighting(0, true);
    this.syncFollowLights();
  }

  private spawnNextChunk(): void {
    const chunkMeters = Math.max(0, -this.nextChunkZ);
    const biome = getBiomeForDistance(chunkMeters);
    const difficulty = THREE.MathUtils.clamp(chunkMeters / 950, 0, 1);
    const chunk = this.worldBuilder.buildChunk(
      this.nextChunkIndex,
      this.nextChunkZ,
      biome,
      difficulty,
      this.difficultyMode,
    );
    this.scene.add(chunk.group);
    this.chunks.push(chunk);
    this.nextChunkZ -= CHUNK_LENGTH;
    this.nextChunkIndex++;
  }

  private emitHaptic(event: HapticEvent): void {
    if (this.callbacks.onHapticEvent) {
      this.callbacks.onHapticEvent(event);
    } else {
      this.haptics.triggerEvent(event);
    }
  }

  // Player Actions
  public moveLeft(): void {
    if (this.phase !== 'playing') return;
    if (this.laneIndex > 0) {
      this.laneIndex--;
      this.audio.playLaneSwitch(-1);
      this.emitHaptic('lane_switch');
    }
  }

  public moveRight(): void {
    if (this.phase !== 'playing') return;
    if (this.laneIndex < 2) {
      this.laneIndex++;
      this.audio.playLaneSwitch(1);
      this.emitHaptic('lane_switch');
    }
  }

  public triggerJump(): void {
    if (this.phase !== 'playing') return;
    this.jumpBufferTimer = 0.15;
  }

  public triggerSlide(): void {
    if (this.phase !== 'playing') return;
    this.slideBufferTimer = 0.15;
    if (!this.isGrounded) {
      // Pro fast-fall slam straight into slide on touchdown!
      if (!this.fastFallQueued) {
        this.audio.playFastFall();
      }
      this.vy = Math.min(this.vy, -24);
      this.fastFallQueued = true;
    }
  }

  private handleResize = (): void => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    const rtScale = this.isSoftwareGl ? 0.65 : Math.min(window.devicePixelRatio, 1.5);
    this.transitionTarget.setSize(
      Math.max(1, Math.floor(width * rtScale)),
      Math.max(1, Math.floor(height * rtScale)),
    );
  };

  private groundHeightAt(x: number, z: number): number {
    let highest = -999;
    for (const chunk of this.chunks) {
      if (z > chunk.zStart + 0.5 || z < chunk.zEnd - 0.5) continue;
      for (const deck of chunk.decks) {
        if (x >= deck.xMin - 0.25 && x <= deck.xMax + 0.25 && z <= deck.zMax + 0.15 && z >= deck.zMin - 0.15) {
          let surfaceY = deck.topY;
          if (
            deck.isRamp &&
            deck.rampStartZ !== undefined &&
            deck.rampEndZ !== undefined &&
            deck.rampStartY !== undefined &&
            deck.rampEndY !== undefined
          ) {
            const t = THREE.MathUtils.clamp(
              (deck.rampStartZ - z) / Math.max(0.01, deck.rampStartZ - deck.rampEndZ),
              0,
              1,
            );
            surfaceY = THREE.MathUtils.lerp(deck.rampStartY, deck.rampEndY, t);
          }
          if (surfaceY > highest && surfaceY <= this.playerY + 0.85) {
            highest = surfaceY;
          }
        }
      }
    }
    return highest;
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.callbacks.onWebGlStatusChange?.('lost');
  };

  private handleContextRestored = (): void => {
    if (this.disposed) return;
    this.contextLost = false;
    this.clock.getDelta();
    this.updateEnvironmentLighting(0, true);
    this.syncFollowLights();
    this.callbacks.onWebGlStatusChange?.('restored');
    this.tick();
  };

  private tick = (): void => {
    if (this.disposed || this.contextLost) return;

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);

    if (this.phase === 'title') {
      this.updateTitleScene(dt);
    } else if (this.phase === 'playing') {
      this.updateGameplay(dt);
    } else if (!this.photoFrozen) {
      // Paused / Gameover subtle ambient idle (completely frozen during Photo Mode)
      if (this.phase === 'gameover' && this.chronosStrength > 0.001) {
        this.chronosStrength = THREE.MathUtils.damp(this.chronosStrength, 0, 5.0, dt);
        this.chronosOverlayMesh.visible = this.chronosStrength > 0.008;
        this.chronosOverlayMat.uniforms.uTime.value = this.clock.elapsedTime;
        this.chronosOverlayMat.uniforms.uIntensity.value = this.chronosStrength;
      }
      this.particles.update(dt * 0.4);
      this.powerupVfx.update(dt * 0.4, this.playerX, this.playerY, this.playerZ);
      this.weatherSystem.update(
        dt * 0.35,
        this.playerX,
        this.playerY,
        this.playerZ,
        this.currentNightFactor,
        this.clock.elapsedTime,
      );
      this.ambientWeatherOverlay.update(
        dt * 0.35,
        this.playerX,
        this.playerY,
        this.playerZ,
        this.currentNightFactor,
        this.clock.elapsedTime,
        0,
        this.renderer.getPixelRatio(),
      );
      this.updateEnvironmentLighting(dt);
    }

    const maxMult = DIFFICULTY_CONFIGS[this.difficultyMode].maxMultiplier;
    const speedRatio = THREE.MathUtils.clamp(
      (this.speedMultiplier - 1) / Math.max(0.1, maxMult - 1),
      0,
      1,
    );
    this.audio.setTimeDilation(this.phase === 'playing' ? this.chronosStrength : 0);
    this.audio.updateAmbient(dt, this.phase, speedRatio);
    this.music.update(this.audio.getContext(), dt, {
      phase: this.phase,
      landmark: this.currentLandmarkKind,
      speedRatio,
      speedBoostActive: this.speedBoostTimer > 0,
      comboStreak: this.comboStreak,
      chronosStrength: this.phase === 'playing' ? this.chronosStrength : 0,
      muted: this.audio.isMuted(),
      globalEventActive: this.globalEventStatus.active,
    });

    this.renderFrame();

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private renderFrame(): void {
    const activeBlurZoom =
      !this.photoFrozen &&
      this.phase === 'playing' &&
      this.landmarkTransitionIntensity > 0.004;

    if (!activeBlurZoom) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    this.blurZoomMat.uniforms.uIntensity.value = this.landmarkTransitionIntensity;
    this.blurZoomMat.uniforms.uZoomAmount.value = this.landmarkTransitionIntensity;
    this.blurZoomMat.uniforms.uTime.value = this.clock.elapsedTime;
    this.blurZoomMat.uniforms.uPhase.value = this.landmarkTransitionPhase;
    (this.blurZoomMat.uniforms.uAccentColor.value as THREE.Color).copy(
      this.landmarkTransitionAccent,
    );

    this.renderer.setRenderTarget(this.transitionTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.blurZoomScene, this.blurZoomCamera);
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateTitleScene(dt: number): void {
    if (this.showcaseMode) {
      this.showcaseAngle += dt * 0.65;
      this.runCycle += dt * 6.5;
      this.character.root.position.set(0, 0, this.playerZ);
      this.character.updatePose(
        {
          isGrounded: true,
          isSliding: false,
          vy: 0,
          laneVelX: 0,
          runCycle: this.runCycle,
          squashY: 1,
          hasShield: false,
          magnetTimer: 0,
          multiplierTimer: 0,
          chronosTimer: 0,
          powerupSurge: 0,
          hitFlash: 0,
          showcaseMode: true,
        },
        dt,
        0,
      );

      const camDist = 4.2;
      _camDesired.set(
        Math.sin(this.showcaseAngle) * camDist,
        1.75,
        this.playerZ - Math.cos(this.showcaseAngle) * camDist,
      );
      this.camera.position.lerp(_camDesired, 1 - Math.exp(-8 * dt));
      _lookAtTarget.set(0, 1.05, this.playerZ);
      this.camera.lookAt(_lookAtTarget);
    } else {
      // Live world forward jog along the scenic track
      this.playerZ -= 6.8 * dt;
      this.runCycle += dt * 9.5;
      this.character.root.position.set(0, 0, this.playerZ);
      this.character.updatePose(
        {
          isGrounded: true,
          isSliding: false,
          vy: 0,
          laneVelX: 0,
          runCycle: this.runCycle,
          squashY: 1,
          hasShield: false,
          magnetTimer: 0,
          multiplierTimer: 0,
          chronosTimer: 0,
          powerupSurge: 0,
          hitFlash: 0,
          showcaseMode: false,
        },
        dt,
        0,
      );

      // Recycle chunks in title mode too so the track is infinite
      while (this.nextChunkZ > this.playerZ - 165) {
        this.spawnNextChunk();
      }
      while (this.chunks.length > 0 && this.chunks[0].zEnd > this.playerZ + 22) {
        const old = this.chunks.shift()!;
        this.scene.remove(old.group);
        this.worldBuilder.disposeChunk(old);
      }

      const sway = Math.sin(this.playerZ * 0.04) * 1.4;
      _camDesired.set(sway, 3.4, this.playerZ + 6.4);
      this.camera.position.lerp(_camDesired, 1 - Math.exp(-6 * dt));
      _lookAtTarget.set(0, 1.25, this.playerZ - 8);
      this.camera.lookAt(_lookAtTarget);

      const scenicMeters = Math.max(0, Math.floor(-this.playerZ));
      const scenicBiome = getBiomeForDistance(scenicMeters);
      if (scenicBiome !== this.currentBiome) {
        this.currentBiome = scenicBiome;
        this.audio.setAmbientBiome(scenicBiome);
      }
      const scenicLandmark = getJourneyProgressForDistance(scenicMeters).currentStop.landmark;
      if (scenicLandmark !== this.currentLandmarkKind) {
        this.currentLandmarkKind = scenicLandmark;
        this.audio.setAmbientLandmark(scenicLandmark, true);
        const nextWeather = pickWeatherForLandmark(
          scenicLandmark,
          this.weatherSystem.getWeather(),
        );
        this.weatherSystem.setWeather(nextWeather);
        this.ambientWeatherOverlay.setForecast(getLandmarkForecast(scenicLandmark), scenicLandmark);
        this.audio.setAmbientWeather(nextWeather);
      }
    }

    this.simTime += dt;
    this.weatherSystem.update(
      dt,
      this.playerX,
      this.playerY,
      this.playerZ,
      this.currentNightFactor,
      this.simTime,
    );
    this.ambientWeatherOverlay.update(
      dt,
      this.playerX,
      this.playerY,
      this.playerZ,
      this.currentNightFactor,
      this.simTime,
      0.24,
      this.renderer.getPixelRatio(),
    );
    this.syncFollowLights();
    this.updateEnvironmentLighting(dt);
    this.animateCollectibles(dt, this.simTime);
  }

  private updateGameplay(dt: number): void {
    // Hitstop freeze frame on heavy impacts
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.particles.update(dt * 0.35);
      this.updateCamera(dt);
      return;
    }

    // Gradual time + distance speed multiplier ramp scaled per difficulty mode
    this.elapsedRunTime += dt;
    const prevZ = this.playerZ;
    const meters = Math.floor(-this.playerZ);
    this.distance = Math.max(0, meters);
    const diffCfg = DIFFICULTY_CONFIGS[this.difficultyMode];
    const distProgress = 1 - Math.exp(-this.distance / diffCfg.rampDistance);
    const timeProgress = 1 - Math.exp(-this.elapsedRunTime / diffCfg.rampTimeSeconds);
    const combinedProgress = 0.55 * timeProgress + 0.45 * distProgress;
    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer = Math.max(0, this.speedBoostTimer - dt);
      if (this.speedBoostTimer <= 0) {
        this.speedBoostFactor = 1.0;
      }
    }
    const activeBoost = this.speedBoostTimer > 0 ? this.speedBoostFactor : 1.0;
    const targetMultiplier = 1.0 + (diffCfg.maxMultiplier - 1.0) * combinedProgress;
    const targetSpeed = diffCfg.baseSpeed * targetMultiplier * activeBoost;
    this.speed = THREE.MathUtils.damp(this.speed, targetSpeed, 2.4, dt);
    this.speedMultiplier = this.speed / diffCfg.baseSpeed;
    this.peakSpeedMultiplier = Math.max(this.peakSpeedMultiplier, this.speedMultiplier);

    // Trigger speed milestone banner & sound at every +0.2x tier up to mode ceiling
    if (this.speedMultiplier >= this.nextSpeedTier && this.nextSpeedTier <= diffCfg.maxMultiplier - 0.05) {
      const tierLabel = this.nextSpeedTier.toFixed(1);
      this.nextSpeedTier = Number((this.nextSpeedTier + 0.2).toFixed(1));
      this.audio.playSpeedUp();
      this.particles.spawnBurst(this.playerX, this.playerY + 0.8, this.playerZ, 0x38bdf8, 12, 5.4, 0.95);
      this.showBanner(`PACE UP · ×${tierLabel}`);
    }

    // Lahore Journey landmark tracking & biome ambient sync
    const newBiome = getBiomeForDistance(this.distance);
    if (newBiome !== this.currentBiome) {
      this.currentBiome = newBiome;
      this.audio.setAmbientBiome(newBiome);
    }

    for (const chunk of this.chunks) {
      const marker = chunk.landmarkMarker;
      if (marker && !marker.triggered && this.playerZ <= marker.z) {
        marker.triggered = true;
        this.triggerLandmarkArrival(
          marker.kind,
          marker.name,
          marker.subtitle,
          marker.accentHex,
          marker.distanceMeters,
        );
      }
    }

    // Timers & active power-up periodic pulses
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.magnetTimer > 0) {
      this.magnetTimer = Math.max(0, this.magnetTimer - dt);
      this.magnetPulseAccum += dt;
      if (this.magnetPulseAccum >= 0.62) {
        this.magnetPulseAccum = 0;
        this.powerupVfx.triggerMagnetPulse(this.playerX, this.playerY, this.playerZ);
      }
    }
    if (this.multiplierTimer > 0) this.multiplierTimer = Math.max(0, this.multiplierTimer - dt);
    if (this.chronosTimer > 0) {
      this.chronosTimer = Math.max(0, this.chronosTimer - dt);
      this.chronosPulseAccum += dt;
      if (this.chronosPulseAccum >= 0.85) {
        this.chronosPulseAccum = 0;
        this.powerupVfx.triggerChronosPulse(this.playerX, this.playerY, this.playerZ);
      }
    }
    const targetChronos = this.chronosTimer > 0 ? 1 : 0;
    this.chronosStrength = THREE.MathUtils.damp(
      this.chronosStrength,
      targetChronos,
      this.chronosTimer > 0 ? 8.5 : 5.0,
      dt,
    );
    const timeScale = 1 - 0.52 * this.chronosStrength;
    const worldAnimScale = 1 - 0.58 * this.chronosStrength;
    this.simTime += dt * worldAnimScale;

    this.chronosOverlayMesh.visible = this.chronosStrength > 0.008;
    if (this.chronosOverlayMesh.visible) {
      this.chronosOverlayMat.uniforms.uTime.value = this.clock.elapsedTime;
      this.chronosOverlayMat.uniforms.uIntensity.value = this.chronosStrength;
      this.chronosOverlayMat.uniforms.uWarning.value =
        this.chronosTimer > 0 && this.chronosTimer < 1.25 ? 1.0 : 0.0;
    }

    if (this.landmarkTransitionTimer > 0) {
      this.landmarkTransitionTimer = Math.max(0, this.landmarkTransitionTimer - dt);
      const p = 1 - this.landmarkTransitionTimer / LANDMARK_TRANSITION_DURATION;
      const rise = THREE.MathUtils.smoothstep(p, 0, 0.16);
      const fall = Math.pow(1 - THREE.MathUtils.smoothstep(p, 0.16, 1.0), 1.65);
      this.landmarkTransitionPhase = p;
      this.landmarkTransitionIntensity = rise * fall;
    } else {
      this.landmarkTransitionPhase = 0;
      this.landmarkTransitionIntensity = 0;
    }

    if (this.powerupSurge > 0) this.powerupSurge = Math.max(0, this.powerupSurge - dt * 2.6);
    if (this.eventBannerTimer > 0) {
      this.eventBannerTimer -= dt;
      if (this.eventBannerTimer <= 0) this.eventBanner = null;
    }
    if (this.landmarkPopupTimer > 0) {
      this.landmarkPopupTimer -= dt;
      if (this.landmarkPopupTimer <= 0) {
        this.landmarkPopupName = null;
        this.landmarkPopupSubtitle = null;
        this.landmarkPopupAccent = null;
        this.landmarkPopupIsNew = false;
        this.emitHud();
      }
    }
    if (this.voiceoverTimer > 0) {
      this.voiceoverTimer -= dt;
      if (this.voiceoverTimer <= 0) this.voiceoverCallout = null;
    }
    if (this.comboDecayTimer > 0) {
      this.comboDecayTimer -= dt;
      if (this.comboDecayTimer <= 0) {
        const hadCombo = this.combo > 1 || this.comboStreak > 0;
        this.combo = 1;
        this.comboStreak = 0;
        this.comboActionLabel = null;
        if (hadCombo) {
          this.emitHud();
        }
      }
    }
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt * 5);

    // Forward advance & speed-scaled pace bonus points (Chronos slows forward speed smoothly)
    const effectiveForwardSpeed = this.speed * timeScale;
    this.playerZ -= effectiveForwardSpeed * dt;
    const stepDist = Math.max(0, prevZ - this.playerZ);
    if (this.speedMultiplier > 1.02) {
      this.bonusScore += stepDist * (this.speedMultiplier - 1) * 5;
    }

    // Lateral lane damping scales with speed so high-pace dodges stay snappy
    const targetX = LANE_X[this.laneIndex];
    const prevX = this.playerX;
    const laneResponsiveness = 17.5 * Math.min(1.4, 0.9 + this.speedMultiplier * 0.18);
    this.playerX = THREE.MathUtils.damp(this.playerX, targetX, laneResponsiveness, dt);
    this.laneVelX = (this.playerX - prevX) / Math.max(0.0001, dt);

    // Input buffers
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= dt;
    if (this.slideBufferTimer > 0) this.slideBufferTimer -= dt;
    if (this.isGrounded) {
      this.coyoteTimer = 0.125;
    } else if (this.coyoteTimer > 0) {
      this.coyoteTimer -= dt;
    }

    // Execute buffered Jump
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      const wasSliding = this.isSliding;
      this.vy = JUMP_VELOCITY;
      this.isGrounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.isSliding = false;
      if (wasSliding) {
        this.emitHaptic('slide_end');
      }
      this.fastFallQueued = false;
      this.jumpedInAir = true;
      this.squashY = 1.24;
      this.runJumps++;
      this.audio.playJump();
      this.particles.spawnBurst(this.playerX, this.playerY + 0.1, this.playerZ, 0xe2e8f0, 7, 3.6, 0.8);
      this.emitHud();
    }

    // Execute buffered Slide
    if (this.slideBufferTimer > 0 && this.isGrounded && !this.isSliding) {
      this.startSlide(false);
    }

    if (this.isSliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) {
        this.isSliding = false;
        this.emitHaptic('slide_end');
      }
    }

    // Vertical physics & surface landing
    const groundY = this.groundHeightAt(this.playerX, this.playerZ);
    if (!this.isGrounded || this.playerY > groundY + 0.05) {
      this.vy -= GRAVITY * dt;
      const nextY = this.playerY + this.vy * dt;

      if (this.vy <= 0 && nextY <= groundY && this.playerY >= groundY - 0.65 && groundY > -10) {
        // Landed cleanly
        const wasJump = this.jumpedInAir;
        this.playerY = groundY;
        this.vy = 0;
        this.isGrounded = true;
        this.jumpedInAir = false;
        this.squashY = 0.78;
        this.audio.playLand();
        this.particles.spawnBurst(this.playerX, this.playerY + 0.08, this.playerZ, 0xf1f5f9, 6, 3.2, 0.75);
        if (this.fastFallQueued) {
          this.fastFallQueued = false;
          this.startSlide(true);
        } else if (wasJump) {
          this.emitHaptic('jump_land');
          this.advanceComboSequence('JUMP LAND');
        }
      } else {
        this.playerY = nextY;
        this.isGrounded = false;
      }
    } else {
      // Running along surface
      if (groundY < -10) {
        this.isGrounded = false;
      } else {
        this.playerY = THREE.MathUtils.damp(this.playerY, groundY, 26, dt);
        this.vy = 0;
        this.isGrounded = true;
      }
    }

    // Chasm fall check
    if (this.playerY < -6.5) {
      this.audio.playCrash();
      this.shakeIntensity = 0.55;
      this.endRun('fall');
      return;
    }

    // Squash recovery & run cycle
    this.squashY = THREE.MathUtils.damp(this.squashY, 1, 14, dt);
    this.runCycle += dt * (effectiveForwardSpeed * 0.85);

    // Slide / Run / Power-up / Carnival Runner dust particles & high-speed air wisps
    this.trailAccum += dt;
    const isCarnivalSkin = this.activeSkinId === CARNIVAL_RUNNER_SKIN.id;
    if (
      (this.isGrounded ||
        this.multiplierTimer > 0 ||
        this.chronosTimer > 0 ||
        this.speedBoostTimer > 0 ||
        isCarnivalSkin) &&
      this.trailAccum >
        (this.isSliding
          ? 0.032
          : this.multiplierTimer > 0 || this.speedBoostTimer > 0
            ? 0.048
            : isCarnivalSkin
              ? 0.068
              : 0.095)
    ) {
      this.trailAccum = 0;
      const carnivalHue =
        CARNIVAL_CONFETTI_COLORS[Math.floor(this.simTime * 8) % CARNIVAL_CONFETTI_COLORS.length];
      const trailColor =
        this.chronosTimer > 0
          ? 0xc084fc
          : this.speedBoostTimer > 0
            ? 0xf59e0b
            : this.multiplierTimer > 0
              ? 0xf43f5e
              : this.magnetTimer > 0
                ? 0x34d399
                : isCarnivalSkin
                  ? carnivalHue
                  : this.isSliding
                    ? 0xfbbf24
                    : 0xe2e8f0;
      this.particles.spawnTrailPuff(
        this.playerX,
        this.playerY,
        this.playerZ,
        trailColor,
        this.isSliding ||
          this.multiplierTimer > 0 ||
          this.chronosTimer > 0 ||
          this.speedBoostTimer > 0 ||
          isCarnivalSkin
          ? 0.95
          : 0.6,
      );
      if (this.speedMultiplier >= 1.32 && Math.random() < 0.45) {
        const sideOffset = (Math.random() < 0.5 ? -1 : 1) * (0.45 + Math.random() * 0.35);
        this.particles.spawnTrailPuff(
          this.playerX + sideOffset,
          this.playerY + 0.55 + Math.random() * 0.5,
          this.playerZ - 0.3,
          isCarnivalSkin ? 0x22d3ee : 0xbae6fd,
          0.42,
        );
      }
    }

    // Subtle celebratory aerial festival embers along track edges during Street Carnival
    if (this.globalEventStatus.active) {
      this.carnivalConfettiAccum += dt;
      if (this.carnivalConfettiAccum >= 0.52) {
        this.carnivalConfettiAccum = 0;
        const side = Math.random() < 0.5 ? -1 : 1;
        const color =
          CARNIVAL_CONFETTI_COLORS[Math.floor(Math.random() * CARNIVAL_CONFETTI_COLORS.length)];
        this.particles.spawnBurst(
          side * (4.1 + Math.random() * 1.4),
          2.6 + Math.random() * 1.8,
          this.playerZ - (10 + Math.random() * 12),
          color,
          4,
          2.8,
          0.95,
        );
      }
    }

    // Recycle & spawn chunks
    while (this.nextChunkZ > this.playerZ - 170) {
      this.spawnNextChunk();
    }
    while (this.chunks.length > 0 && this.chunks[0].zEnd > this.playerZ + 22) {
      const old = this.chunks.shift()!;
      this.scene.remove(old.group);
      this.worldBuilder.disposeChunk(old);
    }

    // Animate collectibles & check collisions
    this.animateCollectibles(dt * worldAnimScale, this.simTime);
    const crashed = this.checkCollisions(dt);
    if (crashed) return;

    // Update character rig & power-up shockwave VFX
    this.character.root.position.set(this.playerX, this.playerY, this.playerZ);
    this.character.updatePose(
      {
        isGrounded: this.isGrounded,
        isSliding: this.isSliding,
        vy: this.vy,
        laneVelX: this.laneVelX,
        runCycle: this.runCycle,
        squashY: this.squashY,
        hasShield: this.hasShield,
        magnetTimer: this.magnetTimer,
        multiplierTimer: this.multiplierTimer,
        chronosTimer: this.chronosTimer,
        powerupSurge: this.powerupSurge,
        hitFlash: this.hitFlash,
        showcaseMode: false,
      },
      dt,
      groundY > -10 ? groundY : -20,
    );

    this.particles.update(dt * timeScale);
    this.powerupVfx.update(dt, this.playerX, this.playerY, this.playerZ);
    this.weatherSystem.update(
      dt * timeScale,
      this.playerX,
      this.playerY,
      this.playerZ,
      this.currentNightFactor,
      this.simTime,
    );
    const maxMultForOverlay = DIFFICULTY_CONFIGS[this.difficultyMode].maxMultiplier;
    const overlaySpeedRatio = THREE.MathUtils.clamp(
      (this.speedMultiplier - 1) / Math.max(0.1, maxMultForOverlay - 1),
      0,
      1,
    );
    this.ambientWeatherOverlay.update(
      dt * timeScale,
      this.playerX,
      this.playerY,
      this.playerZ,
      this.currentNightFactor,
      this.simTime,
      overlaySpeedRatio,
      this.renderer.getPixelRatio(),
    );
    this.updateCamera(dt);
    this.syncFollowLights();
    this.updateEnvironmentLighting(dt);

    // Throttled HUD sync (~15Hz) so React UI stays crisp without overhead
    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.065) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  }

  private startSlide(fromSlam = false): void {
    this.isSliding = true;
    this.slideTimer = SLIDE_DURATION;
    this.slideBufferTimer = 0;
    this.squashY = 0.85;
    this.runSlides++;
    this.audio.playSlide();
    this.emitHaptic('slide_start');
    this.advanceComboSequence(fromSlam ? 'SLAM SLIDE' : 'SLIDE');
  }

  public announceBanner(text: string): void {
    this.eventBanner = text;
    this.eventBannerTimer = 2.2;
  }

  private showBanner(text: string): void {
    this.eventBanner = text;
    this.eventBannerTimer = 2.0;
    this.emitHud();
  }

  private animateCollectibles(dt: number, time: number): void {
    for (const chunk of this.chunks) {
      for (const gem of chunk.gems) {
        if (gem.collected) continue;
        gem.mesh.rotation.y += dt * 3.0;
        gem.mesh.position.y = gem.y + Math.sin(time * 4.2 + gem.bobPhase) * 0.14;
      }
      for (const p of chunk.powerups) {
        if (p.collected) continue;
        p.mesh.rotation.y += dt * 2.5;
        p.mesh.rotation.x = Math.sin(time * 2 + p.bobPhase) * 0.25;
        p.mesh.position.y = p.y + Math.sin(time * 3.2 + p.bobPhase) * 0.16;
        if (p.type === 'chronos') {
          const ringA = p.mesh.getObjectByName('chronosRingA');
          const ringB = p.mesh.getObjectByName('chronosRingB');
          if (ringA) ringA.rotation.z += dt * 2.6;
          if (ringB) ringB.rotation.z -= dt * 3.2;
        }
      }
      for (const obs of chunk.obstacles) {
        if (obs.kind === 'moving') {
          const phase = time * obs.moveSpeed + obs.movePhase;
          obs.x = obs.baseX + Math.sin(phase) * obs.moveAmp;
          obs.mesh.position.x = obs.x;
          // Auto-rickshaw steers and leans gently into turns + engine idle bounce
          const lateralDir = Math.cos(phase);
          obs.mesh.rotation.y = -lateralDir * 0.32;
          obs.mesh.rotation.z = lateralDir * 0.08;
          obs.mesh.position.y = Math.abs(Math.sin(time * 16 + obs.movePhase)) * 0.03;
        }
      }
    }
  }

  private checkCollisions(dt: number): boolean {
    const playerHalfW = 0.3;
    const playerHalfD = 0.28;
    const playerBottom = this.playerY + 0.08;
    const playerTop = this.playerY + (this.isSliding ? 0.84 : 1.72);
    const mult = (this.multiplierTimer > 0 ? 2 : 1) * this.combo;

    for (const chunk of this.chunks) {
      if (chunk.zStart < this.playerZ - 12 || chunk.zEnd > this.playerZ + 12) continue;

      // Spring Pads
      for (const pad of chunk.springs) {
        if (pad.triggered) continue;
        if (
          Math.abs(this.playerX - pad.x) < 0.95 &&
          Math.abs(this.playerZ - pad.z) < 1.0 &&
          Math.abs(this.playerY - pad.y) < 0.75
        ) {
          pad.triggered = true;
          this.vy = SPRING_VELOCITY;
          this.isGrounded = false;
          this.isSliding = false;
          this.jumpedInAir = true;
          this.squashY = 1.32;
          this.audio.playSpringPad();
          this.emitHaptic('jump_land');
          this.particles.spawnBurst(pad.x, pad.y + 0.4, pad.z, 0x22d3ee, 14, 6.2, 1.1);
          this.bonusScore += 50 * mult;
          this.runSpringHits++;
          this.advanceComboSequence('SKY LAUNCH');
          this.showBanner('SKY LAUNCH!');
        }
      }

      // Gems (with Magnet attraction!)
      for (const gem of chunk.gems) {
        if (gem.collected) continue;
        const dx = this.playerX - gem.x;
        const dy = this.playerY + 0.85 - gem.y;
        const dz = this.playerZ - gem.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (this.magnetTimer > 0 && distSq < 49) {
          const pull = Math.min(1, dt * 13);
          gem.x = THREE.MathUtils.lerp(gem.x, this.playerX, pull);
          gem.y = THREE.MathUtils.lerp(gem.y, this.playerY + 0.85, pull);
          gem.z = THREE.MathUtils.lerp(gem.z, this.playerZ, pull);
          gem.mesh.position.set(gem.x, gem.y, gem.z);
          if (Math.random() < 0.25) {
            this.particles.spawnTrailPuff(gem.x, gem.y, gem.z, 0x34d399, 0.45);
          }
        }

        if (distSq < 1.35) {
          gem.collected = true;
          gem.mesh.visible = false;
          const gemGain = gem.value * (this.multiplierTimer > 0 ? 2 : 1);
          this.runGems += gemGain;
          this.bonusScore += 25 * gemGain * this.combo;
          this.audio.playGem();
          this.particles.spawnBurst(
            gem.x,
            gem.y,
            gem.z,
            gem.value > 1 ? 0xfbbf24 : 0x38bdf8,
            8,
            4.2,
            0.9,
          );
          this.emitHud();
        }
      }

      // Powerups
      for (const p of chunk.powerups) {
        if (p.collected) continue;
        const dx = this.playerX - p.x;
        const dy = this.playerY + 0.85 - p.y;
        const dz = this.playerZ - p.z;
        if (dx * dx + dy * dy + dz * dz < 1.65) {
          p.collected = true;
          p.mesh.visible = false;
          this.activatePowerup(p.type);
          const burstColor =
            p.type === 'shield'
              ? 0x38bdf8
              : p.type === 'magnet'
                ? 0x10b981
                : p.type === 'chronos'
                  ? 0xa855f7
                  : 0xf43f5e;
          this.particles.spawnBurst(p.x, p.y, p.z, burstColor, 18, 6.4, 1.2);
        }
      }

      // Obstacles
      for (const obs of chunk.obstacles) {
        const dz = Math.abs(this.playerZ - obs.z);
        const dx = Math.abs(this.playerX - obs.x);
        const overlapX = dx < playerHalfW + obs.halfW;
        const overlapZ = dz < playerHalfD + obs.halfD;
        const overlapY = playerTop > obs.y && playerBottom < obs.y + obs.height;

        if (overlapX && overlapZ && overlapY) {
          if (this.invulnTimer > 0) continue;

          if (this.hasShield) {
            this.hasShield = false;
            this.invulnTimer = 1.25;
            this.hitstopTimer = 0.055;
            this.shakeIntensity = 0.42;
            this.hitFlash = 1.0;
            this.combo = 1;
            this.comboStreak = 0;
            this.comboActionLabel = null;
            this.comboDecayTimer = 0;
            obs.mesh.visible = false;
            obs.y = -50;
            this.audio.playShieldBreak();
            this.emitHaptic('jump_land');
            this.particles.spawnBurst(this.playerX, this.playerY + 0.9, this.playerZ, 0x38bdf8, 22, 7.5, 1.25);
            this.powerupVfx.triggerShieldBreakBurst(this.playerX, this.playerY, this.playerZ);
            this.showBanner('SHIELD SAVED YOU!');
            this.emitHud();
            continue;
          }

          // Impact crash
          this.hitstopTimer = 0.05;
          this.shakeIntensity = 0.65;
          this.hitFlash = 1.0;
          this.audio.playCrash();
          this.particles.spawnBurst(this.playerX, this.playerY + 0.9, this.playerZ, 0xf97316, 24, 8.2, 1.3);
          this.endRun('obstacle');
          return true;
        }

        // Style Near-Miss / Clean Slide-Under Bonus!
        if (!obs.nearMissAwarded && this.playerZ < obs.z - obs.halfD - 0.35 && dz < 1.5) {
          if (obs.kind === 'slide' && this.isSliding && overlapX) {
            obs.nearMissAwarded = true;
            this.awardStyleBonus('CLEAN SLIDE! +30', 'CLEAN SLIDE');
          } else if (obs.kind === 'jump' && !this.isGrounded && overlapX && playerBottom >= obs.y + obs.height) {
            obs.nearMissAwarded = true;
            this.awardStyleBonus('CLEAN HURDLE! +30', 'CLEAN HURDLE');
          } else if (!overlapX && dx < obs.halfW + playerHalfW + 0.7) {
            obs.nearMissAwarded = true;
            this.awardStyleBonus('CLOSE CALL! +30', 'CLOSE CALL');
          }
        }
      }
    }
    return false;
  }

  private advanceComboSequence(actionLabel: string): void {
    const prevCombo = this.combo;
    this.comboStreak++;
    this.combo = Math.min(8, Math.max(this.combo, this.comboStreak));
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.comboDecayTimer = 4.2;
    this.comboActionLabel = actionLabel;

    if (this.comboStreak >= 2) {
      this.comboPopSeq++;
    }

    if (
      this.combo > prevCombo &&
      (this.combo === 2 ||
        this.combo === 3 ||
        this.combo === 4 ||
        this.combo === 5 ||
        this.combo === 6 ||
        this.combo === 8)
    ) {
      const phrase = pickComboVoiceoverPhrase(this.combo);
      if (phrase) {
        this.voiceoverCallout = phrase;
        this.voiceoverTimer = 1.85;
        this.voiceoverSeq++;
        this.audio.playComboVoiceover(this.combo, phrase);
      }
    }

    if (this.comboStreak >= 2) {
      this.emitHud();
    }
  }

  private awardStyleBonus(label: string, actionLabel: string): void {
    this.advanceComboSequence(actionLabel);
    this.bonusScore += 30 * this.combo;
    this.runStyleBonuses++;
    this.audio.playNearMiss();
    this.showBanner(`${label} ×${this.combo}`);
  }

  private activatePowerup(type: PowerupType): void {
    if (type === 'chronos') {
      this.audio.playChronos();
    } else {
      this.audio.playPowerup();
    }
    this.emitHaptic('lane_switch');
    this.powerupSurge = 1.0;
    this.powerupFlashType = type;
    this.powerupFlashSeq++;
    this.powerupVfx.triggerPickupBurst(type, this.playerX, this.playerY, this.playerZ);

    if (type === 'shield') {
      this.hasShield = true;
      this.showBanner('SKY SHIELD ACTIVE');
    } else if (type === 'magnet') {
      this.magnetTimer = 9.0;
      this.magnetPulseAccum = 0;
      this.showBanner('GEM MAGNET');
    } else if (type === 'multiplier') {
      this.multiplierTimer = 9.0;
      this.showBanner('2× SCORE & GEMS');
    } else if (type === 'chronos') {
      this.chronosTimer = 5.0;
      this.chronosPulseAccum = 0;
      this.showBanner('CHRONOS CRYSTAL · TIME DILATION');
    }
    this.emitHud();
  }

  private endRun(reason: 'obstacle' | 'fall'): void {
    this.phase = 'gameover';
    this.chronosTimer = 0;
    this.landmarkTransitionTimer = 0;
    this.landmarkTransitionPhase = 0;
    this.landmarkTransitionIntensity = 0;
    this.audio.stopVoiceover();
    const finalScore = this.computeTotalScore();
    const journey = getJourneyProgressForDistance(this.distance);
    const weatherMeta = this.weatherSystem.getWeatherMetadata();
    this.emitHud();
    this.callbacks.onGameOver({
      distance: this.distance,
      score: finalScore,
      gemsEarned: this.runGems,
      maxCombo: this.maxCombo,
      peakSpeedMultiplier: Number(this.peakSpeedMultiplier.toFixed(2)),
      biomeReached: this.currentBiome,
      landmarkReached: journey.currentStop.landmark,
      landmarkReachedName: journey.currentStop.name,
      weatherReached: weatherMeta.id,
      weatherLabel: weatherMeta.shortLabel,
      difficulty: this.difficultyMode,
      reason,
    });
  }

  private computeTotalScore(): number {
    const scoreFactor = DIFFICULTY_CONFIGS[this.difficultyMode].scoreFactor;
    return Math.floor((this.distance * 10 + this.bonusScore) * scoreFactor);
  }

  private triggerLandmarkArrival(
    kind: LahoreLandmarkKind,
    name: string,
    subtitle: string,
    accentHex: string,
    distanceMeters: number,
  ): void {
    this.currentLandmarkKind = kind;
    this.audio.setAmbientLandmark(kind);
    const nextWeather = pickWeatherForLandmark(kind, this.weatherSystem.getWeather());
    this.weatherSystem.setWeather(nextWeather);
    this.ambientWeatherOverlay.setForecast(getLandmarkForecast(kind), kind);
    this.audio.setAmbientWeather(nextWeather);
    const isNewEntry = Boolean(this.callbacks.onLandmarkEncountered?.(kind));
    this.landmarkPopupName = name;
    this.landmarkPopupSubtitle = subtitle;
    this.landmarkPopupAccent = accentHex;
    this.landmarkPopupDistance = distanceMeters;
    this.landmarkPopupTimer = 2.8;
    this.landmarkPopupSeq++;
    this.landmarkPopupIsNew = isNewEntry;
    this.landmarkTransitionTimer = LANDMARK_TRANSITION_DURATION;
    this.landmarkTransitionPhase = 0;
    this.landmarkTransitionAccent.set(accentHex);
    this.audio.playCityLandmark();

    const accentHexNum = Number.parseInt(accentHex.slice(1), 16) || 0xfbbf24;
    this.particles.spawnBurst(
      this.playerX - 3.5,
      this.playerY + 2.3,
      this.playerZ - 3.5,
      accentHexNum,
      12,
      5.6,
      1.05,
    );
    this.particles.spawnBurst(
      this.playerX + 3.5,
      this.playerY + 2.3,
      this.playerZ - 3.5,
      accentHexNum,
      12,
      5.6,
      1.05,
    );
    this.emitHud();
  }

  private emitHud(): void {
    const journey = getJourneyProgressForDistance(this.distance);
    const weatherMeta = this.weatherSystem.getWeatherMetadata();
    const musicMeta = this.music.getDominantTrackMeta();
    const stationMeta = this.music.getStationMeta();
    this.callbacks.onHudUpdate({
      distance: this.distance,
      score: this.computeTotalScore(),
      runGems: this.runGems,
      combo: this.combo,
      comboStreak: this.comboStreak,
      comboPopSeq: this.comboPopSeq,
      comboActionLabel: this.comboActionLabel,
      comboDecayRatio: Math.max(0, Math.min(1, this.comboDecayTimer / 4.2)),
      speedMultiplier: Number(this.speedMultiplier.toFixed(2)),
      difficulty: this.difficultyMode,
      biome: this.currentBiome,
      journeyStopName: journey.currentStop.name,
      journeySubtitle: journey.currentStop.subtitle,
      journeyAccentHex: journey.currentStop.accentHex,
      weather: weatherMeta.id,
      weatherLabel: weatherMeta.shortLabel,
      weatherAccentHex: weatherMeta.accentHex,
      ambientOverlayLabel: this.ambientWeatherOverlay.getSummary(),
      musicTrack: musicMeta.id,
      musicTrackLabel: musicMeta.shortLabel,
      radioStation: stationMeta.id,
      radioStationLabel: stationMeta.shortName,
      nextJourneyStopName: journey.nextStop.shortName,
      nextJourneyDistance: journey.metersToNext,
      journeyProgress: journey.segmentProgress,
      hasShield: this.hasShield,
      magnetTimer: this.magnetTimer,
      multiplierTimer: this.multiplierTimer,
      chronosTimer: this.chronosTimer,
      speedBoostTimer: this.speedBoostTimer,
      powerupFlashType: this.powerupFlashType,
      powerupFlashSeq: this.powerupFlashSeq,
      eventBanner: this.eventBanner,
      landmarkPopupName: this.landmarkPopupName,
      landmarkPopupSubtitle: this.landmarkPopupSubtitle,
      landmarkPopupAccent: this.landmarkPopupAccent,
      landmarkPopupDistance: this.landmarkPopupDistance,
      landmarkPopupSeq: this.landmarkPopupSeq,
      landmarkPopupIsNew: this.landmarkPopupIsNew,
      voiceoverCallout: this.voiceoverCallout,
      voiceoverSeq: this.voiceoverSeq,
      globalEventActive: this.globalEventStatus.active,
      globalEventName: this.globalEventStatus.name,
      globalEventLabel: this.globalEventStatus.triggerLabel,
      globalEventAccentHex: this.globalEventStatus.accentHex,
      jumps: this.runJumps,
      slides: this.runSlides,
      styleBonuses: this.runStyleBonuses,
      springHits: this.runSpringHits,
    });
  }

  private updateCamera(dt: number): void {
    const maxMult = DIFFICULTY_CONFIGS[this.difficultyMode].maxMultiplier;
    const speedRatio = THREE.MathUtils.clamp(
      (this.speedMultiplier - 1) / Math.max(0.1, maxMult - 1),
      0,
      1,
    );
    const targetFov =
      THREE.MathUtils.lerp(BASE_FOV, MAX_FOV, speedRatio) +
      this.chronosStrength * 5.5 +
      this.landmarkTransitionIntensity * 9.5;
    const nextFov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5.8, dt);
    if (Math.abs(nextFov - this.camera.fov) > 0.01) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }

    const camX = this.playerX * 0.58;
    const camY = 3.85 + Math.max(0, this.playerY * 0.72) + (this.isSliding ? -0.35 : 0);
    const camZ =
      this.playerZ +
      6.9 -
      speedRatio * 0.55 +
      this.chronosStrength * 0.65 -
      this.landmarkTransitionIntensity * 0.85;

    _camDesired.set(camX, camY, camZ);
    this.camera.position.lerp(_camDesired, 1 - Math.exp(-10 * dt));

    if (this.shakeIntensity > 0.005) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 12, dt);
    }

    _lookAtTarget.set(this.playerX * 0.35, this.playerY + 1.35, this.playerZ - 9.5);
    this.camera.lookAt(_lookAtTarget);

    // Subtle kinetic roll lean when carving between lanes
    const targetRoll = THREE.MathUtils.clamp(-this.laneVelX * 0.0085, -0.065, 0.065);
    this.cameraRoll = THREE.MathUtils.damp(this.cameraRoll, targetRoll, 11, dt);
    if (Math.abs(this.cameraRoll) > 0.0005) {
      this.camera.rotateZ(this.cameraRoll);
    }
  }

  private syncFollowLights(): void {
    const dn = this.dayNightState;
    this.keyLight.position.set(
      this.playerX + dn.keyOffsetX,
      dn.keyOffsetY,
      this.playerZ + dn.keyOffsetZ,
    );
    this.keyLight.target.position.set(this.playerX, 0, this.playerZ - 12);
    this.keyLight.target.updateMatrixWorld();
    this.nightGlowLight.position.set(
      this.playerX * 0.65,
      this.playerY + 3.4,
      this.playerZ - 4.0,
    );
    this.horizonRing.position.z = this.playerZ;
    this.celestialGroup.position.z = this.playerZ;
  }

  private updateEnvironmentLighting(dt: number, immediate = false): void {
    this.timeCheckAccum += dt;
    this.eventCheckAccum += dt;
    if (immediate || this.timeCheckAccum >= 1.0) {
      this.timeCheckAccum = 0;
      sampleDayNightState(getHourForLightingMode(this.lightingMode), this.dayNightState);
    }
    if (immediate || this.eventCheckAccum >= 2.0) {
      this.eventCheckAccum = 0;
      this.refreshGlobalEventStatus(!immediate);
    }

    const dn = this.dayNightState;
    const palette = BIOME_PALETTES[this.currentBiome];
    const landmarkTheme = LAHORE_LANDMARK_THEMES[this.currentLandmarkKind];
    const t = immediate ? 1 : 1 - Math.exp(-(1.6 + this.chronosStrength * 4.0) * dt);
    const chronoBlend = this.chronosStrength * 0.68;
    const targetCarnival = this.globalEventStatus.active ? 1 : 0;
    this.carnivalBlend = immediate
      ? targetCarnival
      : THREE.MathUtils.damp(this.carnivalBlend, targetCarnival, 1.4, dt);

    // Blend biome palette with the current Lahore landmark theme & local Lahore time
    const todBlend = dn.twilightBlend;
    const nightBlend = dn.nightFactor;
    const goldenHour = dn.goldenHourFactor;
    this.weatherSystem.getLightingModifiers(nightBlend, _weatherModifiers);

    _landmarkSky.setHex(landmarkTheme.skyHex);
    _landmarkFog.setHex(landmarkTheme.fogHex);
    _landmarkHemiSky.setHex(landmarkTheme.hemiSkyHex);
    _landmarkHemiGround.setHex(landmarkTheme.hemiGroundHex);
    _landmarkNightGlow.setHex(landmarkTheme.nightGlowHex);

    const landmarkDayBlend = 0.34 + goldenHour * 0.14;
    _biomeSky.setHex(palette.sky).lerp(_landmarkSky, landmarkDayBlend).lerp(dn.sky, todBlend);
    _biomeFog.setHex(palette.fog).lerp(_landmarkFog, landmarkDayBlend).lerp(dn.fog, todBlend);
    _biomeHemiSky
      .setHex(palette.hemiSky)
      .lerp(_landmarkHemiSky, landmarkDayBlend)
      .lerp(dn.hemiSky, todBlend);
    _biomeHemiGround
      .setHex(palette.hemiGround)
      .lerp(_landmarkHemiGround, landmarkDayBlend)
      .lerp(dn.hemiGround, todBlend);
    _biomeSun.setHex(palette.sun).lerp(dn.sunColor, todBlend);

    // Soft nocturnal horizon & atmospheric glow synchronized with current landmark theme
    if (nightBlend > 0.02) {
      _biomeSky.lerp(_landmarkNightGlow, nightBlend * 0.14);
      _biomeFog.lerp(_landmarkNightGlow, nightBlend * 0.24);
      _biomeHemiSky.lerp(_landmarkNightGlow, nightBlend * 0.26);
      _biomeHemiGround.lerp(_landmarkNightGlow, nightBlend * 0.22);
    }

    // Street Carnival celebratory Basant / Truck-Art sky palette overlay
    if (this.carnivalBlend > 0.001) {
      _carnivalSky.copy(_carnivalDaySky).lerp(_carnivalNightSky, nightBlend);
      _carnivalFog.copy(_carnivalDayFog).lerp(_carnivalNightFog, nightBlend);
      _biomeSky.lerp(_carnivalSky, this.carnivalBlend * 0.62);
      _biomeFog.lerp(_carnivalFog, this.carnivalBlend * 0.56);
      _biomeHemiSky.lerp(_carnivalHemiSky, this.carnivalBlend * 0.38);
      _biomeHemiGround.lerp(_carnivalHemiGround, this.carnivalBlend * 0.44);
      _biomeSun.lerp(_carnivalSun, this.carnivalBlend * 0.32);
      _landmarkNightGlow.lerp(_carnivalGlow, this.carnivalBlend * 0.65);
    }

    if (_weatherModifiers.skyTintWeight > 0.001) {
      _biomeSky.lerp(_weatherModifiers.skyTint, _weatherModifiers.skyTintWeight);
    }
    if (_weatherModifiers.fogTintWeight > 0.001) {
      _biomeFog.lerp(_weatherModifiers.fogTint, _weatherModifiers.fogTintWeight);
    }

    _targetSky.copy(_biomeSky).lerp(_chronosSky, chronoBlend);
    _targetFog.copy(_biomeFog).lerp(_chronosFog, chronoBlend);
    _targetHemiSky.copy(_biomeHemiSky).lerp(_chronosHemiSky, chronoBlend);
    _targetHemiGround.copy(_biomeHemiGround).lerp(_chronosHemiGround, chronoBlend);
    _targetSun.copy(_biomeSun).lerp(_chronosSun, chronoBlend);
    _targetRim
      .copy(dn.rimColor)
      .lerp(_goldenRimColor, goldenHour * 0.45)
      .lerp(_landmarkNightGlow, nightBlend * 0.55)
      .lerp(_carnivalRim, this.carnivalBlend * 0.58)
      .lerp(_chronosHemiSky, chronoBlend);

    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.lerp(_targetSky, t);
    }
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.lerp(_targetFog, t);
      this.scene.fog.near = THREE.MathUtils.lerp(
        this.scene.fog.near,
        _weatherModifiers.fogNear,
        t,
      );
      this.scene.fog.far = THREE.MathUtils.lerp(
        this.scene.fog.far,
        _weatherModifiers.fogFar,
        t,
      );
    }
    this.hemiLight.color.lerp(_targetHemiSky, t);
    this.hemiLight.groundColor.lerp(_targetHemiGround, t);
    this.keyLight.color.lerp(_targetSun, t);
    this.rimLight.color.lerp(_targetRim, t);

    // Position rim light opposite the sun during golden hour for long-shadow silhouette separation
    this.rimLight.position.set(-dn.keyOffsetX * 0.6, 9.5, -18);

    this.keyLight.intensity = THREE.MathUtils.lerp(
      this.keyLight.intensity,
      dn.sunIntensity * _weatherModifiers.sunIntensityMul,
      t,
    );
    this.hemiLight.intensity = THREE.MathUtils.lerp(
      this.hemiLight.intensity,
      dn.hemiIntensity * _weatherModifiers.hemiIntensityMul,
      t,
    );
    this.rimLight.intensity = THREE.MathUtils.lerp(
      this.rimLight.intensity,
      dn.rimIntensity + nightBlend * 0.16 + this.carnivalBlend * 0.22,
      t,
    );
    this.nightGlowLight.color.lerp(_landmarkNightGlow, t);
    const targetNightGlowIntensity =
      (THREE.MathUtils.smoothstep(nightBlend, 0.15, 0.92) *
        3.1 *
        landmarkTheme.nightGlowIntensity) +
      this.carnivalBlend * 1.45;
    this.nightGlowLight.intensity = THREE.MathUtils.lerp(
      this.nightGlowLight.intensity,
      targetNightGlowIntensity,
      t,
    );

    this.scene.environmentIntensity = THREE.MathUtils.lerp(
      this.scene.environmentIntensity,
      dn.envIntensity,
      t,
    );
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(
      this.renderer.toneMappingExposure,
      dn.exposure + _weatherModifiers.exposureOffset + this.carnivalBlend * 0.04,
      t,
    );

    this.currentNightFactor = THREE.MathUtils.lerp(this.currentNightFactor, nightBlend, t);
    this.worldBuilder.setNightFactor(this.currentNightFactor, _landmarkNightGlow.getHex());

    // Celestial Sun, Moon & Twinkling Stars
    this.sunGroup.visible = dn.sunVisible;
    if (dn.sunVisible) {
      this.sunGroup.position.set(dn.sunX, dn.sunY, -134);
      const sunAlt = THREE.MathUtils.clamp((dn.sunY + 4) / 36, 0, 1);
      this.sunDiscMat.color.copy(_sunHorizonColor).lerp(_sunMiddayColor, sunAlt);
      this.sunDiscMat.opacity = THREE.MathUtils.clamp((1 - nightBlend) * 1.15, 0, 1);
      this.sunHaloMat.opacity = this.sunDiscMat.opacity * 0.28;
    }

    this.moonGroup.visible = dn.moonVisible;
    if (dn.moonVisible) {
      this.moonGroup.position.set(dn.moonX, dn.moonY, -132);
      const moonAlpha = THREE.MathUtils.smoothstep(nightBlend, 0.15, 0.72);
      this.moonMat.opacity = moonAlpha;
      this.moonHaloMat.opacity = moonAlpha * 0.16;
    }

    const starBaseOpacity = THREE.MathUtils.smoothstep(nightBlend, 0.25, 0.9);
    if (starBaseOpacity > 0.01) {
      const twinkle = 0.86 + 0.14 * Math.sin(this.clock.elapsedTime * 1.6);
      this.starMat.opacity = starBaseOpacity * twinkle;
      this.starField.visible = true;
    } else {
      this.starMat.opacity = 0;
      this.starField.visible = false;
    }
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);

    for (const c of this.chunks) {
      this.scene.remove(c.group);
      this.worldBuilder.disposeChunk(c);
    }
    this.chunks.length = 0;
    this.worldBuilder.disposeShared();
    this.character.dispose();
    this.particles.dispose();
    this.powerupVfx.dispose();
    this.weatherSystem.dispose();
    this.ambientWeatherOverlay.dispose();
    this.chronosOverlayMesh.geometry.dispose();
    this.chronosOverlayMat.dispose();
    this.transitionTarget.dispose();
    this.blurZoomQuad.geometry.dispose();
    this.blurZoomMat.dispose();
    this.music.dispose();
    this.audio.dispose();
    this.haptics.cancel();

    this.hemiLight.dispose();
    this.keyLight.shadow.map?.dispose();
    this.keyLight.dispose();
    this.rimLight.dispose();
    this.nightGlowLight.dispose();

    this.celestialGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    });

    this.horizonRing.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    });

    if (this.scene.environment) {
      this.scene.environment.dispose();
    }

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
