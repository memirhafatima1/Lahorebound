import * as THREE from 'three';

export const OVERDRIVE_SPEED_THRESHOLD = 2.05;
const MAX_SPARKS = 180;
const MAX_WAKES = 54;

interface SparkSlot {
  active: boolean;
  life: number;
  maxLife: number;
  px: number;
  py: number;
  pz: number;
  vx: number;
  vy: number;
  vz: number;
  length: number;
  radius: number;
  bounceY: number;
  baseColor: THREE.Color;
}

interface WakeSlot {
  active: boolean;
  life: number;
  maxLife: number;
  px: number;
  py: number;
  pz: number;
  vx: number;
  vy: number;
  vz: number;
  length: number;
  width: number;
  roll: number;
  baseColor: THREE.Color;
}

export interface OverdriveTrailUpdateParams {
  playerX: number;
  playerY: number;
  playerZ: number;
  groundY: number;
  speedMultiplier: number;
  speedBoostTimer: number;
  chronosTimer: number;
  laneVelX: number;
  isGrounded: boolean;
  isSliding: boolean;
  isCarnivalSkin: boolean;
}

const _dummy = new THREE.Object3D();
const _velDir = new THREE.Vector3(0, 0, 1);
const _forwardZ = new THREE.Vector3(0, 0, 1);
const _sparkQuat = new THREE.Quaternion();
const _hdrColor = new THREE.Color();

/**
 * Computes normalized [0..1] overdrive trail intensity once the runner hits
 * OVERDRIVE_SPEED_THRESHOLD or an active turbo boost pad (damped out during Chronos).
 */
export function computeOverdriveIntensity(
  speedMultiplier: number,
  speedBoostTimer: number,
  chronosTimer: number,
): number {
  if (chronosTimer > 0) return 0;
  const boostActive = speedBoostTimer > 0;
  if (!boostActive && speedMultiplier < OVERDRIVE_SPEED_THRESHOLD) {
    return 0;
  }
  const speedRatio = THREE.MathUtils.clamp(
    (speedMultiplier - OVERDRIVE_SPEED_THRESHOLD) / 1.05,
    0,
    1,
  );
  const boostFloor = boostActive ? 0.54 : 0;
  const speedBase = speedMultiplier >= OVERDRIVE_SPEED_THRESHOLD ? 0.24 + speedRatio * 0.76 : 0;
  return THREE.MathUtils.clamp(Math.max(boostFloor, speedBase), 0, 1);
}

/**
 * Creates a tapered asymmetric diamond-needle geometry oriented along +Z
 * (sharp tip at -Z leading toward runner, elongated luminous tail trailing +Z).
 */
function createSparkNeedleGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const r = 0.032;
  const vertices = new Float32Array([
    0, 0, -0.16, // 0: sharp front tip
    r, 0, 0.04, // 1: right
    0, r, 0.04, // 2: top
    -r, 0, 0.04, // 3: left
    0, -r, 0.04, // 4: bottom
    0, 0, 0.72, // 5: long aerodynamic tail
  ]);
  const indices = [
    0, 2, 1,
    0, 3, 2,
    0, 4, 3,
    0, 1, 4,
    5, 1, 2,
    5, 2, 3,
    5, 3, 4,
    5, 4, 1,
  ];
  geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a crossed dual-plane streak geometry (horizontal + vertical ribbons along +Z)
 * so velocity motion-blur trails read cleanly from chase, roll-lean, and orbit angles.
 */
function createCrossedWakeGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const halfW = 0.085;
  // Plane A (horizontal XZ) + Plane B (vertical YZ), UV.x = 0 (front head) -> 1 (feathered tail)
  const positions = new Float32Array([
    // XZ ribbon
    -halfW, 0, 0.0,
    halfW, 0, 0.0,
    halfW, 0, 1.0,
    -halfW, 0, 1.0,
    // YZ ribbon
    0, -halfW, 0.0,
    0, halfW, 0.0,
    0, halfW, 1.0,
    0, -halfW, 1.0,
  ]);
  const uvs = new Float32Array([
    0, 0,
    0, 1,
    1, 1,
    1, 0,
    0, 0,
    0, 1,
    1, 1,
    1, 0,
  ]);
  const indices = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7];
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

