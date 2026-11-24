import * as THREE from 'three';
import type { LahoreLandmarkKind } from './dailyLogin';
import { DIFFICULTY_CONFIGS } from './difficulty';
import {
  JOURNEY_CYCLE_METERS,
  JOURNEY_SEGMENT_METERS,
  LAHORE_TRACK_STOPS,
} from './lahoreJourney';
import { createLahoreTexturePack, type LahoreTexturePack } from './lahoreTextures';
import type { BiomeId, DifficultyMode, PowerupType } from './types';

export const LANE_WIDTH = 2.4;
export const LANE_X = [-LANE_WIDTH, 0, LANE_WIDTH] as const;
export const CHUNK_LENGTH = 36;

export interface DeckBox {
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
  topY: number;
  isRamp?: boolean;
  rampStartZ?: number; // higher Z (entry)
  rampEndZ?: number;   // lower Z (top)
  rampStartY?: number;
  rampEndY?: number;
}

export interface ObstacleItem {
  kind: 'jump' | 'slide' | 'tall' | 'moving';
  mesh: THREE.Group;
  baseX: number;
  x: number;
  prevX: number;
  y: number; // bottom Y of hazard hitbox
  z: number;
  halfW: number;
  height: number; // hazard vertical span [y, y + height]
  halfD: number;
  moveAmp: number;
  moveSpeed: number;
  movePhase: number;
  nearMissAwarded: boolean;
}

export interface GemItem {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  value: number;
  collected: boolean;
  bobPhase: number;
}

export interface PowerupItem {
  type: PowerupType;
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  collected: boolean;
  bobPhase: number;
}

export interface SpringPadItem {
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  triggered: boolean;
}

export interface BoostPadItem {
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  halfW: number;
  halfD: number;
  triggered: boolean;
  chevrons: THREE.Mesh[];
}

export interface LandmarkMarker {
  kind: LahoreLandmarkKind;
  name: string;
  subtitle: string;
  accentHex: string;
  z: number;
  distanceMeters: number;
  triggered: boolean;
}

export interface TrackChunk {
  group: THREE.Group;
  zStart: number; // higher Z (near edge)
  zEnd: number;   // lower Z (far edge = zStart - CHUNK_LENGTH)
  biome: BiomeId;
  decks: DeckBox[];
  obstacles: ObstacleItem[];
  gems: GemItem[];
  powerups: PowerupItem[];
  springs: SpringPadItem[];
  boostPads: BoostPadItem[];
  landmarkMarker?: LandmarkMarker;
}

export interface BiomePalette {
  sky: number;
  fog: number;
  hemiSky: number;
  hemiGround: number;
  sun: number;
  deck: number;
  deckTrim: number;
  cliff: number;
  foliage: number;
  hazard: number;
  hazardAccent: number;
  beam: number;
}

// Lahore Districts:
// - canyon    -> Androon Lahore (Walled City, golden sandstone & red Mughal brick)
// - skybridge -> Canal Road & Mall Flyover (Crisp green curbs, lush canal trees & metro flyovers)
// - obsidian  -> Food Street & Liberty Nights (Festive evening lights, marigold & ruby bazaar lanterns)
export const BIOME_PALETTES: Record<BiomeId, BiomePalette> = {
  canyon: {
    sky: 0x8ccdf2,
    fog: 0xe6c89e,
    hemiSky: 0xfff3d6,
    hemiGround: 0x8d4e32,
    sun: 0xffe8b8,
    deck: 0x5c4b43,
    deckTrim: 0xc2653b,
    cliff: 0xa64b32,
    foliage: 0x2f7d44,
    hazard: 0xd94826,
    hazardAccent: 0xfacc15,
    beam: 0xe11d48,
  },
  skybridge: {
    sky: 0x67b6eb,
    fog: 0xbfe2f7,
    hemiSky: 0xe0f2fe,
    hemiGround: 0x2d5a42,
    sun: 0xfffbeb,
    deck: 0x333c4a,
    deckTrim: 0x15803d,
    cliff: 0xc2895b,
    foliage: 0x16a34a,
    hazard: 0xea580c,
    hazardAccent: 0xfde047,
    beam: 0x0284c7,
  },
  obsidian: {
    sky: 0x2a1b45,
    fog: 0x5c2751,
    hemiSky: 0xf472b6,
    hemiGround: 0x1e1b2e,
    sun: 0xffb36b,
    deck: 0x262d3d,
    deckTrim: 0xf59e0b,
    cliff: 0x5b2c2a,
    foliage: 0x10b981,
    hazard: 0xf97316,
    hazardAccent: 0xfef08a,
    beam: 0xec4899,
  },
};

export function getBiomeForDistance(meters: number): BiomeId {
  const cycle = Math.max(0, meters) % JOURNEY_CYCLE_METERS;
  if (cycle < JOURNEY_SEGMENT_METERS * 3) return 'canyon';
  if (cycle < JOURNEY_SEGMENT_METERS * 5) return 'skybridge';
  return 'obsidian';
}

const _dayCloudColor = new THREE.Color(0xffffff);
const _nightCloudColor = new THREE.Color(0x283552);
const _landmarkGlowTint = new THREE.Color();
const _baseWarmEmissive = new THREE.Color(0xfde047);
const _baseRailEmissive = new THREE.Color(0xf59e0b);

export class WorldBuilder {
  // Shared geometries to minimize GPU memory & draw overhead
  private readonly gemGeo = new THREE.OctahedronGeometry(0.32, 0);
  private readonly pillarGeo = new THREE.BoxGeometry(0.24, 2.75, 0.24);
  private readonly beamGeo = new THREE.BoxGeometry(2.38, 0.62, 0.36);
  private readonly awningGeo = new THREE.BoxGeometry(2.44, 0.22, 0.72);
  private readonly hurdleGeo = new THREE.BoxGeometry(2.15, 0.48, 0.32);
  private readonly hurdleLegGeo = new THREE.BoxGeometry(0.18, 0.94, 0.44);
  private readonly coneGeo = new THREE.ConeGeometry(0.16, 0.44, 6);
  private readonly tallGeo = new THREE.BoxGeometry(1.86, 2.45, 1.1);
  private readonly tallArchCapGeo = new THREE.BoxGeometry(2.08, 0.34, 1.24);
  private readonly tallDomeGeo = new THREE.SphereGeometry(0.68, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6);
  private readonly finialGeo = new THREE.ConeGeometry(0.12, 0.5, 5);

