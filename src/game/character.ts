import * as THREE from 'three';
import type { CharacterSkin, SkinCosmeticId } from './types';

export interface RunnerPoseState {
  isGrounded: boolean;
  isSliding: boolean;
  vy: number;
  laneVelX: number;
  laneAccelX?: number;
  speedMultiplier?: number;
  forwardSpeed?: number;
  obstacleProximity?: number;
  obstacleSideBias?: number;
  obstacleKind?: 'none' | 'jump' | 'slide' | 'tall' | 'moving';
  runCycle: number;
  squashY: number;
  hasShield: boolean;
  magnetTimer: number;
  multiplierTimer: number;
  chronosTimer: number;
  powerupSurge: number;
  hitFlash: number;
  invulnTimer?: number;
  showcaseMode: boolean;
  sampleTerrainHeight?: (worldX: number, worldZ: number) => number;
}

const enum BoneId {
  Root = 0,
  Hips = 1,
  Spine = 2,
  Chest = 3,
  Neck = 4,
  Head = 5,
  LeftArm = 6,
  LeftForearm = 7,
  LeftHand = 8,
  RightArm = 9,
  RightForearm = 10,
  RightHand = 11,
  LeftThigh = 12,
  LeftShin = 13,
  LeftFoot = 14,
  RightThigh = 15,
  RightShin = 16,
  RightFoot = 17,
}

const SKELETON_BONE_COUNT = 18;
export const RUNNER_SHADOW_LAYER = 1;

export interface SkinWeightNormalizationStats {
  vertexCount: number;
  maxBoneIndex: number;
  repairedCount: number;
  prunedInfluences: number;
  duplicateBonesCollapsed: number;
  maxWeightSumDeviationBefore: number;
  maxWeightSumDeviationAfter: number;
}

type AnimStateName = 'idle' | 'run' | 'jump' | 'slide';

interface BoneInfluence {
  idx: [number, number, number, number];
  wt: [number, number, number, number];
}

interface SkinnedPartSpec {
  geometry: THREE.BufferGeometry;
  weightFn?: (x: number, y: number, z: number) => BoneInfluence;
  fixedInfluence?: BoneInfluence;
}

function makeFixedInfluence(
  b0: number,
  w0 = 1,
  b1 = 0,
  w1 = 0,
  b2 = 0,
  w2 = 0,
  b3 = 0,
  w3 = 0,
): BoneInfluence {
  const c0 = Number.isFinite(w0) && w0 > 0 ? w0 : 0;
  const c1 = Number.isFinite(w1) && w1 > 0 ? w1 : 0;
  const c2 = Number.isFinite(w2) && w2 > 0 ? w2 : 0;
  const c3 = Number.isFinite(w3) && w3 > 0 ? w3 : 0;
  const sum = c0 + c1 + c2 + c3;
  if (sum <= 1e-6) {
    return {
      idx: [b0, 0, 0, 0],
      wt: [1, 0, 0, 0],
    };
  }
  return {
    idx: [b0, c1 > 0 ? b1 : 0, c2 > 0 ? b2 : 0, c3 > 0 ? b3 : 0],
    wt: [c0 / sum, c1 / sum, c2 / sum, c3 / sum],
  };
}

/**
 * Sanitizes, deduplicates, prunes sub-epsilon slivers, sorts descending, and
 * enforces strict L1 unit-sum normalization on skinIndex/skinWeight attributes.
 */
export function normalizeGeometrySkinWeights(
  geometry: THREE.BufferGeometry,
  boneCount = SKELETON_BONE_COUNT,
): SkinWeightNormalizationStats {
  const skinIndexAttr = geometry.getAttribute('skinIndex') as THREE.BufferAttribute | undefined;
  const skinWeightAttr = geometry.getAttribute('skinWeight') as THREE.BufferAttribute | undefined;
  if (!skinIndexAttr || !skinWeightAttr) {
    return {
      vertexCount: 0,
      maxBoneIndex: 0,
      repairedCount: 0,
      prunedInfluences: 0,
      duplicateBonesCollapsed: 0,
      maxWeightSumDeviationBefore: 0,
      maxWeightSumDeviationAfter: 0,
    };
  }

  const count = Math.min(skinIndexAttr.count, skinWeightAttr.count);
  const safeMaxBone = Math.max(1, boneCount);
  const slotIdx = [0, 0, 0, 0];
  const slotWt = [0, 0, 0, 0];

  let maxBoneIndex = 0;
  let repairedCount = 0;
  let prunedInfluences = 0;
  let duplicateBonesCollapsed = 0;
  let maxWeightSumDeviationBefore = 0;
  let maxWeightSumDeviationAfter = 0;

  for (let i = 0; i < count; i++) {
    const rawI0 = skinIndexAttr.getX(i);
    const rawI1 = skinIndexAttr.getY(i);
    const rawI2 = skinIndexAttr.getZ(i);
    const rawI3 = skinIndexAttr.getW(i);

    const rawW0 = skinWeightAttr.getX(i);
    const rawW1 = skinWeightAttr.getY(i);
    const rawW2 = skinWeightAttr.getZ(i);
    const rawW3 = skinWeightAttr.getW(i);

    const rawSum =
      (Number.isFinite(rawW0) ? rawW0 : 0) +
      (Number.isFinite(rawW1) ? rawW1 : 0) +
      (Number.isFinite(rawW2) ? rawW2 : 0) +
      (Number.isFinite(rawW3) ? rawW3 : 0);
    maxWeightSumDeviationBefore = Math.max(maxWeightSumDeviationBefore, Math.abs(1 - rawSum));

    slotIdx[0] = rawI0;
    slotIdx[1] = rawI1;
    slotIdx[2] = rawI2;
    slotIdx[3] = rawI3;
    slotWt[0] = rawW0;
    slotWt[1] = rawW1;
    slotWt[2] = rawW2;
    slotWt[3] = rawW3;

    let vertexRepaired = false;

    // 1. Clamp indices and zero invalid/sub-epsilon weights
    for (let s = 0; s < 4; s++) {
      let idx = Number.isFinite(slotIdx[s]) ? Math.round(slotIdx[s]) : 0;
      if (idx < 0 || idx >= safeMaxBone) {
        idx = 0;
        vertexRepaired = true;
      }
      let wt = slotWt[s];
      if (!Number.isFinite(wt) || wt < 0) {
        wt = 0;
        vertexRepaired = true;
      } else if (wt > 0 && wt < 1e-4) {
        wt = 0;
        prunedInfluences++;
        vertexRepaired = true;
      }
      slotIdx[s] = wt > 0 ? idx : 0;
      slotWt[s] = wt;
    }

    // 2. Collapse duplicate bone entries within the 4 skinning slots
    for (let a = 0; a < 4; a++) {
      if (slotWt[a] <= 0) continue;
      for (let b = a + 1; b < 4; b++) {
        if (slotWt[b] > 0 && slotIdx[b] === slotIdx[a]) {
          slotWt[a] += slotWt[b];
          slotWt[b] = 0;
          slotIdx[b] = 0;
          duplicateBonesCollapsed++;
          vertexRepaired = true;
        }
      }
    }

    // 3. Sort descending by weight so dominant bone is always slot 0
    for (let a = 0; a < 3; a++) {
      for (let b = a + 1; b < 4; b++) {
        if (slotWt[b] > slotWt[a]) {
          const tmpW = slotWt[a];
          slotWt[a] = slotWt[b];
          slotWt[b] = tmpW;
          const tmpI = slotIdx[a];
          slotIdx[a] = slotIdx[b];
          slotIdx[b] = tmpI;
        }
      }
    }

    // 4. Normalize to exact unit sum (preventing zero-sum origin collapse)
    const sum = slotWt[0] + slotWt[1] + slotWt[2] + slotWt[3];
    if (sum <= 1e-6) {
      slotIdx[0] = BoneId.Root;
      slotIdx[1] = 0;
      slotIdx[2] = 0;
      slotIdx[3] = 0;
      slotWt[0] = 1;
      slotWt[1] = 0;
      slotWt[2] = 0;
      slotWt[3] = 0;
      vertexRepaired = true;
    } else {
      const invSum = 1 / sum;
      slotWt[0] = Math.fround(slotWt[0] * invSum);
      slotWt[1] = Math.fround(slotWt[1] * invSum);
      slotWt[2] = Math.fround(slotWt[2] * invSum);
      slotWt[3] = Math.fround(slotWt[3] * invSum);
      const residual = 1 - (slotWt[0] + slotWt[1] + slotWt[2] + slotWt[3]);
      slotWt[0] = Math.fround(Math.max(0, slotWt[0] + residual));
      for (let a = 0; a < 3; a++) {
        for (let b = a + 1; b < 4; b++) {
          if (slotWt[b] > slotWt[a]) {
            const tmpW = slotWt[a];
            slotWt[a] = slotWt[b];
            slotWt[b] = tmpW;
            const tmpI = slotIdx[a];
            slotIdx[a] = slotIdx[b];
            slotIdx[b] = tmpI;
          }
        }
      }
    }

    for (let s = 0; s < 4; s++) {
      if (slotWt[s] <= 0) {
        slotWt[s] = 0;
        slotIdx[s] = 0;
      } else if (slotIdx[s] > maxBoneIndex) {
        maxBoneIndex = slotIdx[s];
      }
    }

    const afterSum = slotWt[0] + slotWt[1] + slotWt[2] + slotWt[3];
    maxWeightSumDeviationAfter = Math.max(maxWeightSumDeviationAfter, Math.abs(1 - afterSum));

    if (
      vertexRepaired ||
      Math.abs(1 - rawSum) > 1e-5 ||
      slotIdx[0] !== rawI0 ||
      slotIdx[1] !== rawI1 ||
      slotIdx[2] !== rawI2 ||
      slotIdx[3] !== rawI3
    ) {
      repairedCount++;
    }

    skinIndexAttr.setXYZW(i, slotIdx[0], slotIdx[1], slotIdx[2], slotIdx[3]);
    skinWeightAttr.setXYZW(i, slotWt[0], slotWt[1], slotWt[2], slotWt[3]);
  }

  skinIndexAttr.needsUpdate = true;
  skinWeightAttr.needsUpdate = true;

  return {
    vertexCount: count,
    maxBoneIndex,
    repairedCount,
    prunedInfluences,
    duplicateBonesCollapsed,
    maxWeightSumDeviationBefore,
    maxWeightSumDeviationAfter,
  };
}

