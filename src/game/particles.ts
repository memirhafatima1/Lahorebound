import * as THREE from 'three';

interface ParticleSlot {
  active: boolean;
  life: number;
  maxLife: number;
  px: number;
  py: number;
  pz: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  size: number;
  gravity: number;
  color: THREE.Color;
}

const MAX_PARTICLES = 240;
const _dummy = new THREE.Object3D();
const _tempColor = new THREE.Color();

export class ParticlePool {
  public readonly mesh: THREE.InstancedMesh;
  private readonly slots: ParticleSlot[] = [];
  private cursor = 0;
  private colorDirty = false;

  constructor() {
    const geo = new THREE.OctahedronGeometry(0.13, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.45,
      metalness: 0.15,
      flatShading: true,
    });

    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_PARTICLES);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(MAX_PARTICLES * 3),
      3,
    );

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.slots.push({
        active: false,
        life: 0,
        maxLife: 1,
        px: 0,
        py: -50,
        pz: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        size: 0,
        gravity: 9.8,
        color: new THREE.Color(0xffffff),
      });
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(i, _dummy.matrix);
      this.mesh.setColorAt(i, _tempColor.setHex(0xffffff));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  public spawnBurst(
    x: number,
    y: number,
    z: number,
    hexColor: number,
    count: number,
    speed: number,
    size = 1.0,
    gravity = 12,
    maxLife = 0.48,
  ): void {
    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      const slot = this.slots[idx];
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;

      const angle = Math.random() * Math.PI * 2;
      const up = 0.25 + Math.random() * 0.85;
      const mag = (0.45 + Math.random() * 0.75) * speed;

      slot.active = true;
      slot.life = 0;
      slot.maxLife = maxLife * (0.75 + Math.random() * 0.45);
      slot.px = x + (Math.random() - 0.5) * 0.35;
      slot.py = y + (Math.random() - 0.5) * 0.2;
      slot.pz = z + (Math.random() - 0.5) * 0.35;
      slot.vx = Math.cos(angle) * mag;
      slot.vy = up * mag;
      slot.vz = Math.sin(angle) * mag;
      slot.rx = Math.random() * Math.PI;
      slot.ry = Math.random() * Math.PI;
      slot.size = size * (0.7 + Math.random() * 0.6);
      slot.gravity = gravity;
      slot.color.setHex(hexColor);
      this.mesh.setColorAt(idx, slot.color);
      this.colorDirty = true;
    }
  }

  public spawnTrailPuff(
    x: number,
    y: number,
    z: number,
    hexColor: number,
    size = 0.75,
  ): void {
    const idx = this.cursor;
    const slot = this.slots[idx];
    this.cursor = (this.cursor + 1) % MAX_PARTICLES;

    slot.active = true;
    slot.life = 0;
    slot.maxLife = 0.3 + Math.random() * 0.14;
    slot.px = x + (Math.random() - 0.5) * 0.45;
    slot.py = y + 0.08 + Math.random() * 0.12;
    slot.pz = z + 0.25;
    slot.vx = (Math.random() - 0.5) * 1.2;
    slot.vy = 0.8 + Math.random() * 1.4;
    slot.vz = 2.5 + Math.random() * 2.0;
    slot.rx = Math.random() * Math.PI;
    slot.ry = Math.random() * Math.PI;
    slot.size = size;
    slot.gravity = 2.0;
    slot.color.setHex(hexColor);
    this.mesh.setColorAt(idx, slot.color);
    this.colorDirty = true;
  }

  public spawnSpeedBurstTrail(
    x: number,
    y: number,
    z: number,
    primaryHex: number,
    secondaryHex: number,
    count: number,
    mode: 'jump' | 'slide',
    intensity = 1.0,
  ): void {
    const clampedIntensity = Math.min(1.8, Math.max(0.6, intensity));
    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      const slot = this.slots[idx];
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;

      const spreadSide = (Math.random() - 0.5) * 2; // -1..1
      const isJump = mode === 'jump';
      const lateralAngle = (Math.random() - 0.5) * Math.PI * 0.85;

      slot.active = true;
      slot.life = 0;
      slot.maxLife = (isJump ? 0.36 : 0.32) + Math.random() * 0.16;
      slot.px = x + spreadSide * (isJump ? 0.38 : 0.46);
      slot.py = y + (isJump ? 0.18 + Math.random() * 0.55 : 0.08 + Math.random() * 0.28);
      slot.pz = z + 0.18 + Math.random() * 0.42;

      slot.vx = Math.sin(lateralAngle) * (isJump ? 2.8 : 3.8) * clampedIntensity;
      slot.vy = isJump
        ? (1.4 + Math.random() * 3.1) * clampedIntensity
        : (0.45 + Math.random() * 1.65) * clampedIntensity;
      slot.vz = (4.2 + Math.random() * 4.4) * clampedIntensity;

      slot.rx = Math.random() * Math.PI;
      slot.ry = Math.random() * Math.PI;
      slot.size = (0.72 + Math.random() * 0.55) * (0.85 + clampedIntensity * 0.25);
      slot.gravity = isJump ? 4.2 : 1.6;
      slot.color.setHex(i % 2 === 0 ? primaryHex : secondaryHex);
      this.mesh.setColorAt(idx, slot.color);
      this.colorDirty = true;
    }
  }

  public update(dt: number): void {
    let anyChanged = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const slot = this.slots[i];
      if (!slot.active) continue;
      anyChanged = true;

      slot.life += dt;
      if (slot.life >= slot.maxLife) {
        slot.active = false;
        _dummy.position.set(0, -50, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        this.mesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      slot.vy -= slot.gravity * dt;
      slot.px += slot.vx * dt;
      slot.py += slot.vy * dt;
      slot.pz += slot.vz * dt;
      slot.rx += 5.5 * dt;
      slot.ry += 4.2 * dt;

      const t = 1 - slot.life / slot.maxLife;
      _dummy.position.set(slot.px, slot.py, slot.pz);
      _dummy.rotation.set(slot.rx, slot.ry, 0);
      _dummy.scale.setScalar(Math.max(0.01, slot.size * t));
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(i, _dummy.matrix);
    }

    if (anyChanged) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
    if (this.colorDirty && this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
      this.colorDirty = false;
    }
  }

  public clear(): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.slots[i].active = false;
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(i, _dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