  // Lahore Auto-Rickshaw (Chingchi / Tuk-Tuk) shared parts
  private readonly rickshawBodyGeo = new THREE.BoxGeometry(1.12, 0.62, 1.38);
  private readonly rickshawNoseGeo = new THREE.BoxGeometry(0.86, 0.56, 0.52);
  private readonly rickshawRoofGeo = new THREE.BoxGeometry(1.18, 0.18, 1.48);
  private readonly rickshawPostGeo = new THREE.BoxGeometry(0.08, 0.66, 0.08);
  private readonly rickshawWheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.16, 8);
  private readonly rickshawLightGeo = new THREE.BoxGeometry(0.24, 0.14, 0.08);

  private readonly springBaseGeo = new THREE.CylinderGeometry(0.72, 0.85, 0.18, 6);
  private readonly springCoreGeo = new THREE.CylinderGeometry(0.46, 0.56, 0.14, 6);
  private readonly boostBaseGeo = new THREE.BoxGeometry(1.56, 0.08, 2.9);
  private readonly boostRailGeo = new THREE.BoxGeometry(0.11, 0.14, 2.94);
  private readonly boostChevronGeo = new THREE.BoxGeometry(0.56, 0.06, 0.22);

  // Lahore Street Architecture & Roadside Scenery
  private readonly dashGeo = new THREE.BoxGeometry(0.16, 0.03, 2.2);
  private readonly catEyeGeo = new THREE.BoxGeometry(0.18, 0.04, 0.24);
  private readonly roadEdgeLineGeo = new THREE.BoxGeometry(0.12, 0.03, CHUNK_LENGTH);
  private readonly curbSegGeo = new THREE.BoxGeometry(0.28, 0.22, 3.0);
  private readonly sidewalkGeo = new THREE.BoxGeometry(14.0, 0.8, CHUNK_LENGTH);
  private readonly canalWaterGeo = new THREE.BoxGeometry(3.2, 0.14, CHUNK_LENGTH);
  private readonly haveliBodyGeo = new THREE.BoxGeometry(4.4, 6.2, 5.2);
  private readonly haveliRoofGeo = new THREE.BoxGeometry(4.65, 0.42, 5.45);
  private readonly kanguraGeo = new THREE.BoxGeometry(0.55, 0.45, 0.36);
  private readonly jharokhaGeo = new THREE.BoxGeometry(0.68, 1.45, 2.1);
  private readonly shopAwningGeo = new THREE.BoxGeometry(1.45, 0.18, 4.6);
  private readonly windowGlowGeo = new THREE.BoxGeometry(0.12, 0.95, 0.72);
  private readonly treeTrunkGeo = new THREE.CylinderGeometry(0.22, 0.36, 2.2, 6);
  private readonly neemCrownGeo1 = new THREE.DodecahedronGeometry(1.45, 0);
  private readonly neemCrownGeo2 = new THREE.DodecahedronGeometry(1.05, 0);
  private readonly lampPostGeo = new THREE.CylinderGeometry(0.07, 0.11, 4.2, 6);
  private readonly lampArmGeo = new THREE.BoxGeometry(0.95, 0.09, 0.09);
  private readonly lampBulbGeo = new THREE.BoxGeometry(0.32, 0.14, 0.22);
  private readonly fairyBulbGeo = new THREE.OctahedronGeometry(0.12, 0);
  private readonly minaretShaftGeo = new THREE.CylinderGeometry(0.45, 0.72, 12.5, 8);
  private readonly mosqueDomeGeo = new THREE.SphereGeometry(2.6, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.62);
  private readonly cloudGeo = new THREE.DodecahedronGeometry(1.6, 0);

  // Comic Billboard, Gate Comic Banner, Chai Dhabba & Street Bunting Geometries
  private readonly billboardFrameGeo = new THREE.BoxGeometry(3.75, 1.98, 0.18);
  private readonly billboardFaceGeo = new THREE.PlaneGeometry(3.5, 1.75);
  private readonly billboardPostGeo = new THREE.CylinderGeometry(0.1, 0.12, 2.4, 6);
  private readonly gateComicFaceGeo = new THREE.PlaneGeometry(2.26, 0.96);
  private readonly shopBoardFrameGeo = new THREE.BoxGeometry(0.16, 1.32, 3.1);
  private readonly shopBoardFaceGeo = new THREE.PlaneGeometry(2.86, 1.18);
  private readonly stallTableGeo = new THREE.BoxGeometry(1.25, 0.9, 2.2);
  private readonly samovarGeo = new THREE.CylinderGeometry(0.2, 0.26, 0.65, 8);
  private readonly umbrellaPoleGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.35, 6);
  private readonly umbrellaGeo = new THREE.ConeGeometry(1.25, 0.52, 6);
  private readonly buntingWireGeo = new THREE.BoxGeometry(9.4, 0.05, 0.05);
  private readonly buntingFlagGeo = new THREE.ConeGeometry(0.22, 0.42, 3);

  private readonly fullDeck36Geo = new THREE.BoxGeometry(LANE_WIDTH * 3 + 0.6, 1.2, CHUNK_LENGTH);

  // Shared Power-up Geometries & Materials
  private readonly powerupIcoGeo = new THREE.IcosahedronGeometry(0.42, 0);
  private readonly powerupHaloGeo = new THREE.TorusGeometry(0.58, 0.06, 6, 12);
  private readonly chronosCrystalGeo = new THREE.OctahedronGeometry(0.42, 0);
  private readonly chronosHeartGeo = new THREE.OctahedronGeometry(0.22, 0);
  private readonly chronosRingAGeo = new THREE.TorusGeometry(0.62, 0.042, 6, 18);
  private readonly chronosRingBGeo = new THREE.TorusGeometry(0.74, 0.032, 6, 18);
  private readonly chronosShardGeo = new THREE.OctahedronGeometry(0.11, 0);

  private readonly powerupMats: Record<Exclude<PowerupType, 'chronos'>, THREE.MeshStandardMaterial> = {
    shield: new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.75,
      roughness: 0.18,
      metalness: 0.75,
      flatShading: true,
    }),
    magnet: new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.75,
      roughness: 0.18,
      metalness: 0.75,
      flatShading: true,
    }),
    multiplier: new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xf43f5e,
      emissiveIntensity: 0.75,
      roughness: 0.18,
      metalness: 0.75,
      flatShading: true,
    }),
  };

  private readonly chronosCrystalMat = new THREE.MeshPhysicalMaterial({
    color: 0xa855f7,
    emissive: 0x7e22ce,
    emissiveIntensity: 0.85,
    roughness: 0.12,
    metalness: 0.72,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    flatShading: true,
  });

  private readonly chronosHeartMat = new THREE.MeshStandardMaterial({
    color: 0x67e8f9,
    emissive: 0x22d3ee,
    emissiveIntensity: 1.2,
    roughness: 0.15,
    metalness: 0.5,
    flatShading: true,
  });

  private readonly chronosRingCyanMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.9,
    roughness: 0.22,
    metalness: 0.85,
  });

  private readonly chronosRingGoldMat = new THREE.MeshStandardMaterial({
    color: 0xfde047,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.75,
    roughness: 0.2,
    metalness: 0.9,
  });

  // Shared materials
  private readonly lahoreTextures: LahoreTexturePack;
  private readonly biomeMaterials: Record<
    BiomeId,
    {
      deckMat: THREE.MeshStandardMaterial;
      trimMat: THREE.MeshStandardMaterial;
      hazardMat: THREE.MeshStandardMaterial;
      hazardAccentMat: THREE.MeshStandardMaterial;
      beamMat: THREE.MeshStandardMaterial;
      cliffMat: THREE.MeshStandardMaterial;
      foliageMat: THREE.MeshStandardMaterial;
    }
  >;

  constructor(maxAnisotropy = 4) {
    this.lahoreTextures = createLahoreTexturePack(maxAnisotropy);

    const buildBiomeSet = (biome: BiomeId) => {
      const palette = BIOME_PALETTES[biome];
      const roadMap =
        biome === 'canyon'
          ? this.lahoreTextures.walledRoadTex
          : biome === 'skybridge'
            ? this.lahoreTextures.gardenMarbleTex
            : this.lahoreTextures.asphaltRoadTex;
      return {
        deckMat: new THREE.MeshStandardMaterial({
          color: biome === 'obsidian' ? 0xcbd5e1 : 0xffffff,
          map: roadMap,
          roughness: biome === 'skybridge' ? 0.62 : 0.84,
          metalness: biome === 'skybridge' ? 0.12 : 0.05,
          flatShading: true,
        }),
        trimMat: new THREE.MeshStandardMaterial({
          color: palette.deckTrim,
          roughness: 0.52,
          metalness: 0.22,
          flatShading: true,
        }),
        hazardMat: new THREE.MeshStandardMaterial({
          color: palette.hazard,
          roughness: 0.45,
          metalness: 0.25,
          flatShading: true,
        }),
        hazardAccentMat: new THREE.MeshStandardMaterial({
          color: palette.hazardAccent,
          emissive: palette.hazardAccent,
          emissiveIntensity: 0.45,
          roughness: 0.25,
          metalness: 0.55,
          flatShading: true,
        }),
        beamMat: new THREE.MeshStandardMaterial({
          color: palette.beam,
          emissive: palette.beam,
          emissiveIntensity: 0.48,
          roughness: 0.28,
          metalness: 0.4,
          flatShading: true,
        }),
        cliffMat: new THREE.MeshStandardMaterial({
          color: palette.cliff,
          roughness: 0.86,
          metalness: 0.05,
          flatShading: true,
        }),
        foliageMat: new THREE.MeshStandardMaterial({
          color: palette.foliage,
          roughness: 0.76,
          metalness: 0.05,
          flatShading: true,
        }),
      };
    };

    this.biomeMaterials = {
      canyon: buildBiomeSet('canyon'),
      skybridge: buildBiomeSet('skybridge'),
      obsidian: buildBiomeSet('obsidian'),
    };
  }

  public setRainWetness(wetness: number): void {
    const w = THREE.MathUtils.clamp(wetness, 0, 1);
    const canyonDeck = this.biomeMaterials.canyon.deckMat;
    canyonDeck.roughness = THREE.MathUtils.lerp(0.84, 0.28, w);
    canyonDeck.metalness = THREE.MathUtils.lerp(0.05, 0.34, w);

    const obsidianDeck = this.biomeMaterials.obsidian.deckMat;
    obsidianDeck.roughness = THREE.MathUtils.lerp(0.84, 0.26, w);
    obsidianDeck.metalness = THREE.MathUtils.lerp(0.05, 0.38, w);

    const skyDeck = this.biomeMaterials.skybridge.deckMat;
    skyDeck.roughness = THREE.MathUtils.lerp(0.62, 0.2, w);
    skyDeck.metalness = THREE.MathUtils.lerp(0.12, 0.4, w);
  }

  public setNightFactor(nightFactor: number, landmarkGlowHex?: number): void {
    const t = THREE.MathUtils.clamp(nightFactor, 0, 1);
    this.warmLightMat.emissiveIntensity = THREE.MathUtils.lerp(0.55, 1.85, t);
    this.redLightMat.emissiveIntensity = THREE.MathUtils.lerp(0.55, 1.5, t);
    this.canalWaterMat.emissiveIntensity = THREE.MathUtils.lerp(0.18, 0.52, t);
    this.lahoreTextures.truckArtRailMat.emissiveIntensity = THREE.MathUtils.lerp(0.14, 0.48, t);
    const comicEmissive = THREE.MathUtils.lerp(0.22, 0.58, t);
    for (const m of this.lahoreTextures.comicMaterials) {
      m.emissiveIntensity = comicEmissive;
    }
    this.cloudMat.color.copy(_dayCloudColor).lerp(_nightCloudColor, t);

    if (landmarkGlowHex !== undefined) {
      _landmarkGlowTint.setHex(landmarkGlowHex);
      this.warmLightMat.emissive.copy(_baseWarmEmissive).lerp(_landmarkGlowTint, t * 0.42);
      this.lahoreTextures.truckArtRailMat.emissive
        .copy(_baseRailEmissive)
        .lerp(_landmarkGlowTint, t * 0.55);
      this.cloudMat.color.lerp(_landmarkGlowTint, t * 0.14);
    }
  }

  private readonly gemMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.65,
    roughness: 0.15,
    metalness: 0.75,
    flatShading: true,
  });

  private readonly bonusGemMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xd97706,
    emissiveIntensity: 0.75,
    roughness: 0.14,
    metalness: 0.85,
    flatShading: true,
  });

  private readonly springPadMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.9,
    roughness: 0.2,
    metalness: 0.6,
    flatShading: true,
  });

  private readonly boostAmberMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xf97316,
    emissiveIntensity: 1.15,
    roughness: 0.2,
    metalness: 0.65,
    flatShading: true,
  });

  private readonly boostVioletMat = new THREE.MeshStandardMaterial({
    color: 0xc084fc,
    emissive: 0x9333ea,
    emissiveIntensity: 1.15,
    roughness: 0.2,
    metalness: 0.65,
    flatShading: true,
  });

  private readonly darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.4,
    metalness: 0.75,
    flatShading: true,
  });

  private readonly roadStripeMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.65,
    metalness: 0.05,
    flatShading: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  private readonly roadYellowMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.6,
    metalness: 0.05,
    flatShading: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  private readonly canalWaterMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    emissive: 0x0369a1,
    emissiveIntensity: 0.22,
    roughness: 0.18,
    metalness: 0.45,
    flatShading: true,
  });

  private readonly brassMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.28,
    metalness: 0.85,
    flatShading: true,
  });

  private readonly umbrellaRedMat = new THREE.MeshStandardMaterial({
    color: 0xe11d48,
    roughness: 0.65,
    metalness: 0.05,
    flatShading: true,
  });

  private readonly pakGreenMat = new THREE.MeshStandardMaterial({
    color: 0x15803d,
    roughness: 0.55,
    metalness: 0.15,
    flatShading: true,
  });

  private readonly rickshawYellowMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.48,
    metalness: 0.1,
    flatShading: true,
  });

  private readonly truckPinkMat = new THREE.MeshStandardMaterial({
    color: 0xec4899,
    roughness: 0.42,
    metalness: 0.2,
    flatShading: true,
  });

  private readonly warmLightMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfde047,
    emissiveIntensity: 0.95,
    roughness: 0.25,
    metalness: 0.1,
  });

  private readonly redLightMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 0.85,
    roughness: 0.25,
    metalness: 0.1,
  });

  private readonly marbleWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.38,
    metalness: 0.1,
    flatShading: true,
  });

  private readonly brickRedMat = new THREE.MeshStandardMaterial({
    color: 0x9a3412,
    roughness: 0.84,
    metalness: 0.04,
    flatShading: true,
  });

  private readonly ochreSandMat = new THREE.MeshStandardMaterial({
    color: 0xd99b52,
    roughness: 0.78,
    metalness: 0.05,
    flatShading: true,
  });

  private readonly woodBalconyMat = new THREE.MeshStandardMaterial({
    color: 0x5c3419,
    roughness: 0.8,
    metalness: 0.05,
    flatShading: true,
  });

  private readonly hazardYellowMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.45,
    metalness: 0.2,
    flatShading: true,
  });

  private readonly cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.0,
    flatShading: true,
  });

  private readonly trunkMat = new THREE.MeshStandardMaterial({
    color: 0x6b4423,
    roughness: 0.88,
    metalness: 0.05,
    flatShading: true,
  });

  public buildChunk(
    chunkIndex: number,
    zStart: number,
    biome: BiomeId,
    difficulty: number,
    difficultyMode: DifficultyMode = 'normal',
  ): TrackChunk {
    const group = new THREE.Group();
    const density = DIFFICULTY_CONFIGS[difficultyMode].obstacleDensity;
    const {
      deckMat,
      trimMat,
      hazardMat,
      hazardAccentMat,
      beamMat,
      cliffMat,
      foliageMat,
    } = this.biomeMaterials[biome];

    const chunk: TrackChunk = {
      group,
      zStart,
      zEnd: zStart - CHUNK_LENGTH,
      biome,
      decks: [],
      obstacles: [],
      gems: [],
      powerups: [],
      springs: [],
      boostPads: [],
    };

    // Starter chunk (chunkIndex <= 1) is an easy clean Lahore avenue with warm-up gems
    if (chunkIndex <= 1) {
      this.addFullDeck(chunk, zStart, CHUNK_LENGTH, 0, deckMat, trimMat);
      if (chunkIndex === 1) {
        this.addGemLine(chunk, 0, 0.75, zStart - 10, 4, 2.2, false);
        this.addJumpHurdle(chunk, 0, 0, zStart - 24, hazardMat, hazardAccentMat);
        this.addGemArc(chunk, 0, 0, zStart - 24);
      }
      this.populateLahoreScenery(chunk, chunkIndex, zStart, biome, cliffMat, foliageMat, beamMat);
      return chunk;
    }

    // Choose dynamic Lahore street pattern
    const roll = Math.random();
    if (roll < 0.22) {
      this.buildChasmJumpPattern(chunk, zStart, difficulty, density, deckMat, trimMat, hazardMat, hazardAccentMat, beamMat);
      if (chunkIndex % 2 === 0 || Math.random() < 0.45) {
        const boostLane = Math.floor(Math.random() * 3);
        this.addBoostPad(chunk, LANE_X[boostLane], 0, zStart - 5.2);
      }
    } else if (roll < 0.44) {
      this.buildElevatedDeckPattern(chunk, zStart, difficulty, density, deckMat, trimMat, hazardMat, hazardAccentMat, beamMat);
      if (chunkIndex % 2 === 0 || Math.random() < 0.5) {
        const boostLane = Math.floor(Math.random() * 3);
        this.addBoostPad(chunk, LANE_X[boostLane], 0, zStart - 33.2);
      }
    } else if (roll < 0.64) {
      this.buildSpringSkyRailPattern(chunk, zStart, density, deckMat, trimMat, hazardMat, hazardAccentMat, beamMat);
      if (chunkIndex % 2 === 0 || Math.random() < 0.48) {
        const boostLane = Math.floor(Math.random() * 3);
        this.addBoostPad(chunk, LANE_X[boostLane], 0, zStart - 32.5);
      }
    } else if (roll < 0.84) {
      this.buildRhythmJumpSlidePattern(chunk, zStart, difficulty, density, deckMat, trimMat, hazardMat, hazardAccentMat, beamMat);
      if (chunkIndex % 2 === 0 || Math.random() < 0.45) {
        const boostLane = Math.floor(Math.random() * 3);
        this.addBoostPad(chunk, LANE_X[boostLane], 0, zStart - 4.0);
      }
    } else {
      this.buildMovingSentinelPattern(chunk, zStart, difficulty, density, deckMat, trimMat, hazardMat, hazardAccentMat, beamMat);
      if (chunkIndex % 2 === 0 || Math.random() < 0.45) {
        const boostLane = Math.floor(Math.random() * 3);
        this.addBoostPad(chunk, LANE_X[boostLane], 0, zStart - 5.5);
      }
    }

    // Occasional powerup spawn in the chunk
    if (Math.random() < 0.34) {
      const types: PowerupType[] = ['shield', 'magnet', 'multiplier', 'chronos'];
      const pType = types[Math.floor(Math.random() * types.length)];
      const laneIdx = Math.floor(Math.random() * 3);
      this.addPowerup(chunk, pType, LANE_X[laneIdx], 1.15, zStart - CHUNK_LENGTH * 0.5);
    }

    this.populateLahoreScenery(chunk, chunkIndex, zStart, biome, cliffMat, foliageMat, beamMat);
    return chunk;
  }

  private addFullDeck(
    chunk: TrackChunk,
    zTop: number,
    length: number,
    topY: number,
    deckMat: THREE.Material,
    trimMat: THREE.Material,
  ): void {
    const width = LANE_WIDTH * 3 + 0.6;
    const thickness = 1.2;
    const geo =
      Math.abs(length - CHUNK_LENGTH) < 0.01
        ? this.fullDeck36Geo
        : new THREE.BoxGeometry(width, thickness, length);
    const mesh = new THREE.Mesh(geo, deckMat);
    mesh.position.set(0, topY - thickness / 2, zTop - length / 2);
    mesh.receiveShadow = true;
    chunk.group.add(mesh);

    // Alternating Lahore green/white or sandstone/brick sidewalk curb blocks
    const segCount = Math.max(2, Math.round(length / 3));
    const segLen = length / segCount;
    for (let i = 0; i < segCount; i++) {
      const segZ = zTop - i * segLen - segLen * 0.5;
      const useGreenOrWhite = chunk.biome === 'skybridge';
      const curbMat =
        i % 2 === 0
          ? useGreenOrWhite
            ? this.pakGreenMat
            : trimMat
          : useGreenOrWhite
            ? this.marbleWhiteMat
            : this.ochreSandMat;

      const leftCurb = new THREE.Mesh(this.curbSegGeo, curbMat);
      leftCurb.scale.set(1, 1, segLen / 3.0);
      leftCurb.position.set(-width / 2 + 0.14, topY + 0.11, segZ);
      leftCurb.receiveShadow = true;
      chunk.group.add(leftCurb);

      const rightCurb = new THREE.Mesh(this.curbSegGeo, curbMat);
      rightCurb.scale.set(1, 1, segLen / 3.0);
      rightCurb.position.set(width / 2 - 0.14, topY + 0.11, segZ);
      rightCurb.receiveShadow = true;
      chunk.group.add(rightCurb);
    }

    // Crisp dashed Pakistani road lane markings + glowing cat's-eye studs + shoulder stripes
    const dashCount = Math.max(1, Math.floor(length / 4.5));
    for (let i = 0; i < dashCount; i++) {
      const dashZ = zTop - 2.25 - i * 4.5;
      for (const dx of [-LANE_WIDTH / 2, LANE_WIDTH / 2]) {
        const dash = new THREE.Mesh(this.dashGeo, this.roadStripeMat);
        dash.position.set(dx, topY + 0.02, dashZ);
        dash.receiveShadow = true;
        chunk.group.add(dash);

        if (i % 2 === 0) {
          const catEye = new THREE.Mesh(
            this.catEyeGeo,
            chunk.biome === 'skybridge' ? this.springPadMat : this.warmLightMat,
          );
          catEye.position.set(dx, topY + 0.03, dashZ + 1.45);
          chunk.group.add(catEye);
        }
      }
    }

    for (const sx of [-width / 2 + 0.36, width / 2 - 0.36]) {
      const edgeLine = new THREE.Mesh(this.roadEdgeLineGeo, this.roadYellowMat);
      edgeLine.scale.set(1, 1, length / CHUNK_LENGTH);
      edgeLine.position.set(sx, topY + 0.02, zTop - length / 2);
      edgeLine.receiveShadow = true;
      chunk.group.add(edgeLine);
    }

    chunk.decks.push({
      xMin: -width / 2,
      xMax: width / 2,
      zMin: zTop - length,
      zMax: zTop,
      topY,
    });
  }

  private addLaneDeck(
    chunk: TrackChunk,
    laneIdx: number,
    zTop: number,
    length: number,
    topY: number,
    deckMat: THREE.Material,
    _trimMat: THREE.Material,
  ): void {
    const laneW = LANE_WIDTH - 0.08;
    const thickness = 1.1;
    const x = LANE_X[laneIdx];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(laneW, thickness, length), deckMat);
    mesh.position.set(x, topY - thickness / 2, zTop - length / 2);
    mesh.receiveShadow = true;
    chunk.group.add(mesh);

    // Lahore Metro flyover truck-art side safety trim
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(laneW + 0.1, 0.18, length),
      this.lahoreTextures.truckArtRailMat,
    );
    strip.position.set(x, topY - 0.06, zTop - length / 2);
    strip.receiveShadow = true;
    chunk.group.add(strip);

    chunk.decks.push({
      xMin: x - laneW / 2,
      xMax: x + laneW / 2,
      zMin: zTop - length,
      zMax: zTop,
      topY,
    });
  }

  private addLaneRamp(
    chunk: TrackChunk,
    laneIdx: number,
    zTop: number,
    length: number,
    startY: number,
    endY: number,
    deckMat: THREE.Material,
    trimMat: THREE.Material,
  ): void {
    const laneW = LANE_WIDTH - 0.12;
    const x = LANE_X[laneIdx];
    const dy = endY - startY;
    const hyp = Math.hypot(length, dy);
    const angle = Math.atan2(dy, length);

    const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(laneW, 0.45, hyp), deckMat);
    rampMesh.position.set(x, (startY + endY) / 2 - 0.22, zTop - length / 2);
    rampMesh.rotation.x = angle;
    rampMesh.receiveShadow = true;
    rampMesh.castShadow = true;
    chunk.group.add(rampMesh);

    const guide = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, hyp * 0.85), trimMat);
    guide.position.set(x, (startY + endY) / 2 + 0.03, zTop - length / 2);
    guide.rotation.x = angle;
    guide.receiveShadow = true;
    chunk.group.add(guide);

    chunk.decks.push({
      xMin: x - laneW / 2,
      xMax: x + laneW / 2,
      zMin: zTop - length,
      zMax: zTop,
      topY: endY,
      isRamp: true,
      rampStartZ: zTop,
      rampEndZ: zTop - length,
      rampStartY: startY,
      rampEndY: endY,
    });
  }

  // Pattern 1: Canal / Roadwork Chasm Jump — bridges with open sky gaps
  private buildChasmJumpPattern(
    chunk: TrackChunk,
    zStart: number,
    difficulty: number,
    density: number,
    deckMat: THREE.Material,
    trimMat: THREE.Material,
    hazardMat: THREE.Material,
    hazardAccentMat: THREE.Material,
    beamMat: THREE.Material,
  ): void {
    this.addFullDeck(chunk, zStart, 11, 0, deckMat, trimMat);
    const safeLane = Math.floor(Math.random() * 3);
    const secondBridge = density < 0.75 || (density <= 1.1 && difficulty < 0.45) ? (safeLane + 1) % 3 : -1;
    for (let l = 0; l < 3; l++) {
      if (l === safeLane || l === secondBridge) {
        this.addLaneDeck(chunk, l, zStart - 11, 6.0, 0, deckMat, trimMat);
      }
    }
    const jumpLane = (safeLane + 2) % 3;
    this.addGemArc(chunk, LANE_X[jumpLane], 0.4, zStart - 14.0);

    this.addFullDeck(chunk, zStart - 17.0, 19.0, 0, deckMat, trimMat);
    if (density >= 0.75 && (difficulty > 0.25 || density > 1.25)) {
      this.addSlideGate(chunk, LANE_X[safeLane], 0, zStart - 24, beamMat);
      this.addGemLine(chunk, LANE_X[safeLane], 0.55, zStart - 22, 3, 2.0, false);
    }
    const otherLane = (safeLane + 1) % 3;
    this.addJumpHurdle(chunk, LANE_X[otherLane], 0, zStart - 28, hazardMat, hazardAccentMat);
    if (density > 1.25) {
      this.addJumpHurdle(chunk, LANE_X[jumpLane], 0, zStart - 28, hazardMat, hazardAccentMat);
    }
  }

  // Pattern 2: Canal Flyover Ramp + Lower Bazaar Lanes
  private buildElevatedDeckPattern(
    chunk: TrackChunk,
    zStart: number,
    difficulty: number,
    density: number,
    deckMat: THREE.Material,
    trimMat: THREE.Material,
    hazardMat: THREE.Material,
    hazardAccentMat: THREE.Material,
    beamMat: THREE.Material,
  ): void {
    this.addFullDeck(chunk, zStart, CHUNK_LENGTH, 0, deckMat, trimMat);

    const highLane = Math.floor(Math.random() * 3);
    const highY = 1.65;
    this.addLaneRamp(chunk, highLane, zStart - 4, 6, 0, highY, deckMat, trimMat);
    this.addLaneDeck(chunk, highLane, zStart - 10, 18, highY, deckMat, trimMat);
    this.addGemLine(chunk, LANE_X[highLane], highY + 0.75, zStart - 13, 5, 2.6, true);

    if (density >= 0.75 && (difficulty > 0.3 || density > 1.25)) {
      this.addJumpHurdle(chunk, LANE_X[highLane], highY, zStart - 24, hazardMat, hazardAccentMat);
    }

    for (let l = 0; l < 3; l++) {
      if (l === highLane) continue;
      if (l % 2 === 0) {
        this.addSlideGate(chunk, LANE_X[l], 0, zStart - 16, beamMat);
        if (density >= 0.75) {
          this.addTallPillar(chunk, LANE_X[l], 0, zStart - 28, hazardMat, hazardAccentMat);
        }
      } else {
        this.addJumpHurdle(chunk, LANE_X[l], 0, zStart - 18, hazardMat, hazardAccentMat);
        if (density > 1.25) {
          this.addSlideGate(chunk, LANE_X[l], 0, zStart - 29, beamMat);
        }
      }
    }
  }

  // Pattern 3: Spring Pad Rooftop Launch + Aerial Gem Arc
  private buildSpringSkyRailPattern(
    chunk: TrackChunk,
    zStart: number,
    density: number,
    deckMat: THREE.Material,
    trimMat: THREE.Material,
    hazardMat: THREE.Material,
    hazardAccentMat: THREE.Material,
    beamMat: THREE.Material,
  ): void {
    this.addFullDeck(chunk, zStart, CHUNK_LENGTH, 0, deckMat, trimMat);
    const springLane = Math.floor(Math.random() * 3);
    this.addSpringPad(chunk, LANE_X[springLane], 0, zStart - 9);

    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const zPos = zStart - 12 - i * 3.0;
      const yPos = 2.0 + Math.sin(t * Math.PI) * 3.2;
      this.addSingleGem(chunk, LANE_X[springLane], yPos, zPos, true);
    }

    const blocked1 = (springLane + 1) % 3;
    const lane3 = (springLane + 2) % 3;
    if (density >= 0.75) {
      this.addTallPillar(chunk, LANE_X[blocked1], 0, zStart - 18, hazardMat, hazardAccentMat);
    }
    this.addJumpHurdle(chunk, LANE_X[springLane], 0, zStart - 20, hazardMat, hazardAccentMat);
    if (density >= 0.75) {
      this.addJumpHurdle(chunk, LANE_X[lane3], 0, zStart - 27, hazardMat, hazardAccentMat);
    }
    if (density > 1.25) {
      this.addSlideGate(chunk, LANE_X[lane3], 0, zStart - 17, beamMat);
    }
  }

  // Pattern 4: Bazaar Awning Slide -> Traffic Barrier Jump Rhythm
  private buildRhythmJumpSlidePattern(
    chunk: TrackChunk,
    zStart: number,
    difficulty: number,
    density: number,
    deckMat: THREE.Material,
    trimMat: THREE.Material,
    hazardMat: THREE.Material,
    hazardAccentMat: THREE.Material,
    beamMat: THREE.Material,
  ): void {
    this.addFullDeck(chunk, zStart, CHUNK_LENGTH, 0, deckMat, trimMat);
    const focusLane = Math.floor(Math.random() * 3);

    for (let l = 0; l < 3; l++) {
      if (l === focusLane) {
        this.addSlideGate(chunk, LANE_X[l], 0, zStart - 9, beamMat);
        this.addGemLine(chunk, LANE_X[l], 0.55, zStart - 7, 2, 2.0, false);
      } else if (density >= 0.75 || l === (focusLane + 1) % 3) {
        this.addJumpHurdle(chunk, LANE_X[l], 0, zStart - 9, hazardMat, hazardAccentMat);
      }
    }

    this.addJumpHurdle(chunk, LANE_X[focusLane], 0, zStart - 21, hazardMat, hazardAccentMat);
    this.addGemArc(chunk, LANE_X[focusLane], 0, zStart - 21);

    const openExitLane = (focusLane + (Math.random() < 0.5 ? 1 : 2)) % 3;
    for (let l = 0; l < 3; l++) {
      if (l === focusLane) continue;
      if (l !== openExitLane && density >= 0.75 && (difficulty > 0.2 || density > 1.25)) {
        this.addTallPillar(chunk, LANE_X[l], 0, zStart - 21, hazardMat, hazardAccentMat);
      }
    }

    if (density >= 0.75) {
      this.addSlideGate(chunk, LANE_X[openExitLane], 0, zStart - 31, beamMat);
      this.addJumpHurdle(chunk, LANE_X[focusLane], 0, zStart - 31, hazardMat, hazardAccentMat);
    }
    if (density > 1.25) {
      const thirdLane = 3 - focusLane - openExitLane;
      this.addTallPillar(chunk, LANE_X[thirdLane], 0, zStart - 31, hazardMat, hazardAccentMat);
    }
  }

  // Pattern 5: Weaving Lahore Auto-Rickshaw + Haveli Arch Pillars
  private buildMovingSentinelPattern(
    chunk: TrackChunk,
    zStart: number,
    difficulty: number,
    density: number,
    deckMat: THREE.Material,
    trimMat: THREE.Material,
    hazardMat: THREE.Material,
    hazardAccentMat: THREE.Material,
    beamMat: THREE.Material,
  ): void {
    this.addFullDeck(chunk, zStart, CHUNK_LENGTH, 0, deckMat, trimMat);

    // Subtle yellow road crossing strip where rickshaw weaves
    const trackLine = new THREE.Mesh(
      new THREE.BoxGeometry(LANE_WIDTH * 2.5, 0.05, 0.28),
      this.hazardYellowMat,
    );
    trackLine.position.set(0, 0.025, zStart - 12);
    chunk.group.add(trackLine);

    this.addMovingRickshaw(chunk, 0, zStart - 12, difficulty, density);

    const clearLane = Math.floor(Math.random() * 3);
    for (let l = 0; l < 3; l++) {
      if (l === clearLane) {
        this.addSlideGate(chunk, LANE_X[l], 0, zStart - 26, beamMat);
        this.addGemLine(chunk, LANE_X[l], 0.55, zStart - 24, 3, 1.8, true);
      } else if (density >= 0.75 || l === (clearLane + 1) % 3) {
        this.addTallPillar(chunk, LANE_X[l], 0, zStart - 26, hazardMat, hazardAccentMat);
      }
    }

    if (density > 1.25) {
      this.addJumpHurdle(chunk, LANE_X[(clearLane + 1) % 3], 0, zStart - 32, hazardMat, hazardAccentMat);
    }
  }

  // Jump Obstacle: Lahore Traffic Roadblock Barrier with Caution Stripes & Cones
  private addJumpHurdle(
    chunk: TrackChunk,
    x: number,
    baseY: number,
    z: number,
    mat: THREE.Material,
    accentMat: THREE.Material,
  ): void {
    const g = new THREE.Group();
    g.position.set(x, baseY, z);

    const leftLeg = new THREE.Mesh(this.hurdleLegGeo, this.darkMetalMat);
    leftLeg.position.set(-0.92, 0.47, 0);
    leftLeg.castShadow = true;
    g.add(leftLeg);

    const rightLeg = new THREE.Mesh(this.hurdleLegGeo, this.darkMetalMat);
    rightLeg.position.set(0.92, 0.47, 0);
    rightLeg.castShadow = true;
    g.add(rightLeg);

    const bar = new THREE.Mesh(this.hurdleGeo, mat);
    bar.position.y = 0.68;
    bar.castShadow = true;
    bar.receiveShadow = true;
    g.add(bar);

    const topStrip = new THREE.Mesh(this.hurdleGeo, accentMat);
    topStrip.scale.set(0.96, 0.34, 1.08);
    topStrip.position.y = 0.88;
    topStrip.receiveShadow = true;
    g.add(topStrip);

    // Twin reflective road cones flanking barrier
    const leftCone = new THREE.Mesh(this.coneGeo, this.hazardYellowMat);
    leftCone.position.set(-0.92, 1.12, 0);
    g.add(leftCone);

    const rightCone = new THREE.Mesh(this.coneGeo, this.hazardYellowMat);
    rightCone.position.set(0.92, 1.12, 0);
    g.add(rightCone);

    chunk.group.add(g);
    chunk.obstacles.push({
      kind: 'jump',
      mesh: g,
      baseX: x,
      x,
      prevX: x,
      y: baseY,
      z,
      halfW: 0.95,
      height: 1.04,
      halfD: 0.3,
      moveAmp: 0,
      moveSpeed: 0,
      movePhase: 0,
      nearMissAwarded: false,
    });
  }

  // Slide Obstacle: Festive Bazaar Awning / Overhead Lahore Gantry Arch
  private addSlideGate(
    chunk: TrackChunk,
    x: number,
    baseY: number,
    z: number,
    beamMat: THREE.Material,
  ): void {
    const g = new THREE.Group();
    g.position.set(x, baseY, z);

    const leftPost = new THREE.Mesh(this.pillarGeo, this.ochreSandMat);
    leftPost.position.set(-1.05, 1.375, 0);
    leftPost.castShadow = true;
    g.add(leftPost);

    const rightPost = new THREE.Mesh(this.pillarGeo, this.ochreSandMat);
    rightPost.position.set(1.05, 1.375, 0);
    rightPost.castShadow = true;
    g.add(rightPost);

    // Festive bazaar signboard & striped canopy hanging from y=1.18 to y=2.65
    const beam = new THREE.Mesh(this.beamGeo, beamMat);
    beam.scale.set(1, 1.45, 1);
    beam.position.set(0, 1.66, 0);
    beam.castShadow = true;
    g.add(beam);

    const awning = new THREE.Mesh(this.awningGeo, this.rickshawYellowMat);
    awning.position.set(0, 1.26, 0.18);
    awning.rotation.x = 0.25;
    g.add(awning);

    // Urdu / Punjabi comic signboard mounted flush on the front of the overhead bazaar gate!
    const comicMats = this.lahoreTextures.comicMaterials;
    const comicMat = comicMats[Math.floor(Math.random() * comicMats.length)];
    const comicFace = new THREE.Mesh(this.gateComicFaceGeo, comicMat);
    comicFace.scale.set(1, 0.9, 1);
    comicFace.position.set(0, 1.68, 0.2);
    g.add(comicFace);

    const topCross = new THREE.Mesh(this.beamGeo, this.pakGreenMat);
    topCross.scale.set(1.0, 0.52, 1.02);
    topCross.position.set(0, 2.52, 0);
    g.add(topCross);

    chunk.group.add(g);
    chunk.obstacles.push({
      kind: 'slide',
      mesh: g,
      baseX: x,
      x,
      prevX: x,
      y: baseY + 1.12,
      z,
      halfW: 1.02,
      height: 1.6,
      halfD: 0.3,
      moveAmp: 0,
      moveSpeed: 0,
      movePhase: 0,
      nearMissAwarded: false,
    });
  }

  // Tall Obstacle: Ornate Mughal Brick Column / Minaret Pavilion
  private addTallPillar(
    chunk: TrackChunk,
    x: number,
    baseY: number,
    z: number,
    mat: THREE.Material,
    accentMat: THREE.Material,
  ): void {
    const g = new THREE.Group();
    g.position.set(x, baseY, z);

    const body = new THREE.Mesh(this.tallGeo, mat);
    body.position.y = 1.225;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    const cornice = new THREE.Mesh(this.tallArchCapGeo, this.ochreSandMat);
    cornice.position.y = 2.48;
    cornice.castShadow = true;
    cornice.receiveShadow = true;
    g.add(cornice);

    const dome = new THREE.Mesh(this.tallDomeGeo, this.marbleWhiteMat);
    dome.position.y = 2.64;
    dome.castShadow = true;
    g.add(dome);

    const finial = new THREE.Mesh(this.finialGeo, accentMat);
    finial.position.y = 3.22;
    g.add(finial);

    chunk.group.add(g);
    chunk.obstacles.push({
      kind: 'tall',
      mesh: g,
      baseX: x,
      x,
      prevX: x,
      y: baseY,
      z,
      halfW: 0.88,
      height: 3.1,
      halfD: 0.56,
      moveAmp: 0,
      moveSpeed: 0,
      movePhase: 0,
      nearMissAwarded: false,
    });
  }

  // Moving Obstacle: Iconic Green & Yellow Lahore Auto-Rickshaw (8-part composite Group!)
  private addMovingRickshaw(
    chunk: TrackChunk,
    baseX: number,
    z: number,
    difficulty: number,
    density: number,
  ): void {
    const g = new THREE.Group();
    g.position.set(baseX, 0, z);

    // 1. Lower green chassis cabin
    const body = new THREE.Mesh(this.rickshawBodyGeo, this.pakGreenMat);
    body.position.set(0, 0.54, -0.08);
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    // 2. Front nose / cowl facing player (+Z)
    const nose = new THREE.Mesh(this.rickshawNoseGeo, this.truckPinkMat);
    nose.position.set(0, 0.5, 0.66);
    nose.castShadow = true;
    nose.receiveShadow = true;
    g.add(nose);

    // 3. Yellow canvas canopy roof
    const roof = new THREE.Mesh(this.rickshawRoofGeo, this.rickshawYellowMat);
    roof.position.set(0, 1.38, -0.04);
    roof.castShadow = true;
    roof.receiveShadow = true;
    g.add(roof);

    // 4. Support pillars
    for (const px of [-0.5, 0.5]) {
      for (const pz of [-0.66, 0.48]) {
        const post = new THREE.Mesh(this.rickshawPostGeo, this.darkMetalMat);
        post.position.set(px, 1.02, pz);
        g.add(post);
      }
    }

    // 5. Three grounded wheels (front center + 2 rear)
    const frontWheel = new THREE.Mesh(this.rickshawWheelGeo, this.darkMetalMat);
    frontWheel.rotation.z = Math.PI / 2;
    frontWheel.position.set(0, 0.24, 0.72);
    g.add(frontWheel);

    for (const wx of [-0.58, 0.58]) {
      const rearWheel = new THREE.Mesh(this.rickshawWheelGeo, this.darkMetalMat);
      rearWheel.rotation.z = Math.PI / 2;
      rearWheel.position.set(wx, 0.24, -0.45);
      g.add(rearWheel);
    }

    // 6. Glowing headlight & decorative truck-art trim
    const headlight = new THREE.Mesh(this.rickshawLightGeo, this.warmLightMat);
    headlight.position.set(0, 0.58, 0.94);
    g.add(headlight);

    const sideAccent = new THREE.Mesh(this.rickshawLightGeo, this.hazardYellowMat);
    sideAccent.scale.set(4.8, 0.9, 1.2);
    sideAccent.position.set(0, 0.94, 0.56);
    g.add(sideAccent);

    for (const tx of [-0.38, 0.38]) {
      const tail = new THREE.Mesh(this.rickshawLightGeo, this.redLightMat);
      tail.position.set(tx, 0.52, -0.78);
      g.add(tail);
    }

    chunk.group.add(g);
    const speedScale = 0.72 + density * 0.34;
    chunk.obstacles.push({
      kind: 'moving',
      mesh: g,
      baseX,
      x: baseX,
      prevX: baseX,
      y: 0.08,
      z,
      halfW: 0.72,
      height: 1.45,
      halfD: 0.62,
      moveAmp: LANE_WIDTH * 0.95,
      moveSpeed: (2.0 + difficulty * 1.35) * speedScale,
      movePhase: Math.random() * Math.PI * 2,
      nearMissAwarded: false,
    });
  }

  private addSpringPad(chunk: TrackChunk, x: number, baseY: number, z: number): void {
    const g = new THREE.Group();
    g.position.set(x, baseY, z);

    const base = new THREE.Mesh(this.springBaseGeo, this.darkMetalMat);
    base.position.y = 0.09;
    base.receiveShadow = true;
    g.add(base);

    const core = new THREE.Mesh(this.springCoreGeo, this.springPadMat);
    core.position.y = 0.22;
    g.add(core);

    chunk.group.add(g);
    chunk.springs.push({
      mesh: g,
      x,
      y: baseY,
      z,
      triggered: false,
    });
  }

  // Track Speed Boost Strip (composite 7-part amber/violet kinetic chevron pad)
  private addBoostPad(chunk: TrackChunk, x: number, baseY: number, z: number): void {
    const g = new THREE.Group();
    g.position.set(x, baseY, z);

    const base = new THREE.Mesh(this.boostBaseGeo, this.darkMetalMat);
    base.position.y = 0.04;
    base.receiveShadow = true;
    g.add(base);

    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(
        this.boostRailGeo,
        side < 0 ? this.boostAmberMat : this.boostVioletMat,
      );
      rail.position.set(side * 0.76, 0.08, 0);
      g.add(rail);
    }

    const chevrons: THREE.Mesh[] = [];
    const zOffsets = [0.85, 0, -0.85];
    zOffsets.forEach((cz, idx) => {
      const chevronMat = idx % 2 === 0 ? this.boostAmberMat : this.boostVioletMat;
      const leftArm = new THREE.Mesh(this.boostChevronGeo, chevronMat);
      leftArm.position.set(-0.24, 0.1, cz);
      leftArm.rotation.y = 0.56;
      g.add(leftArm);

      const rightArm = new THREE.Mesh(this.boostChevronGeo, chevronMat);
      rightArm.position.set(0.24, 0.1, cz);
      rightArm.rotation.y = -0.56;
      g.add(rightArm);

      chevrons.push(leftArm, rightArm);
    });

    chunk.group.add(g);
    chunk.boostPads.push({
      mesh: g,
      x,
      y: baseY,
      z,
      halfW: 0.92,
      halfD: 1.55,
      triggered: false,
      chevrons,
    });
  }

  private addSingleGem(
    chunk: TrackChunk,
    x: number,
    y: number,
    z: number,
    isBonus: boolean,
  ): void {
    const mesh = new THREE.Mesh(this.gemGeo, isBonus ? this.bonusGemMat : this.gemMat);
    mesh.position.set(x, y, z);
    if (isBonus) mesh.scale.setScalar(1.22);
    chunk.group.add(mesh);
    chunk.gems.push({
      mesh,
      x,
      y,
      z,
      value: isBonus ? 3 : 1,
      collected: false,
      bobPhase: Math.random() * Math.PI * 2,
    });
  }

  private addGemLine(
    chunk: TrackChunk,
    x: number,
    y: number,
    zStartLine: number,
    count: number,
    spacing: number,
    isBonus: boolean,
  ): void {
    for (let i = 0; i < count; i++) {
      this.addSingleGem(chunk, x, y, zStartLine - i * spacing, isBonus);
    }
  }

  private addGemArc(chunk: TrackChunk, x: number, baseY: number, centerZ: number): void {
    const offsets = [
      { dz: 2.4, dy: 1.0 },
      { dz: 1.2, dy: 2.0 },
      { dz: 0, dy: 2.45 },
      { dz: -1.2, dy: 2.0 },
      { dz: -2.4, dy: 1.0 },
    ];
    for (const o of offsets) {
      this.addSingleGem(chunk, x, baseY + o.dy, centerZ + o.dz, false);
    }
  }

  private addPowerup(
    chunk: TrackChunk,
    type: PowerupType,
    x: number,
    y: number,
    z: number,
  ): void {
    const g = new THREE.Group();
    g.position.set(x, y, z);

    if (type === 'chronos') {
      // Composite 6-part Chronos-Crystal: faceted amethyst crystal, cyan core & dual astrolabe rings
      const crystal = new THREE.Mesh(this.chronosCrystalGeo, this.chronosCrystalMat);
      crystal.scale.set(0.76, 1.38, 0.76);
      g.add(crystal);

      const heart = new THREE.Mesh(this.chronosHeartGeo, this.chronosHeartMat);
      heart.scale.set(0.65, 1.15, 0.65);
      g.add(heart);

      const ringA = new THREE.Mesh(this.chronosRingAGeo, this.chronosRingCyanMat);
      ringA.name = 'chronosRingA';
      ringA.rotation.set(Math.PI / 3, 0.3, 0);
      g.add(ringA);

      const ringB = new THREE.Mesh(this.chronosRingBGeo, this.chronosRingGoldMat);
      ringB.name = 'chronosRingB';
      ringB.rotation.set(-Math.PI / 3, -0.35, Math.PI / 4);
      g.add(ringB);

      const topShard = new THREE.Mesh(this.chronosShardGeo, this.chronosHeartMat);
      topShard.position.set(0, 0.74, 0);
      g.add(topShard);

      const bottomShard = new THREE.Mesh(this.chronosShardGeo, this.chronosHeartMat);
      bottomShard.position.set(0, -0.74, 0);
      g.add(bottomShard);
    } else {
      const mat = this.powerupMats[type];
      const core = new THREE.Mesh(this.powerupIcoGeo, mat);
      g.add(core);

      const halo = new THREE.Mesh(this.powerupHaloGeo, mat);
      g.add(halo);
    }

    chunk.group.add(g);
    chunk.powerups.push({
      type,
      mesh: g,
      x,
      y,
      z,
      collected: false,
      bobPhase: Math.random() * Math.PI * 2,
    });
  }

  private addComicBillboard(
    chunk: TrackChunk,
    side: number,
    zPos: number,
    boardIdx: number,
  ): void {
    const board = new THREE.Group();
    board.position.set(side * 4.95, -0.05, zPos);
    board.rotation.y = side * -0.44;

    // Twin dark steel support legs
    for (const px of [-1.25, 1.25]) {
      const post = new THREE.Mesh(this.billboardPostGeo, this.darkMetalMat);
      post.position.set(px, 1.2, 0);
      board.add(post);
    }

    // Backing frame
    const frame = new THREE.Mesh(this.billboardFrameGeo, this.darkMetalMat);
    frame.position.set(0, 2.75, 0);
    frame.castShadow = true;
    board.add(frame);

    // Urdu & Punjabi Comic face (pointing toward oncoming player!)
    const comicMats = this.lahoreTextures.comicMaterials;
    const mat = comicMats[((boardIdx % comicMats.length) + comicMats.length) % comicMats.length];
    const face = new THREE.Mesh(this.billboardFaceGeo, mat);
    face.position.set(0, 2.75, 0.11);
    board.add(face);

    // Twin warm signboard lights on top edge
    for (const lx of [-1.05, 1.05]) {
      const bulb = new THREE.Mesh(this.lampBulbGeo, this.warmLightMat);
      bulb.position.set(lx, 3.82, 0.18);
      board.add(bulb);
    }

    chunk.group.add(board);
  }

  private addRoadsideChaiStall(chunk: TrackChunk, side: number, zPos: number): void {
    const stall = new THREE.Group();
    stall.position.set(side * 5.05, -0.05, zPos);

    const counter = new THREE.Mesh(this.stallTableGeo, this.woodBalconyMat);
    counter.position.y = 0.45;
    stall.add(counter);

    const samovar = new THREE.Mesh(this.samovarGeo, this.brassMat);
    samovar.position.set(-side * 0.25, 1.22, 0.35);
    stall.add(samovar);

    const pole = new THREE.Mesh(this.umbrellaPoleGeo, this.darkMetalMat);
    pole.position.set(side * 0.15, 1.55, -0.2);
    stall.add(pole);

    const umbrella = new THREE.Mesh(this.umbrellaGeo, this.umbrellaRedMat);
    umbrella.position.set(side * 0.15, 2.68, -0.2);
    stall.add(umbrella);

    chunk.group.add(stall);
  }

  private addOverheadStreetBunting(chunk: TrackChunk, zPos: number, beamMat: THREE.Material): void {
    const bunting = new THREE.Group();
    bunting.position.set(0, 6.4, zPos);

    const wire = new THREE.Mesh(this.buntingWireGeo, this.darkMetalMat);
    bunting.add(wire);

    const flagMats = [this.pakGreenMat, this.rickshawYellowMat, beamMat, this.truckPinkMat];
    for (let i = 0; i < 9; i++) {
      const fx = -3.8 + i * 0.95;
      const sag = Math.sin((i / 8) * Math.PI) * 0.32;
      const flag = new THREE.Mesh(this.buntingFlagGeo, flagMats[i % flagMats.length]);
      flag.position.set(fx, -0.22 - sag, 0);
      flag.rotation.x = Math.PI;
      bunting.add(flag);

      if (i % 2 === 1) {
        const bulb = new THREE.Mesh(this.fairyBulbGeo, this.warmLightMat);
        bulb.position.set(fx, -0.14 - sag, 0.08);
        bunting.add(bulb);
      }
    }

    chunk.group.add(bunting);
  }

  private addJourneyLandmarkSetpiece(
    chunk: TrackChunk,
    kind: LahoreLandmarkKind,
    zPos: number,
    cliffMat: THREE.Material,
    beamMat: THREE.Material,
  ): void {
    const g = new THREE.Group();
    g.position.set(0, -0.05, zPos);

    if (kind === 'gate') {
      // Delhi Gate: Grand Mughal brick & sandstone archway straddling the road (y >= 4.9 clearance)
      for (const side of [-1, 1]) {
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.35, 8.2, 8), this.brickRedMat);
        tower.position.set(side * 4.9, 4.1, 0);
        tower.castShadow = true;
        g.add(tower);

        const collar = new THREE.Mesh(new THREE.CylinderGeometry(1.38, 1.25, 0.45, 8), this.ochreSandMat);
        collar.position.set(side * 4.9, 6.2, 0);
        g.add(collar);

        const dome = new THREE.Mesh(this.tallDomeGeo, this.marbleWhiteMat);
        dome.scale.set(1.55, 1.45, 1.55);
        dome.position.set(side * 4.9, 8.2, 0);
        g.add(dome);

        const finial = new THREE.Mesh(this.finialGeo, this.brassMat);
        finial.scale.set(1.4, 1.4, 1.4);
        finial.position.set(side * 4.9, 9.45, 0);
        g.add(finial);

        const lantern = new THREE.Mesh(this.lampBulbGeo, this.warmLightMat);
        lantern.scale.set(1.4, 1.6, 1.4);
        lantern.position.set(side * 3.85, 4.6, 0.85);
        g.add(lantern);
      }

      // Main spanning Mughal lintel & parapet high above runner jump/spring arc
      const archSpan = new THREE.Mesh(new THREE.BoxGeometry(10.2, 2.2, 1.65), cliffMat);
      archSpan.position.set(0, 6.1, 0);
      archSpan.castShadow = true;
      g.add(archSpan);

      const truckTrim = new THREE.Mesh(
        new THREE.BoxGeometry(8.6, 0.72, 1.75),
        this.lahoreTextures.truckArtRailMat,
      );
      truckTrim.position.set(0, 5.45, 0);
      g.add(truckTrim);

      for (let kx = -3.8; kx <= 3.8; kx += 0.95) {
        const kangura = new THREE.Mesh(this.kanguraGeo, this.marbleWhiteMat);
        kangura.position.set(kx, 7.45, 0);
        g.add(kangura);
      }
    } else if (kind === 'bazaar') {
      // Anarkali Bazaar: Illuminated lantern arcade spanning overhead + festive shop banners
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.42, 6.4, 0.42), this.woodBalconyMat);
        post.position.set(side * 4.5, 3.2, 0);
        g.add(post);

        const shopComic = new THREE.Mesh(
          this.billboardFaceGeo,
          this.lahoreTextures.comicMaterials[side > 0 ? 4 : 2],
        );
        shopComic.scale.set(0.82, 0.82, 1);
        shopComic.position.set(side * 5.8, 3.3, 0.5);
        shopComic.rotation.y = side * -0.45;
        g.add(shopComic);
      }

      const canopyBeam = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.36, 1.1), this.pakGreenMat);
      canopyBeam.position.set(0, 6.2, 0);
      g.add(canopyBeam);

      for (let lx = -3.6; lx <= 3.6; lx += 1.2) {
        const drop = 0.45 + Math.abs(lx) * 0.08;
        const lantern = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.24, 0),
          Math.round(lx * 10) % 2 === 0 ? this.warmLightMat : beamMat,
        );
        lantern.position.set(lx, 6.0 - drop, 0);
        g.add(lantern);
      }
    } else if (kind === 'mosque') {
      // Badshahi Mosque: Twin towering red-sandstone & marble minarets + courtyard pavilions
      for (const side of [-1, 1]) {
        const base = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.0, 3.4), this.brickRedMat);
        base.position.set(side * 6.8, 1.5, 0);
        g.add(base);

        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 1.18, 15.5, 8), this.brickRedMat);
        shaft.position.set(side * 6.8, 10.75, 0);
        g.add(shaft);

        const gallery = new THREE.Mesh(new THREE.CylinderGeometry(1.38, 1.38, 0.45, 8), this.marbleWhiteMat);
        gallery.position.set(side * 6.8, 11.2, 0);
        g.add(gallery);

        const cupola = new THREE.Mesh(this.mosqueDomeGeo, this.marbleWhiteMat);
        cupola.scale.set(0.55, 0.6, 0.55);
        cupola.position.set(side * 6.8, 18.4, 0);
        g.add(cupola);

        const lightRing = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.08, 6, 12), this.warmLightMat);
        lightRing.rotation.x = Math.PI / 2;
        lightRing.position.set(side * 6.8, 18.2, 0);
        g.add(lightRing);
      }
    } else if (kind === 'minar') {
      // Minar-e-Pakistan: Iconic star-petal monument on emerald terrace flanking track
      const terrace = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 5.2, 1.2, 8), this.pakGreenMat);
      terrace.position.set(-8.6, 0.6, 0);
      g.add(terrace);

      const petals = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 3.6, 4.2, 8), this.marbleWhiteMat);
      petals.position.set(-8.6, 3.3, 0);
      g.add(petals);

      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 2.0, 17.5, 8), this.marbleWhiteMat);
      tower.position.set(-8.6, 13.8, 0);
      g.add(tower);

      const crown = new THREE.Mesh(new THREE.SphereGeometry(1.25, 8, 6), this.marbleWhiteMat);
      crown.position.set(-8.6, 22.8, 0);
      g.add(crown);

      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.32, 3.6, 6), this.brassMat);
      spire.position.set(-8.6, 25.4, 0);
      g.add(spire);

      const uplight = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.1, 6, 16), this.springPadMat);
      uplight.rotation.x = Math.PI / 2;
      uplight.position.set(-8.6, 1.3, 0);
      g.add(uplight);
    } else if (kind === 'gardens') {
      // Shalimar Gardens: Symmetrical marble baradari pavilions + glowing fountain terraces
      for (const side of [-1, 1]) {
        const pool = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.35, 8.4), this.marbleWhiteMat);
        pool.position.set(side * 6.6, 0.17, 0);
        g.add(pool);

        const water = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.08, 7.6), this.canalWaterMat);
        water.position.set(side * 6.6, 0.38, 0);
        g.add(water);

        for (const px of [-1.1, 1.1]) {
          for (const pz of [-1.6, 1.6]) {
            const col = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 3.2, 6), this.marbleWhiteMat);
            col.position.set(side * 6.6 + px, 1.85, pz);
            g.add(col);
          }
        }

        const roof = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.45, 4.4), this.brickRedMat);
        roof.position.set(side * 6.6, 3.65, 0);
        g.add(roof);

        const baradariDome = new THREE.Mesh(this.tallDomeGeo, this.marbleWhiteMat);
        baradariDome.scale.set(1.2, 1.0, 1.2);
        baradariDome.position.set(side * 6.6, 3.9, 0);
        g.add(baradariDome);
      }
    } else if (kind === 'canal') {
      // Canal Road: Illuminated heritage bridge gantry spanning the track + festive canal float
      for (const side of [-1, 1]) {
        const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.65, 6.2, 0.85), this.pakGreenMat);
        pylon.position.set(side * 4.75, 3.1, 0);
        g.add(pylon);
      }

      const truss = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.85, 1.15), this.pakGreenMat);
      truss.position.set(0, 5.95, 0);
      g.add(truss);

      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(9.6, 0.48, 1.24),
        this.lahoreTextures.truckArtRailMat,
      );
      trim.position.set(0, 5.95, 0);
      g.add(trim);

      for (let lx = -3.6; lx <= 3.6; lx += 1.8) {
        const lamp = new THREE.Mesh(this.lampBulbGeo, this.springPadMat);
        lamp.position.set(lx, 5.38, 0.55);
        g.add(lamp);
      }

      // Illuminated canal cultural float on right canal channel
      const hull = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 4.2), this.rickshawYellowMat);
      hull.position.set(11.4, 0.25, 0);
      g.add(hull);
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.4, 6), this.truckPinkMat);
      canopy.position.set(11.4, 1.2, 0);
      g.add(canopy);
    } else {
      // Liberty Chowk: Glowing Gulberg monument tower + neon marquee portal
      const plaza = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.8, 0.65, 10), this.marbleWhiteMat);
      plaza.position.set(8.2, 0.32, 0);
      g.add(plaza);

      const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 1.05, 10.5, 6), this.marbleWhiteMat);
      obelisk.position.set(8.2, 5.7, 0);
      g.add(obelisk);

      const ringColors = [this.warmLightMat, this.truckPinkMat, this.springPadMat];
      for (let r = 0; r < 3; r++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(2.2 - r * 0.42, 0.1, 6, 16),
          ringColors[r],
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.set(8.2, 2.2 + r * 2.2, 0);
        g.add(ring);
      }

      // Festive Gulberg overhead marquee arch
      for (const side of [-1, 1]) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.48, 5.8, 0.48), this.darkMetalMat);
        col.position.set(side * 4.65, 2.9, 0);
        g.add(col);
      }
      const marquee = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.9, 0.72), beamMat);
      marquee.position.set(0, 5.85, 0);
      g.add(marquee);
      const marqueeTrim = new THREE.Mesh(
        new THREE.BoxGeometry(9.2, 0.54, 0.8),
        this.lahoreTextures.truckArtRailMat,
      );
      marqueeTrim.position.set(0, 5.85, 0);
      g.add(marqueeTrim);
    }

    chunk.group.add(g);
  }

  private populateLahoreScenery(
    chunk: TrackChunk,
    chunkIndex: number,
    zStart: number,
    biome: BiomeId,
    cliffMat: THREE.Material,
    foliageMat: THREE.Material,
    beamMat: THREE.Material,
  ): void {
    const chunkSeed = Math.abs(Math.round(zStart / CHUNK_LENGTH));
    const comicMats = this.lahoreTextures.comicMaterials;

    // Monumental Lahore Journey landmark setpiece on route start & milestone boundaries
    if (chunkIndex === 0) {
      const gateStop = LAHORE_TRACK_STOPS[0];
      const gateZ = zStart - 26;
      this.addJourneyLandmarkSetpiece(chunk, gateStop.landmark, gateZ, cliffMat, beamMat);
      chunk.landmarkMarker = {
        kind: gateStop.landmark,
        name: gateStop.name,
        subtitle: gateStop.subtitle,
        accentHex: gateStop.accentHex,
        z: gateZ,
        distanceMeters: Math.max(0, Math.round(-gateZ)),
        triggered: false,
      };
    } else {
      const startMeters = Math.max(0, -zStart);
      const endMeters = startMeters + CHUNK_LENGTH;
      const prevMilestone = Math.floor(startMeters / JOURNEY_SEGMENT_METERS);
      const nextMilestone = Math.floor(endMeters / JOURNEY_SEGMENT_METERS);
      if (nextMilestone > prevMilestone) {
        const milestoneMeters = nextMilestone * JOURNEY_SEGMENT_METERS;
        const stopIdx =
          Math.floor((milestoneMeters % JOURNEY_CYCLE_METERS) / JOURNEY_SEGMENT_METERS) %
          LAHORE_TRACK_STOPS.length;
        const stop = LAHORE_TRACK_STOPS[stopIdx];
        const offsetInChunk = THREE.MathUtils.clamp(milestoneMeters - startMeters, 8, CHUNK_LENGTH - 8);
        const landmarkZ = zStart - offsetInChunk;
        this.addJourneyLandmarkSetpiece(
          chunk,
          stop.landmark,
          landmarkZ,
          cliffMat,
          beamMat,
        );
        chunk.landmarkMarker = {
          kind: stop.landmark,
          name: stop.name,
          subtitle: stop.subtitle,
          accentHex: stop.accentHex,
          z: landmarkZ,
          distanceMeters: milestoneMeters,
          triggered: false,
        };
      }
    }

    // Festive overhead bazaar bunting stretched high above street (safely above jump/spring arc)
    this.addOverheadStreetBunting(chunk, zStart - 10, beamMat);
    this.addOverheadStreetBunting(chunk, zStart - 28, beamMat);

    // Grounded outer Lahore sidewalks & street aprons flanking both sides
    for (const side of [-1, 1]) {
      const sidewalk = new THREE.Mesh(
        this.sidewalkGeo,
        biome === 'skybridge' ? foliageMat : this.ochreSandMat,
      );
      sidewalk.position.set(side * 10.85, -0.45, zStart - CHUNK_LENGTH / 2);
      sidewalk.receiveShadow = true;
      chunk.group.add(sidewalk);

      // Lahore Canal turquoise water strip on Canal Road district!
      if (biome === 'skybridge') {
        const canal = new THREE.Mesh(this.canalWaterGeo, this.canalWaterMat);
        canal.position.set(side * 11.4, 0.02, zStart - CHUNK_LENGTH / 2);
        canal.receiveShadow = true;
        chunk.group.add(canal);
      }

      // Prominent angled Urdu & Punjabi Comic Billboard on the sidewalk
      this.addComicBillboard(
        chunk,
        side,
        zStart - (side === -1 ? 11.5 : 22.5),
        chunkSeed * 2 + (side === -1 ? 0 : 3),
      );

      // Chai Dhabba / Roadside stall along sidewalk
      if ((chunkSeed + (side > 0 ? 1 : 0)) % 2 === 0) {
        this.addRoadsideChaiStall(chunk, side, zStart - (side === -1 ? 26 : 9.5));
      }

      // Streetlights lining both curbs
      for (let l = 0; l < 2; l++) {
        const lampZ = zStart - 6 - l * 18;
        const lamp = new THREE.Group();
        lamp.position.set(side * 4.25, -0.05, lampZ);

        const pole = new THREE.Mesh(this.lampPostGeo, this.darkMetalMat);
        pole.position.y = 2.1;
        lamp.add(pole);

        const arm = new THREE.Mesh(this.lampArmGeo, this.darkMetalMat);
        arm.position.set(-side * 0.42, 4.15, 0);
        lamp.add(arm);

        const bulb = new THREE.Mesh(this.lampBulbGeo, this.warmLightMat);
        bulb.position.set(-side * 0.78, 4.05, 0);
        lamp.add(bulb);

        chunk.group.add(lamp);
      }

      // Walled-City Havelis with comic shop boards, Mughal kangura battlements & Neem Trees
      for (let i = 0; i < 3; i++) {
        const zPos = zStart - 6 - i * 11.5 - (Math.random() - 0.5) * 1.2;
        const xBase = side * (7.6 + Math.random() * 1.1);

        if (biome === 'skybridge' && i % 2 === 1) {
          const tree = new THREE.Group();
          tree.position.set(side * (5.9 + Math.random() * 1.5), -0.05, zPos);

          const trunk = new THREE.Mesh(this.treeTrunkGeo, this.trunkMat);
          trunk.position.y = 1.1;
          tree.add(trunk);

          const crown1 = new THREE.Mesh(this.neemCrownGeo1, foliageMat);
          crown1.position.y = 2.8;
          crown1.scale.set(1.15, 0.85, 1.15);
          tree.add(crown1);

          const crown2 = new THREE.Mesh(this.neemCrownGeo2, foliageMat);
          crown2.position.set(-side * 0.6, 3.6, 0.35);
          tree.add(crown2);

          tree.scale.setScalar(0.9 + Math.random() * 0.35);
          chunk.group.add(tree);
        } else {
          // Composite Lahore Haveli / Bazaar Shopfront
          const haveli = new THREE.Group();
          const scaleH = 0.82 + Math.random() * 0.6;
          haveli.position.set(xBase, -0.05, zPos);

          const facadeMat =
            i % 3 === 0 ? cliffMat : i % 3 === 1 ? this.brickRedMat : this.ochreSandMat;
          const body = new THREE.Mesh(this.haveliBodyGeo, facadeMat);
          body.scale.set(1, scaleH, 1);
          body.position.y = (6.2 * scaleH) / 2;
          haveli.add(body);

          const roofTrim = new THREE.Mesh(this.haveliRoofGeo, this.marbleWhiteMat);
          roofTrim.position.y = 6.2 * scaleH + 0.16;
          haveli.add(roofTrim);

          // Mughal Kangura parapet merlons along roofline
          for (const kz of [-1.6, 0, 1.6]) {
            const kangura = new THREE.Mesh(this.kanguraGeo, cliffMat);
            kangura.position.set(-side * 2.0, 6.2 * scaleH + 0.56, kz);
            haveli.add(kangura);
          }

          // Overhanging wooden Jharokha balcony facing the street
          const jharokha = new THREE.Mesh(this.jharokhaGeo, this.woodBalconyMat);
          jharokha.position.set(-side * 2.25, 3.45, 0);
          haveli.add(jharokha);

          // Colorful bazaar market awning over footpath
          const awningColor =
            i % 2 === 0 ? beamMat : biome === 'skybridge' ? this.pakGreenMat : this.rickshawYellowMat;
          const awning = new THREE.Mesh(this.shopAwningGeo, awningColor);
          awning.position.set(-side * 2.45, 2.05, 0);
          awning.rotation.z = side * 0.25;
          haveli.add(awning);

          // Shopfront Urdu & Punjabi comic board above awning!
          const shopBoardFrame = new THREE.Mesh(this.shopBoardFrameGeo, this.darkMetalMat);
          shopBoardFrame.position.set(-side * 2.28, 2.85, 0);
          haveli.add(shopBoardFrame);

          const shopComicMat = comicMats[(chunkSeed + i + (side > 0 ? 2 : 0)) % comicMats.length];
          const shopBoardFace = new THREE.Mesh(this.shopBoardFaceGeo, shopComicMat);
          shopBoardFace.position.set(-side * 2.38, 2.85, 0);
          shopBoardFace.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
          haveli.add(shopBoardFace);

          // Glowing bazaar windows
          if (biome === 'obsidian' || Math.random() < 0.65) {
            const winMat = biome === 'obsidian' ? this.warmLightMat : this.ochreSandMat;
            for (const wz of [-1.2, 1.2]) {
              const win = new THREE.Mesh(this.windowGlowGeo, winMat);
              win.position.set(-side * 2.24, 4.4, wz);
              haveli.add(win);
            }
          }

          chunk.group.add(haveli);
        }
      }

      // Outer skyline Mughal Mosque Domes & Minarets (Badshahi / Wazir Khan silhouette)
      if (Math.random() < 0.55) {
        const landmark = new THREE.Group();
        const lz = zStart - 12 - Math.random() * 14;
        landmark.position.set(side * (15.5 + Math.random() * 3.5), -0.05, lz);

        const base = new THREE.Mesh(this.haveliBodyGeo, this.brickRedMat);
        base.scale.set(1.3, 1.0, 1.3);
        base.position.y = 3.1;
        landmark.add(base);

        const dome = new THREE.Mesh(this.mosqueDomeGeo, this.marbleWhiteMat);
        dome.position.y = 6.2;
        landmark.add(dome);

        const minaret = new THREE.Mesh(this.minaretShaftGeo, this.brickRedMat);
        minaret.position.set(side * 2.2, 6.25, 2.0);
        landmark.add(minaret);

        const cap = new THREE.Mesh(this.tallDomeGeo, this.marbleWhiteMat);
        cap.position.set(side * 2.2, 12.5, 2.0);
        landmark.add(cap);

        chunk.group.add(landmark);
      }

      // High drifting low-poly clouds
      if (Math.random() < 0.7) {
        const cloud = new THREE.Mesh(this.cloudGeo, this.cloudMat);
        cloud.scale.set(1.6 + Math.random() * 1.2, 0.65, 1.1 + Math.random() * 0.7);
        cloud.position.set(
          side * (9 + Math.random() * 14),
          10.0 + Math.random() * 5,
          zStart - Math.random() * CHUNK_LENGTH,
        );
        chunk.group.add(cloud);
      }
    }
  }

  public disposeChunk(chunk: TrackChunk): void {
    const sharedGeos = new Set<THREE.BufferGeometry>([
      this.gemGeo,
      this.pillarGeo,
      this.beamGeo,
      this.awningGeo,
      this.hurdleGeo,
      this.hurdleLegGeo,
      this.coneGeo,
      this.tallGeo,
      this.tallArchCapGeo,
      this.tallDomeGeo,
      this.finialGeo,
      this.rickshawBodyGeo,
      this.rickshawNoseGeo,
      this.rickshawRoofGeo,
      this.rickshawPostGeo,
      this.rickshawWheelGeo,
      this.rickshawLightGeo,
      this.springBaseGeo,
      this.springCoreGeo,
      this.boostBaseGeo,
      this.boostRailGeo,
      this.boostChevronGeo,
      this.dashGeo,
      this.catEyeGeo,
      this.roadEdgeLineGeo,
      this.curbSegGeo,
      this.sidewalkGeo,
      this.canalWaterGeo,
      this.haveliBodyGeo,
      this.haveliRoofGeo,
      this.kanguraGeo,
      this.jharokhaGeo,
      this.shopAwningGeo,
      this.windowGlowGeo,
      this.treeTrunkGeo,
      this.neemCrownGeo1,
      this.neemCrownGeo2,
      this.lampPostGeo,
      this.lampArmGeo,
      this.lampBulbGeo,
      this.fairyBulbGeo,
      this.minaretShaftGeo,
      this.mosqueDomeGeo,
      this.cloudGeo,
      this.billboardFrameGeo,
      this.billboardFaceGeo,
      this.billboardPostGeo,
      this.gateComicFaceGeo,
      this.shopBoardFrameGeo,
      this.shopBoardFaceGeo,
      this.stallTableGeo,
      this.samovarGeo,
      this.umbrellaPoleGeo,
      this.umbrellaGeo,
      this.buntingWireGeo,
      this.buntingFlagGeo,
      this.fullDeck36Geo,
      this.powerupIcoGeo,
      this.powerupHaloGeo,
      this.chronosCrystalGeo,
      this.chronosHeartGeo,
      this.chronosRingAGeo,
      this.chronosRingBGeo,
      this.chronosShardGeo,
    ]);
    const sharedMats = new Set<THREE.Material>([
      this.gemMat,
      this.bonusGemMat,
      this.springPadMat,
      this.boostAmberMat,
      this.boostVioletMat,
      this.darkMetalMat,
      this.roadStripeMat,
      this.roadYellowMat,
      this.canalWaterMat,
      this.brassMat,
      this.umbrellaRedMat,
      this.pakGreenMat,
      this.rickshawYellowMat,
      this.truckPinkMat,
      this.warmLightMat,
      this.redLightMat,
      this.marbleWhiteMat,
      this.brickRedMat,
      this.ochreSandMat,
      this.woodBalconyMat,
      this.hazardYellowMat,
      this.cloudMat,
      this.trunkMat,
      this.lahoreTextures.truckArtRailMat,
      ...this.lahoreTextures.comicMaterials,
      this.powerupMats.shield,
      this.powerupMats.magnet,
      this.powerupMats.multiplier,
      this.chronosCrystalMat,
      this.chronosHeartMat,
      this.chronosRingCyanMat,
      this.chronosRingGoldMat,
      ...Object.values(this.biomeMaterials).flatMap((set) => [
        set.deckMat,
        set.trimMat,
        set.hazardMat,
        set.hazardAccentMat,
        set.beamMat,
        set.cliffMat,
        set.foliageMat,
      ]),
    ]);

    const matsToDispose = new Set<THREE.Material>();

    chunk.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (!sharedGeos.has(obj.geometry)) {
          obj.geometry.dispose();
        }
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (m && !sharedMats.has(m)) {
            matsToDispose.add(m);
          }
        }
      }
    });

    for (const m of matsToDispose) {
      m.dispose();
    }
  }

  public disposeShared(): void {
    this.gemGeo.dispose();
    this.pillarGeo.dispose();
    this.beamGeo.dispose();
    this.awningGeo.dispose();
    this.hurdleGeo.dispose();
    this.hurdleLegGeo.dispose();
    this.coneGeo.dispose();
    this.tallGeo.dispose();
    this.tallArchCapGeo.dispose();
    this.tallDomeGeo.dispose();
    this.finialGeo.dispose();
    this.rickshawBodyGeo.dispose();
    this.rickshawNoseGeo.dispose();
    this.rickshawRoofGeo.dispose();
    this.rickshawPostGeo.dispose();
    this.rickshawWheelGeo.dispose();
    this.rickshawLightGeo.dispose();
    this.springBaseGeo.dispose();
    this.springCoreGeo.dispose();
    this.boostBaseGeo.dispose();
    this.boostRailGeo.dispose();
    this.boostChevronGeo.dispose();
    this.dashGeo.dispose();
    this.catEyeGeo.dispose();
    this.roadEdgeLineGeo.dispose();
    this.curbSegGeo.dispose();
    this.sidewalkGeo.dispose();
    this.canalWaterGeo.dispose();
    this.haveliBodyGeo.dispose();
    this.haveliRoofGeo.dispose();
    this.kanguraGeo.dispose();
    this.jharokhaGeo.dispose();
    this.shopAwningGeo.dispose();
    this.windowGlowGeo.dispose();
    this.treeTrunkGeo.dispose();
    this.neemCrownGeo1.dispose();
    this.neemCrownGeo2.dispose();
    this.lampPostGeo.dispose();
    this.lampArmGeo.dispose();
    this.lampBulbGeo.dispose();
    this.fairyBulbGeo.dispose();
    this.minaretShaftGeo.dispose();
    this.mosqueDomeGeo.dispose();
    this.cloudGeo.dispose();
    this.billboardFrameGeo.dispose();
    this.billboardFaceGeo.dispose();
    this.billboardPostGeo.dispose();
    this.gateComicFaceGeo.dispose();
    this.shopBoardFrameGeo.dispose();
    this.shopBoardFaceGeo.dispose();
    this.stallTableGeo.dispose();
    this.samovarGeo.dispose();
    this.umbrellaPoleGeo.dispose();
    this.umbrellaGeo.dispose();
    this.buntingWireGeo.dispose();
    this.buntingFlagGeo.dispose();
    this.fullDeck36Geo.dispose();
    this.powerupIcoGeo.dispose();
    this.powerupHaloGeo.dispose();
    this.chronosCrystalGeo.dispose();
    this.chronosHeartGeo.dispose();
    this.chronosRingAGeo.dispose();
    this.chronosRingBGeo.dispose();
    this.chronosShardGeo.dispose();

    this.gemMat.dispose();
    this.bonusGemMat.dispose();
    this.springPadMat.dispose();
    this.boostAmberMat.dispose();
    this.boostVioletMat.dispose();
    this.darkMetalMat.dispose();
    this.roadStripeMat.dispose();
    this.roadYellowMat.dispose();
    this.canalWaterMat.dispose();
    this.brassMat.dispose();
    this.umbrellaRedMat.dispose();
    this.pakGreenMat.dispose();
    this.rickshawYellowMat.dispose();
    this.truckPinkMat.dispose();
    this.warmLightMat.dispose();
    this.redLightMat.dispose();
    this.marbleWhiteMat.dispose();
    this.brickRedMat.dispose();
    this.ochreSandMat.dispose();
    this.woodBalconyMat.dispose();
    this.hazardYellowMat.dispose();
    this.cloudMat.dispose();
    this.trunkMat.dispose();
    this.powerupMats.shield.dispose();
    this.powerupMats.magnet.dispose();
    this.powerupMats.multiplier.dispose();
    this.chronosCrystalMat.dispose();
    this.chronosHeartMat.dispose();
    this.chronosRingCyanMat.dispose();
    this.chronosRingGoldMat.dispose();
    for (const set of Object.values(this.biomeMaterials)) {
      set.deckMat.dispose();
      set.trimMat.dispose();
      set.hazardMat.dispose();
      set.hazardAccentMat.dispose();
      set.beamMat.dispose();
      set.cliffMat.dispose();
      set.foliageMat.dispose();
    }
    this.lahoreTextures.dispose();
  }
}