/**
 * Procedural RGBA DataTexture (128x32) encoding a bright tapered core and
 * smooth feathered motion-blur wake tail without DOM canvas dependencies.
 */
function createMotionStreakTexture(): THREE.DataTexture {
  const width = 128;
  const height = 32;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) / height;
    const crossDist = Math.abs(v * 2 - 1);
    const crossFalloff = Math.pow(Math.max(0, 1 - crossDist), 2.1);
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width;
      const head = THREE.MathUtils.smoothstep(u, 0.0, 0.16);
      const tail = Math.pow(Math.max(0, 1 - (u - 0.16) / 0.84), 1.85);
      const axial = u < 0.16 ? head : tail;
      const coreBoost = u < 0.28 ? (1 - crossDist * crossDist) * 0.35 : 0;
      const alpha = THREE.MathUtils.clamp((axial * crossFalloff + coreBoost * axial), 0, 1);
      const lum = Math.round(THREE.MathUtils.clamp(0.78 + coreBoost * 0.22, 0, 1) * 255);
      const idx = (y * width + x) * 4;
      data[idx] = lum;
      data[idx + 1] = lum;
      data[idx + 2] = lum;
      data[idx + 3] = Math.round(alpha * 255);
    }
  }
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

export class OverdriveTrailEffect {
  public readonly group = new THREE.Group();
  public readonly sparksMesh: THREE.InstancedMesh;
  public readonly wakesMesh: THREE.InstancedMesh;

  private readonly sparkSlots: SparkSlot[] = [];
  private readonly wakeSlots: WakeSlot[] = [];
  private readonly streakTexture: THREE.DataTexture;

  private sparkCursor = 0;
  private wakeCursor = 0;
  private sparkAccum = 0;
  private wakeAccum = 0;
  private overdriveActive = false;
  private currentIntensity = 0;
  private colorsDirty = false;