function smoothstep01(t: number): number {
  const c = THREE.MathUtils.clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

/**
 * Generates a subtle procedural woven athletic-fabric bump texture (linear data map, zero 404s).
 */
function createFabricBumpTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 4) {
      for (let x = 0; x < size; x += 4) {
        const checker = ((x + y) >> 2) & 1;
        ctx.fillStyle = checker ? '#969696' : '#6e6e6e';
        ctx.fillRect(x, y, 2, 3);
        ctx.fillStyle = checker ? '#767676' : '#8c8c8c';
        ctx.fillRect(x + 2, y + 1, 2, 2);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Merges multiple BufferGeometries (converted to non-indexed with position, normal, uv,
 * skinIndex Uint16(4), and skinWeight Float32(4)) into a single SkinnedMesh geometry.
 */
function mergeSkinnedParts(parts: SkinnedPartSpec[]): THREE.BufferGeometry {
  const prepared: Array<{
    pos: Float32Array;
    norm: Float32Array;
    uv: Float32Array;
    skinIdx: Uint16Array;
    skinWt: Float32Array;
    count: number;
  }> = [];
  let totalVerts = 0;

  for (const part of parts) {
    const nonIndexed = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
    if (!nonIndexed.getAttribute('normal')) {
      nonIndexed.computeVertexNormals();
    }
    const posAttr = nonIndexed.getAttribute('position') as THREE.BufferAttribute;
    const normAttr = nonIndexed.getAttribute('normal') as THREE.BufferAttribute;
    const uvAttr = nonIndexed.getAttribute('uv') as THREE.BufferAttribute | undefined;
    const count = posAttr.count;

    const pos = new Float32Array(count * 3);
    const norm = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    const skinIdx = new Uint16Array(count * 4);
    const skinWt = new Float32Array(count * 4);

    for (let i = 0; i < count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const vz = posAttr.getZ(i);
      pos[i * 3] = vx;
      pos[i * 3 + 1] = vy;
      pos[i * 3 + 2] = vz;

      norm[i * 3] = normAttr.getX(i);
      norm[i * 3 + 1] = normAttr.getY(i);
      norm[i * 3 + 2] = normAttr.getZ(i);

      if (uvAttr) {
        uv[i * 2] = uvAttr.getX(i);
        uv[i * 2 + 1] = uvAttr.getY(i);
      }

      const inf = part.weightFn ? part.weightFn(vx, vy, vz) : part.fixedInfluence!;
      const wSum = inf.wt[0] + inf.wt[1] + inf.wt[2] + inf.wt[3] || 1;
      skinIdx[i * 4] = inf.idx[0];
      skinIdx[i * 4 + 1] = inf.idx[1];
      skinIdx[i * 4 + 2] = inf.idx[2];
      skinIdx[i * 4 + 3] = inf.idx[3];
      skinWt[i * 4] = inf.wt[0] / wSum;
      skinWt[i * 4 + 1] = inf.wt[1] / wSum;
      skinWt[i * 4 + 2] = inf.wt[2] / wSum;
      skinWt[i * 4 + 3] = inf.wt[3] / wSum;
    }

    prepared.push({ pos, norm, uv, skinIdx, skinWt, count });
    totalVerts += count;
    nonIndexed.dispose();
    part.geometry.dispose();
  }

  const outPos = new Float32Array(totalVerts * 3);
  const outNorm = new Float32Array(totalVerts * 3);
  const outUv = new Float32Array(totalVerts * 2);
  const outSkinIdx = new Uint16Array(totalVerts * 4);
  const outSkinWt = new Float32Array(totalVerts * 4);

  let offset = 0;
  for (const item of prepared) {
    outPos.set(item.pos, offset * 3);
    outNorm.set(item.norm, offset * 3);
    outUv.set(item.uv, offset * 2);
    outSkinIdx.set(item.skinIdx, offset * 4);
    outSkinWt.set(item.skinWt, offset * 4);
    offset += item.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(outPos, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(outNorm, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(outUv, 2));
  merged.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(outSkinIdx, 4));
  merged.setAttribute('skinWeight', new THREE.Float32BufferAttribute(outSkinWt, 4));
  normalizeGeometrySkinWeights(merged, SKELETON_BONE_COUNT);
  return merged;
}

interface TubeRing {
  cx: number;
  cy: number;
  cz: number;
  rx: number;
  rz: number;
  tiltX?: number;
  tiltZ?: number;
}

/**
 * Builds a continuous closed-cap organic tube mesh across ordered rings (bottom to top)
 * with smooth vertex normals across joint rings for natural human anatomy & joint bending.
 */
function createOrganicTube(rings: TubeRing[], radialSegs = 18): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const ringCount = rings.length;
  const stride = radialSegs + 1;

  for (let r = 0; r < ringCount; r++) {
    const ring = rings[r];
    const v = r / Math.max(1, ringCount - 1);
    const cosTx = Math.cos(ring.tiltX ?? 0);
    const sinTx = Math.sin(ring.tiltX ?? 0);
    const cosTz = Math.cos(ring.tiltZ ?? 0);
    const sinTz = Math.sin(ring.tiltZ ?? 0);

    for (let s = 0; s <= radialSegs; s++) {
      const u = s / radialSegs;
      const theta = u * Math.PI * 2;
      const lx = Math.cos(theta) * ring.rx;
      const lz = Math.sin(theta) * ring.rz;

      const y1 = -lz * sinTx;
      const z1 = lz * cosTx;
      const x2 = lx * cosTz - y1 * sinTz;
      const y2 = lx * sinTz + y1 * cosTz;

      positions.push(ring.cx + x2, ring.cy + y2, ring.cz + z1);
      uvs.push(u, v);
    }
  }

  for (let r = 0; r < ringCount - 1; r++) {
    for (let s = 0; s < radialSegs; s++) {
      const a = r * stride + s;
      const b = r * stride + s + 1;
      const c = (r + 1) * stride + s;
      const d = (r + 1) * stride + s + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const bottomCenterIdx = ringCount * stride;
  positions.push(rings[0].cx, rings[0].cy, rings[0].cz);
  uvs.push(0.5, 0);
  for (let s = 0; s < radialSegs; s++) {
    indices.push(bottomCenterIdx, s, s + 1);
  }

  const topCenterIdx = bottomCenterIdx + 1;
  const topRing = rings[ringCount - 1];
  const topStart = (ringCount - 1) * stride;
  positions.push(topRing.cx, topRing.cy, topRing.cz);
  uvs.push(0.5, 1);
  for (let s = 0; s < radialSegs; s++) {
    indices.push(topCenterIdx, topStart + s + 1, topStart + s);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a sculpted curved tube along a CatmullRomCurve3 (used for hair locks, seams, stripes).
 */
function createCurvedTube(
  points: Array<[number, number, number]>,
  radius: number,
  tubularSegments = 10,
  radialSegments = 7,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  return new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
}

const _tmpEuler = new THREE.Euler();
const _tmpQuat = new THREE.Quaternion();

// Pre-allocated zero-GC scratch helpers for 2-bone analytical Arm/Hand IK
const _ikInvRig = new THREE.Matrix4();
const _ikRigBoneMat = new THREE.Matrix4();
const _ikBasisMat = new THREE.Matrix4();
const _ikChestPos = new THREE.Vector3();
const _ikChestScale = new THREE.Vector3();
const _ikDummyScale = new THREE.Vector3();
const _ikChestRigQ = new THREE.Quaternion();
const _ikChestRigQInv = new THREE.Quaternion();
const _ikS = new THREE.Vector3();
const _ikEfk = new THREE.Vector3();
const _ikHfk = new THREE.Vector3();
const _ikT = new THREE.Vector3();
const _ikP = new THREE.Vector3();
const _ikEik = new THREE.Vector3();
const _ikDirST = new THREE.Vector3();
const _ikPoleDir = new THREE.Vector3();
const _ikOrthoP = new THREE.Vector3();
const _ikFallbackAxis = new THREE.Vector3();
const _ikD1 = new THREE.Vector3();
const _ikD2 = new THREE.Vector3();
const _ikD2Local = new THREE.Vector3();
const _ikBasisX = new THREE.Vector3();
const _ikBasisY = new THREE.Vector3();
const _ikBasisZ = new THREE.Vector3();
const _ikQArmRig = new THREE.Quaternion();
const _ikQArmRigInv = new THREE.Quaternion();
const _ikQArmLocalIk = new THREE.Quaternion();
const _ikQForearmLocalIk = new THREE.Quaternion();
const _ikQForearmRigIk = new THREE.Quaternion();
const _ikQForearmRigIkInv = new THREE.Quaternion();
const _ikQHandRigFk = new THREE.Quaternion();
const _ikQHandRigIk = new THREE.Quaternion();
const _ikQHandLocalIk = new THREE.Quaternion();
const _ikQHandOffset = new THREE.Quaternion();
const _ikHandEuler = new THREE.Euler();
const _ikArmQDummy = new THREE.Quaternion();

// Pre-allocated zero-GC scratch helpers for 2-bone analytical Leg & Foot Terrain IK
interface FootIKSideState {
  pinned: boolean;
  pinWorldX: number;
  pinWorldZ: number;
  pinWeight: number;
  ikWeight: number;
  alignWeight: number;
  smoothedGroundY: number;
  hasGroundSample: boolean;
  smoothedNormal: THREE.Vector3;
}

interface FootTerrainSample {
  valid: boolean;
  groundY: number;
  normal: THREE.Vector3;
}

const _legRigMat = new THREE.Matrix4();
const _legInvRig = new THREE.Matrix4();
const _legRigBoneMat = new THREE.Matrix4();
const _legBasisMat = new THREE.Matrix4();
const _legWorldPos = new THREE.Vector3();
const _legDummyScale = new THREE.Vector3();
const _legDummyQuat = new THREE.Quaternion();

const _legHipsPosRig = new THREE.Vector3();
const _legHipsScaleRig = new THREE.Vector3();
const _legHipsRigQ = new THREE.Quaternion();
const _legHipsRigQInv = new THREE.Quaternion();

const _legHipRigL = new THREE.Vector3();
const _legKneeFkRigL = new THREE.Vector3();
const _legAnkleFkRigL = new THREE.Vector3();
const _legAnkleFkWorldL = new THREE.Vector3();
const _legTargetWorldL = new THREE.Vector3();
const _legTargetRigL = new THREE.Vector3();
const _legQFootRigFkL = new THREE.Quaternion();

const _legHipRigR = new THREE.Vector3();
const _legKneeFkRigR = new THREE.Vector3();
const _legAnkleFkRigR = new THREE.Vector3();
const _legAnkleFkWorldR = new THREE.Vector3();
const _legTargetWorldR = new THREE.Vector3();
const _legTargetRigR = new THREE.Vector3();
const _legQFootRigFkR = new THREE.Quaternion();

const _legSampleNormalL = new THREE.Vector3(0, 1, 0);
const _legSampleNormalR = new THREE.Vector3(0, 1, 0);
const _legTerrainNormalRig = new THREE.Vector3(0, 1, 0);
const _legNormalMat3 = new THREE.Matrix3();

const _legDirHA = new THREE.Vector3();
const _legPoleDir = new THREE.Vector3();
const _legOrthoP = new THREE.Vector3();
const _legFallbackPole = new THREE.Vector3();
const _legKneeIk = new THREE.Vector3();
const _legD1 = new THREE.Vector3();
const _legD2 = new THREE.Vector3();
const _legD2Local = new THREE.Vector3();
const _legBasisX = new THREE.Vector3();
const _legBasisY = new THREE.Vector3();
const _legBasisZ = new THREE.Vector3();
const _legQThighRig = new THREE.Quaternion();
const _legQThighRigInv = new THREE.Quaternion();
const _legQThighLocalIk = new THREE.Quaternion();
const _legQShinLocalIk = new THREE.Quaternion();
const _legQShinRigIk = new THREE.Quaternion();
const _legQShinRigIkInv = new THREE.Quaternion();
const _legFootFwd = new THREE.Vector3();
const _legQFootRigAligned = new THREE.Quaternion();
const _legQFootRigTarget = new THREE.Quaternion();
const _legQFootLocalTarget = new THREE.Quaternion();
const _legDownAxis = new THREE.Vector3(0, -1, 0);
const _legEulerScratch = new THREE.Euler();

interface FootIKDebugSide {
  group: THREE.Group;
  targetMarker: THREE.Mesh;
  solePlaneCage: THREE.Mesh;
  groundRing: THREE.Mesh;
  groundRingMat: THREE.MeshBasicMaterial;
  pinStake: THREE.Mesh;
  solvedAnkleBox: THREE.Mesh;
  lines: THREE.LineSegments;
  linePosAttr: THREE.BufferAttribute;
  linePositions: Float32Array;
}

const _dbgSolvedAnkleWorld = new THREE.Vector3();
const _dbgFootWorldQuat = new THREE.Quaternion();
const _dbgFwd = new THREE.Vector3();
const _dbgBasisX = new THREE.Vector3();
const _dbgBasisY = new THREE.Vector3();
const _dbgBasisZ = new THREE.Vector3();
const _dbgRotMat = new THREE.Matrix4();

function buildShoulderRestBasisQuat(
  upperDir: THREE.Vector3,
  outQuat: THREE.Quaternion,
): THREE.Quaternion {
  const by = _ikBasisY.copy(upperDir).normalize();
  const hingeApprox = _ikFallbackAxis.set(1, 0, 0);
  const bz = _ikBasisZ.crossVectors(hingeApprox, by).normalize();
  const bx = _ikBasisX.crossVectors(by, bz).normalize();
  _ikBasisMat.makeBasis(bx, by, bz);
  return outQuat.setFromRotationMatrix(_ikBasisMat);
}

function buildQuatTrack(
  boneName: string,
  times: number[],
  poses: Array<[number, number, number]>,
): THREE.QuaternionKeyframeTrack {
  const values: number[] = [];
  let prevX = 0;
  let prevY = 0;
  let prevZ = 0;
  let prevW = 1;

  for (let i = 0; i < poses.length; i++) {
    const [rx, ry, rz] = poses[i];
    _tmpEuler.set(rx, ry, rz, 'XYZ');
    _tmpQuat.setFromEuler(_tmpEuler);
    let qx = _tmpQuat.x;
    let qy = _tmpQuat.y;
    let qz = _tmpQuat.z;
    let qw = _tmpQuat.w;
    if (i > 0 && prevX * qx + prevY * qy + prevZ * qz + prevW * qw < 0) {
      qx = -qx;
      qy = -qy;
      qz = -qz;
      qw = -qw;
    }
    prevX = qx;
    prevY = qy;
    prevZ = qz;
    prevW = qw;
    values.push(qx, qy, qz, qw);
  }
  const trackName = boneName.endsWith('.quaternion') ? boneName : `${boneName}.quaternion`;
  const track = new THREE.QuaternionKeyframeTrack(trackName, times, values);
  track.setInterpolation(THREE.InterpolateLinear);
  return track;
}

function buildVecTrack(
  target: string,
  times: number[],
  vecs: Array<[number, number, number]>,
): THREE.VectorKeyframeTrack {
  const values: number[] = [];
  for (const [x, y, z] of vecs) {
    values.push(x, y, z);
  }
  const track = new THREE.VectorKeyframeTrack(target, times, values);
  track.setInterpolation(THREE.InterpolateSmooth);
  return track;
}

export class LowPolyCharacter {
  public readonly root = new THREE.Group();
  public readonly debugFootIkGroup = new THREE.Group();
  private readonly bodyRig = new THREE.Group();

  private readonly bones: THREE.Bone[] = [];
  private readonly skeleton: THREE.Skeleton;
  private readonly skinnedMeshes: THREE.SkinnedMesh[] = [];

  private readonly hipsBone: THREE.Bone;
  private readonly chestBone: THREE.Bone;
  private readonly headBone: THREE.Bone;
  private readonly leftArmBone: THREE.Bone;
  private readonly leftForearmBone: THREE.Bone;
  private readonly leftHandBone: THREE.Bone;
  private readonly rightArmBone: THREE.Bone;
  private readonly rightForearmBone: THREE.Bone;
  private readonly rightHandBone: THREE.Bone;
  private readonly leftThighBone: THREE.Bone;
  private readonly leftShinBone: THREE.Bone;
  private readonly leftFootBone: THREE.Bone;
  private readonly rightThighBone: THREE.Bone;
  private readonly rightShinBone: THREE.Bone;
  private readonly rightFootBone: THREE.Bone;

  private readonly leftUpperLen: number;
  private readonly leftForearmLen: number;
  private readonly rightUpperLen: number;
  private readonly rightForearmLen: number;
  private readonly leftThighLen: number;
  private readonly leftShinLen: number;
  private readonly rightThighLen: number;
  private readonly rightShinLen: number;
  private readonly footSoleOffset = 0.078;
  private readonly leftRestU1 = new THREE.Vector3();
  private readonly leftRestU2 = new THREE.Vector3();
  private readonly rightRestU1 = new THREE.Vector3();
  private readonly rightRestU2 = new THREE.Vector3();
  private readonly leftRestArmQInv = new THREE.Quaternion();
  private readonly rightRestArmQInv = new THREE.Quaternion();

  private readonly chestAccessoryGroup = new THREE.Group();
  private readonly headAccessoryGroup = new THREE.Group();
  private readonly hipsAccessoryGroup = new THREE.Group();
  private readonly leftShinAccessoryGroup = new THREE.Group();
  private readonly rightShinAccessoryGroup = new THREE.Group();
  private readonly hairGroup = new THREE.Group();
  private readonly chestCosmeticGroup = new THREE.Group();
  private readonly headCosmeticGroup = new THREE.Group();
  private readonly facialGroup = new THREE.Group();
  private readonly archetypeMaterials: THREE.Material[] = [];

  private readonly mixer: THREE.AnimationMixer;
  private readonly idleAction: THREE.AnimationAction;
  private readonly runAction: THREE.AnimationAction;
  private readonly jumpAction: THREE.AnimationAction;
  private readonly slideAction: THREE.AnimationAction;
  private readonly runClipDuration = 1.0;

  private activeState: AnimStateName = 'run';
  private stateWeights: Record<AnimStateName, number> = {
    idle: 0,
    run: 1,
    jump: 0,
    slide: 0,
  };

  // Damped Inverse Kinematics state (momentum, speed multiplier, obstacle avoidance)
  private ikBlend = 0;
  private ikSpeedNorm = 0;
  private ikOverdrive = 0;
  private ikLatMom = 0;
  private ikVertMom = 0;
  private ikImpactMom = 0;
  private ikAvoidProx = 0;
  private ikAvoidSide = 0;
  private ikDuckFactor = 0;
  private ikHurdleFactor = 0;

  // Analytical Foot & Leg Terrain IK state
  private footIkWasGrounded = true;
  private footLandingTimer = 0;
  private ikPelvisDeltaY = 0;
  private lastFootIkRootZ = 0;
  private readonly leftFootIkState: FootIKSideState = {
    pinned: false,
    pinWorldX: 0,
    pinWorldZ: 0,
    pinWeight: 0,
    ikWeight: 0,
    alignWeight: 0,
    smoothedGroundY: 0,
    hasGroundSample: false,
    smoothedNormal: new THREE.Vector3(0, 1, 0),
  };
  private readonly rightFootIkState: FootIKSideState = {
    pinned: false,
    pinWorldX: 0,
    pinWorldZ: 0,
    pinWeight: 0,
    ikWeight: 0,
    alignWeight: 0,
    smoothedGroundY: 0,
    hasGroundSample: false,
    smoothedNormal: new THREE.Vector3(0, 1, 0),
  };

  private debugFootIkVisible = false;
  private leftFootDebug: FootIKDebugSide | null = null;
  private rightFootDebug: FootIKDebugSide | null = null;
  private readonly debugSharedGeos: THREE.BufferGeometry[] = [];
  private readonly debugSharedMats: THREE.Material[] = [];

  private readonly shieldBubble: THREE.Mesh;
  private readonly shieldInnerShell: THREE.Mesh;
  private readonly magnetAuraGroup = new THREE.Group();
  private readonly magnetRingA: THREE.Mesh;
  private readonly magnetRingB: THREE.Mesh;
  private readonly multiplierAuraGroup = new THREE.Group();
  private readonly chronosAuraGroup = new THREE.Group();
  private readonly chronosRingA: THREE.Mesh;
  private readonly chronosRingB: THREE.Mesh;
  private readonly contactShadow: THREE.Mesh;
  private vfxTime = 0;

  private readonly fabricBumpTex: THREE.CanvasTexture | null;
  private readonly primaryMat: THREE.MeshStandardMaterial;
  private readonly secondaryMat: THREE.MeshStandardMaterial;
  private readonly accentMat: THREE.MeshStandardMaterial;
  private readonly visorMat: THREE.MeshStandardMaterial;
  private readonly skinMat: THREE.MeshPhysicalMaterial;
  private readonly hairMat: THREE.MeshStandardMaterial;
  private readonly soleMat: THREE.MeshStandardMaterial;
  private readonly irisMat: THREE.MeshStandardMaterial;
  private currentSkin: CharacterSkin;
  private currentCosmeticId: SkinCosmeticId | null = null;

  constructor(initialSkin: CharacterSkin, initialCosmeticId: SkinCosmeticId | null = null) {
    this.currentSkin = initialSkin;
    this.currentCosmeticId = initialCosmeticId;

    this.fabricBumpTex = createFabricBumpTexture();

    this.primaryMat = new THREE.MeshStandardMaterial({
      color: initialSkin.primaryColor,
      roughness: Math.max(0.42, initialSkin.roughness),
      metalness: Math.min(0.38, initialSkin.metalness),
      bumpMap: this.fabricBumpTex,
      bumpScale: 0.008,
    });
    this.secondaryMat = new THREE.MeshStandardMaterial({
      color: initialSkin.secondaryColor,
      roughness: Math.min(0.86, initialSkin.roughness + 0.22),
      metalness: Math.max(0.04, initialSkin.metalness * 0.24),
      bumpMap: this.fabricBumpTex,
      bumpScale: 0.006,
    });
    this.accentMat = new THREE.MeshStandardMaterial({
      color: initialSkin.accentColor,
      roughness: 0.30,
      metalness: 0.36,
    });
    this.visorMat = new THREE.MeshStandardMaterial({
      color: initialSkin.visorColor,
      emissive: initialSkin.visorColor,
      emissiveIntensity: initialSkin.emissiveIntensity,
      roughness: 0.16,
      metalness: 0.72,
    });
    this.skinMat = new THREE.MeshPhysicalMaterial({
      color: initialSkin.skinTone ?? 0xd99b72,
      roughness: 0.52,
      metalness: 0.0,
      sheen: 0.44,
      sheenRoughness: 0.60,
      sheenColor: new THREE.Color(0xffcdb0),
      clearcoat: 0.04,
    });
    this.hairMat = new THREE.MeshStandardMaterial({
      color: initialSkin.hairColor ?? 0x1b1512,
      roughness: 0.54,
      metalness: 0.10,
    });
    this.soleMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.46,
      metalness: 0.06,
    });
    this.irisMat = new THREE.MeshStandardMaterial({
      color: initialSkin.eyeColor ?? 0x3f2414,
      roughness: 0.18,
      metalness: 0.08,
    });

    // Soft contact shadow grounded beneath runner
    const shadowGeo = new THREE.CircleGeometry(0.56, 22);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x070d18,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    this.contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.contactShadow.position.y = 0.025;
    this.root.add(this.contactShadow);

    this.root.add(this.bodyRig);

    // -------------------------------------------------------------------------
    // 1. 18-Bone Athletic Human Kid Skeleton (~1.62m standing height)
    //    Bind positions:
    //    Hips 0.78 | Spine 0.91 | Chest 1.08 | Neck 1.24 | Head 1.32
    //    Shoulders (±0.185, 1.19, 0) | Elbows (±0.197, 0.985, 0) | Wrists (±0.201, 0.790, 0)
    //    Hips L/R (±0.098, 0.76, 0) | Knees (±0.098, 0.415, 0) | Ankles (±0.098, 0.080, 0)
    // -------------------------------------------------------------------------
    const makeBone = (name: string, parent: THREE.Object3D, x: number, y: number, z: number): THREE.Bone => {
      const b = new THREE.Bone();
      b.name = name;
      b.position.set(x, y, z);
      parent.add(b);
      this.bones.push(b);
      return b;
    };

    const rootBone = makeBone('Root', this.bodyRig, 0, 0, 0);
    this.hipsBone = makeBone('Hips', rootBone, 0, 0.78, 0);
    const spineBone = makeBone('Spine', this.hipsBone, 0, 0.13, 0);
    this.chestBone = makeBone('Chest', spineBone, 0, 0.17, 0);
    const neckBone = makeBone('Neck', this.chestBone, 0, 0.16, 0);
    this.headBone = makeBone('Head', neckBone, 0, 0.08, 0);

    this.leftArmBone = makeBone('LeftArm', this.chestBone, -0.185, 0.11, 0);
    this.leftForearmBone = makeBone('LeftForearm', this.leftArmBone, -0.012, -0.205, 0);
    this.leftHandBone = makeBone('LeftHand', this.leftForearmBone, -0.004, -0.195, 0);

    this.rightArmBone = makeBone('RightArm', this.chestBone, 0.185, 0.11, 0);
    this.rightForearmBone = makeBone('RightForearm', this.rightArmBone, 0.012, -0.205, 0);
    this.rightHandBone = makeBone('RightHand', this.rightForearmBone, 0.004, -0.195, 0);

    this.leftUpperLen = this.leftForearmBone.position.length();
    this.leftForearmLen = this.leftHandBone.position.length();
    this.leftRestU1.copy(this.leftForearmBone.position).normalize();
    this.leftRestU2.copy(this.leftHandBone.position).normalize();
    buildShoulderRestBasisQuat(this.leftRestU1, this.leftRestArmQInv).invert();

    this.rightUpperLen = this.rightForearmBone.position.length();
    this.rightForearmLen = this.rightHandBone.position.length();
    this.rightRestU1.copy(this.rightForearmBone.position).normalize();
    this.rightRestU2.copy(this.rightHandBone.position).normalize();
    buildShoulderRestBasisQuat(this.rightRestU1, this.rightRestArmQInv).invert();

    this.leftThighBone = makeBone('LeftThigh', this.hipsBone, -0.098, -0.02, 0);
    this.leftShinBone = makeBone('LeftShin', this.leftThighBone, 0, -0.345, 0);
    this.leftFootBone = makeBone('LeftFoot', this.leftShinBone, 0, -0.335, 0);
    this.leftThighLen = this.leftShinBone.position.length();
    this.leftShinLen = this.leftFootBone.position.length();

    this.rightThighBone = makeBone('RightThigh', this.hipsBone, 0.098, -0.02, 0);
    this.rightShinBone = makeBone('RightShin', this.rightThighBone, 0, -0.345, 0);
    this.rightFootBone = makeBone('RightFoot', this.rightShinBone, 0, -0.335, 0);
    this.rightThighLen = this.rightShinBone.position.length();
    this.rightShinLen = this.rightFootBone.position.length();

    this.root.updateMatrixWorld(true);
    this.skeleton = new THREE.Skeleton(this.bones);

    // -------------------------------------------------------------------------
    // 2. Athletic Proportioned Human Runner Meshes (Rich Back & 3/4 Silhouette)
    // -------------------------------------------------------------------------
    const bindSkinned = (parts: SkinnedPartSpec[], material: THREE.Material, castShadow = true) => {
      const geo = mergeSkinnedParts(parts);
      const mesh = new THREE.SkinnedMesh(geo, material);
      mesh.castShadow = castShadow;
      mesh.frustumCulled = false;
      this.bodyRig.add(mesh);
      mesh.bind(this.skeleton, new THREE.Matrix4());
      this.skinnedMeshes.push(mesh);
    };

    const torsoWeight = (_x: number, y: number): BoneInfluence => {
      if (y < 0.85) {
        const t = smoothstep01((y - 0.74) / 0.14);
        return makeFixedInfluence(BoneId.Hips, 1 - t, BoneId.Spine, t);
      }
      if (y < 1.03) {
        const t = smoothstep01((y - 0.86) / 0.17);
        return makeFixedInfluence(BoneId.Spine, 1 - t, BoneId.Chest, t);
      }
      if (y < 1.21) {
        return makeFixedInfluence(BoneId.Chest, 1);
      }
      const t = smoothstep01((y - 1.21) / 0.06);
      return makeFixedInfluence(BoneId.Chest, 1 - t, BoneId.Neck, t);
    };

    const makeSleeveParts = (sideSign: -1 | 1): SkinnedPartSpec[] => {
      const armBone = sideSign < 0 ? BoneId.LeftArm : BoneId.RightArm;
      const forearmBone = sideSign < 0 ? BoneId.LeftForearm : BoneId.RightForearm;
      const sx = sideSign * 0.185;
      const ex = sideSign * 0.197;

      // Full athletic rolled track sleeve with muscular upper-arm contour
      const sleeveTube = createOrganicTube(
        [
          { cx: ex, cy: 0.985, cz: 0, rx: 0.047, rz: 0.047 },
          { cx: sideSign * 0.193, cy: 1.045, cz: 0, rx: 0.052, rz: 0.052 },
          { cx: sideSign * 0.189, cy: 1.115, cz: 0, rx: 0.056, rz: 0.056 },
          { cx: sx, cy: 1.185, cz: 0, rx: 0.060, rz: 0.058 },
        ],
        16,
      );

      // Sculpted athletic deltoid cap bridging shoulder socket seamlessly
      const shoulderCap = new THREE.SphereGeometry(0.062, 14, 10);
      shoulderCap.scale(0.98, 1.04, 0.98);
      shoulderCap.translate(sx * 0.96, 1.185, 0);

      return [
        {
          geometry: sleeveTube,
          weightFn: (_x, y) => {
            if (y < 1.035) {
              const elT = smoothstep01((1.035 - y) / 0.050) * 0.48;
              return makeFixedInfluence(armBone, 1 - elT, forearmBone, elT);
            }
            if (y > 1.135) {
              const shT = smoothstep01((y - 1.135) / 0.055) * 0.42;
              return makeFixedInfluence(armBone, 1 - shT, BoneId.Chest, shT);
            }
            return makeFixedInfluence(armBone, 1);
          },
        },
        {
          geometry: shoulderCap,
          weightFn: (x, y) => {
            const xDist = smoothstep01((0.185 - Math.abs(x)) / 0.075);
            const yTop = smoothstep01((y - 1.175) / 0.055) * 0.35;
            const cW = THREE.MathUtils.clamp(xDist * 0.75 + yTop, 0.08, 0.88);
            return makeFixedInfluence(armBone, 1 - cW, BoneId.Chest, cW);
          },
        },
      ];
    };

    const makeLegTubeParts = (sideSign: -1 | 1): SkinnedPartSpec => {
      const thighBone = sideSign < 0 ? BoneId.LeftThigh : BoneId.RightThigh;
      const shinBone = sideSign < 0 ? BoneId.LeftShin : BoneId.RightShin;
      const lx = sideSign * 0.098;
      // Athletic quad -> tapered knee -> sculpted gastrocnemius calf -> ankle cuff
      const tube = createOrganicTube(
        [
          { cx: lx, cy: 0.145, cz: 0.002, rx: 0.041, rz: 0.043 },
          { cx: lx, cy: 0.235, cz: 0.008, rx: 0.054, rz: 0.058 },
          { cx: lx, cy: 0.315, cz: 0.010, rx: 0.060, rz: 0.064 },
          { cx: lx, cy: 0.375, cz: 0.003, rx: 0.055, rz: 0.058 },
          { cx: lx, cy: 0.415, cz: -0.004, rx: 0.054, rz: 0.057 },
          { cx: lx, cy: 0.455, cz: -0.002, rx: 0.058, rz: 0.062 },
          { cx: lx, cy: 0.565, cz: 0.000, rx: 0.072, rz: 0.077 },
          { cx: lx, cy: 0.680, cz: 0.002, rx: 0.080, rz: 0.084 },
          { cx: lx, cy: 0.775, cz: 0.002, rx: 0.082, rz: 0.084 },
        ],
        16,
      );
      return {
        geometry: tube,
        weightFn: (_x, y) => {
          if (y > 0.675) {
            const hipT = smoothstep01((y - 0.675) / 0.105);
            return makeFixedInfluence(thighBone, 1 - hipT * 0.48, BoneId.Hips, hipT * 0.48);
          }
          const kneeT = smoothstep01((0.485 - y) / 0.14);
          return makeFixedInfluence(thighBone, 1 - kneeT, shinBone, kneeT);
        },
      };
    };

    const makeForearmAndHandParts = (sideSign: -1 | 1): SkinnedPartSpec[] => {
      const armBone = sideSign < 0 ? BoneId.LeftArm : BoneId.RightArm;
      const forearmBone = sideSign < 0 ? BoneId.LeftForearm : BoneId.RightForearm;
      const handBone = sideSign < 0 ? BoneId.LeftHand : BoneId.RightHand;
      const ex = sideSign * 0.197;
      const wx = sideSign * 0.201;

      // Muscular human forearm (elbow 0.985 -> wrist 0.790)
      const forearmGeo = createOrganicTube(
        [
          { cx: wx, cy: 0.790, cz: 0, rx: 0.030, rz: 0.028 },
          { cx: wx, cy: 0.855, cz: 0, rx: 0.036, rz: 0.034 },
          { cx: sideSign * 0.199, cy: 0.920, cz: 0, rx: 0.042, rz: 0.040 },
          { cx: ex, cy: 0.985, cz: 0, rx: 0.043, rz: 0.042 },
        ],
        14,
      );

      // Proportional athletic palm (knuckle width & thickness readable from chase cam)
      const palmGeo = createOrganicTube(
        [
          { cx: wx, cy: 0.725, cz: -0.006, rx: 0.021, rz: 0.035 },
          { cx: wx, cy: 0.758, cz: -0.002, rx: 0.022, rz: 0.037 },
          { cx: wx, cy: 0.790, cz: 0.0, rx: 0.020, rz: 0.029 },
        ],
        12,
      );

      // 4 Proportional curled fingers with natural length cascade
      const fingerSpecs: Array<{ dz: number; len: number; r: number; curl: number }> = [
        { dz: -0.025, len: 0.050, r: 0.0092, curl: 0.26 },
        { dz: -0.008, len: 0.055, r: 0.0096, curl: 0.30 },
        { dz: 0.009, len: 0.051, r: 0.0090, curl: 0.34 },
        { dz: 0.024, len: 0.041, r: 0.0080, curl: 0.38 },
      ];

      const fingerParts: SkinnedPartSpec[] = fingerSpecs.map((f) => {
        const fingerGeo = new THREE.CapsuleGeometry(f.r, f.len * 0.62, 4, 8);
        fingerGeo.rotateZ(sideSign * -f.curl);
        fingerGeo.translate(
          wx - sideSign * (f.curl * 0.018),
          0.720 - f.len * 0.42,
          -0.003 + f.dz,
        );
        return {
          geometry: fingerGeo,
          fixedInfluence: makeFixedInfluence(handBone, 1),
        };
      });

      const thumbGeo = new THREE.CapsuleGeometry(0.0105, 0.032, 4, 8);
      thumbGeo.rotateX(0.45);
      thumbGeo.rotateZ(sideSign * -0.48);
      thumbGeo.translate(wx - sideSign * 0.018, 0.756, -0.036);

      const wristWeight = (y: number): BoneInfluence => {
        const handT = smoothstep01((0.825 - y) / 0.070);
        return makeFixedInfluence(forearmBone, 1 - handT, handBone, handT);
      };

      return [
        {
          geometry: forearmGeo,
          weightFn: (_x, y) => {
            if (y > 0.930) {
              const elT = smoothstep01((y - 0.930) / 0.055) * 0.50;
              return makeFixedInfluence(forearmBone, 1 - elT, armBone, elT);
            }
            if (y < 0.825) {
              return wristWeight(y);
            }
            return makeFixedInfluence(forearmBone, 1);
          },
        },
        {
          geometry: palmGeo,
          weightFn: (_x, y) => {
            if (y > 0.755) {
              return wristWeight(y);
            }
            return makeFixedInfluence(handBone, 1);
          },
        },
        ...fingerParts,
        {
          geometry: thumbGeo,
          fixedInfluence: makeFixedInfluence(handBone, 1),
        },
      ];
    };

    // --- Group A: Tailored Athletic Runner Jacket / Tunic (primaryMat) ---
    const jacketTorsoGeo = createOrganicTube(
      [
        { cx: 0, cy: 0.775, cz: 0.002, rx: 0.144, rz: 0.104 },
        { cx: 0, cy: 0.845, cz: 0.004, rx: 0.132, rz: 0.098 },
        { cx: 0, cy: 0.935, cz: 0.004, rx: 0.140, rz: 0.104 },
        { cx: 0, cy: 1.045, cz: -0.006, rx: 0.166, rz: 0.118 },
        { cx: 0, cy: 1.150, cz: -0.006, rx: 0.160, rz: 0.112 },
        { cx: 0, cy: 1.210, cz: 0.0, rx: 0.106, rz: 0.086 },
        { cx: 0, cy: 1.240, cz: 0.002, rx: 0.066, rz: 0.064 },
      ],
      20,
    );

    const chestArmorRibGeo = new THREE.CapsuleGeometry(0.022, 0.15, 4, 8);
    chestArmorRibGeo.rotateZ(Math.PI / 2);
    chestArmorRibGeo.scale(1.0, 0.78, 0.55);
    chestArmorRibGeo.translate(0, 1.08, -0.106);

    bindSkinned(
      [
        { geometry: jacketTorsoGeo, weightFn: (_x, y) => torsoWeight(_x, y) },
        { geometry: chestArmorRibGeo, fixedInfluence: makeFixedInfluence(BoneId.Chest, 1) },
        ...makeSleeveParts(-1),
        ...makeSleeveParts(1),
      ],
      this.primaryMat,
    );

    // --- Group B: Athletic Tapered Runner Joggers, Waistband & Gloves (secondaryMat) ---
    const pelvisGeo = createOrganicTube(
      [
        { cx: 0, cy: 0.702, cz: 0.006, rx: 0.146, rz: 0.106 },
        { cx: 0, cy: 0.765, cz: 0.008, rx: 0.150, rz: 0.108 },
        { cx: 0, cy: 0.810, cz: 0.004, rx: 0.140, rz: 0.100 },
      ],
      18,
    );

    const gloveLGeo = createOrganicTube(
      [
        { cx: -0.201, cy: 0.735, cz: -0.004, rx: 0.024, rz: 0.039 },
        { cx: -0.201, cy: 0.770, cz: -0.001, rx: 0.025, rz: 0.039 },
        { cx: -0.201, cy: 0.796, cz: 0.0, rx: 0.024, rz: 0.033 },
      ],
      12,
    );
    const gloveRGeo = createOrganicTube(
      [
        { cx: 0.201, cy: 0.735, cz: -0.004, rx: 0.024, rz: 0.039 },
        { cx: 0.201, cy: 0.770, cz: -0.001, rx: 0.025, rz: 0.039 },
        { cx: 0.201, cy: 0.796, cz: 0.0, rx: 0.024, rz: 0.033 },
      ],
      12,
    );

    const gloveWeight = (forearmBone: BoneId, handBone: BoneId, y: number): BoneInfluence => {
      const handT = smoothstep01((0.825 - y) / 0.070);
      return makeFixedInfluence(forearmBone, 1 - handT, handBone, handT);
    };

    bindSkinned(
      [
        {
          geometry: pelvisGeo,
          weightFn: (x, y) => {
            // Smooth crotch-to-hip-socket 3-bone blend (eliminates step-edge crotch tearing)
            const spineW = y > 0.775 ? smoothstep01((y - 0.775) / 0.035) * 0.16 : 0;
            const latT = smoothstep01((Math.abs(x) - 0.018) / 0.072);
            const vertT = smoothstep01((0.768 - y) / 0.068);
            const thighW = latT * vertT * 0.48;
            const hipsW = Math.max(0.01, 1 - spineW - thighW);
            const thighBone = x < 0 ? BoneId.LeftThigh : BoneId.RightThigh;
            return makeFixedInfluence(BoneId.Hips, hipsW, thighBone, thighW, BoneId.Spine, spineW);
          },
        },
        makeLegTubeParts(-1),
        makeLegTubeParts(1),
        { geometry: gloveLGeo, weightFn: (_x, y) => gloveWeight(BoneId.LeftForearm, BoneId.LeftHand, y) },
        { geometry: gloveRGeo, weightFn: (_x, y) => gloveWeight(BoneId.RightForearm, BoneId.RightHand, y) },
      ],
      this.secondaryMat,
    );

    // --- Group C: Sculpted Stylized Human Head, Neck, Forearms, Fingers & Ankles (skinMat) ---
    const neckGeo = createOrganicTube(
      [
        { cx: 0, cy: 1.215, cz: 0.002, rx: 0.052, rz: 0.052 },
        { cx: 0, cy: 1.275, cz: 0.002, rx: 0.046, rz: 0.047 },
        { cx: 0, cy: 1.338, cz: -0.004, rx: 0.045, rz: 0.047 },
      ],
      14,
    );

    const kidHeadGeo = createOrganicTube(
      [
        { cx: 0, cy: 1.330, cz: -0.018, rx: 0.046, rz: 0.060 },
        { cx: 0, cy: 1.366, cz: -0.014, rx: 0.078, rz: 0.090 },
        { cx: 0, cy: 1.404, cz: -0.008, rx: 0.098, rz: 0.104 },
        { cx: 0, cy: 1.445, cz: -0.004, rx: 0.106, rz: 0.112 },
        { cx: 0, cy: 1.484, cz: 0.000, rx: 0.108, rz: 0.115 },
        { cx: 0, cy: 1.522, cz: 0.006, rx: 0.102, rz: 0.110 },
        { cx: 0, cy: 1.556, cz: 0.012, rx: 0.082, rz: 0.092 },
        { cx: 0, cy: 1.578, cz: 0.015, rx: 0.042, rz: 0.050 },
      ],
      24,
    );

    const noseBridgeGeo = new THREE.CapsuleGeometry(0.0065, 0.020, 4, 8);
    noseBridgeGeo.rotateX(0.32);
    noseBridgeGeo.translate(0, 1.425, -0.111);

    const noseTipGeo = new THREE.SphereGeometry(0.010, 10, 8);
    noseTipGeo.scale(1.0, 0.78, 0.95);
    noseTipGeo.translate(0, 1.412, -0.116);

    const earLGeo = new THREE.SphereGeometry(0.022, 10, 8);
    earLGeo.scale(0.36, 0.98, 0.68);
    earLGeo.rotateY(0.20);
    earLGeo.translate(-0.107, 1.438, 0.008);

    const earRGeo = new THREE.SphereGeometry(0.022, 10, 8);
    earRGeo.scale(0.36, 0.98, 0.68);
    earRGeo.rotateY(-0.20);
    earRGeo.translate(0.107, 1.438, 0.008);

    const ankleLGeo = new THREE.CylinderGeometry(0.030, 0.028, 0.068, 12);
    ankleLGeo.translate(-0.098, 0.115, 0);

    const ankleRGeo = new THREE.CylinderGeometry(0.030, 0.028, 0.068, 12);
    ankleRGeo.translate(0.098, 0.115, 0);

    const ankleWeight = (shinBone: BoneId, footBone: BoneId, y: number): BoneInfluence => {
      const footT = smoothstep01((0.128 - y) / 0.068);
      return makeFixedInfluence(shinBone, 1 - footT, footBone, footT);
    };

    bindSkinned(
      [
        {
          geometry: neckGeo,
          weightFn: (_x, y) => {
            if (y < 1.240) {
              const chestT = smoothstep01((1.240 - y) / 0.030) * 0.45;
              return makeFixedInfluence(BoneId.Neck, 1 - chestT, BoneId.Chest, chestT);
            }
            const headT = smoothstep01((y - 1.245) / 0.085);
            return makeFixedInfluence(BoneId.Neck, 1 - headT, BoneId.Head, headT);
          },
        },
        { geometry: kidHeadGeo, fixedInfluence: makeFixedInfluence(BoneId.Head, 1) },
        { geometry: noseBridgeGeo, fixedInfluence: makeFixedInfluence(BoneId.Head, 1) },
        { geometry: noseTipGeo, fixedInfluence: makeFixedInfluence(BoneId.Head, 1) },
        { geometry: earLGeo, fixedInfluence: makeFixedInfluence(BoneId.Head, 1) },
        { geometry: earRGeo, fixedInfluence: makeFixedInfluence(BoneId.Head, 1) },
        ...makeForearmAndHandParts(-1),
        ...makeForearmAndHandParts(1),
        {
          geometry: ankleLGeo,
          weightFn: (_x, y) => ankleWeight(BoneId.LeftShin, BoneId.LeftFoot, y),
        },
        {
          geometry: ankleRGeo,
          weightFn: (_x, y) => ankleWeight(BoneId.RightShin, BoneId.RightFoot, y),
        },
      ],
      this.skinMat,
    );

    // --- Group D: Collar, Belt/Hem, Cuffs, Racing Stripes & Contoured Sneaker Uppers (accentMat) ---
    const collarTrimGeo = new THREE.TorusGeometry(0.070, 0.016, 8, 18);
    collarTrimGeo.rotateX(Math.PI / 2 - 0.12);
    collarTrimGeo.translate(0, 1.232, 0.002);

    const jacketBeltGeo = new THREE.CylinderGeometry(0.142, 0.145, 0.036, 18);
    jacketBeltGeo.scale(1.0, 1, 0.74);
    jacketBeltGeo.translate(0, 0.782, 0.003);

    const backYokeGeo = createCurvedTube(
      [
        [-0.155, 1.155, 0.068],
        [-0.08, 1.168, 0.104],
        [0, 1.170, 0.110],
        [0.08, 1.168, 0.104],
        [0.155, 1.155, 0.068],
      ],
      0.012,
      12,
      6,
    );

    const makeLegStripe = (sideSign: -1 | 1): SkinnedPartSpec => {
      const thighBone = sideSign < 0 ? BoneId.LeftThigh : BoneId.RightThigh;
      const shinBone = sideSign < 0 ? BoneId.LeftShin : BoneId.RightShin;
      const stripeGeo = createCurvedTube(
        [
          [sideSign * 0.172, 0.74, 0.004],
          [sideSign * 0.170, 0.56, 0.004],
          [sideSign * 0.152, 0.415, 0.002],
          [sideSign * 0.155, 0.28, 0.008],
          [sideSign * 0.138, 0.15, 0.004],
        ],
        0.0085,
        16,
        6,
      );
      return {
        geometry: stripeGeo,
        weightFn: (_x, y) => {
          if (y > 0.675) {
            const hipT = smoothstep01((y - 0.675) / 0.105);
            return makeFixedInfluence(thighBone, 1 - hipT * 0.48, BoneId.Hips, hipT * 0.48);
          }
          const kneeT = smoothstep01((0.485 - y) / 0.14);
          return makeFixedInfluence(thighBone, 1 - kneeT, shinBone, kneeT);
        },
      };
    };

    const cuffLGeo = new THREE.CylinderGeometry(0.048, 0.048, 0.026, 14);
    cuffLGeo.translate(-0.197, 0.985, 0);
    const cuffRGeo = new THREE.CylinderGeometry(0.048, 0.048, 0.026, 14);
    cuffRGeo.translate(0.197, 0.985, 0);

    const wristLGeo = new THREE.CylinderGeometry(0.033, 0.033, 0.036, 14);
    wristLGeo.translate(-0.201, 0.808, 0);
    const wristRGeo = new THREE.CylinderGeometry(0.033, 0.033, 0.036, 14);
    wristRGeo.translate(0.201, 0.808, 0);

    const joggerCuffLGeo = new THREE.CylinderGeometry(0.043, 0.039, 0.030, 14);
    joggerCuffLGeo.translate(-0.098, 0.145, 0.002);
    const joggerCuffRGeo = new THREE.CylinderGeometry(0.043, 0.039, 0.030, 14);
    joggerCuffRGeo.translate(0.098, 0.145, 0.002);

    const makeShoeUpper = (lx: number): THREE.BufferGeometry =>
      createOrganicTube(
        [
          { cx: lx, cy: 0.028, cz: -0.042, rx: 0.047, rz: 0.114 },
          { cx: lx, cy: 0.056, cz: -0.034, rx: 0.045, rz: 0.104 },
          { cx: lx, cy: 0.082, cz: -0.010, rx: 0.040, rz: 0.068 },
        ],
        14,
      );

    const makeShoeCollar = (lx: number): THREE.BufferGeometry => {
      const collar = new THREE.TorusGeometry(0.040, 0.014, 8, 14);
      collar.rotateX(Math.PI / 2 + 0.12);
      collar.translate(lx, 0.088, 0.002);
      return collar;
    };

    const elbowCuffWeight = (armBone: BoneId, forearmBone: BoneId, y: number): BoneInfluence => {
      const elT = smoothstep01((1.020 - y) / 0.070) * 0.56 + 0.20;
      return makeFixedInfluence(armBone, 1 - elT, forearmBone, elT);
    };

    bindSkinned(
      [
        { geometry: collarTrimGeo, weightFn: (_x, y) => torsoWeight(_x, y) },
        { geometry: jacketBeltGeo, weightFn: (_x, y) => torsoWeight(_x, y) },
        { geometry: backYokeGeo, fixedInfluence: makeFixedInfluence(BoneId.Chest, 1) },
        makeLegStripe(-1),
        makeLegStripe(1),
        { geometry: cuffLGeo, weightFn: (_x, y) => elbowCuffWeight(BoneId.LeftArm, BoneId.LeftForearm, y) },
        { geometry: cuffRGeo, weightFn: (_x, y) => elbowCuffWeight(BoneId.RightArm, BoneId.RightForearm, y) },
        { geometry: wristLGeo, weightFn: (_x, y) => gloveWeight(BoneId.LeftForearm, BoneId.LeftHand, y) },
        { geometry: wristRGeo, weightFn: (_x, y) => gloveWeight(BoneId.RightForearm, BoneId.RightHand, y) },
        { geometry: joggerCuffLGeo, weightFn: (_x, y) => ankleWeight(BoneId.LeftShin, BoneId.LeftFoot, y) },
        { geometry: joggerCuffRGeo, weightFn: (_x, y) => ankleWeight(BoneId.RightShin, BoneId.RightFoot, y) },
        { geometry: makeShoeUpper(-0.098), weightFn: (_x, y) => ankleWeight(BoneId.LeftShin, BoneId.LeftFoot, y) },
        { geometry: makeShoeUpper(0.098), weightFn: (_x, y) => ankleWeight(BoneId.RightShin, BoneId.RightFoot, y) },
        { geometry: makeShoeCollar(-0.098), weightFn: (_x, y) => ankleWeight(BoneId.LeftShin, BoneId.LeftFoot, y) },
        { geometry: makeShoeCollar(0.098), weightFn: (_x, y) => ankleWeight(BoneId.RightShin, BoneId.RightFoot, y) },
      ],
      this.accentMat,
    );

    // --- Group E: Contoured Sneaker Midsoles, Toe Bumpers & Sleek Straps (soleMat) ---
    const makeShoeSole = (lx: number): THREE.BufferGeometry =>
      createOrganicTube(
        [
          { cx: lx, cy: 0.002, cz: -0.044, rx: 0.052, rz: 0.126 },
          { cx: lx, cy: 0.020, cz: -0.042, rx: 0.055, rz: 0.130 },
          { cx: lx, cy: 0.034, cz: -0.036, rx: 0.050, rz: 0.118 },
        ],
        16,
      );

    const makeShoeStrap = (lx: number, zOff: number, yOff: number): THREE.BufferGeometry => {
      const strap = new THREE.CapsuleGeometry(0.007, 0.038, 4, 8);
      strap.rotateZ(Math.PI / 2);
      strap.translate(lx, yOff, zOff);
      return strap;
    };

    bindSkinned(
      [
        { geometry: makeShoeSole(-0.098), fixedInfluence: makeFixedInfluence(BoneId.LeftFoot, 1) },
        { geometry: makeShoeSole(0.098), fixedInfluence: makeFixedInfluence(BoneId.RightFoot, 1) },
        { geometry: makeShoeStrap(-0.098, -0.072, 0.068), fixedInfluence: makeFixedInfluence(BoneId.LeftFoot, 1) },
        { geometry: makeShoeStrap(-0.098, -0.048, 0.078), fixedInfluence: makeFixedInfluence(BoneId.LeftFoot, 1) },
        { geometry: makeShoeStrap(0.098, -0.072, 0.068), fixedInfluence: makeFixedInfluence(BoneId.RightFoot, 1) },
        { geometry: makeShoeStrap(0.098, -0.048, 0.078), fixedInfluence: makeFixedInfluence(BoneId.RightFoot, 1) },
      ],
      this.soleMat,
    );

    // --- Group G: Glowing Trim (Zipper Piping, Back Chevron, Buckle, Sneaker Heel Air-Pods) ---
    const zipLineGeo = new THREE.CapsuleGeometry(0.006, 0.34, 4, 8);
    zipLineGeo.rotateX(-0.02);
    zipLineGeo.translate(0, 1.015, -0.114);

    const backChevronL = new THREE.CapsuleGeometry(0.007, 0.12, 4, 6);
    backChevronL.rotateZ(-0.62);
    backChevronL.translate(-0.042, 1.03, 0.114);

    const backChevronR = new THREE.CapsuleGeometry(0.007, 0.12, 4, 6);
    backChevronR.rotateZ(0.62);
    backChevronR.translate(0.042, 1.03, 0.114);

    const beltBuckleGeo = new THREE.OctahedronGeometry(0.022, 0);
    beltBuckleGeo.scale(1.2, 0.9, 0.45);
    beltBuckleGeo.translate(0, 0.782, -0.108);

    const heelPodLGeo = new THREE.CapsuleGeometry(0.011, 0.044, 4, 8);
    heelPodLGeo.rotateZ(Math.PI / 2);
    heelPodLGeo.translate(-0.098, 0.026, 0.072);

    const heelPodRGeo = new THREE.CapsuleGeometry(0.011, 0.044, 4, 8);
    heelPodRGeo.rotateZ(Math.PI / 2);
    heelPodRGeo.translate(0.098, 0.026, 0.072);

    bindSkinned(
      [
        {
          geometry: zipLineGeo,
          weightFn: (_x, y) => {
            const t = smoothstep01((y - 0.87) / 0.16);
            return makeFixedInfluence(BoneId.Spine, 1 - t, BoneId.Chest, t);
          },
        },
        { geometry: backChevronL, fixedInfluence: makeFixedInfluence(BoneId.Chest, 1) },
        { geometry: backChevronR, fixedInfluence: makeFixedInfluence(BoneId.Chest, 1) },
        { geometry: beltBuckleGeo, weightFn: (_x, y) => torsoWeight(_x, y) },
        { geometry: heelPodLGeo, fixedInfluence: makeFixedInfluence(BoneId.LeftFoot, 1) },
        { geometry: heelPodRGeo, fixedInfluence: makeFixedInfluence(BoneId.RightFoot, 1) },
      ],
      this.visorMat,
      false,
    );

    // Run full-rig bone-weight normalization pass over all bound SkinnedMeshes
    this.normalizeAllSkinWeights();

    // -------------------------------------------------------------------------
    // 3. Expressive Stylized Kid Face & Sculpted Tapered Hair (on Head bone y=1.32)
    // -------------------------------------------------------------------------
    this.headBone.add(this.facialGroup);
    this.buildKidFace();

    this.headBone.add(this.hairGroup);
    this.buildStylizedHair();

    // -------------------------------------------------------------------------
    // 4. Bone-Attached Archetype Outfit, Armor & Cosmetic Mounts
    // -------------------------------------------------------------------------
    this.chestBone.add(this.chestAccessoryGroup);
    this.headBone.add(this.headAccessoryGroup);
    this.hipsBone.add(this.hipsAccessoryGroup);
    this.leftShinBone.add(this.leftShinAccessoryGroup);
    this.rightShinBone.add(this.rightShinAccessoryGroup);
    this.chestBone.add(this.chestCosmeticGroup);
    this.headBone.add(this.headCosmeticGroup);
    this.rebuildAccessory(initialSkin);
    this.rebuildCosmetic(initialCosmeticId);

    // -------------------------------------------------------------------------
    // 5. Skeletal AnimationMixer + Seamless Periodic Wrapping + IK Blending
    // -------------------------------------------------------------------------
    this.mixer = new THREE.AnimationMixer(this.bodyRig);
    this.idleAction = this.mixer.clipAction(this.createIdleClip());
    this.runAction = this.mixer.clipAction(this.createRunClip());
    this.jumpAction = this.mixer.clipAction(this.createJumpClip());
    this.slideAction = this.mixer.clipAction(this.createSlideClip());

    this.idleAction.setLoop(THREE.LoopRepeat, Infinity);
    this.runAction.setLoop(THREE.LoopRepeat, Infinity);

    this.jumpAction.setLoop(THREE.LoopOnce, 1);
    this.jumpAction.clampWhenFinished = true;

    this.slideAction.setLoop(THREE.LoopOnce, 1);
    this.slideAction.clampWhenFinished = true;

    this.idleAction.play().setEffectiveWeight(0);
    this.runAction.play().setEffectiveWeight(1);
    this.jumpAction.play().setEffectiveWeight(0);
    this.slideAction.play().setEffectiveWeight(0);

    // Advance mixer once with non-zero delta so periodic run clip initializes loop state,
    // then enforce symmetric WrapAroundEnding for seamless cyclic interpolation.
    this.runAction.setEffectiveTimeScale(1);
    this.mixer.update(0.001);
    this.runAction.setEffectiveTimeScale(0);
    this.runAction.time = 0;
    const runInternals = this.runAction as unknown as {
      _interpolantSettings?: { endingStart: number; endingEnd: number };
    };
    if (runInternals._interpolantSettings) {
      runInternals._interpolantSettings.endingStart = THREE.WrapAroundEnding;
      runInternals._interpolantSettings.endingEnd = THREE.WrapAroundEnding;
    }

    // -------------------------------------------------------------------------
    // 6. Power-Up Aura Visuals
    // -------------------------------------------------------------------------
    const bubbleGeo = new THREE.IcosahedronGeometry(0.98, 1);
    const bubbleMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.34,
      wireframe: true,
      depthWrite: false,
    });
    this.shieldBubble = new THREE.Mesh(bubbleGeo, bubbleMat);
    this.shieldBubble.position.y = 0.86;
    this.shieldBubble.visible = false;
    this.root.add(this.shieldBubble);

    const innerShellGeo = new THREE.IcosahedronGeometry(0.91, 1);
    const innerShellMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.shieldInnerShell = new THREE.Mesh(innerShellGeo, innerShellMat);
    this.shieldInnerShell.position.y = 0.86;
    this.shieldInnerShell.visible = false;
    this.root.add(this.shieldInnerShell);

    const magRingGeo = new THREE.TorusGeometry(0.80, 0.036, 6, 16);
    const magRingMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.magnetRingA = new THREE.Mesh(magRingGeo, magRingMat);
    this.magnetRingA.rotation.set(Math.PI / 2.4, 0, 0.35);
    this.magnetRingB = new THREE.Mesh(magRingGeo, magRingMat);
    this.magnetRingB.rotation.set(-Math.PI / 2.4, 0, -0.35);
    this.magnetAuraGroup.add(this.magnetRingA, this.magnetRingB);
    this.magnetAuraGroup.position.y = 0.84;
    this.magnetAuraGroup.visible = false;
    this.root.add(this.magnetAuraGroup);

    const multRingGeo = new THREE.TorusGeometry(0.72, 0.038, 6, 12);
    const multMat = new THREE.MeshBasicMaterial({
      color: 0xfb7185,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const multRing = new THREE.Mesh(multRingGeo, multMat);
    multRing.rotation.x = Math.PI / 2;
    this.multiplierAuraGroup.add(multRing);

    const starGeo = new THREE.OctahedronGeometry(0.12, 0);
    const starMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const star = new THREE.Mesh(starGeo, starMat);
      star.position.set(Math.cos(angle) * 0.74, 0, Math.sin(angle) * 0.74);
      this.multiplierAuraGroup.add(star);
    }
    this.multiplierAuraGroup.position.y = 0.86;
    this.multiplierAuraGroup.visible = false;
    this.root.add(this.multiplierAuraGroup);

    const chronosRingGeoA = new THREE.TorusGeometry(0.88, 0.03, 6, 20);
    const chronosMatA = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.chronosRingA = new THREE.Mesh(chronosRingGeoA, chronosMatA);
    this.chronosRingA.rotation.set(Math.PI / 2.2, 0.25, 0);

    const chronosRingGeoB = new THREE.TorusGeometry(0.76, 0.025, 6, 20);
    const chronosMatB = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.chronosRingB = new THREE.Mesh(chronosRingGeoB, chronosMatB);
    this.chronosRingB.rotation.set(-Math.PI / 2.5, -0.3, 0.4);

    this.chronosAuraGroup.add(this.chronosRingA, this.chronosRingB);
    this.chronosAuraGroup.position.y = 0.86;
    this.chronosAuraGroup.visible = false;
    this.root.add(this.chronosAuraGroup);

    this.debugFootIkGroup.name = 'FootIKDebugGroup';
    this.debugFootIkGroup.visible = false;
    this.syncShadowCasterHierarchy();
  }

  public syncShadowCasterHierarchy(): void {
    this.bodyRig.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.layers.enable(RUNNER_SHADOW_LAYER);
      }
    });
  }

  private buildKidFace(): void {
    const scleraMat = new THREE.MeshStandardMaterial({
      color: 0xfafafa,
      roughness: 0.20,
      metalness: 0.0,
    });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x090d16 });
    const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const lashMat = new THREE.MeshStandardMaterial({ color: 0x16110e, roughness: 0.55 });
    const lipMat = new THREE.MeshStandardMaterial({
      color: 0xa6534a,
      roughness: 0.46,
    });

    const scleraGeo = new THREE.SphereGeometry(0.020, 14, 12);
    const irisGeo = new THREE.SphereGeometry(0.0138, 12, 10);
    const pupilGeo = new THREE.SphereGeometry(0.0074, 10, 8);
    const glintGeo = new THREE.SphereGeometry(0.0036, 8, 6);
    const lashGeo = new THREE.CapsuleGeometry(0.0022, 0.026, 4, 8);
    const browGeo = new THREE.CapsuleGeometry(0.0038, 0.024, 4, 8);

    for (const side of [-1, 1]) {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(side * 0.039, 0.125, -0.104);
      eyeGroup.rotation.y = side * -0.22;

      const sclera = new THREE.Mesh(scleraGeo, scleraMat);
      sclera.scale.set(1.08, 0.78, 0.36);
      eyeGroup.add(sclera);

      const iris = new THREE.Mesh(irisGeo, this.irisMat);
      iris.position.set(-side * 0.001, -0.0005, -0.0045);
      iris.scale.set(1.0, 1.02, 0.36);
      eyeGroup.add(iris);

      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(-side * 0.001, -0.0005, -0.0074);
      pupil.scale.set(1, 1, 0.34);
      eyeGroup.add(pupil);

      const glintMain = new THREE.Mesh(glintGeo, glintMat);
      glintMain.position.set(0.0042, 0.0042, -0.0094);
      eyeGroup.add(glintMain);

      const glintSub = new THREE.Mesh(glintGeo, glintMat);
      glintSub.scale.setScalar(0.5);
      glintSub.position.set(-0.0038, -0.0038, -0.0092);
      eyeGroup.add(glintSub);

      const upperLash = new THREE.Mesh(lashGeo, lashMat);
      upperLash.rotation.z = Math.PI / 2 + side * -0.08;
      upperLash.position.set(0, 0.013, -0.0035);
      eyeGroup.add(upperLash);

      this.facialGroup.add(eyeGroup);

      const brow = new THREE.Mesh(browGeo, this.hairMat);
      brow.position.set(side * 0.040, 0.151, -0.108);
      brow.rotation.z = Math.PI / 2 + side * -0.16;
      brow.rotation.y = side * -0.22;
      this.facialGroup.add(brow);
    }

    const smileCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.019, 0.058, -0.095),
      new THREE.Vector3(-0.007, 0.052, -0.101),
      new THREE.Vector3(0.008, 0.053, -0.101),
      new THREE.Vector3(0.021, 0.060, -0.094),
    ]);
    const smileGeo = new THREE.TubeGeometry(smileCurve, 10, 0.0026, 6, false);
    const smile = new THREE.Mesh(smileGeo, lipMat);
    this.facialGroup.add(smile);
  }

  private buildStylizedHair(): void {
    // Sleek layered cranium cap + tapered nape + swept geometric hair tufts (Head local y=0 -> world 1.32)
    const hairCrownGeo = new THREE.SphereGeometry(0.114, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.56);
    hairCrownGeo.scale(0.99, 0.96, 1.06);
    hairCrownGeo.rotateX(0.42);
    const hairCrown = new THREE.Mesh(hairCrownGeo, this.hairMat);
    hairCrown.position.set(0, 0.168, 0.016);
    this.hairGroup.add(hairCrown);

    const hairBackGeo = createOrganicTube(
      [
        { cx: 0, cy: 0.045, cz: 0.064, rx: 0.066, rz: 0.038 },
        { cx: 0, cy: 0.095, cz: 0.075, rx: 0.092, rz: 0.048 },
        { cx: 0, cy: 0.152, cz: 0.070, rx: 0.102, rz: 0.052 },
      ],
      16,
    );
    this.hairGroup.add(new THREE.Mesh(hairBackGeo, this.hairMat));

    for (const side of [-1, 1]) {
      const sideburn = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.040, 4, 6), this.hairMat);
      sideburn.position.set(side * 0.101, 0.145, -0.010);
      sideburn.rotation.z = side * 0.12;
      this.hairGroup.add(sideburn);
    }

    // Swept stylized spikes / front bangs (tapered elliptical cones, zero bulky hoses)
    const tufts: Array<{ pos: [number, number, number]; rot: [number, number, number]; r: number; len: number; sx: number }> = [
      { pos: [-0.028, 0.258, -0.048], rot: [-1.18, -0.18, 0.24], r: 0.036, len: 0.145, sx: 1.25 },
      { pos: [0.032, 0.262, -0.040], rot: [-1.12, 0.22, -0.28], r: 0.034, len: 0.140, sx: 1.20 },
      { pos: [0.002, 0.275, 0.008], rot: [-0.72, 0.06, -0.10], r: 0.040, len: 0.150, sx: 1.30 },
      { pos: [-0.064, 0.232, -0.025], rot: [-0.95, -0.35, 0.52], r: 0.028, len: 0.118, sx: 1.15 },
      { pos: [0.066, 0.232, -0.022], rot: [-0.92, 0.38, -0.50], r: 0.028, len: 0.115, sx: 1.15 },
      { pos: [0.0, 0.242, 0.068], rot: [0.95, 0.0, 0.08], r: 0.036, len: 0.130, sx: 1.35 },
      { pos: [-0.045, 0.228, 0.065], rot: [0.92, -0.24, 0.25], r: 0.030, len: 0.115, sx: 1.2 },
      { pos: [0.045, 0.228, 0.065], rot: [0.92, 0.24, -0.25], r: 0.030, len: 0.115, sx: 1.2 },
    ];
    for (const tSpec of tufts) {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(tSpec.r, tSpec.len, 6), this.hairMat);
      tuft.position.set(...tSpec.pos);
      tuft.rotation.set(...tSpec.rot);
      tuft.scale.set(tSpec.sx, 1, 0.72);
      this.hairGroup.add(tuft);
    }
  }

  private createIdleClip(): THREE.AnimationClip {
    const t = [0, 0.65, 1.3, 1.95, 2.6];
    return new THREE.AnimationClip('idle', 2.6, [
      buildVecTrack('Hips.position', t, [
        [0, 0.78, 0],
        [-0.008, 0.762, 0.005],
        [0, 0.784, 0],
        [0.008, 0.764, -0.004],
        [0, 0.78, 0],
      ]),
      buildQuatTrack('Hips.quaternion', t, [
        [0, 0.08, 0],
        [0.02, 0.04, -0.02],
        [0, 0.08, 0],
        [-0.01, 0.12, 0.02],
        [0, 0.08, 0],
      ]),
      buildQuatTrack('Spine.quaternion', t, [
        [-0.04, -0.04, 0],
        [-0.07, -0.01, 0.015],
        [-0.03, -0.04, 0],
        [-0.06, -0.07, -0.015],
        [-0.04, -0.04, 0],
      ]),
      buildQuatTrack('Chest.quaternion', t, [
        [-0.03, -0.04, 0],
        [-0.06, 0.02, 0],
        [-0.01, -0.04, 0],
        [-0.05, -0.08, 0],
        [-0.03, -0.04, 0],
      ]),
      buildQuatTrack('Neck.quaternion', t, [
        [0.03, 0, 0],
        [0.04, 0.03, 0],
        [0.02, 0, 0],
        [0.04, -0.03, 0],
        [0.03, 0, 0],
      ]),
      buildQuatTrack('Head.quaternion', t, [
        [0.04, -0.06, 0],
        [0.08, 0.06, 0.025],
        [0.03, -0.03, 0],
        [0.06, -0.12, -0.025],
        [0.04, -0.06, 0],
      ]),
      buildQuatTrack('LeftArm.quaternion', t, [
        [0.08, 0, -0.22],
        [0.24, 0.08, -0.28],
        [0.04, 0, -0.20],
        [-0.12, -0.06, -0.24],
        [0.08, 0, -0.22],
      ]),
      buildQuatTrack('LeftForearm.quaternion', t, [
        [0.44, 0, 0],
        [0.72, 0, 0],
        [0.36, 0, 0],
        [0.58, 0, 0],
        [0.44, 0, 0],
      ]),
      buildQuatTrack('LeftHand.quaternion', t, [
        [-0.08, 0.06, -0.10],
        [0.18, 0.14, -0.06],
        [-0.12, 0.02, -0.12],
        [0.10, -0.08, -0.04],
        [-0.08, 0.06, -0.10],
      ]),
      buildQuatTrack('RightArm.quaternion', t, [
        [-0.06, 0, 0.22],
        [-0.16, 0.06, 0.25],
        [0.04, 0, 0.21],
        [0.22, -0.08, 0.28],
        [-0.06, 0, 0.22],
      ]),
      buildQuatTrack('RightForearm.quaternion', t, [
        [0.50, 0, 0],
        [0.40, 0, 0],
        [0.64, 0, 0],
        [0.82, 0, 0],
        [0.50, 0, 0],
      ]),
      buildQuatTrack('RightHand.quaternion', t, [
        [0.08, -0.06, 0.10],
        [-0.14, -0.12, 0.08],
        [0.12, -0.02, 0.12],
        [0.22, 0.10, 0.06],
        [0.08, -0.06, 0.10],
      ]),
      buildQuatTrack('LeftThigh.quaternion', t, [
        [0.10, 0, -0.05],
        [0.18, 0, -0.06],
        [0.08, 0, -0.04],
        [0.12, 0, -0.05],
        [0.10, 0, -0.05],
      ]),
      buildQuatTrack('LeftShin.quaternion', t, [
        [-0.16, 0, 0],
        [-0.28, 0, 0],
        [-0.14, 0, 0],
        [-0.22, 0, 0],
        [-0.16, 0, 0],
      ]),
      buildQuatTrack('LeftFoot.quaternion', t, [
        [0.06, 0, 0],
        [0.12, 0, 0],
        [0.05, 0, 0],
        [0.09, 0, 0],
        [0.06, 0, 0],
      ]),
      buildQuatTrack('RightThigh.quaternion', t, [
        [-0.06, 0, 0.05],
        [-0.02, 0, 0.06],
        [-0.07, 0, 0.04],
        [0.02, 0, 0.05],
        [-0.06, 0, 0.05],
      ]),
      buildQuatTrack('RightShin.quaternion', t, [
        [-0.08, 0, 0],
        [-0.14, 0, 0],
        [-0.08, 0, 0],
        [-0.18, 0, 0],
        [-0.08, 0, 0],
      ]),
      buildQuatTrack('RightFoot.quaternion', t, [
        [0.08, 0, 0],
        [0.11, 0, 0],
        [0.07, 0, 0],
        [0.12, 0, 0],
        [0.08, 0, 0],
      ]),
    ]);
  }

  private createRunClip(): THREE.AnimationClip {
    // 24-sample exact periodic harmonic sprint cycle:
    // Left and Right limbs are evaluated at exact PI phase offset (theta vs theta + PI),
    // guaranteeing 100% left-right symmetry, seamless loop wrap (u=0 === u=1), and zero sharp corners.
    const samples = 24;
    const t: number[] = [];
    const hipsPos: Array<[number, number, number]> = [];
    const hipsRot: Array<[number, number, number]> = [];
    const spineRot: Array<[number, number, number]> = [];
    const chestRot: Array<[number, number, number]> = [];
    const neckRot: Array<[number, number, number]> = [];
    const headRot: Array<[number, number, number]> = [];

    const lThighRot: Array<[number, number, number]> = [];
    const lShinRot: Array<[number, number, number]> = [];
    const lFootRot: Array<[number, number, number]> = [];
    const rThighRot: Array<[number, number, number]> = [];
    const rShinRot: Array<[number, number, number]> = [];
    const rFootRot: Array<[number, number, number]> = [];

    const lArmRot: Array<[number, number, number]> = [];
    const lForearmRot: Array<[number, number, number]> = [];
    const lHandRot: Array<[number, number, number]> = [];
    const rArmRot: Array<[number, number, number]> = [];
    const rForearmRot: Array<[number, number, number]> = [];
    const rHandRot: Array<[number, number, number]> = [];

    const evalThighX = (th: number) =>
      0.16 + 0.86 * Math.sin(th) - 0.04 * Math.cos(th) + 0.05 * Math.sin(2 * th);
    const evalShinX = (th: number) =>
      -0.88 - 0.46 * Math.cos(th) + 0.18 * Math.sin(th) + 0.06 * Math.cos(2 * th) + 0.14 * Math.sin(2 * th);
    const evalFootX = (th: number) =>
      -0.04 - 0.14 * Math.cos(th) + 0.10 * Math.sin(th);
    const evalArmX = (th: number) =>
      0.04 - 1.02 * Math.sin(th) - 0.06 * Math.sin(2 * th);
    const evalForearmX = (th: number) =>
      1.18 - 0.40 * Math.sin(th);
    const evalHandX = (th: number) =>
      -0.18 * Math.sin(th);

    for (let i = 0; i <= samples; i++) {
      const u = i / samples;
      t.push(u * this.runClipDuration);
      const th = u * Math.PI * 2;
      const thOpp = th + Math.PI;
      const sinTh = Math.sin(th);
      const cosTh = Math.cos(th);
      const cos2Th = Math.cos(2 * th);

      // Pelvis dips gently during mid-stance (u=0 & u=0.5, cos2Th=+1) and floats at flight apex (u=0.25 & u=0.75)
      hipsPos.push([0.015 * cosTh, 0.778 - 0.028 * cos2Th, 0.002 * cos2Th]);
      hipsRot.push([-0.06, 0.14 * sinTh, 0.032 * cosTh]);
      spineRot.push([-0.15, -0.11 * sinTh, -0.018 * cosTh]);
      chestRot.push([-0.11, -0.17 * sinTh, 0]);
      neckRot.push([0.11, 0.10 * sinTh, 0]);
      headRot.push([0.14, 0.16 * sinTh, 0]);

      lThighRot.push([evalThighX(th), 0, -0.028]);
      lShinRot.push([evalShinX(th), 0, 0]);
      lFootRot.push([evalFootX(th), 0, 0]);

      rThighRot.push([evalThighX(thOpp), 0, 0.028]);
      rShinRot.push([evalShinX(thOpp), 0, 0]);
      rFootRot.push([evalFootX(thOpp), 0, 0]);

      lArmRot.push([evalArmX(th), 0.12 * -sinTh, -0.18 - 0.04 * sinTh]);
      lForearmRot.push([evalForearmX(th), 0, 0]);
      lHandRot.push([evalHandX(th), -0.14 * sinTh, -0.06]);

      rArmRot.push([evalArmX(thOpp), -0.12 * -sinTh, 0.18 + 0.04 * -sinTh]);
      rForearmRot.push([evalForearmX(thOpp), 0, 0]);
      rHandRot.push([evalHandX(thOpp), 0.14 * sinTh, 0.06]);
    }

    const hipsTrack = new THREE.VectorKeyframeTrack(
      'Hips.position',
      t,
      hipsPos.flatMap((v) => v),
    );
    hipsTrack.setInterpolation(THREE.InterpolateLinear);

    return new THREE.AnimationClip('run', this.runClipDuration, [
      hipsTrack,
      buildQuatTrack('Hips.quaternion', t, hipsRot),
      buildQuatTrack('Spine.quaternion', t, spineRot),
      buildQuatTrack('Chest.quaternion', t, chestRot),
      buildQuatTrack('Neck.quaternion', t, neckRot),
      buildQuatTrack('Head.quaternion', t, headRot),
      buildQuatTrack('LeftThigh.quaternion', t, lThighRot),
      buildQuatTrack('LeftShin.quaternion', t, lShinRot),
      buildQuatTrack('LeftFoot.quaternion', t, lFootRot),
      buildQuatTrack('RightThigh.quaternion', t, rThighRot),
      buildQuatTrack('RightShin.quaternion', t, rShinRot),
      buildQuatTrack('RightFoot.quaternion', t, rFootRot),
      buildQuatTrack('LeftArm.quaternion', t, lArmRot),
      buildQuatTrack('LeftForearm.quaternion', t, lForearmRot),
      buildQuatTrack('LeftHand.quaternion', t, lHandRot),
      buildQuatTrack('RightArm.quaternion', t, rArmRot),
      buildQuatTrack('RightForearm.quaternion', t, rForearmRot),
      buildQuatTrack('RightHand.quaternion', t, rHandRot),
    ]);
  }

  private createJumpClip(): THREE.AnimationClip {
    const t = [0, 0.16, 0.42, 0.65];
    return new THREE.AnimationClip('jump', 0.65, [
      buildVecTrack('Hips.position', t, [
        [0, 0.78, 0],
        [0, 0.83, 0],
        [0, 0.81, 0],
        [0, 0.77, 0],
      ]),
      buildQuatTrack('Hips.quaternion', t, [
        [-0.08, -0.05, 0],
        [-0.07, -0.10, 0],
        [-0.05, -0.07, 0],
        [-0.07, -0.03, 0],
      ]),
      buildQuatTrack('Spine.quaternion', t, [
        [-0.14, 0.04, 0],
        [-0.08, -0.05, 0],
        [-0.04, -0.03, 0],
        [-0.12, 0.0, 0],
      ]),
      buildQuatTrack('Chest.quaternion', t, [
        [-0.10, 0.05, 0],
        [0.02, -0.08, 0],
        [0.03, -0.06, 0],
        [-0.08, 0.0, 0],
      ]),
      buildQuatTrack('Neck.quaternion', t, [
        [0.10, 0, 0],
        [0.04, 0.04, 0],
        [0.02, 0.03, 0],
        [0.09, 0, 0],
      ]),
      buildQuatTrack('Head.quaternion', t, [
        [0.12, -0.03, 0],
        [0.05, 0.06, 0],
        [0.02, 0.05, 0],
        [0.10, 0, 0],
      ]),
      buildQuatTrack('LeftThigh.quaternion', t, [
        [0.78, 0, -0.03],
        [1.06, 0, -0.04],
        [0.82, 0, -0.03],
        [0.40, 0, -0.03],
      ]),
      buildQuatTrack('LeftShin.quaternion', t, [
        [-1.08, 0, 0],
        [-1.32, 0, 0],
        [-1.06, 0, 0],
        [-0.56, 0, 0],
      ]),
      buildQuatTrack('LeftFoot.quaternion', t, [
        [0.14, 0, 0],
        [0.20, 0, 0],
        [0.14, 0, 0],
        [0.10, 0, 0],
      ]),
      buildQuatTrack('RightThigh.quaternion', t, [
        [-0.44, 0, 0.03],
        [-0.38, 0, 0.04],
        [-0.16, 0, 0.03],
        [0.18, 0, 0.03],
      ]),
      buildQuatTrack('RightShin.quaternion', t, [
        [-0.78, 0, 0],
        [-1.02, 0, 0],
        [-0.82, 0, 0],
        [-0.42, 0, 0],
      ]),
      buildQuatTrack('RightFoot.quaternion', t, [
        [-0.24, 0, 0],
        [-0.20, 0, 0],
        [-0.10, 0, 0],
        [0.06, 0, 0],
      ]),
      buildQuatTrack('LeftArm.quaternion', t, [
        [-0.48, 0, -0.26],
        [-0.84, -0.08, -0.40],
        [-0.56, -0.06, -0.32],
        [-0.20, 0, -0.22],
      ]),
      buildQuatTrack('LeftForearm.quaternion', t, [
        [0.88, 0, 0],
        [0.64, 0, 0],
        [0.78, 0, 0],
        [0.72, 0, 0],
      ]),
      buildQuatTrack('LeftHand.quaternion', t, [
        [-0.16, -0.08, -0.14],
        [-0.24, -0.12, -0.20],
        [-0.18, -0.10, -0.16],
        [0.08, 0, -0.08],
      ]),
      buildQuatTrack('RightArm.quaternion', t, [
        [1.04, 0, 0.22],
        [1.38, -0.10, 0.32],
        [1.12, -0.08, 0.26],
        [0.58, 0, 0.22],
      ]),
      buildQuatTrack('RightForearm.quaternion', t, [
        [1.02, 0, 0],
        [0.74, 0, 0],
        [0.92, 0, 0],
        [0.82, 0, 0],
      ]),
      buildQuatTrack('RightHand.quaternion', t, [
        [0.18, 0.08, 0.14],
        [0.26, 0.14, 0.18],
        [0.20, 0.10, 0.14],
        [0.06, 0, 0.08],
      ]),
    ]);
  }

  private createSlideClip(): THREE.AnimationClip {
    const t = [0, 0.12, 0.36];
    return new THREE.AnimationClip('slide', 0.36, [
      buildVecTrack('Hips.position', t, [
        [0, 0.58, 0.02],
        [0, 0.37, 0.04],
        [0, 0.36, 0.04],
      ]),
      buildQuatTrack('Hips.quaternion', t, [
        [0.38, 0.12, 0],
        [0.72, 0.16, 0],
        [0.76, 0.16, 0],
      ]),
      buildQuatTrack('Spine.quaternion', t, [
        [0.12, 0.06, 0],
        [0.22, 0.08, 0],
        [0.24, 0.08, 0],
      ]),
      buildQuatTrack('Chest.quaternion', t, [
        [0.06, 0.08, 0],
        [0.14, 0.10, 0],
        [0.14, 0.10, 0],
      ]),
      buildQuatTrack('Neck.quaternion', t, [
        [-0.22, -0.06, 0],
        [-0.42, -0.08, 0],
        [-0.44, -0.08, 0],
      ]),
      buildQuatTrack('Head.quaternion', t, [
        [-0.28, -0.10, 0],
        [-0.50, -0.12, 0],
        [-0.52, -0.12, 0],
      ]),
      buildQuatTrack('RightThigh.quaternion', t, [
        [0.64, 0, 0.04],
        [0.86, 0, 0.05],
        [0.88, 0, 0.05],
      ]),
      buildQuatTrack('RightShin.quaternion', t, [
        [-0.22, 0, 0],
        [-0.12, 0, 0],
        [-0.10, 0, 0],
      ]),
      buildQuatTrack('RightFoot.quaternion', t, [
        [-0.18, 0, 0],
        [-0.24, 0, 0],
        [-0.24, 0, 0],
      ]),
      buildQuatTrack('LeftThigh.quaternion', t, [
        [0.72, 0.55, -0.25],
        [1.02, 0.92, -0.34],
        [1.05, 0.95, -0.35],
      ]),
      buildQuatTrack('LeftShin.quaternion', t, [
        [-0.95, 0, 0],
        [-1.32, 0, 0],
        [-1.35, 0, 0],
      ]),
      buildQuatTrack('LeftFoot.quaternion', t, [
        [-0.14, 0, 0],
        [-0.18, 0, 0],
        [-0.18, 0, 0],
      ]),
      buildQuatTrack('LeftArm.quaternion', t, [
        [-0.48, 0, -0.36],
        [-0.72, -0.10, -0.52],
        [-0.74, -0.12, -0.54],
      ]),
      buildQuatTrack('LeftForearm.quaternion', t, [
        [0.42, 0, 0],
        [0.48, 0, 0],
        [0.48, 0, 0],
      ]),
      buildQuatTrack('LeftHand.quaternion', t, [
        [-0.20, 0, -0.16],
        [-0.36, -0.10, -0.20],
        [-0.38, -0.12, -0.20],
      ]),
      buildQuatTrack('RightArm.quaternion', t, [
        [0.48, 0, 0.24],
        [0.74, 0.12, 0.34],
        [0.78, 0.14, 0.36],
      ]),
      buildQuatTrack('RightForearm.quaternion', t, [
        [0.92, 0, 0],
        [1.08, 0, 0],
        [1.12, 0, 0],
      ]),
      buildQuatTrack('RightHand.quaternion', t, [
        [0.18, 0.08, 0.12],
        [0.26, 0.14, 0.18],
        [0.28, 0.16, 0.18],
      ]),
    ]);
  }

  public applySkin(skin: CharacterSkin): void {
    this.currentSkin = skin;
    this.primaryMat.color.setHex(skin.primaryColor);
    this.primaryMat.roughness = Math.max(0.42, skin.roughness);
    this.primaryMat.metalness = Math.min(0.38, skin.metalness);

    this.secondaryMat.color.setHex(skin.secondaryColor);
    this.secondaryMat.roughness = Math.min(0.86, skin.roughness + 0.22);
    this.secondaryMat.metalness = Math.max(0.04, skin.metalness * 0.24);

    this.accentMat.color.setHex(skin.accentColor);
    this.visorMat.color.setHex(skin.visorColor);
    this.visorMat.emissive.setHex(skin.visorColor);
    this.visorMat.emissiveIntensity = skin.emissiveIntensity;

    this.skinMat.color.setHex(skin.skinTone ?? 0xd99b72);
    this.hairMat.color.setHex(skin.hairColor ?? 0x1b1512);
    this.irisMat.color.setHex(skin.eyeColor ?? 0x3f2414);

    this.rebuildAccessory(skin);
    this.normalizeAllSkinWeights();
  }

  /**
   * Executes a bone-weight sanitization & normalization pass across all SkinnedMeshes
   * on the active character rig, guaranteeing clean skinning weights for every skin.
   */
  public normalizeAllSkinWeights(): SkinWeightNormalizationStats {
    const visited = new Set<THREE.SkinnedMesh>();
    const total: SkinWeightNormalizationStats = {
      vertexCount: 0,
      maxBoneIndex: 0,
      repairedCount: 0,
      prunedInfluences: 0,
      duplicateBonesCollapsed: 0,
      maxWeightSumDeviationBefore: 0,
      maxWeightSumDeviationAfter: 0,
    };

    const processSkinnedMesh = (mesh: THREE.SkinnedMesh) => {
      if (visited.has(mesh)) return;
      visited.add(mesh);
      const boneCount = mesh.skeleton?.bones.length ?? this.skeleton.bones.length;
      const stats = normalizeGeometrySkinWeights(mesh.geometry, boneCount);
      mesh.normalizeSkinWeights();
      total.vertexCount += stats.vertexCount;
      total.maxBoneIndex = Math.max(total.maxBoneIndex, stats.maxBoneIndex);
      total.repairedCount += stats.repairedCount;
      total.prunedInfluences += stats.prunedInfluences;
      total.duplicateBonesCollapsed += stats.duplicateBonesCollapsed;
      total.maxWeightSumDeviationBefore = Math.max(
        total.maxWeightSumDeviationBefore,
        stats.maxWeightSumDeviationBefore,
      );
      total.maxWeightSumDeviationAfter = Math.max(
        total.maxWeightSumDeviationAfter,
        stats.maxWeightSumDeviationAfter,
      );
    };

    for (const mesh of this.skinnedMeshes) {
      processSkinnedMesh(mesh);
    }
    this.root.traverse((obj) => {
      if (obj instanceof THREE.SkinnedMesh) {
        processSkinnedMesh(obj);
      }
    });

    return total;
  }

  public applyCosmetic(cosmeticId: SkinCosmeticId | null): void {
    if (this.currentCosmeticId === cosmeticId) return;
    this.currentCosmeticId = cosmeticId;
    this.rebuildCosmetic(cosmeticId);
  }

  private disposeGroupChildren(group: THREE.Group, disposeMaterials: boolean): void {
    while (group.children.length > 0) {
      const child = group.children.pop();
      if (!child) continue;
      child.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (disposeMaterials) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose());
            } else {
              obj.material.dispose();
            }
          }
        }
      });
    }
  }

  private rebuildCosmetic(cosmeticId: SkinCosmeticId | null): void {
    this.disposeGroupChildren(this.chestCosmeticGroup, true);
    this.disposeGroupChildren(this.headCosmeticGroup, true);
    if (!cosmeticId) return;

    if (cosmeticId === 'starlight_crown') {
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.72,
        roughness: 0.2,
        metalness: 0.85,
      });
      const emeraldMat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x34d399,
        emissiveIntensity: 0.85,
        roughness: 0.25,
        metalness: 0.5,
      });

      const crownPivot = new THREE.Group();
      crownPivot.name = 'crownPivot';
      crownPivot.position.set(0, 0.31, 0.01);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.020, 6, 16), goldMat);
      ring.rotation.x = Math.PI / 2;
      crownPivot.add(ring);

      const spikeGeo = new THREE.ConeGeometry(0.030, 0.098, 4);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const spike = new THREE.Mesh(spikeGeo, i % 2 === 0 ? goldMat : emeraldMat);
        spike.position.set(Math.cos(a) * 0.145, 0.052, Math.sin(a) * 0.145);
        crownPivot.add(spike);
      }

      const topGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.048, 0), emeraldMat);
      topGem.position.set(0, 0.120, 0);
      crownPivot.add(topGem);

      this.headCosmeticGroup.add(crownPivot);
    } else if (cosmeticId === 'truckart_wings') {
      const roseMat = new THREE.MeshStandardMaterial({
        color: 0xec4899,
        emissive: 0xf43f5e,
        emissiveIntensity: 0.65,
        roughness: 0.28,
        metalness: 0.45,
      });
      const cyanMat = new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.72,
        roughness: 0.25,
        metalness: 0.55,
      });
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.55,
        roughness: 0.25,
        metalness: 0.75,
      });

      const wingPivot = new THREE.Group();
      wingPivot.name = 'wingPivot';
      wingPivot.position.set(0, 0.04, 0.13);

      const upperBladeGeo = new THREE.BoxGeometry(0.56, 0.12, 0.034);
      const lowerBladeGeo = new THREE.BoxGeometry(0.40, 0.085, 0.034);

      for (const side of [-1, 1]) {
        const upper = new THREE.Mesh(upperBladeGeo, roseMat);
        upper.position.set(side * 0.36, 0.09, 0.04);
        upper.rotation.set(0.18, side * 0.28, side * -0.34);
        wingPivot.add(upper);

        const lower = new THREE.Mesh(lowerBladeGeo, cyanMat);
        lower.position.set(side * 0.30, -0.06, 0.055);
        lower.rotation.set(0.15, side * 0.22, side * -0.18);
        wingPivot.add(lower);

        const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.052, 0), goldMat);
        jewel.position.set(side * 0.14, 0.035, 0.04);
        wingPivot.add(jewel);
      }

      this.chestCosmeticGroup.add(wingPivot);
    } else if (cosmeticId === 'emerald_crest') {
      const pakGreenMat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x10b981,
        emissiveIntensity: 0.75,
        roughness: 0.28,
        metalness: 0.5,
      });
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.65,
        roughness: 0.22,
        metalness: 0.8,
      });

      const crestPivot = new THREE.Group();
      crestPivot.name = 'crestPivot';

      for (const side of [-1, 1]) {
        const pauldron = new THREE.Mesh(new THREE.ConeGeometry(0.082, 0.19, 5), pakGreenMat);
        pauldron.position.set(side * 0.205, 0.14, 0);
        pauldron.rotation.z = side * -0.45;
        crestPivot.add(pauldron);

        const trim = new THREE.Mesh(new THREE.OctahedronGeometry(0.048, 0), goldMat);
        trim.position.set(side * 0.24, 0.22, -0.01);
        crestPivot.add(trim);
      }

      const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.070, 0.26, 4), goldMat);
      dorsal.position.set(0, 0.05, 0.16);
      dorsal.rotation.x = -0.85;
      crestPivot.add(dorsal);

      this.chestCosmeticGroup.add(crestPivot);
    } else if (cosmeticId === 'comet_halo') {
      const cyanMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.85,
        roughness: 0.18,
        metalness: 0.7,
      });
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xfde047,
        emissive: 0xfbbf24,
        emissiveIntensity: 0.9,
        roughness: 0.2,
        metalness: 0.8,
      });

      const haloPivot = new THREE.Group();
      haloPivot.name = 'cometPivot';
      haloPivot.position.set(0, 0.04, 0.17);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.025, 6, 18), cyanMat);
      haloPivot.add(ring);

      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), goldMat);
        orb.position.set(Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0);
        haloPivot.add(orb);
      }

      this.chestCosmeticGroup.add(haloPivot);
    } else if (cosmeticId === 'marigold_scarf') {
      const saffronMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.45,
        roughness: 0.45,
        metalness: 0.25,
      });
      const crimsonMat = new THREE.MeshStandardMaterial({
        color: 0xe11d48,
        emissive: 0xbe123c,
        emissiveIntensity: 0.5,
        roughness: 0.42,
        metalness: 0.25,
      });
      const claspMat = new THREE.MeshStandardMaterial({
        color: 0xfde047,
        emissive: 0xfbbf24,
        emissiveIntensity: 0.65,
        roughness: 0.2,
        metalness: 0.85,
      });

      const scarfPivot = new THREE.Group();
      scarfPivot.name = 'scarfPivot';
      scarfPivot.position.set(0, 0.15, 0.11);

      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.086, 0.024, 8, 16), saffronMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.set(0, 0.01, -0.10);
      scarfPivot.add(collar);

      const clasp = new THREE.Mesh(new THREE.OctahedronGeometry(0.044, 0), claspMat);
      clasp.position.set(0, 0.0, -0.01);
      scarfPivot.add(clasp);

      for (const side of [-1, 1]) {
        const upperRibbon = new THREE.Mesh(
          new THREE.BoxGeometry(0.088, 0.30, 0.028),
          side < 0 ? saffronMat : crimsonMat,
        );
        upperRibbon.position.set(side * 0.08, -0.11, 0.08);
        upperRibbon.rotation.set(0.52, side * 0.22, side * 0.18);
        scarfPivot.add(upperRibbon);

        const tailTip = new THREE.Mesh(
          new THREE.ConeGeometry(0.050, 0.16, 4),
          side < 0 ? crimsonMat : saffronMat,
        );
        tailTip.position.set(side * 0.12, -0.26, 0.18);
        tailTip.rotation.set(Math.PI * 0.72, 0, side * -0.2);
        scarfPivot.add(tailTip);
      }

      this.chestCosmeticGroup.add(scarfPivot);
    } else if (cosmeticId === 'badshahi_crest') {
      const sandstoneMat = new THREE.MeshStandardMaterial({
        color: 0xe11d48,
        emissive: 0x9f1239,
        emissiveIntensity: 0.42,
        roughness: 0.35,
        metalness: 0.45,
      });
      const gildedMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.78,
        roughness: 0.2,
        metalness: 0.86,
      });

      const shahiPivot = new THREE.Group();
      shahiPivot.name = 'shahiPivot';

      for (const side of [-1, 1]) {
        const spireBase = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.068, 0.16, 8), sandstoneMat);
        spireBase.position.set(side * 0.21, 0.16, 0.02);
        spireBase.rotation.z = side * -0.28;
        shahiPivot.add(spireBase);

        const dome = new THREE.Mesh(new THREE.OctahedronGeometry(0.060, 0), gildedMat);
        dome.position.set(side * 0.24, 0.26, 0.02);
        shahiPivot.add(dome);
      }

      const backCrest = new THREE.Mesh(new THREE.OctahedronGeometry(0.10, 0), sandstoneMat);
      backCrest.position.set(0, 0.04, 0.15);
      shahiPivot.add(backCrest);

      const coreSeal = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.020, 6, 14), gildedMat);
      coreSeal.position.set(0, 0.04, 0.16);
      shahiPivot.add(coreSeal);

      this.chestCosmeticGroup.add(shahiPivot);
    } else if (cosmeticId === 'prism_thrusters') {
      const hullMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.3,
        metalness: 0.78,
      });
      const cyanFinMat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x22d3ee,
        emissiveIntensity: 0.72,
        roughness: 0.24,
        metalness: 0.65,
      });
      const plumeMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.95,
        roughness: 0.2,
        metalness: 0.35,
      });

      const thrusterPivot = new THREE.Group();
      thrusterPivot.name = 'thrusterPivot';
      thrusterPivot.position.set(0, 0.02, 0.14);

      for (const side of [-1, 1]) {
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.060, 0.082, 0.27, 8), hullMat);
        pod.position.set(side * 0.13, 0.02, 0);
        pod.rotation.set(-0.36, 0, side * -0.18);
        thrusterPivot.add(pod);

        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.095, 0.032), cyanFinMat);
        fin.position.set(side * 0.22, 0.07, 0.02);
        fin.rotation.set(0.15, side * -0.25, side * 0.38);
        thrusterPivot.add(fin);

        const plume = new THREE.Mesh(new THREE.ConeGeometry(0.054, 0.16, 6), plumeMat);
        plume.position.set(side * 0.15, -0.14, 0.065);
        plume.rotation.set(Math.PI - 0.36, 0, side * -0.18);
        thrusterPivot.add(plume);
      }

      this.chestCosmeticGroup.add(thrusterPivot);
    } else if (cosmeticId === 'golden_chakkar') {
      const brassMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xeab308,
        emissiveIntensity: 0.72,
        roughness: 0.2,
        metalness: 0.88,
      });
      const jadeMat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x34d399,
        emissiveIntensity: 0.82,
        roughness: 0.26,
        metalness: 0.55,
      });

      const chakkarPivot = new THREE.Group();
      chakkarPivot.name = 'chakkarPivot';
      chakkarPivot.position.set(0, 0.04, 0.17);

      const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.024, 6, 18), brassMat);
      chakkarPivot.add(outerRing);

      const innerCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.078, 0), jadeMat);
      chakkarPivot.add(innerCore);

      const spokeGeo = new THREE.BoxGeometry(0.50, 0.030, 0.024);
      for (let i = 0; i < 4; i++) {
        const spoke = new THREE.Mesh(spokeGeo, i % 2 === 0 ? brassMat : jadeMat);
        spoke.rotation.z = (i * Math.PI) / 4;
        chakkarPivot.add(spoke);
      }

      this.chestCosmeticGroup.add(chakkarPivot);
    }
    this.syncShadowCasterHierarchy();
  }

  private makeArchetypeMat(params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial(params);
    this.archetypeMaterials.push(mat);
    return mat;
  }

  private rebuildAccessory(skin: CharacterSkin): void {
    this.disposeGroupChildren(this.chestAccessoryGroup, false);
    this.disposeGroupChildren(this.headAccessoryGroup, false);
    this.disposeGroupChildren(this.hipsAccessoryGroup, false);
    this.disposeGroupChildren(this.leftShinAccessoryGroup, false);
    this.disposeGroupChildren(this.rightShinAccessoryGroup, false);
    for (const mat of this.archetypeMaterials) {
      mat.dispose();
    }
    this.archetypeMaterials.length = 0;

    // Hide stylized hair crown when character wears a full helmet, turban, or ranger hood
    const hidesHair =
      skin.accessory === 'crest' ||
      skin.accessory === 'shahi' ||
      skin.accessory === 'fins' ||
      skin.accessory === 'hood' ||
      skin.accessory === 'halo';
    this.hairGroup.visible = !hidesHair;

    const addShinGuards = (mat: THREE.Material, accentTrim: THREE.Material) => {
      const guardGeo = new THREE.CylinderGeometry(0.056, 0.044, 0.16, 10, 1, false, -Math.PI * 0.45, Math.PI * 0.9);
      for (const grp of [this.leftShinAccessoryGroup, this.rightShinAccessoryGroup]) {
        const guard = new THREE.Mesh(guardGeo, mat);
        guard.position.set(0, -0.145, -0.022);
        guard.rotation.y = Math.PI;
        grp.add(guard);

        const trim = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.008, 6, 12), accentTrim);
        trim.rotation.x = Math.PI / 2;
        trim.position.set(0, -0.08, 0);
        grp.add(trim);
      }
    };

    if (skin.accessory === 'pack') {
      // Trailblazer: Athletic headband + trailing ribbons + courier parkour pack + draped hood
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.114, 0.015, 8, 22), this.accentMat);
      band.rotation.x = Math.PI / 2 + 0.22;
      band.scale.set(0.98, 1, 1.08);
      band.position.set(0, 0.195, 0.006);
      this.headAccessoryGroup.add(band);

      const knot = new THREE.Mesh(new THREE.OctahedronGeometry(0.022, 0), this.visorMat);
      knot.position.set(0, 0.175, 0.118);
      this.headAccessoryGroup.add(knot);

      for (const side of [-1, 1]) {
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.12, 4), this.accentMat);
        tail.position.set(side * 0.032, 0.135, 0.155);
        tail.rotation.set(-0.95, side * 0.25, side * -0.2);
        this.headAccessoryGroup.add(tail);
      }

      const pack = new THREE.Mesh(new THREE.CapsuleGeometry(0.092, 0.14, 6, 12), this.accentMat);
      pack.scale.set(1.1, 1.0, 0.62);
      pack.position.set(0, -0.02, 0.155);
      pack.castShadow = true;
      this.chestAccessoryGroup.add(pack);

      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.22, 12), this.secondaryMat);
      roll.rotation.z = Math.PI / 2;
      roll.position.set(0, 0.11, 0.155);
      this.chestAccessoryGroup.add(roll);

      const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.028, 0), this.visorMat);
      beacon.position.set(0, 0.02, 0.215);
      this.chestAccessoryGroup.add(beacon);

      addShinGuards(this.secondaryMat, this.accentMat);
    } else if (skin.accessory === 'basant') {
      // Basant Flyer: Brass rooftop aviator goggles + Diamond Basant kite-glider + Charkhi string spool
      const brassMat = this.makeArchetypeMat({ color: 0xfbbf24, roughness: 0.25, metalness: 0.82 });
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.114, 0.013, 8, 22), this.secondaryMat);
      strap.rotation.x = Math.PI / 2 + 0.18;
      strap.position.set(0, 0.188, 0.005);
      this.headAccessoryGroup.add(strap);

      for (const side of [-1, 1]) {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.030, 0.007, 8, 14), brassMat);
        rim.position.set(side * 0.042, 0.195, -0.106);
        rim.rotation.y = side * -0.20;
        this.headAccessoryGroup.add(rim);

        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.026, 12), this.visorMat);
        lens.position.set(side * 0.042, 0.195, -0.110);
        lens.rotation.y = Math.PI + side * -0.20;
        this.headAccessoryGroup.add(lens);
      }

      // Charkhi kite-spool strapped on upper back
      const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.16, 14), brassMat);
      spool.rotation.z = Math.PI / 2;
      spool.position.set(0, 0.02, 0.16);
      this.chestAccessoryGroup.add(spool);

      const spoolThread = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.11, 12), this.visorMat);
      spoolThread.rotation.z = Math.PI / 2;
      spoolThread.position.set(0, 0.02, 0.16);
      this.chestAccessoryGroup.add(spoolThread);

      // Diamond Patang kite-wings
      const kiteWingGeo = new THREE.OctahedronGeometry(0.18, 0);
      kiteWingGeo.scale(1.25, 0.72, 0.10);
      for (const side of [-1, 1]) {
        const kite = new THREE.Mesh(kiteWingGeo, side < 0 ? this.primaryMat : this.secondaryMat);
        kite.position.set(side * 0.24, 0.09, 0.155);
        kite.rotation.set(0.22, side * -0.35, side * 0.28);
        this.chestAccessoryGroup.add(kite);

        const rib = new THREE.Mesh(new THREE.OctahedronGeometry(0.038, 0), this.visorMat);
        rib.position.set(side * 0.38, 0.15, 0.21);
        this.chestAccessoryGroup.add(rib);
      }

      // Flowing kite sash tails on hips
      for (const side of [-1, 1]) {
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.26, 4), this.accentMat);
        tail.position.set(side * 0.09, -0.10, 0.125);
        tail.rotation.set(Math.PI * 0.72, 0, side * -0.18);
        this.hipsAccessoryGroup.add(tail);
      }
      addShinGuards(this.secondaryMat, this.visorMat);
    } else if (skin.accessory === 'crest') {
      // Glacier Scout: Aerodynamic Cryo-Helmet + Glowing Panoramic Visor + Ice Shoulder Crests
      const helmGeo = new THREE.SphereGeometry(0.126, 20, 16);
      helmGeo.scale(1.0, 1.06, 1.08);
      const helm = new THREE.Mesh(helmGeo, this.primaryMat);
      helm.position.set(0, 0.158, 0.005);
      this.headAccessoryGroup.add(helm);

      const aeroFin = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.20, 5), this.accentMat);
      aeroFin.position.set(0, 0.295, 0.03);
      aeroFin.rotation.x = -0.65;
      this.headAccessoryGroup.add(aeroFin);

      const visor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.124, 0.124, 0.068, 18, 1, true, Math.PI * 0.65, Math.PI * 0.70),
        this.visorMat,
      );
      visor.position.set(0, 0.145, -0.008);
      this.headAccessoryGroup.add(visor);

      const crystalGeo = new THREE.ConeGeometry(0.054, 0.20, 6);
      for (const side of [-1, 1]) {
        const crystal = new THREE.Mesh(crystalGeo, this.visorMat);
        crystal.position.set(side * 0.18, 0.15, 0.08);
        crystal.rotation.set(-0.32, 0, side * -0.48);
        this.chestAccessoryGroup.add(crystal);
      }

      const cryoPack = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.24, 8), this.secondaryMat);
      cryoPack.position.set(0, 0.02, 0.155);
      this.chestAccessoryGroup.add(cryoPack);

      addShinGuards(this.primaryMat, this.visorMat);
    } else if (skin.accessory === 'shahi') {
      // Shahi Falconer: Royal Badshahi Pagri Turban + Gold Kalgi Plume + Flowing Sherwani Coat Tails + Gold Bracers
      const velvetMat = this.makeArchetypeMat({ color: 0x881337, roughness: 0.45, metalness: 0.22 });
      const goldMat = this.makeArchetypeMat({
        color: 0xfbbf24,
        emissive: 0xd97706,
        emissiveIntensity: 0.25,
        roughness: 0.22,
        metalness: 0.88,
      });

      const turbanBase = new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.048, 10, 22), this.primaryMat);
      turbanBase.rotation.x = Math.PI / 2 - 0.14;
      turbanBase.position.set(0, 0.215, 0.010);
      this.headAccessoryGroup.add(turbanBase);

      const turbanFoldL = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.036, 8, 18), velvetMat);
      turbanFoldL.rotation.set(Math.PI / 2 - 0.25, 0.25, 0.22);
      turbanFoldL.position.set(-0.015, 0.245, 0.012);
      this.headAccessoryGroup.add(turbanFoldL);

      const turbanTop = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), this.primaryMat);
      turbanTop.scale.set(1.02, 0.72, 1.05);
      turbanTop.position.set(0, 0.245, 0.012);
      this.headAccessoryGroup.add(turbanTop);

      const sarpech = new THREE.Mesh(new THREE.OctahedronGeometry(0.034, 0), goldMat);
      sarpech.scale.set(0.85, 1.25, 0.45);
      sarpech.position.set(0, 0.240, -0.132);
      this.headAccessoryGroup.add(sarpech);

      const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.018, 0), this.visorMat);
      jewel.position.set(0, 0.240, -0.146);
      this.headAccessoryGroup.add(jewel);

      const kalgiPlume = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.15, 5), this.accentMat);
      kalgiPlume.position.set(0, 0.34, -0.095);
      kalgiPlume.rotation.x = -0.35;
      this.headAccessoryGroup.add(kalgiPlume);

      for (const side of [-1, 1]) {
        const epaulet = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.075, 4, 8), goldMat);
        epaulet.rotation.z = side * 0.35;
        epaulet.position.set(side * 0.17, 0.135, 0);
        this.chestAccessoryGroup.add(epaulet);

        // Flowing split royal coat tails (flared backward away from stride swing)
        const coatTail = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.32, 0.024), this.primaryMat);
        coatTail.position.set(side * 0.088, -0.14, 0.145);
        coatTail.rotation.set(-0.26, side * 0.12, side * -0.08);
        this.hipsAccessoryGroup.add(coatTail);

        const tailTrim = new THREE.Mesh(new THREE.BoxGeometry(0.134, 0.030, 0.028), goldMat);
        tailTrim.position.set(side * 0.088, -0.285, 0.184);
        tailTrim.rotation.set(-0.26, side * 0.12, side * -0.08);
        this.hipsAccessoryGroup.add(tailTrim);
      }

      const backMedallion = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.012, 6, 14), goldMat);
      backMedallion.position.set(0, 0.03, 0.126);
      this.chestAccessoryGroup.add(backMedallion);

      addShinGuards(goldMat, velvetMat);
    } else if (skin.accessory === 'fins') {
      // Solar Flare: Sunforged Aero-Helmet + Glowing Wrap Visor + Twin Turbine Jetpack
      const darkAlloy = this.makeArchetypeMat({ color: 0x1e2230, roughness: 0.24, metalness: 0.82 });
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.125, 20, 14), darkAlloy);
      helm.scale.set(1.0, 1.04, 1.12);
      helm.position.set(0, 0.158, 0.008);
      this.headAccessoryGroup.add(helm);

      const visor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.124, 0.122, 0.064, 18, 1, true, Math.PI * 0.62, Math.PI * 0.76),
        this.visorMat,
      );
      visor.position.set(0, 0.142, -0.008);
      this.headAccessoryGroup.add(visor);

      for (const side of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.12, 5), this.primaryMat);
        horn.position.set(side * 0.095, 0.25, 0.02);
        horn.rotation.set(-0.55, 0, side * -0.24);
        this.headAccessoryGroup.add(horn);

        const thrusterPod = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.068, 0.24, 10), darkAlloy);
        thrusterPod.position.set(side * 0.105, 0.02, 0.155);
        thrusterPod.rotation.set(-0.28, 0, side * -0.14);
        this.chestAccessoryGroup.add(thrusterPod);

        const wingFin = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.24, 4), this.primaryMat);
        wingFin.position.set(side * 0.19, 0.08, 0.16);
        wingFin.rotation.set(-0.35, 0, side * -0.68);
        this.chestAccessoryGroup.add(wingFin);

        const plasma = new THREE.Mesh(new THREE.ConeGeometry(0.044, 0.14, 8), this.visorMat);
        plasma.position.set(side * 0.115, -0.13, 0.20);
        plasma.rotation.set(Math.PI - 0.28, 0, side * -0.14);
        this.chestAccessoryGroup.add(plasma);
      }
      addShinGuards(darkAlloy, this.primaryMat);
    } else if (skin.accessory === 'hood') {
      // Moss Warden: Pointed Shalimar Ranger Cowl + Leaf Mantle + Flowing Forest Cape
      const cowl = new THREE.Mesh(
        new THREE.SphereGeometry(0.130, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.72),
        this.primaryMat,
      );
      cowl.rotation.x = 0.55;
      cowl.position.set(0, 0.165, 0.015);
      this.headAccessoryGroup.add(cowl);

      const hoodTip = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.20, 8), this.primaryMat);
      hoodTip.position.set(0, 0.22, 0.095);
      hoodTip.rotation.x = -0.85;
      this.headAccessoryGroup.add(hoodTip);

      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.032, 8, 16), this.secondaryMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.set(0, 0.13, 0.02);
      this.chestAccessoryGroup.add(collar);

      for (const side of [-1, 1]) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.058, 0.16, 4), this.accentMat);
        leaf.scale.set(1.2, 1.0, 0.35);
        leaf.position.set(side * 0.175, 0.12, 0.02);
        leaf.rotation.set(0, 0, side * -1.15);
        this.chestAccessoryGroup.add(leaf);
      }

      const cape = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.42, 0.024), this.secondaryMat);
      cape.position.set(0, -0.06, 0.185);
      cape.rotation.x = -0.26;
      this.chestAccessoryGroup.add(cape);

      const capeGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.042, 0), this.visorMat);
      capeGem.position.set(0, 0.09, 0.152);
      this.chestAccessoryGroup.add(capeGem);

      addShinGuards(this.secondaryMat, this.primaryMat);
    } else if (skin.accessory === 'qawwal') {
      // Cyber Qawwal: Neon AR Shades + Halo Headphones + Equalizer Spine Array
      const goldMat = this.makeArchetypeMat({ color: 0xfbbf24, roughness: 0.22, metalness: 0.85 });

      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.036, 0.032), this.visorMat);
      visor.position.set(0, 0.126, -0.106);
      this.headAccessoryGroup.add(visor);

      const headband = new THREE.Mesh(
        new THREE.TorusGeometry(0.128, 0.014, 8, 18, Math.PI),
        goldMat,
      );
      headband.position.set(0, 0.155, 0.005);
      this.headAccessoryGroup.add(headband);

      for (const side of [-1, 1]) {
        const earcup = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.028, 14), this.secondaryMat);
        earcup.rotation.z = Math.PI / 2;
        earcup.position.set(side * 0.126, 0.135, 0.005);
        this.headAccessoryGroup.add(earcup);

        const glowRing = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.007, 6, 14), this.visorMat);
        glowRing.rotation.y = Math.PI / 2;
        glowRing.position.set(side * 0.141, 0.135, 0.005);
        this.headAccessoryGroup.add(glowRing);

        const emitter = new THREE.Mesh(new THREE.OctahedronGeometry(0.048, 0), goldMat);
        emitter.position.set(side * 0.19, 0.13, 0.02);
        this.chestAccessoryGroup.add(emitter);
      }

      // Stepped glowing equalizer bars on back
      for (let i = -2; i <= 2; i++) {
        const h = 0.22 - Math.abs(i) * 0.042;
        const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, h, 4, 8), i % 2 === 0 ? this.visorMat : goldMat);
        bar.position.set(i * 0.044, 0.01, 0.145);
        this.chestAccessoryGroup.add(bar);
      }

      addShinGuards(this.secondaryMat, this.visorMat);
    } else if (skin.accessory === 'wings') {
      // Neon Striker: Carbon Stealth Half-Mask + Glowing Optic Visor + Swept Energy Blade Wings
      const mask = new THREE.Mesh(
        new THREE.CylinderGeometry(0.098, 0.072, 0.078, 14, 1, false, Math.PI * 0.62, Math.PI * 0.76),
        this.secondaryMat,
      );
      mask.position.set(0, 0.068, -0.025);
      this.headAccessoryGroup.add(mask);

      const opticVisor = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.032, 0.026), this.visorMat);
      opticVisor.position.set(0, 0.126, -0.106);
      this.headAccessoryGroup.add(opticVisor);

      for (const side of [-1, 1]) {
        const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.088, 0.022), this.visorMat);
        wingBlade.position.set(side * 0.25, 0.07, 0.145);
        wingBlade.rotation.set(0.22, side * -0.35, side * 0.34);
        this.chestAccessoryGroup.add(wingBlade);

        const subBlade = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.056, 0.022), this.accentMat);
        subBlade.position.set(side * 0.21, -0.03, 0.155);
        subBlade.rotation.set(0.20, side * -0.28, side * 0.18);
        this.chestAccessoryGroup.add(subBlade);
      }
      addShinGuards(this.secondaryMat, this.visorMat);
    } else if (skin.accessory === 'stormrider') {
      // Ravi Stormrider: High Storm Collar + Lightning Visor + Twin Tesla Shoulder Coils + Coat Tails
      const stormVisor = new THREE.Mesh(new THREE.BoxGeometry(0.152, 0.034, 0.030), this.visorMat);
      stormVisor.position.set(0, 0.126, -0.106);
      this.headAccessoryGroup.add(stormVisor);

      const boltCrest = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.11, 4), this.accentMat);
      boltCrest.position.set(0, 0.22, -0.11);
      boltCrest.rotation.x = -0.35;
      this.headAccessoryGroup.add(boltCrest);

      const highCollar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.125, 0.115, 0.095, 16, 1, true, -Math.PI * 0.72, Math.PI * 1.44),
        this.primaryMat,
      );
      highCollar.position.set(0, 0.145, 0.015);
      this.chestAccessoryGroup.add(highCollar);

      for (const side of [-1, 1]) {
        const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.042, 0.14, 10), this.secondaryMat);
        coil.position.set(side * 0.18, 0.16, 0.06);
        coil.rotation.set(-0.28, 0, side * -0.25);
        this.chestAccessoryGroup.add(coil);

        const arcRing = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.010, 6, 14), this.accentMat);
        arcRing.position.set(side * 0.20, 0.21, 0.075);
        arcRing.rotation.x = Math.PI / 2 - 0.28;
        this.chestAccessoryGroup.add(arcRing);

        const stormTail = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.30, 0.022), this.secondaryMat);
        stormTail.position.set(side * 0.085, -0.13, 0.150);
        stormTail.rotation.set(-0.28, side * 0.14, side * -0.08);
        this.hipsAccessoryGroup.add(stormTail);
      }
      addShinGuards(this.secondaryMat, this.accentMat);
    } else if (skin.accessory === 'halo') {
      // Aether Knight: Winged Paladin Helm + Floating Solar Halo + Armored Pauldrons + Seraph Wings
      const goldMat = this.makeArchetypeMat({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.35,
        roughness: 0.20,
        metalness: 0.88,
      });

      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.125, 20, 14), this.primaryMat);
      helm.scale.set(1.0, 1.08, 1.08);
      helm.position.set(0, 0.160, 0.006);
      this.headAccessoryGroup.add(helm);

      const slit = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.028, 0.028), this.visorMat);
      slit.position.set(0, 0.135, -0.112);
      this.headAccessoryGroup.add(slit);

      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.178, 0.020, 8, 20), goldMat);
      halo.rotation.x = Math.PI / 2;
      halo.position.set(0, 0.33, 0.01);
      this.headAccessoryGroup.add(halo);

      for (const side of [-1, 1]) {
        const helmWing = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.14, 0.08), goldMat);
        helmWing.position.set(side * 0.132, 0.18, 0.01);
        helmWing.rotation.set(-0.35, 0, side * -0.25);
        this.headAccessoryGroup.add(helmWing);

        const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.072, 12, 10), goldMat);
        pauldron.scale.set(1.1, 0.72, 1.05);
        pauldron.position.set(side * 0.195, 0.13, 0);
        this.chestAccessoryGroup.add(pauldron);

        const seraphUpper = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.095, 0.024), this.visorMat);
        seraphUpper.position.set(side * 0.28, 0.09, 0.145);
        seraphUpper.rotation.set(0.20, side * -0.32, side * 0.34);
        this.chestAccessoryGroup.add(seraphUpper);

        const seraphLower = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.068, 0.024), goldMat);
        seraphLower.position.set(side * 0.22, -0.02, 0.155);
        seraphLower.rotation.set(0.18, side * -0.24, side * 0.16);
        this.chestAccessoryGroup.add(seraphLower);
      }
      addShinGuards(this.primaryMat, goldMat);
    } else if (skin.accessory === 'carnival') {
      // Carnival Runner: Peacock Plume Crown + Truck-Art Pennants + Bazaar Lantern Gem
      const centerPlume = new THREE.Mesh(new THREE.ConeGeometry(0.046, 0.20, 5), this.visorMat);
      centerPlume.position.set(0, 0.30, -0.01);
      centerPlume.rotation.x = -0.18;
      this.headAccessoryGroup.add(centerPlume);

      for (const side of [-1, 1]) {
        const sidePlume = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.16, 5), this.accentMat);
        sidePlume.position.set(side * 0.085, 0.28, 0.015);
        sidePlume.rotation.set(-0.22, 0, side * -0.45);
        this.headAccessoryGroup.add(sidePlume);

        const pennant = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.080, 0.034), this.accentMat);
        pennant.position.set(side * 0.23, 0.10, 0.145);
        pennant.rotation.set(0.24, side * -0.42, side * 0.28);
        this.chestAccessoryGroup.add(pennant);

        const ribbonTip = new THREE.Mesh(new THREE.OctahedronGeometry(0.046, 0), this.visorMat);
        ribbonTip.position.set(side * 0.35, 0.13, 0.205);
        this.chestAccessoryGroup.add(ribbonTip);
      }

      const lanternGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.080, 0), this.visorMat);
      lanternGem.position.set(0, 0.05, 0.165);
      this.chestAccessoryGroup.add(lanternGem);
      addShinGuards(this.secondaryMat, this.visorMat);
    }
    this.syncShadowCasterHierarchy();
  }

  public updatePose(pose: RunnerPoseState, dt: number, groundHeightBelow: number): void {
    const heightAboveGround = Math.max(0, this.root.position.y - groundHeightBelow);
    this.contactShadow.position.y = groundHeightBelow - this.root.position.y + 0.025;
    const shadowScale = THREE.MathUtils.clamp(1 - heightAboveGround * 0.14, 0.35, 1.05);
    this.contactShadow.scale.setScalar(pose.isSliding ? shadowScale * 1.15 : shadowScale);
    (this.contactShadow.material as THREE.MeshBasicMaterial).opacity =
      groundHeightBelow < -5 ? 0 : THREE.MathUtils.clamp(0.28 - heightAboveGround * 0.05, 0.06, 0.28);

    this.vfxTime += dt;

    const invulnRemaining = pose.invulnTimer ?? 0;
    if (invulnRemaining > 0) {
      const flickerOn = Math.sin(this.vfxTime * 34) > -0.15;
      this.bodyRig.visible = flickerOn;
    } else {
      this.bodyRig.visible = true;
    }

    if (pose.hitFlash > 0) {
      this.primaryMat.emissive.setHex(0xffffff);
      this.primaryMat.emissiveIntensity = pose.hitFlash * 1.4;
      this.secondaryMat.emissive.setHex(0xffffff);
      this.secondaryMat.emissiveIntensity = pose.hitFlash * 0.65;
    } else if (invulnRemaining > 0) {
      this.primaryMat.emissive.setHex(0x38bdf8);
      this.primaryMat.emissiveIntensity = 0.52;
      this.secondaryMat.emissive.setHex(0x38bdf8);
      this.secondaryMat.emissiveIntensity = 0.25;
    } else if (pose.powerupSurge > 0) {
      this.primaryMat.emissive.setHex(0xbae6fd);
      this.primaryMat.emissiveIntensity = pose.powerupSurge * 0.65;
      this.secondaryMat.emissive.setHex(0xbae6fd);
      this.secondaryMat.emissiveIntensity = pose.powerupSurge * 0.28;
    } else if (pose.chronosTimer > 0) {
      this.primaryMat.emissive.setHex(0x8b5cf6);
      this.primaryMat.emissiveIntensity = 0.34;
      this.secondaryMat.emissive.setHex(0x8b5cf6);
      this.secondaryMat.emissiveIntensity = 0.16;
    } else {
      this.primaryMat.emissive.setHex(0x000000);
      this.primaryMat.emissiveIntensity = 0;
      this.secondaryMat.emissive.setHex(0x000000);
      this.secondaryMat.emissiveIntensity = 0;
    }

    // Shield Shimmer Visual
    this.shieldBubble.visible = pose.hasShield;
    this.shieldInnerShell.visible = pose.hasShield;
    if (pose.hasShield) {
      const shimmer = 0.5 + 0.5 * Math.sin(this.vfxTime * 7.5);
      const baseScale = (pose.isSliding ? 0.78 : 1.0) * (1 + shimmer * 0.035 + pose.powerupSurge * 0.14);
      const yPos = pose.isSliding ? 0.50 : 0.86;

      this.shieldBubble.rotation.y += dt * 1.9;
      this.shieldBubble.rotation.x += dt * 0.75;
      this.shieldBubble.scale.setScalar(baseScale);
      this.shieldBubble.position.y = yPos;
      const bubbleMat = this.shieldBubble.material as THREE.MeshStandardMaterial;
      bubbleMat.opacity = 0.24 + shimmer * 0.22;
      bubbleMat.emissiveIntensity = 0.65 + shimmer * 0.75;

      this.shieldInnerShell.rotation.y -= dt * 1.3;
      this.shieldInnerShell.rotation.z += dt * 0.6;
      this.shieldInnerShell.scale.setScalar(baseScale * 0.95);
      this.shieldInnerShell.position.y = yPos;
      (this.shieldInnerShell.material as THREE.MeshBasicMaterial).opacity = 0.08 + shimmer * 0.14;
    }

    // Magnet Orbiting Field Visual
    const magnetOn = pose.magnetTimer > 0;
    this.magnetAuraGroup.visible = magnetOn;
    if (magnetOn) {
      const warnFlicker = pose.magnetTimer < 2.2 ? 0.5 + 0.5 * Math.sin(this.vfxTime * 18) : 1;
      const magPulse = 0.96 + 0.08 * Math.sin(this.vfxTime * 9);
      this.magnetAuraGroup.position.y = pose.isSliding ? 0.48 : 0.84;
      this.magnetAuraGroup.rotation.y += dt * 3.8;
      this.magnetAuraGroup.scale.setScalar((pose.isSliding ? 0.82 : 1.0) * magPulse);
      this.magnetRingA.rotation.z += dt * 2.4;
      this.magnetRingB.rotation.z -= dt * 2.4;
      (this.magnetRingA.material as THREE.MeshBasicMaterial).opacity = 0.55 * warnFlicker + 0.2;
    }

    // 2x Multiplier Overdrive Aura
    const multOn = pose.multiplierTimer > 0;
    this.multiplierAuraGroup.visible = multOn;
    if (multOn) {
      const warnFlicker = pose.multiplierTimer < 2.2 ? 0.5 + 0.5 * Math.sin(this.vfxTime * 18) : 1;
      this.multiplierAuraGroup.position.y = (pose.isSliding ? 0.48 : 0.86) + Math.sin(this.vfxTime * 6) * 0.08;
      this.multiplierAuraGroup.rotation.y -= dt * 5.2;
      this.multiplierAuraGroup.rotation.z = Math.sin(this.vfxTime * 3.2) * 0.22;
      this.multiplierAuraGroup.scale.setScalar(pose.isSliding ? 0.82 : 1.0);
      const ringChild = this.multiplierAuraGroup.children[0] as THREE.Mesh;
      (ringChild.material as THREE.MeshBasicMaterial).opacity = 0.6 * warnFlicker + 0.2;
    }

    // Chronos-Crystal Time-Dilation Orbital Aura
    const chronosOn = pose.chronosTimer > 0;
    this.chronosAuraGroup.visible = chronosOn;
    if (chronosOn) {
      const warnFlicker = pose.chronosTimer < 1.25 ? 0.45 + 0.55 * Math.sin(this.vfxTime * 18) : 1;
      this.chronosAuraGroup.position.y = (pose.isSliding ? 0.48 : 0.86) + Math.sin(this.vfxTime * 3.2) * 0.05;
      this.chronosRingA.rotation.z += dt * 1.9;
      this.chronosRingB.rotation.z -= dt * 2.5;
      this.chronosAuraGroup.rotation.y += dt * 1.2;
      this.chronosAuraGroup.scale.setScalar(pose.isSliding ? 0.8 : 1.0);
      (this.chronosRingA.material as THREE.MeshBasicMaterial).opacity = 0.72 * warnFlicker;
      (this.chronosRingB.material as THREE.MeshBasicMaterial).opacity = 0.78 * warnFlicker;
    }

    // Squash & stretch + lane banking lean + speed forward lean + air pitch on bodyRig
    const sy = pose.squashY;
    const sxz = 1 / Math.sqrt(Math.max(0.65, sy));
    this.bodyRig.scale.set(sxz, sy, sxz);

    const targetBank = THREE.MathUtils.clamp(-pose.laneVelX * 0.036, -0.26, 0.26);
    this.bodyRig.rotation.z = THREE.MathUtils.damp(this.bodyRig.rotation.z, targetBank, 14, dt);

    const speedLean =
      !pose.showcaseMode && !pose.isSliding
        ? -THREE.MathUtils.clamp(((pose.speedMultiplier ?? 1) - 1) * 0.075, 0, 0.14)
        : 0;
    const targetAirPitch =
      !pose.isGrounded && !pose.isSliding && !pose.showcaseMode
        ? THREE.MathUtils.clamp(-pose.vy * 0.018, -0.18, 0.18) + speedLean * 0.5
        : speedLean;
    this.bodyRig.rotation.x = THREE.MathUtils.damp(this.bodyRig.rotation.x, targetAirPitch, 12, dt);

    // -------------------------------------------------------------------------
    // Skeletal Animation State Machine with Lerped Weight Transitions
    // -------------------------------------------------------------------------
    const desiredState: AnimStateName = pose.showcaseMode
      ? 'idle'
      : pose.isSliding
        ? 'slide'
        : !pose.isGrounded
          ? 'jump'
          : 'run';

    if (desiredState !== this.activeState) {
      if (desiredState === 'jump') {
        this.jumpAction.reset();
        this.jumpAction.play();
      } else if (desiredState === 'slide') {
        this.slideAction.reset();
        this.slideAction.play();
      }
      this.activeState = desiredState;
    }

    const blendSpeed = desiredState === 'slide' ? 24 : desiredState === 'jump' ? 18 : 14;
    this.stateWeights.idle = THREE.MathUtils.damp(
      this.stateWeights.idle,
      desiredState === 'idle' ? 1 : 0,
      blendSpeed,
      dt,
    );
    this.stateWeights.run = THREE.MathUtils.damp(
      this.stateWeights.run,
      desiredState === 'run' ? 1 : 0,
      blendSpeed,
      dt,
    );
    this.stateWeights.jump = THREE.MathUtils.damp(
      this.stateWeights.jump,
      desiredState === 'jump' ? 1 : 0,
      blendSpeed,
      dt,
    );
    this.stateWeights.slide = THREE.MathUtils.damp(
      this.stateWeights.slide,
      desiredState === 'slide' ? 1 : 0,
      blendSpeed,
      dt,
    );

    const weightSum =
      this.stateWeights.idle +
      this.stateWeights.run +
      this.stateWeights.jump +
      this.stateWeights.slide || 1;

    this.idleAction.setEffectiveWeight(this.stateWeights.idle / weightSum);
    this.runAction.setEffectiveWeight(this.stateWeights.run / weightSum);
    this.jumpAction.setEffectiveWeight(this.stateWeights.jump / weightSum);
    this.slideAction.setEffectiveWeight(this.stateWeights.slide / weightSum);

    const twoPi = Math.PI * 2;
    const normPhase = (((pose.runCycle % twoPi) + twoPi) % twoPi) / twoPi;
    this.runAction.time = normPhase * this.runClipDuration;

    this.mixer.update(dt);

    // -------------------------------------------------------------------------
    // Analytical 2-Bone Leg & Foot Terrain Inverse Kinematics (IK)
    // -------------------------------------------------------------------------
    this.applyFootIKSystem(pose, dt, groundHeightBelow);

    // -------------------------------------------------------------------------
    // Analytical 2-Bone Arm & Hand Inverse Kinematics (IK)
    // -------------------------------------------------------------------------
    this.applyArmIKSystem(pose, dt);

    // Animate equipped Weekly Challenge runner cosmetic
    if (this.currentCosmeticId) {
      const headChild = this.headCosmeticGroup.children[0];
      const chestChild = this.chestCosmeticGroup.children[0];
      if (this.currentCosmeticId === 'starlight_crown' && headChild) {
        headChild.rotation.y += dt * 2.1;
        headChild.position.y = 0.31 + Math.sin(this.vfxTime * 4.2) * 0.025;
      } else if (this.currentCosmeticId === 'truckart_wings' && chestChild) {
        chestChild.rotation.x = Math.sin(this.vfxTime * 7.5) * 0.08;
        const s = 1 + Math.sin(this.vfxTime * 6.0) * 0.04;
        chestChild.scale.set(s, s, 1);
      } else if (this.currentCosmeticId === 'comet_halo' && chestChild) {
        chestChild.rotation.z -= dt * 2.8;
      } else if (this.currentCosmeticId === 'emerald_crest' && chestChild) {
        const s = 1 + Math.sin(this.vfxTime * 5.2) * 0.045;
        chestChild.scale.setScalar(s);
      } else if (this.currentCosmeticId === 'marigold_scarf' && chestChild) {
        chestChild.rotation.z = Math.sin(this.vfxTime * 7.2) * 0.06;
        chestChild.rotation.x = Math.sin(this.vfxTime * 5.6) * 0.08;
      } else if (this.currentCosmeticId === 'badshahi_crest' && chestChild) {
        const s = 1 + Math.sin(this.vfxTime * 4.8) * 0.04;
        chestChild.scale.setScalar(s);
      } else if (this.currentCosmeticId === 'prism_thrusters' && chestChild) {
        const s = 1 + Math.sin(this.vfxTime * 12) * 0.05;
        chestChild.scale.set(1, s, s);
      } else if (this.currentCosmeticId === 'golden_chakkar' && chestChild) {
        chestChild.rotation.z += dt * 2.6;
      }
    }

    if (this.currentSkin.accessory === 'carnival') {
      this.chestAccessoryGroup.rotation.z = Math.sin(this.vfxTime * 6.4) * 0.045;
      this.chestAccessoryGroup.position.y = Math.sin(this.vfxTime * 8.2) * 0.014;
      this.headAccessoryGroup.rotation.z = Math.sin(this.vfxTime * 6.4) * 0.035;
    } else {
      this.chestAccessoryGroup.rotation.z = 0;
      this.chestAccessoryGroup.position.y = 0;
      this.headAccessoryGroup.rotation.z = 0;
    }

    this.visorMat.emissiveIntensity = this.currentSkin.emissiveIntensity;
  }

  private applyArmIKSystem(pose: RunnerPoseState, dt: number): void {
    const active = !pose.showcaseMode;
    const speedMult = pose.speedMultiplier ?? 1.0;
    const targetSpeedNorm = active ? THREE.MathUtils.clamp((speedMult - 1.0) / 2.0, 0, 1) : 0;
    const targetOverdrive = active ? THREE.MathUtils.clamp((speedMult - 2.35) / 0.85, 0, 1) : 0;
    const targetLatMom = active
      ? THREE.MathUtils.clamp(pose.laneVelX * 0.085 + (pose.laneAccelX ?? 0) * 0.011, -1.25, 1.25)
      : 0;
    const targetVertMom = active && !pose.isGrounded ? THREE.MathUtils.clamp(pose.vy / 15, -1, 1) : 0;
    const targetImpactMom =
      active && pose.isGrounded ? THREE.MathUtils.clamp((1 - pose.squashY) * 3.8, 0, 1) : 0;
    const targetAvoidProx = active ? THREE.MathUtils.clamp(pose.obstacleProximity ?? 0, 0, 1) : 0;
    const targetAvoidSide = active ? THREE.MathUtils.clamp(pose.obstacleSideBias ?? 0, -1, 1) : 0;
    const targetDuck =
      active && (pose.isSliding || (pose.obstacleKind === 'slide' && targetAvoidProx > 0.22))
        ? Math.max(pose.isSliding ? 1.0 : 0, targetAvoidProx * 0.92)
        : 0;
    const targetHurdle =
      active && !pose.isGrounded && !pose.isSliding
        ? pose.obstacleKind === 'jump'
          ? Math.max(0.5, targetAvoidProx)
          : 0.25
        : 0;

    const targetBlend = active
      ? THREE.MathUtils.clamp(
          0.32 +
            targetSpeedNorm * 0.42 +
            Math.abs(targetLatMom) * 0.28 +
            targetAvoidProx * 0.44 +
            targetImpactMom * 0.25 +
            Math.abs(targetVertMom) * 0.22,
          0,
          0.94,
        )
      : 0;

    const dampRate = Math.min(26, Math.max(10, 14 + targetAvoidProx * 8));
    this.ikBlend = THREE.MathUtils.damp(this.ikBlend, targetBlend, 12, dt);
    this.ikSpeedNorm = THREE.MathUtils.damp(this.ikSpeedNorm, targetSpeedNorm, 8, dt);
    this.ikOverdrive = THREE.MathUtils.damp(this.ikOverdrive, targetOverdrive, 7, dt);
    this.ikLatMom = THREE.MathUtils.damp(this.ikLatMom, targetLatMom, 16, dt);
    this.ikVertMom = THREE.MathUtils.damp(this.ikVertMom, targetVertMom, 15, dt);
    this.ikImpactMom = THREE.MathUtils.damp(this.ikImpactMom, targetImpactMom, 18, dt);
    this.ikAvoidProx = THREE.MathUtils.damp(this.ikAvoidProx, targetAvoidProx, dampRate, dt);
    this.ikAvoidSide = THREE.MathUtils.damp(this.ikAvoidSide, targetAvoidSide, dampRate, dt);
    this.ikDuckFactor = THREE.MathUtils.damp(this.ikDuckFactor, targetDuck, 18, dt);
    this.ikHurdleFactor = THREE.MathUtils.damp(this.ikHurdleFactor, targetHurdle, 15, dt);

    if (this.ikBlend <= 0.004) return;

    this.bodyRig.updateMatrixWorld(true);
    _ikInvRig.copy(this.bodyRig.matrixWorld).invert();
    _ikRigBoneMat.multiplyMatrices(_ikInvRig, this.chestBone.matrixWorld);
    _ikRigBoneMat.decompose(_ikChestPos, _ikChestRigQ, _ikChestScale);
    _ikChestRigQInv.copy(_ikChestRigQ).invert();

    this.solveTwoBoneArmIK(-1, pose);
    this.solveTwoBoneArmIK(1, pose);
  }

  private solveTwoBoneArmIK(sideSign: -1 | 1, pose: RunnerPoseState): void {
    const isLeft = sideSign < 0;
    const armBone = isLeft ? this.leftArmBone : this.rightArmBone;
    const forearmBone = isLeft ? this.leftForearmBone : this.rightForearmBone;
    const handBone = isLeft ? this.leftHandBone : this.rightHandBone;
    const L1 = isLeft ? this.leftUpperLen : this.rightUpperLen;
    const L2 = isLeft ? this.leftForearmLen : this.rightForearmLen;
    const u2Rest = isLeft ? this.leftRestU2 : this.rightRestU2;
    const restArmQInv = isLeft ? this.leftRestArmQInv : this.rightRestArmQInv;

    _ikRigBoneMat.multiplyMatrices(_ikInvRig, armBone.matrixWorld);
    _ikRigBoneMat.decompose(_ikS, _ikArmQDummy, _ikDummyScale);

    _ikRigBoneMat.multiplyMatrices(_ikInvRig, forearmBone.matrixWorld);
    _ikRigBoneMat.decompose(_ikEfk, _ikArmQDummy, _ikDummyScale);

    _ikRigBoneMat.multiplyMatrices(_ikInvRig, handBone.matrixWorld);
    _ikRigBoneMat.decompose(_ikHfk, _ikQHandRigFk, _ikDummyScale);

    _ikT.copy(_ikHfk);
    _ikP.copy(_ikEfk);

    const swingRelZ = _ikHfk.z - _ikS.z;
    const forwardFactor = THREE.MathUtils.clamp(-swingRelZ / 0.25, 0, 1);

    // (A) Speed-Multiplier Biomechanics
    const tuckIn = (0.040 * this.ikSpeedNorm + 0.024 * this.ikOverdrive) * forwardFactor;
    _ikT.x += -sideSign * tuckIn;
    _ikT.y += forwardFactor * (0.048 * this.ikSpeedNorm + 0.026 * this.ikOverdrive);
    _ikT.z += swingRelZ * (0.16 * this.ikSpeedNorm + 0.12 * this.ikOverdrive);

    // (B) Body Momentum Constraints
    const trailingLat = THREE.MathUtils.clamp(-sideSign * this.ikLatMom, 0, 1.25);
    const leadingLat = THREE.MathUtils.clamp(sideSign * this.ikLatMom, 0, 1.25);
    _ikT.x += sideSign * (0.092 * trailingLat - 0.046 * leadingLat);
    _ikT.y += 0.054 * trailingLat;
    _ikT.z += 0.044 * trailingLat - 0.036 * leadingLat;

    const upMom = Math.max(0, this.ikVertMom);
    const downMom = Math.max(0, -this.ikVertMom);
    _ikT.y += 0.058 * upMom + 0.068 * downMom - 0.048 * this.ikImpactMom;
    _ikT.x += sideSign * (0.082 * downMom + 0.058 * this.ikImpactMom);
    _ikT.z -= 0.040 * upMom;

    // (C) Obstacle Avoidance Constraints
    const nearObs = THREE.MathUtils.clamp(sideSign * this.ikAvoidSide, 0, 1) * this.ikAvoidProx;
    const farObs = THREE.MathUtils.clamp(-sideSign * this.ikAvoidSide, 0, 1) * this.ikAvoidProx;
    _ikT.x += sideSign * (0.075 * farObs - 0.098 * nearObs);
    _ikT.y += 0.054 * nearObs + 0.044 * this.ikHurdleFactor;
    _ikT.z += 0.038 * farObs - 0.046 * nearObs;
    _ikT.x += sideSign * 0.048 * this.ikHurdleFactor;

    if (this.ikDuckFactor > 0.01) {
      _ikT.y -= 0.065 * this.ikDuckFactor;
      _ikT.z += (0.086 + 0.034 * this.ikSpeedNorm) * this.ikDuckFactor;
      _ikT.x += sideSign * 0.046 * this.ikDuckFactor;
      const shoulderCeilingY = _ikS.y - 0.035;
      if (_ikT.y > shoulderCeilingY) {
        _ikT.y = THREE.MathUtils.lerp(_ikT.y, shoulderCeilingY, this.ikDuckFactor);
      }
    }

    // (D) Torso Keep-Out Ellipsoid Constraint
    if (_ikT.y >= _ikChestPos.y - 0.34 && _ikT.y <= _ikChestPos.y + 0.18) {
      const dx = _ikT.x - _ikChestPos.x * 0.35;
      const dz = _ikT.z - (_ikChestPos.z - 0.006);
      const minRx = 0.172;
      const minRz = 0.128;
      const normSq = (dx * dx) / (minRx * minRx) + (dz * dz) / (minRz * minRz);
      if (normSq < 1.0 && normSq > 1e-6) {
        const push = 1.0 / Math.sqrt(normSq);
        _ikT.x = _ikChestPos.x * 0.35 + dx * push;
        _ikT.z = _ikChestPos.z - 0.006 + dz * push;
      }
    }

    // Dynamic Elbow Pole Steering
    _ikP.x +=
      sideSign *
      (-0.042 * this.ikSpeedNorm * forwardFactor -
        0.065 * nearObs +
        0.078 * (trailingLat + farObs) +
        0.068 * downMom);
    _ikP.z += 0.045 + 0.036 * this.ikSpeedNorm + 0.046 * this.ikDuckFactor;
    _ikP.y -= 0.028 * this.ikDuckFactor;

    _ikDirST.subVectors(_ikT, _ikS);
    const rawDist = _ikDirST.length();
    if (rawDist < 1e-5) return;

    const minReach = Math.max(0.150, Math.abs(L1 - L2) + 0.115);
    const hardMaxReach = (L1 + L2) * 0.985;
    let clampedDist = Math.max(minReach, rawDist);
    const softStart = hardMaxReach * 0.92;
    if (clampedDist > softStart) {
      const excess = clampedDist - softStart;
      const kneeRange = hardMaxReach - softStart;
      clampedDist = softStart + kneeRange * (1 - Math.exp(-excess / Math.max(1e-4, kneeRange)));
    }
    clampedDist = Math.min(hardMaxReach, clampedDist);

    _ikDirST.multiplyScalar(1 / rawDist);
    _ikT.copy(_ikS).addScaledVector(_ikDirST, clampedDist);

    const cosAngle = THREE.MathUtils.clamp(
      (L1 * L1 + clampedDist * clampedDist - L2 * L2) / (2 * L1 * clampedDist),
      -1,
      1,
    );
    const sinAngle = Math.sqrt(Math.max(0, 1 - cosAngle * cosAngle));

    _ikPoleDir.subVectors(_ikP, _ikS);
    _ikOrthoP.copy(_ikPoleDir).addScaledVector(_ikDirST, -_ikPoleDir.dot(_ikDirST));
    if (_ikOrthoP.lengthSq() < 1e-5) {
      _ikFallbackAxis.set(sideSign * 0.45, 0, 1).normalize();
      _ikOrthoP.copy(_ikFallbackAxis).addScaledVector(_ikDirST, -_ikFallbackAxis.dot(_ikDirST));
    }
    _ikOrthoP.normalize();

    _ikEik
      .copy(_ikS)
      .addScaledVector(_ikDirST, L1 * cosAngle)
      .addScaledVector(_ikOrthoP, L1 * sinAngle);

    _ikD1.subVectors(_ikEik, _ikS).normalize();
    _ikD2.subVectors(_ikT, _ikEik).normalize();

    _ikBasisX.crossVectors(_ikOrthoP, _ikDirST);
    if (_ikBasisX.lengthSq() < 1e-6) {
      _ikBasisX.set(1, 0, 0);
    } else {
      _ikBasisX.normalize();
    }
    _ikBasisY.copy(_ikD1);
    _ikBasisZ.crossVectors(_ikBasisX, _ikBasisY).normalize();
    _ikBasisMat.makeBasis(_ikBasisX, _ikBasisY, _ikBasisZ);

    _ikQArmRig.setFromRotationMatrix(_ikBasisMat).multiply(restArmQInv);
    _ikQArmLocalIk.multiplyQuaternions(_ikChestRigQInv, _ikQArmRig);

    _ikQArmRigInv.copy(_ikQArmRig).invert();
    _ikD2Local.copy(_ikD2).applyQuaternion(_ikQArmRigInv).normalize();
    _ikQForearmLocalIk.setFromUnitVectors(u2Rest, _ikD2Local);

    _ikQForearmRigIk.multiplyQuaternions(_ikQArmRig, _ikQForearmLocalIk);
    _ikQForearmRigIkInv.copy(_ikQForearmRigIk).invert();

    const knifePitch = (0.14 * this.ikSpeedNorm + 0.10 * this.ikOverdrive) * forwardFactor;
    const duckSweep = pose.isSliding ? -0.18 * this.ikDuckFactor : 0;
    const braceRoll = sideSign * (0.20 * nearObs - 0.14 * trailingLat);
    const braceYaw = -sideSign * (0.14 * nearObs + 0.12 * this.ikSpeedNorm * forwardFactor);
    _ikHandEuler.set(knifePitch + duckSweep, braceYaw, braceRoll, 'XYZ');
    _ikQHandOffset.setFromEuler(_ikHandEuler);

    _ikQHandRigIk.multiplyQuaternions(_ikQHandRigFk, _ikQHandOffset);
    _ikQHandLocalIk.multiplyQuaternions(_ikQForearmRigIkInv, _ikQHandRigIk);

    armBone.quaternion.slerp(_ikQArmLocalIk, this.ikBlend);
    forearmBone.quaternion.slerp(_ikQForearmLocalIk, this.ikBlend);
    handBone.quaternion.slerp(_ikQHandLocalIk, this.ikBlend * 0.88);
  }

  private sampleTerrainPlaneForFoot(
    worldX: number,
    worldZ: number,
    fallbackGroundY: number,
    sampleFn: ((x: number, z: number) => number) | undefined,
    outNormal: THREE.Vector3,
  ): FootTerrainSample {
    const rawCenter = sampleFn ? sampleFn(worldX, worldZ) : fallbackGroundY;
    if (rawCenter < -5) {
      outNormal.set(0, 1, 0);
      return { valid: false, groundY: rawCenter, normal: outNormal };
    }

    if (!sampleFn) {
      outNormal.set(0, 1, 0);
      return { valid: true, groundY: rawCenter, normal: outNormal };
    }

    const probeZ = 0.11;
    const probeX = 0.05;
    const hToe = sampleFn(worldX, worldZ - probeZ);
    const hHeel = sampleFn(worldX, worldZ + probeZ);
    const hLeft = sampleFn(worldX - probeX, worldZ);
    const hRight = sampleFn(worldX + probeX, worldZ);

    let dzSlope = 0;
    if (hToe > -5 && hHeel > -5 && Math.abs(hToe - hHeel) < 0.24) {
      dzSlope = (hToe - hHeel) / (probeZ * 2);
    } else if (hToe > -5 && Math.abs(hToe - rawCenter) < 0.15) {
      dzSlope = (hToe - rawCenter) / probeZ;
    } else if (hHeel > -5 && Math.abs(rawCenter - hHeel) < 0.15) {
      dzSlope = (rawCenter - hHeel) / probeZ;
    }

    let dxSlope = 0;
    if (hLeft > -5 && hRight > -5 && Math.abs(hLeft - hRight) < 0.14) {
      dxSlope = (hLeft - hRight) / (probeX * 2);
    }

    outNormal.set(
      THREE.MathUtils.clamp(dxSlope, -0.55, 0.55),
      1.0,
      THREE.MathUtils.clamp(dzSlope, -0.75, 0.75),
    ).normalize();

    // Average contact plane over footprint so sole sits smoothly at ramp transitions
    let sumY = rawCenter * 2.0;
    let weightSum = 2.0;
    if (hToe > -5 && Math.abs(hToe - rawCenter) < 0.16) {
      sumY += hToe;
      weightSum += 1.0;
    }
    if (hHeel > -5 && Math.abs(hHeel - rawCenter) < 0.16) {
      sumY += hHeel;
      weightSum += 1.0;
    }

    return { valid: true, groundY: sumY / weightSum, normal: outNormal };
  }

  private computeFootTarget(
    pose: RunnerPoseState,
    dt: number,
    state: FootIKSideState,
    sample: FootTerrainSample,
    hipRig: THREE.Vector3,
    ankleFkRig: THREE.Vector3,
    ankleFkWorld: THREE.Vector3,
    footRigQuatFk: THREE.Quaternion,
    scaleY: number,
    outTargetWorld: THREE.Vector3,
  ): { ikWeight: number; alignWeight: number; desiredAnkleRigY: number } {
    const valid = sample.valid;
    if (valid) {
      if (!state.hasGroundSample) {
        state.smoothedGroundY = sample.groundY;
        state.smoothedNormal.copy(sample.normal);
        state.hasGroundSample = true;
      } else {
        // Track continuous ramps/decks immediately (zero lag); only smooth sharp deck-edge step drops
        const deltaY = sample.groundY - state.smoothedGroundY;
        if (Math.abs(deltaY) < 0.18 || !pose.isGrounded) {
          state.smoothedGroundY = sample.groundY;
        } else {
          state.smoothedGroundY = THREE.MathUtils.damp(state.smoothedGroundY, sample.groundY, 48, dt);
        }
        const nAlpha = 1 - Math.exp(-26 * dt);
        state.smoothedNormal.lerp(sample.normal, nAlpha).normalize();
      }
    } else {
      state.hasGroundSample = false;
      state.smoothedNormal.set(0, 1, 0);
    }

    _legEulerScratch.setFromQuaternion(footRigQuatFk, 'XYZ');
    const rawPitchMargin = Math.min(0.022, Math.sin(Math.min(0.9, Math.abs(_legEulerScratch.x))) * 0.026);
    const pitchMargin = rawPitchMargin * (1 - state.alignWeight * 0.85);
    const worldSoleHeight = (this.footSoleOffset + pitchMargin) * scaleY;
    const groundedAnkleWorldY = state.smoothedGroundY + worldSoleHeight;
    const clearance = valid ? ankleFkWorld.y - groundedAnkleWorldY : 999;

    outTargetWorld.copy(ankleFkWorld);

    let targetIk = 0;
    let targetAlign = 0;

    if (pose.showcaseMode) {
      // Stationary showcase podium: anti-slide XZ pin + flush floor lock
      if (valid) {
        if (!state.pinned) {
          state.pinned = true;
          state.pinWorldX = ankleFkWorld.x;
          state.pinWorldZ = ankleFkWorld.z;
        }
        outTargetWorld.set(
          THREE.MathUtils.lerp(ankleFkWorld.x, state.pinWorldX, 0.72),
          groundedAnkleWorldY,
          THREE.MathUtils.lerp(ankleFkWorld.z, state.pinWorldZ, 0.72),
        );
        targetIk = 1.0;
        targetAlign = 1.0;
      }
    } else if (pose.isSliding) {
      state.pinned = false;
      state.pinWeight = 0;
      if (valid && clearance < 0.14) {
        const minSlideAnkleY = state.smoothedGroundY + (this.footSoleOffset + 0.015) * scaleY;
        if (ankleFkWorld.y < minSlideAnkleY) {
          outTargetWorld.y = minSlideAnkleY;
          targetIk = 1.0;
        } else {
          targetIk = smoothstep01((0.14 - clearance) / 0.14) * 0.45;
        }
        targetAlign = smoothstep01((0.14 - clearance) / 0.14) * 0.65;
      }
    } else if (!pose.isGrounded) {
      // Airborne jump / fall: prevent terrain clipping + gentle pre-landing anticipation
      state.pinned = false;
      state.pinWeight = 0;
      if (valid) {
        if (clearance < 0.01) {
          outTargetWorld.y = groundedAnkleWorldY;
          targetIk = 1.0;
          targetAlign = 0.88;
        } else if (pose.vy <= 1.0 && clearance < 0.68) {
          const approach = smoothstep01((0.68 - clearance) / 0.60);
          const descBias = THREE.MathUtils.clamp((1.0 - pose.vy) / 8.0, 0.25, 1.0);
          const reach = approach * descBias;
          outTargetWorld.y = Math.max(
            groundedAnkleWorldY,
            THREE.MathUtils.lerp(ankleFkWorld.y, groundedAnkleWorldY + clearance * 0.22, reach * 0.65),
          );
          targetIk = Math.min(0.92, reach * 0.88);
          targetAlign = Math.min(0.95, reach);
        }
      }
    } else {
      // Active high-speed running: preserve exact FK stride XZ (zero world-Z drag!)
      // and smoothly snap/clamp vertical contact & terrain slope alignment.
      state.pinned = false;
      state.pinWeight = 0;
      if (valid) {
        const stance = 1 - smoothstep01(clearance / 0.20);
        const landingBoost = Math.max(
          this.footLandingTimer > 0 ? (this.footLandingTimer / 0.22) * 0.65 : 0,
          THREE.MathUtils.clamp((0.97 - pose.squashY) * 6.0, 0, 0.7),
        );
        const effectiveStance = Math.min(1.0, Math.max(stance, landingBoost * (1 - smoothstep01(clearance / 0.32))));

        outTargetWorld.y = Math.max(
          groundedAnkleWorldY,
          THREE.MathUtils.lerp(ankleFkWorld.y, groundedAnkleWorldY, effectiveStance),
        );

        // If ankle would penetrate terrain (e.g., steep uphill ramp), enforce full contact blend smoothly
        const penetrationBlend = clearance < 0 ? THREE.MathUtils.clamp(-clearance / 0.04, 0, 1) : 0;
        targetIk = Math.max(effectiveStance, penetrationBlend);
        targetAlign = Math.max(stance * 0.94, landingBoost * 0.85);
      }
    }

    const ikDamp = targetIk > state.ikWeight ? 42 : 22;
    const alignDamp = targetAlign > state.alignWeight ? 34 : 18;
    state.ikWeight = THREE.MathUtils.damp(state.ikWeight, targetIk, ikDamp, dt);
    state.alignWeight = THREE.MathUtils.damp(state.alignWeight, targetAlign, alignDamp, dt);

    // Guarantee anti-penetration floor lock continuously without discontinuous pops
    if (valid && !pose.isSliding && clearance < 0) {
      const requiredWeight = smoothstep01(-clearance / 0.025);
      state.ikWeight = Math.max(state.ikWeight, requiredWeight);
    }

    const rigTargetY = (outTargetWorld.y - this.root.position.y) / Math.max(0.5, scaleY);
    const desiredAnkleRigY = THREE.MathUtils.lerp(ankleFkRig.y, rigTargetY, state.ikWeight);
    void hipRig;

    return {
      ikWeight: state.ikWeight,
      alignWeight: state.alignWeight,
      desiredAnkleRigY,
    };
  }

  private applyFootIKSystem(pose: RunnerPoseState, dt: number, groundHeightBelow: number): void {
    // Detect jump touchdown or teleport/reset
    if (!this.footIkWasGrounded && pose.isGrounded) {
      this.footLandingTimer = 0.22;
    } else if (this.footLandingTimer > 0) {
      this.footLandingTimer = Math.max(0, this.footLandingTimer - dt);
    }
    this.footIkWasGrounded = pose.isGrounded;

    if (Math.abs(this.root.position.z - this.lastFootIkRootZ) > 2.5) {
      this.leftFootIkState.pinned = false;
      this.rightFootIkState.pinned = false;
      this.leftFootIkState.pinWeight = 0;
      this.rightFootIkState.pinWeight = 0;
      this.leftFootIkState.hasGroundSample = false;
      this.rightFootIkState.hasGroundSample = false;
      this.ikPelvisDeltaY = 0;
    }
    this.lastFootIkRootZ = this.root.position.z;

    this.root.updateMatrixWorld(true);
    _legRigMat.copy(this.bodyRig.matrixWorld);
    _legInvRig.copy(_legRigMat).invert();

    const scaleY = this.bodyRig.scale.y || 1;

    // Extract FK leg poses in both rig space & world space
    _legRigBoneMat.multiplyMatrices(_legInvRig, this.leftThighBone.matrixWorld);
    _legRigBoneMat.decompose(_legHipRigL, _legDummyQuat, _legDummyScale);
    _legRigBoneMat.multiplyMatrices(_legInvRig, this.leftShinBone.matrixWorld);
    _legRigBoneMat.decompose(_legKneeFkRigL, _legDummyQuat, _legDummyScale);
    _legRigBoneMat.multiplyMatrices(_legInvRig, this.leftFootBone.matrixWorld);
    _legRigBoneMat.decompose(_legAnkleFkRigL, _legQFootRigFkL, _legDummyScale);
    this.leftFootBone.getWorldPosition(_legAnkleFkWorldL);

    _legRigBoneMat.multiplyMatrices(_legInvRig, this.rightThighBone.matrixWorld);
    _legRigBoneMat.decompose(_legHipRigR, _legDummyQuat, _legDummyScale);
    _legRigBoneMat.multiplyMatrices(_legInvRig, this.rightShinBone.matrixWorld);
    _legRigBoneMat.decompose(_legKneeFkRigR, _legDummyQuat, _legDummyScale);
    _legRigBoneMat.multiplyMatrices(_legInvRig, this.rightFootBone.matrixWorld);
    _legRigBoneMat.decompose(_legAnkleFkRigR, _legQFootRigFkR, _legDummyScale);
    this.rightFootBone.getWorldPosition(_legAnkleFkWorldR);

    const sampleL = this.sampleTerrainPlaneForFoot(
      _legAnkleFkWorldL.x,
      _legAnkleFkWorldL.z,
      groundHeightBelow,
      pose.sampleTerrainHeight,
      _legSampleNormalL,
    );
    const sampleR = this.sampleTerrainPlaneForFoot(
      _legAnkleFkWorldR.x,
      _legAnkleFkWorldR.z,
      groundHeightBelow,
      pose.sampleTerrainHeight,
      _legSampleNormalR,
    );

    const resL = this.computeFootTarget(
      pose,
      dt,
      this.leftFootIkState,
      sampleL,
      _legHipRigL,
      _legAnkleFkRigL,
      _legAnkleFkWorldL,
      _legQFootRigFkL,
      scaleY,
      _legTargetWorldL,
    );
    const resR = this.computeFootTarget(
      pose,
      dt,
      this.rightFootIkState,
      sampleR,
      _legHipRigR,
      _legAnkleFkRigR,
      _legAnkleFkWorldR,
      _legQFootRigFkR,
      scaleY,
      _legTargetWorldR,
    );

    _legTargetRigL.copy(_legTargetWorldL).applyMatrix4(_legInvRig);
    _legTargetRigR.copy(_legTargetWorldR).applyMatrix4(_legInvRig);

    // Smooth pelvis grounding compensation on slopes/landings so stance knees never lock straight
    let targetPelvisDelta = 0;
    if (!pose.isSliding) {
      const maxReachL = (this.leftThighLen + this.leftShinLen) * 0.985;
      const maxReachR = (this.rightThighLen + this.rightShinLen) * 0.985;
      let neededDrop = 0;

      if (resL.ikWeight > 0.2) {
        const dL = _legHipRigL.distanceTo(_legTargetRigL);
        if (dL > maxReachL) {
          neededDrop = Math.max(neededDrop, (dL - maxReachL) * resL.ikWeight);
        }
      }
      if (resR.ikWeight > 0.2) {
        const dR = _legHipRigR.distanceTo(_legTargetRigR);
        if (dR > maxReachR) {
          neededDrop = Math.max(neededDrop, (dR - maxReachR) * resR.ikWeight);
        }
      }

      if (pose.isGrounded && !pose.showcaseMode && this.footLandingTimer > 0) {
        const impactDrop = (this.footLandingTimer / 0.22) * 0.048;
        neededDrop = Math.max(neededDrop, impactDrop);
      }

      targetPelvisDelta = -THREE.MathUtils.clamp(neededDrop, 0, 0.18);
    }

    this.ikPelvisDeltaY = THREE.MathUtils.damp(this.ikPelvisDeltaY, targetPelvisDelta, 28, dt);
    if (Math.abs(this.ikPelvisDeltaY) > 1e-4) {
      this.hipsBone.position.y += this.ikPelvisDeltaY;
      this.bodyRig.updateMatrixWorld(true);
    }

    const hasLeftSolve = resL.ikWeight > 0.004 || resL.alignWeight > 0.004;
    const hasRightSolve = resR.ikWeight > 0.004 || resR.alignWeight > 0.004;

    if (hasLeftSolve || hasRightSolve) {
      _legRigBoneMat.multiplyMatrices(_legInvRig, this.hipsBone.matrixWorld);
      _legRigBoneMat.decompose(_legHipsPosRig, _legHipsRigQ, _legHipsScaleRig);
      _legHipsRigQInv.copy(_legHipsRigQ).invert();
      _legNormalMat3.setFromMatrix4(_legInvRig);

      if (hasLeftSolve) {
        _legRigBoneMat.multiplyMatrices(_legInvRig, this.leftThighBone.matrixWorld);
        _legRigBoneMat.decompose(_legHipRigL, _legDummyQuat, _legDummyScale);
        this.solveTwoBoneLegIK(
          -1,
          _legHipRigL,
          _legKneeFkRigL,
          _legAnkleFkRigL,
          _legTargetRigL,
          _legQFootRigFkL,
          this.leftFootIkState.smoothedNormal,
          resL.ikWeight,
          resL.alignWeight,
        );
      }

      if (hasRightSolve) {
        _legRigBoneMat.multiplyMatrices(_legInvRig, this.rightThighBone.matrixWorld);
        _legRigBoneMat.decompose(_legHipRigR, _legDummyQuat, _legDummyScale);
        this.solveTwoBoneLegIK(
          1,
          _legHipRigR,
          _legKneeFkRigR,
          _legAnkleFkRigR,
          _legTargetRigR,
          _legQFootRigFkR,
          this.rightFootIkState.smoothedNormal,
          resR.ikWeight,
          resR.alignWeight,
        );
      }
    }

    if (this.debugFootIkVisible) {
      this.bodyRig.updateMatrixWorld(true);
      this.updateFootIkDebugVisuals(
        this.leftFootDebug,
        this.leftFootBone,
        this.leftFootIkState,
        sampleL,
        _legAnkleFkWorldL,
        _legTargetWorldL,
        resL.ikWeight,
        scaleY,
      );
      this.updateFootIkDebugVisuals(
        this.rightFootDebug,
        this.rightFootBone,
        this.rightFootIkState,
        sampleR,
        _legAnkleFkWorldR,
        _legTargetWorldR,
        resR.ikWeight,
        scaleY,
      );
    }
  }

  public setFootIkDebugVisible(visible: boolean): void {
    this.debugFootIkVisible = visible;
    if (visible && (!this.leftFootDebug || !this.rightFootDebug)) {
      this.initFootIkDebugVisuals();
    }
    this.debugFootIkGroup.visible = visible;
  }

  public isFootIkDebugVisible(): boolean {
    return this.debugFootIkVisible;
  }

  private initFootIkDebugVisuals(): void {
    if (this.leftFootDebug && this.rightFootDebug) return;

    const targetOctGeo = new THREE.OctahedronGeometry(0.052, 0);
    const soleWireGeo = new THREE.BoxGeometry(0.115, 0.024, 0.225);
    const groundRingGeo = new THREE.RingGeometry(0.068, 0.095, 14);
    groundRingGeo.rotateX(-Math.PI / 2);
    const pinGeo = new THREE.OctahedronGeometry(0.032, 0);
    const ankleBoxGeo = new THREE.BoxGeometry(0.052, 0.052, 0.052);
    this.debugSharedGeos.push(targetOctGeo, soleWireGeo, groundRingGeo, pinGeo, ankleBoxGeo);

    const pinMat = new THREE.MeshBasicMaterial({
      color: 0xe879f9,
      wireframe: true,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
    });
    const solvedMat = new THREE.MeshBasicMaterial({
      color: 0xa3e635,
      wireframe: true,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      depthWrite: false,
    });
    this.debugSharedMats.push(pinMat, solvedMat);

    const buildSide = (sideColor: number, namePrefix: string): FootIKDebugSide => {
      const group = new THREE.Group();
      group.name = `${namePrefix}FootIKDebug`;

      const targetMat = new THREE.MeshBasicMaterial({
        color: sideColor,
        wireframe: true,
        transparent: true,
        opacity: 0.96,
        depthTest: false,
        depthWrite: false,
      });
      const soleMat = new THREE.MeshBasicMaterial({
        color: sideColor,
        wireframe: true,
        transparent: true,
        opacity: 0.85,
        depthTest: false,
        depthWrite: false,
      });
      const groundRingMat = new THREE.MeshBasicMaterial({
        color: 0x34d399,
        wireframe: true,
        transparent: true,
        opacity: 0.92,
        depthTest: false,
        depthWrite: false,
      });
      const lineMat = new THREE.LineBasicMaterial({
        color: sideColor,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
        depthWrite: false,
      });
      this.debugSharedMats.push(targetMat, soleMat, groundRingMat, lineMat);

      const targetMarker = new THREE.Mesh(targetOctGeo, targetMat);
      targetMarker.renderOrder = 60;
      targetMarker.frustumCulled = false;

      const solePlaneCage = new THREE.Mesh(soleWireGeo, soleMat);
      solePlaneCage.renderOrder = 58;
      solePlaneCage.frustumCulled = false;

      const groundRing = new THREE.Mesh(groundRingGeo, groundRingMat);
      groundRing.renderOrder = 57;
      groundRing.frustumCulled = false;

      const pinStake = new THREE.Mesh(pinGeo, pinMat);
      pinStake.renderOrder = 61;
      pinStake.frustumCulled = false;

      const solvedAnkleBox = new THREE.Mesh(ankleBoxGeo, solvedMat);
      solvedAnkleBox.renderOrder = 59;
      solvedAnkleBox.frustumCulled = false;

      const linePositions = new Float32Array(18);
      const lineGeo = new THREE.BufferGeometry();
      const linePosAttr = new THREE.BufferAttribute(linePositions, 3);
      linePosAttr.setUsage(THREE.DynamicDrawUsage);
      lineGeo.setAttribute('position', linePosAttr);
      this.debugSharedGeos.push(lineGeo);

      const lines = new THREE.LineSegments(lineGeo, lineMat);
      lines.renderOrder = 59;
      lines.frustumCulled = false;

      group.add(targetMarker, solePlaneCage, groundRing, pinStake, solvedAnkleBox, lines);
      this.debugFootIkGroup.add(group);

      return {
        group,
        targetMarker,
        solePlaneCage,
        groundRing,
        groundRingMat,
        pinStake,
        solvedAnkleBox,
        lines,
        linePosAttr,
        linePositions,
      };
    };

    this.leftFootDebug = buildSide(0x22d3ee, 'Left');
    this.rightFootDebug = buildSide(0xfb923c, 'Right');
  }

  private updateFootIkDebugVisuals(
    dbg: FootIKDebugSide | null,
    footBone: THREE.Bone,
    state: FootIKSideState,
    sample: FootTerrainSample,
    ankleFkWorld: THREE.Vector3,
    targetWorld: THREE.Vector3,
    ikWeight: number,
    scaleY: number,
  ): void {
    if (!dbg) return;

    footBone.getWorldPosition(_dbgSolvedAnkleWorld);
    footBone.getWorldQuaternion(_dbgFootWorldQuat);

    dbg.targetMarker.position.copy(targetWorld);
    const activePulse = 0.85 + ikWeight * 0.35;
    dbg.targetMarker.scale.setScalar(activePulse);

    dbg.solvedAnkleBox.position.copy(_dbgSolvedAnkleWorld);
    dbg.solvedAnkleBox.quaternion.copy(_dbgFootWorldQuat);

    const norm = state.hasGroundSample ? state.smoothedNormal : sample.normal;
    _dbgBasisY.copy(norm).normalize();
    if (_dbgBasisY.y < 0.2) _dbgBasisY.set(0, 1, 0);
    _dbgFwd.set(0, 0, -1).applyQuaternion(_dbgFootWorldQuat);
    _dbgFwd.addScaledVector(_dbgBasisY, -_dbgFwd.dot(_dbgBasisY));
    if (_dbgFwd.lengthSq() < 1e-5) {
      _dbgFwd.set(0, 0, -1);
      _dbgFwd.addScaledVector(_dbgBasisY, -_dbgFwd.dot(_dbgBasisY));
    }
    _dbgFwd.normalize();
    _dbgBasisZ.copy(_dbgFwd).negate();
    _dbgBasisX.crossVectors(_dbgBasisY, _dbgBasisZ).normalize();
    _dbgBasisZ.crossVectors(_dbgBasisX, _dbgBasisY).normalize();
    _dbgRotMat.makeBasis(_dbgBasisX, _dbgBasisY, _dbgBasisZ);
    dbg.solePlaneCage.quaternion.setFromRotationMatrix(_dbgRotMat);

    const contactY = sample.valid ? sample.groundY : targetWorld.y - this.footSoleOffset * scaleY;
    dbg.solePlaneCage.position.set(
      targetWorld.x,
      contactY + 0.012 * scaleY,
      targetWorld.z,
    );
    dbg.solePlaneCage.visible = sample.valid || ikWeight > 0.02;

    if (sample.valid) {
      dbg.groundRing.visible = true;
      dbg.groundRing.position.set(targetWorld.x, sample.groundY + 0.005, targetWorld.z);
      dbg.groundRing.quaternion.copy(dbg.solePlaneCage.quaternion);
      dbg.groundRingMat.color.setHex(ikWeight > 0.35 ? 0x34d399 : 0x94a3b8);
    } else {
      dbg.groundRing.visible = false;
    }

    if (state.pinned && state.pinWeight > 0.08 && sample.valid) {
      dbg.pinStake.visible = true;
      dbg.pinStake.position.set(state.pinWorldX, state.smoothedGroundY + 0.036, state.pinWorldZ);
    } else {
      dbg.pinStake.visible = false;
    }

    const lp = dbg.linePositions;
    lp[0] = ankleFkWorld.x;
    lp[1] = ankleFkWorld.y;
    lp[2] = ankleFkWorld.z;
    lp[3] = targetWorld.x;
    lp[4] = targetWorld.y;
    lp[5] = targetWorld.z;

    if (sample.valid) {
      lp[6] = targetWorld.x;
      lp[7] = targetWorld.y;
      lp[8] = targetWorld.z;
      lp[9] = targetWorld.x;
      lp[10] = sample.groundY;
      lp[11] = targetWorld.z;

      lp[12] = targetWorld.x;
      lp[13] = sample.groundY;
      lp[14] = targetWorld.z;
      lp[15] = targetWorld.x + sample.normal.x * 0.22;
      lp[16] = sample.groundY + sample.normal.y * 0.22;
      lp[17] = targetWorld.z + sample.normal.z * 0.22;
    } else {
      lp[6] = lp[0];
      lp[7] = lp[1];
      lp[8] = lp[2];
      lp[9] = lp[3];
      lp[10] = lp[4];
      lp[11] = lp[5];
      lp[12] = lp[3];
      lp[13] = lp[4];
      lp[14] = lp[5];
      lp[15] = lp[3];
      lp[16] = lp[4];
      lp[17] = lp[5];
    }
    dbg.linePosAttr.needsUpdate = true;
  }

  private solveTwoBoneLegIK(
    sideSign: -1 | 1,
    hipRig: THREE.Vector3,
    kneeFkRig: THREE.Vector3,
    ankleFkRig: THREE.Vector3,
    targetRig: THREE.Vector3,
    footRigQuatFk: THREE.Quaternion,
    worldNormal: THREE.Vector3,
    ikWeight: number,
    alignWeight: number,
  ): void {
    const isLeft = sideSign < 0;
    const thighBone = isLeft ? this.leftThighBone : this.rightThighBone;
    const shinBone = isLeft ? this.leftShinBone : this.rightShinBone;
    const footBone = isLeft ? this.leftFootBone : this.rightFootBone;
    const L1 = isLeft ? this.leftThighLen : this.rightThighLen;
    const L2 = isLeft ? this.leftShinLen : this.rightShinLen;

    _legWorldPos.copy(ankleFkRig).lerp(targetRig, ikWeight);

    _legDirHA.subVectors(_legWorldPos, hipRig);
    const rawDist = _legDirHA.length();
    if (rawDist < 1e-5) return;

    const minReach = Math.max(0.20, Math.abs(L1 - L2) + 0.14);
    const hardMaxReach = (L1 + L2) * 0.992;
    let clampedDist = Math.max(minReach, rawDist);
    const softStart = hardMaxReach * 0.93;
    if (clampedDist > softStart) {
      const excess = clampedDist - softStart;
      const kneeRange = hardMaxReach - softStart;
      clampedDist = softStart + kneeRange * (1 - Math.exp(-excess / Math.max(1e-4, kneeRange)));
    }
    clampedDist = Math.min(hardMaxReach, clampedDist);

    _legDirHA.multiplyScalar(1 / rawDist);
    _legWorldPos.copy(hipRig).addScaledVector(_legDirHA, clampedDist);

    const cosAngle = THREE.MathUtils.clamp(
      (L1 * L1 + clampedDist * clampedDist - L2 * L2) / (2 * L1 * clampedDist),
      -1,
      1,
    );
    const sinAngle = Math.sqrt(Math.max(0, 1 - cosAngle * cosAngle));

    // Deterministic forward (-Z) knee pole blend so knees NEVER flip or twist backward
    _legPoleDir.subVectors(kneeFkRig, hipRig).normalize();
    _legPoleDir.z -= 0.72;
    _legPoleDir.x += sideSign * 0.05;
    _legOrthoP.copy(_legPoleDir).addScaledVector(_legDirHA, -_legPoleDir.dot(_legDirHA));
    if (_legOrthoP.lengthSq() < 1e-5 || _legOrthoP.z > -0.10) {
      _legFallbackPole.set(sideSign * 0.06, 0.22, -1).normalize();
      _legOrthoP.copy(_legFallbackPole).addScaledVector(_legDirHA, -_legFallbackPole.dot(_legDirHA));
    }
    _legOrthoP.normalize();

    _legKneeIk
      .copy(hipRig)
      .addScaledVector(_legDirHA, L1 * cosAngle)
      .addScaledVector(_legOrthoP, L1 * sinAngle);

    _legD1.subVectors(_legKneeIk, hipRig).normalize();
    _legD2.subVectors(_legWorldPos, _legKneeIk).normalize();

    // Identity-aligned Thigh basis: +Y = -thighDir, +Z = -kneePole, +X = +Y x +Z
    _legBasisY.copy(_legD1).negate();
    _legBasisZ.copy(_legOrthoP).addScaledVector(_legD1, -_legOrthoP.dot(_legD1));
    if (_legBasisZ.lengthSq() < 1e-6) {
      _legBasisZ.set(0, 0, -1);
    }
    _legBasisZ.negate().normalize();
    _legBasisX.crossVectors(_legBasisY, _legBasisZ).normalize();
    _legBasisZ.crossVectors(_legBasisX, _legBasisY).normalize();
    _legBasisMat.makeBasis(_legBasisX, _legBasisY, _legBasisZ);

    _legQThighRig.setFromRotationMatrix(_legBasisMat);
    _legQThighLocalIk.multiplyQuaternions(_legHipsRigQInv, _legQThighRig);

    _legQThighRigInv.copy(_legQThighRig).invert();
    _legD2Local.copy(_legD2).applyQuaternion(_legQThighRigInv).normalize();
    _legQShinLocalIk.setFromUnitVectors(_legDownAxis, _legD2Local);

    thighBone.quaternion.slerp(_legQThighLocalIk, ikWeight);
    shinBone.quaternion.slerp(_legQShinLocalIk, ikWeight);

    // Terrain-normal Foot alignment in rig space (preserves natural runner yaw, aligns pitch & roll)
    _legTerrainNormalRig.copy(worldNormal).applyMatrix3(_legNormalMat3).normalize();
    if (_legTerrainNormalRig.y < 0.2) {
      _legTerrainNormalRig.set(0, 1, 0);
    }
    _legFootFwd.set(0, 0, -1).applyQuaternion(footRigQuatFk);
    _legFootFwd.addScaledVector(_legTerrainNormalRig, -_legFootFwd.dot(_legTerrainNormalRig));
    if (_legFootFwd.lengthSq() < 1e-5) {
      _legFootFwd.set(0, 0, -1);
      _legFootFwd.addScaledVector(_legTerrainNormalRig, -_legFootFwd.dot(_legTerrainNormalRig));
    }
    _legFootFwd.normalize();

    _legBasisZ.copy(_legFootFwd).negate();
    _legBasisX.crossVectors(_legTerrainNormalRig, _legBasisZ).normalize();
    _legBasisZ.crossVectors(_legBasisX, _legTerrainNormalRig).normalize();
    _legBasisMat.makeBasis(_legBasisX, _legTerrainNormalRig, _legBasisZ);
    _legQFootRigAligned.setFromRotationMatrix(_legBasisMat);

    _legQFootRigTarget.copy(footRigQuatFk).slerp(_legQFootRigAligned, alignWeight);
    _legQThighRig.multiplyQuaternions(_legHipsRigQ, thighBone.quaternion);
    _legQShinRigIk.multiplyQuaternions(_legQThighRig, shinBone.quaternion);
    _legQShinRigIkInv.copy(_legQShinRigIk).invert();
    _legQFootLocalTarget.multiplyQuaternions(_legQShinRigIkInv, _legQFootRigTarget);
    footBone.quaternion.copy(_legQFootLocalTarget);
  }

  public dispose(): void {
    this.mixer.stopAllAction();
    this.disposeGroupChildren(this.chestCosmeticGroup, true);
    this.disposeGroupChildren(this.headCosmeticGroup, true);
    this.disposeGroupChildren(this.chestAccessoryGroup, false);
    this.disposeGroupChildren(this.headAccessoryGroup, false);
    this.disposeGroupChildren(this.hipsAccessoryGroup, false);
    this.disposeGroupChildren(this.leftShinAccessoryGroup, false);
    this.disposeGroupChildren(this.rightShinAccessoryGroup, false);
    this.disposeGroupChildren(this.hairGroup, false);
    for (const mat of this.archetypeMaterials) {
      mat.dispose();
    }
    this.archetypeMaterials.length = 0;

    this.facialGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mat = obj.material;
        if (
          mat !== this.hairMat &&
          mat !== this.skinMat &&
          mat !== this.primaryMat &&
          mat !== this.secondaryMat &&
          mat !== this.accentMat &&
          mat !== this.visorMat &&
          mat !== this.irisMat
        ) {
          if (Array.isArray(mat)) {
            mat.forEach((m) => m.dispose());
          } else {
            mat.dispose();
          }
        }
      }
    });

    for (const sm of this.skinnedMeshes) {
      sm.geometry.dispose();
    }
    this.skeleton.dispose();

    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh && !(obj instanceof THREE.SkinnedMesh)) {
        obj.geometry.dispose();
      }
    });

    this.fabricBumpTex?.dispose();
    this.primaryMat.dispose();
    this.secondaryMat.dispose();
    this.accentMat.dispose();
    this.visorMat.dispose();
    this.skinMat.dispose();
    this.hairMat.dispose();
    this.soleMat.dispose();
    this.irisMat.dispose();
    (this.shieldBubble.material as THREE.Material).dispose();
    (this.shieldInnerShell.material as THREE.Material).dispose();
    (this.magnetRingA.material as THREE.Material).dispose();
    for (const child of this.multiplierAuraGroup.children) {
      if (child instanceof THREE.Mesh) {
        (child.material as THREE.Material).dispose();
      }
    }
    (this.chronosRingA.material as THREE.Material).dispose();
    (this.chronosRingB.material as THREE.Material).dispose();
    (this.contactShadow.material as THREE.Material).dispose();

    for (const geo of this.debugSharedGeos) {
      geo.dispose();
    }
    this.debugSharedGeos.length = 0;
    for (const mat of this.debugSharedMats) {
      mat.dispose();
    }
    this.debugSharedMats.length = 0;
    this.leftFootDebug = null;
    this.rightFootDebug = null;
  }
}