  constructor() {
    this.group.name = 'OverdriveTrailGroup';

    const sparkGeo = createSparkNeedleGeometry();
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.94,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.sparksMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, MAX_SPARKS);
    this.sparksMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sparksMesh.frustumCulled = false;
    this.sparksMesh.renderOrder = 14;
    this.sparksMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(MAX_SPARKS * 3),
      3,
    );

    const wakeGeo = createCrossedWakeGeometry();
    this.streakTexture = createMotionStreakTexture();
    const wakeMat = new THREE.MeshBasicMaterial({
      map: this.streakTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0.68,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.wakesMesh = new THREE.InstancedMesh(wakeGeo, wakeMat, MAX_WAKES);
    this.wakesMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.wakesMesh.frustumCulled = false;
    this.wakesMesh.renderOrder = 13;
    this.wakesMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(MAX_WAKES * 3),
      3,
    );

    _dummy.position.set(0, -80, 0);
    _dummy.scale.setScalar(0.0001);
    _dummy.updateMatrix();
    _hdrColor.setHex(0xffffff);

    for (let i = 0; i < MAX_SPARKS; i++) {
      this.sparkSlots.push({
        active: false,
        life: 0,
        maxLife: 0.3,
        px: 0,
        py: -80,
        pz: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        length: 1,
        radius: 1,
        bounceY: -999,
        baseColor: new THREE.Color(0xfbbf24),
      });
      this.sparksMesh.setMatrixAt(i, _dummy.matrix);
      this.sparksMesh.setColorAt(i, _hdrColor);
    }

    for (let i = 0; i < MAX_WAKES; i++) {
      this.wakeSlots.push({
        active: false,
        life: 0,
        maxLife: 0.25,
        px: 0,
        py: -80,
        pz: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        length: 1.5,
        width: 1,
        roll: 0,
        baseColor: new THREE.Color(0x38bdf8),
      });
      this.wakesMesh.setMatrixAt(i, _dummy.matrix);
      this.wakesMesh.setColorAt(i, _hdrColor);
    }

    this.sparksMesh.instanceMatrix.needsUpdate = true;
    if (this.sparksMesh.instanceColor) this.sparksMesh.instanceColor.needsUpdate = true;
    this.wakesMesh.instanceMatrix.needsUpdate = true;
    if (this.wakesMesh.instanceColor) this.wakesMesh.instanceColor.needsUpdate = true;

    this.group.add(this.wakesMesh, this.sparksMesh);
  }

  private pickSparkColorHex(
    superOverdrive: boolean,
    isCarnivalSkin: boolean,
    variant: number,
  ): number {
    if (isCarnivalSkin) {
      if (variant < 0.34) return 0xec4899;
      if (variant < 0.68) return 0xfbbf24;
      return 0x22d3ee;
    }
    if (superOverdrive) {
      if (variant < 0.32) return 0xfef08a;
      if (variant < 0.66) return 0xc084fc;
      return 0x22d3ee;
    }
    if (variant < 0.42) return 0xfde047;
    if (variant < 0.74) return 0xf97316;
    return 0x38bdf8;
  }

  private spawnSpark(
    px: number,
    py: number,
    pz: number,
    vx: number,
    vy: number,
    vz: number,
    length: number,
    radius: number,
    maxLife: number,
    bounceY: number,
    hexColor: number,
  ): void {
    const idx = this.sparkCursor;
    const slot = this.sparkSlots[idx];
    this.sparkCursor = (this.sparkCursor + 1) % MAX_SPARKS;

    slot.active = true;
    slot.life = 0;
    slot.maxLife = maxLife;
    slot.px = px;
    slot.py = py;
    slot.pz = pz;
    slot.vx = vx;
    slot.vy = vy;
    slot.vz = vz;
    slot.length = length;
    slot.radius = radius;
    slot.bounceY = bounceY;
    slot.baseColor.setHex(hexColor);
    this.colorsDirty = true;
  }

  private spawnWake(
    px: number,
    py: number,
    pz: number,
    vx: number,
    vy: number,
    vz: number,
    length: number,
    width: number,
    maxLife: number,
    roll: number,
    hexColor: number,
  ): void {
    const idx = this.wakeCursor;
    const slot = this.wakeSlots[idx];
    this.wakeCursor = (this.wakeCursor + 1) % MAX_WAKES;

    slot.active = true;
    slot.life = 0;
    slot.maxLife = maxLife;
    slot.px = px;
    slot.py = py;
    slot.pz = pz;
    slot.vx = vx;
    slot.vy = vy;
    slot.vz = vz;
    slot.length = length;
    slot.width = width;
    slot.roll = roll;
    slot.baseColor.setHex(hexColor);
    this.colorsDirty = true;
  }

  public triggerThresholdPulse(
    playerX: number,
    playerY: number,
    playerZ: number,
    groundY: number,
    intensity = 0.85,
    isCarnivalSkin = false,
  ): void {
    const clamped = THREE.MathUtils.clamp(intensity, 0.35, 1.0);
    const bounceFloor = groundY > -10 ? groundY : -999;
    const sparkCount = Math.round(18 + clamped * 12);

    for (let i = 0; i < sparkCount; i++) {
      const a = (i / sparkCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const radialSpeed = 2.4 + Math.random() * 3.8 * (0.7 + clamped * 0.5);
      const colorHex = this.pickSparkColorHex(clamped > 0.72, isCarnivalSkin, Math.random());
      this.spawnSpark(
        playerX + Math.cos(a) * 0.22,
        playerY + 0.48 + Math.sin(a) * 0.34,
        playerZ + 0.15 + Math.random() * 0.2,
        Math.cos(a) * radialSpeed,
        Math.sin(a) * radialSpeed * 0.65 + 1.4,
        13.0 + Math.random() * 10.0 + clamped * 6.0,
        1.15 + Math.random() * 0.85 + clamped * 0.5,
        0.95 + Math.random() * 0.45,
        0.26 + Math.random() * 0.16,
        bounceFloor,
        colorHex,
      );
    }

    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const band = Math.floor(i / 2);
      const colorHex = this.pickSparkColorHex(clamped > 0.72, isCarnivalSkin, i / 8);
      this.spawnWake(
        playerX + side * (0.2 + band * 0.11),
        playerY + 0.28 + band * 0.26,
        playerZ + 0.12,
        side * (0.65 + Math.random() * 0.9),
        0.2 + Math.random() * 0.45,
        16.0 + Math.random() * 8.0,
        1.8 + clamped * 1.4,
        0.85 + clamped * 0.55,
        0.2 + Math.random() * 0.1,
        Math.random() * Math.PI,
        colorHex,
      );
    }
  }

  public update(dt: number, params: OverdriveTrailUpdateParams): void {
    const targetIntensity = computeOverdriveIntensity(
      params.speedMultiplier,
      params.speedBoostTimer,
      params.chronosTimer,
    );
    const wasActive = this.overdriveActive;
    const isNowActive = targetIntensity > 0;
    this.overdriveActive = isNowActive;
    this.currentIntensity = THREE.MathUtils.damp(
      this.currentIntensity,
      targetIntensity,
      isNowActive ? 10 : 8,
      dt,
    );

    const bounceFloor = params.groundY > -10 ? params.groundY : -999;

    if (isNowActive && !wasActive) {
      this.triggerThresholdPulse(
        params.playerX,
        params.playerY,
        params.playerZ,
        params.groundY,
        Math.max(0.65, targetIntensity),
        params.isCarnivalSkin,
      );
    }

    if (isNowActive) {
      const superOverdrive = params.speedMultiplier >= 3.0;
      const sparkInterval = THREE.MathUtils.lerp(0.028, 0.011, targetIntensity);
      const wakeInterval = THREE.MathUtils.lerp(0.056, 0.026, targetIntensity);
      this.sparkAccum += dt;
      this.wakeAccum += dt;

      let emitCap = 0;
      while (this.sparkAccum >= sparkInterval && emitCap < 4) {
        this.sparkAccum -= sparkInterval;
        emitCap++;

        const heelOrShoulder = Math.random();
        const side = Math.random() < 0.5 ? -1 : 1;
        const laneDriftVx = -params.laneVelX * 0.28;
        let spawnX = params.playerX;
        let spawnY = params.playerY;
        let vx = laneDriftVx;
        let vy = 0.6;

        if (heelOrShoulder < 0.62) {
          // Foot / slide heel spark jet
          spawnX += side * (0.11 + Math.random() * 0.12);
          spawnY += params.isSliding ? 0.06 + Math.random() * 0.12 : 0.07 + Math.random() * 0.18;
          vx += side * (1.1 + Math.random() * 2.1);
          vy = params.isGrounded
            ? 1.5 + Math.random() * 2.4 + targetIntensity * 1.1
            : -0.6 + Math.random() * 1.4;
        } else {
          // Shoulder / hip slipstream sparks
          spawnX += side * (0.24 + Math.random() * 0.14);
          spawnY += (params.isSliding ? 0.34 : 0.68) + Math.random() * 0.45;
          vx += side * (0.7 + Math.random() * 1.5);
          vy = (Math.random() - 0.35) * 1.4;
        }

        const vz = 11.5 + targetIntensity * 13.5 + Math.random() * 5.0;
        const sparkLen = 0.78 + targetIntensity * 0.95 + Math.random() * 0.45;
        const colorHex = this.pickSparkColorHex(
          superOverdrive,
          params.isCarnivalSkin,
          Math.random(),
        );
        this.spawnSpark(
          spawnX,
          spawnY,
          params.playerZ + 0.14 + Math.random() * 0.16,
          vx,
          vy,
          vz,
          sparkLen,
          0.75 + Math.random() * 0.45 + targetIntensity * 0.25,
          0.22 + Math.random() * 0.14,
          bounceFloor,
          colorHex,
        );
      }

      let wakeCap = 0;
      while (this.wakeAccum >= wakeInterval && wakeCap < 3) {
        this.wakeAccum -= wakeInterval;
        wakeCap++;

        const side = Math.random() < 0.5 ? -1 : 1;
        const heightOffset = params.isSliding
          ? 0.16 + Math.random() * 0.34
          : 0.22 + Math.random() * 0.95;
        const colorHex = this.pickSparkColorHex(
          superOverdrive,
          params.isCarnivalSkin,
          Math.random(),
        );
        this.spawnWake(
          params.playerX + side * (0.14 + Math.random() * 0.24),
          params.playerY + heightOffset,
          params.playerZ + 0.18 + Math.random() * 0.15,
          -params.laneVelX * 0.18 + side * (0.35 + Math.random() * 0.5),
          (Math.random() - 0.5) * 0.35,
          14.0 + targetIntensity * 12.0 + Math.random() * 4.0,
          1.35 + targetIntensity * 1.75 + Math.random() * 0.65,
          0.72 + targetIntensity * 0.52,
          0.16 + Math.random() * 0.08,
          Math.random() * Math.PI,
          colorHex,
        );
      }
    } else {
      this.sparkAccum = 0;
      this.wakeAccum = 0;
    }

    // Integrate spark particles with velocity-aligned streak scaling & floor ricochet
    let sparksDirty = false;
    const hdrGain = 1.28 + Math.max(targetIntensity, this.currentIntensity) * 0.95;

    for (let i = 0; i < MAX_SPARKS; i++) {
      const slot = this.sparkSlots[i];
      if (!slot.active) continue;
      sparksDirty = true;

      slot.life += dt;
      if (slot.life >= slot.maxLife) {
        slot.active = false;
        _dummy.position.set(0, -80, 0);
        _dummy.scale.setScalar(0.0001);
        _dummy.updateMatrix();
        this.sparksMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      slot.vy -= 14.5 * dt;
      slot.vx *= Math.max(0, 1 - dt * 1.4);
      slot.px += slot.vx * dt;
      slot.py += slot.vy * dt;
      slot.pz += slot.vz * dt;

      if (slot.bounceY > -10 && slot.py <= slot.bounceY + 0.035 && slot.vy < 0) {
        slot.py = slot.bounceY + 0.035;
        slot.vy = Math.abs(slot.vy) * 0.42 + 1.15;
        slot.vz *= 0.9;
      }

      const t = 1 - slot.life / slot.maxLife;
      const speedMag = Math.hypot(slot.vx, slot.vy, slot.vz);
      if (speedMag > 1e-4) {
        _velDir.set(slot.vx / speedMag, slot.vy / speedMag, slot.vz / speedMag);
      } else {
        _velDir.set(0, 0, 1);
      }
      _sparkQuat.setFromUnitVectors(_forwardZ, _velDir);

      _dummy.position.set(slot.px, slot.py, slot.pz);
      _dummy.quaternion.copy(_sparkQuat);
      const radiusScale = Math.max(0.02, slot.radius * (0.3 + 0.7 * t));
      const lengthScale = Math.max(
        0.08,
        slot.length * (0.45 + 0.8 * t) * (1 + speedMag * 0.03),
      );
      _dummy.scale.set(radiusScale, radiusScale, lengthScale);
      _dummy.updateMatrix();
      this.sparksMesh.setMatrixAt(i, _dummy.matrix);

      _hdrColor.copy(slot.baseColor).multiplyScalar(hdrGain * t);
      this.sparksMesh.setColorAt(i, _hdrColor);
      this.colorsDirty = true;
    }

    // Integrate aerodynamic motion-blur wake ribbons behind runner
    let wakesDirty = false;
    const wakeGain = 0.85 + Math.max(targetIntensity, this.currentIntensity) * 0.75;
    for (let i = 0; i < MAX_WAKES; i++) {
      const slot = this.wakeSlots[i];
      if (!slot.active) continue;
      wakesDirty = true;

      slot.life += dt;
      if (slot.life >= slot.maxLife) {
        slot.active = false;
        _dummy.position.set(0, -80, 0);
        _dummy.scale.setScalar(0.0001);
        _dummy.updateMatrix();
        this.wakesMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      slot.px += slot.vx * dt;
      slot.py += slot.vy * dt;
      slot.pz += slot.vz * dt;

      const t = 1 - slot.life / slot.maxLife;
      const wakeFade = Math.sin(t * Math.PI * 0.5);
      _dummy.position.set(slot.px, slot.py, slot.pz);
      _dummy.rotation.set(0, 0, slot.roll);
      _dummy.scale.set(
        Math.max(0.02, slot.width * (0.55 + 0.55 * t)),
        Math.max(0.02, slot.width * (0.55 + 0.55 * t)),
        Math.max(0.1, slot.length * (0.65 + 0.7 * (1 - t))),
      );
      _dummy.updateMatrix();
      this.wakesMesh.setMatrixAt(i, _dummy.matrix);

      _hdrColor.copy(slot.baseColor).multiplyScalar(wakeGain * wakeFade);
      this.wakesMesh.setColorAt(i, _hdrColor);
      this.colorsDirty = true;
    }

    if (sparksDirty) {
      this.sparksMesh.instanceMatrix.needsUpdate = true;
    }
    if (wakesDirty) {
      this.wakesMesh.instanceMatrix.needsUpdate = true;
    }
    if (this.colorsDirty) {
      if (this.sparksMesh.instanceColor) this.sparksMesh.instanceColor.needsUpdate = true;
      if (this.wakesMesh.instanceColor) this.wakesMesh.instanceColor.needsUpdate = true;
      this.colorsDirty = false;
    }
  }

  public getActiveCounts(): {
    sparks: number;
    wakes: number;
    overdriveActive: boolean;
    intensity: number;
  } {
    let sparks = 0;
    let wakes = 0;
    for (let i = 0; i < MAX_SPARKS; i++) {
      if (this.sparkSlots[i].active) sparks++;
    }
    for (let i = 0; i < MAX_WAKES; i++) {
      if (this.wakeSlots[i].active) wakes++;
    }
    return {
      sparks,
      wakes,
      overdriveActive: this.overdriveActive,
      intensity: this.currentIntensity,
    };
  }

  public reset(): void {
    this.overdriveActive = false;
    this.currentIntensity = 0;
    this.sparkAccum = 0;
    this.wakeAccum = 0;

    _dummy.position.set(0, -80, 0);
    _dummy.scale.setScalar(0.0001);
    _dummy.updateMatrix();

    for (let i = 0; i < MAX_SPARKS; i++) {
      this.sparkSlots[i].active = false;
      this.sparksMesh.setMatrixAt(i, _dummy.matrix);
    }
    for (let i = 0; i < MAX_WAKES; i++) {
      this.wakeSlots[i].active = false;
      this.wakesMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.sparksMesh.instanceMatrix.needsUpdate = true;
    this.wakesMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    this.sparksMesh.geometry.dispose();
    (this.sparksMesh.material as THREE.Material).dispose();
    this.wakesMesh.geometry.dispose();
    (this.wakesMesh.material as THREE.Material).dispose();
    this.streakTexture.dispose();
  }
}
