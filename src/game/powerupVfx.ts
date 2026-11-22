import * as THREE from 'three';
import type { PowerupType } from './types';

interface PulseRingSlot {
  active: boolean;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
  px: number;
  py: number;
  pz: number;
  vy: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  spinY: number;
  color: number;
  followPlayer: boolean;
  yOffset: number;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
}

const POOL_SIZE = 18;

export class PowerupVfxSystem {
  public readonly group = new THREE.Group();
  private readonly ringGeo: THREE.TorusGeometry;
  private readonly slots: PulseRingSlot[] = [];
  private cursor = 0;

  constructor() {
    this.ringGeo = new THREE.TorusGeometry(0.9, 0.055, 6, 16);

    for (let i = 0; i < POOL_SIZE; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(this.ringGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);

      this.slots.push({
        active: false,
        life: 0,
        maxLife: 0.5,
        startScale: 0.5,
        endScale: 2.5,
        px: 0,
        py: 0,
        pz: 0,
        vy: 0,
        rotX: Math.PI / 2,
        rotY: 0,
        rotZ: 0,
        spinY: 0,
        color: 0xffffff,
        followPlayer: true,
        yOffset: 0.5,
        mesh,
        mat,
      });
    }
  }

  private spawnRing(opts: {
    x: number;
    y: number;
    z: number;
    color: number;
    startScale: number;
    endScale: number;
    maxLife: number;
    rotX?: number;
    rotZ?: number;
    spinY?: number;
    vy?: number;
    followPlayer?: boolean;
    yOffset?: number;
  }): void {
    const slot = this.slots[this.cursor];
    this.cursor = (this.cursor + 1) % POOL_SIZE;

    slot.active = true;
    slot.life = 0;
    slot.maxLife = opts.maxLife;
    slot.startScale = opts.startScale;
    slot.endScale = opts.endScale;
    slot.px = opts.x;
    slot.py = opts.y;
    slot.pz = opts.z;
    slot.vy = opts.vy ?? 0;
    slot.rotX = opts.rotX ?? Math.PI / 2;
    slot.rotY = Math.random() * Math.PI;
    slot.rotZ = opts.rotZ ?? 0;
    slot.spinY = opts.spinY ?? 3.5;
    slot.color = opts.color;
    slot.followPlayer = opts.followPlayer ?? true;
    slot.yOffset = opts.yOffset ?? 0.6;

    slot.mat.color.setHex(opts.color);
    slot.mat.opacity = 0.9;
    slot.mesh.visible = true;
    slot.mesh.position.set(slot.px, slot.py, slot.pz);
    slot.mesh.rotation.set(slot.rotX, slot.rotY, slot.rotZ);
    slot.mesh.scale.setScalar(slot.startScale);
  }

  public triggerPickupBurst(type: PowerupType, x: number, y: number, z: number): void {
    if (type === 'shield') {
      // Shimmering cyan dome expansion + rising protective ring
      this.spawnRing({
        x,
        y: y + 0.85,
        z,
        color: 0x38bdf8,
        startScale: 0.45,
        endScale: 2.3,
        maxLife: 0.48,
        rotX: Math.PI / 2,
        spinY: 6,
        vy: 0.5,
        yOffset: 0.85,
      });
      this.spawnRing({
        x,
        y: y + 0.35,
        z,
        color: 0xbae6fd,
        startScale: 0.75,
        endScale: 1.55,
        maxLife: 0.42,
        rotX: Math.PI / 2,
        vy: 3.4,
        yOffset: 0.35,
      });
      this.spawnRing({
        x,
        y: y + 0.9,
        z,
        color: 0x7dd3fc,
        startScale: 0.5,
        endScale: 1.9,
        maxLife: 0.45,
        rotX: 0.35,
        rotZ: 0.4,
        spinY: -7,
        yOffset: 0.9,
      });
    } else if (type === 'magnet') {
      // Triple emerald magnetic field pulse waves
      this.spawnRing({
        x,
        y: y + 0.65,
        z,
        color: 0x10b981,
        startScale: 0.4,
        endScale: 3.8,
        maxLife: 0.52,
        yOffset: 0.65,
      });
      this.spawnRing({
        x,
        y: y + 0.65,
        z,
        color: 0x6ee7b7,
        startScale: 2.8,
        endScale: 0.35,
        maxLife: 0.4,
        yOffset: 0.65,
      });
      this.spawnRing({
        x,
        y: y + 0.25,
        z,
        color: 0x34d399,
        startScale: 0.5,
        endScale: 4.4,
        maxLife: 0.62,
        yOffset: 0.25,
      });
    } else if (type === 'chronos') {
      // Chronos-Crystal expanding violet/cyan temporal astrolabe rings
      this.spawnRing({
        x,
        y: y + 0.9,
        z,
        color: 0xa855f7,
        startScale: 0.4,
        endScale: 4.4,
        maxLife: 0.65,
        rotX: Math.PI / 2,
        spinY: -4.5,
        yOffset: 0.9,
      });
      this.spawnRing({
        x,
        y: y + 0.9,
        z,
        color: 0x67e8f9,
        startScale: 3.4,
        endScale: 0.35,
        maxLife: 0.5,
        rotX: 0.55,
        rotZ: -0.4,
        spinY: 6.5,
        yOffset: 0.9,
      });
      this.spawnRing({
        x,
        y: y + 0.45,
        z,
        color: 0xfde047,
        startScale: 0.5,
        endScale: 2.9,
        maxLife: 0.55,
        rotX: -0.45,
        rotZ: 0.45,
        spinY: 5,
        yOffset: 0.45,
      });
    } else {
      // 2x Multiplier overdrive star-burst rings
      this.spawnRing({
        x,
        y: y + 0.9,
        z,
        color: 0xf43f5e,
        startScale: 0.45,
        endScale: 3.0,
        maxLife: 0.5,
        rotX: Math.PI / 2,
        yOffset: 0.9,
      });
      this.spawnRing({
        x,
        y: y + 0.9,
        z,
        color: 0xfbbf24,
        startScale: 0.55,
        endScale: 2.4,
        maxLife: 0.46,
        rotX: 0.6,
        rotZ: -0.5,
        spinY: 9,
        yOffset: 0.9,
      });
      this.spawnRing({
        x,
        y: y + 0.9,
        z,
        color: 0xfb7185,
        startScale: 0.55,
        endScale: 2.4,
        maxLife: 0.46,
        rotX: -0.6,
        rotZ: 0.5,
        spinY: -9,
        yOffset: 0.9,
      });
    }
  }

  public triggerMagnetPulse(x: number, y: number, z: number): void {
    this.spawnRing({
      x,
      y: y + 0.4,
      z,
      color: 0x34d399,
      startScale: 0.55,
      endScale: 3.9,
      maxLife: 0.55,
      rotX: Math.PI / 2,
      spinY: 4,
      yOffset: 0.4,
    });
  }

  public triggerChronosPulse(x: number, y: number, z: number): void {
    this.spawnRing({
      x,
      y: y + 0.75,
      z,
      color: 0xc084fc,
      startScale: 3.6,
      endScale: 0.55,
      maxLife: 0.65,
      rotX: Math.PI / 2,
      spinY: -3.2,
      yOffset: 0.75,
    });
  }

  public triggerShieldBreakBurst(x: number, y: number, z: number): void {
    this.spawnRing({
      x,
      y: y + 0.9,
      z,
      color: 0x38bdf8,
      startScale: 0.9,
      endScale: 3.4,
      maxLife: 0.42,
      rotX: Math.PI / 2,
      followPlayer: false,
    });
    this.spawnRing({
      x,
      y: y + 0.9,
      z,
      color: 0xffffff,
      startScale: 0.8,
      endScale: 2.6,
      maxLife: 0.32,
      rotX: 0.45,
      rotZ: 0.45,
      followPlayer: false,
    });
  }

  public update(dt: number, playerX: number, playerY: number, playerZ: number): void {
    for (let i = 0; i < POOL_SIZE; i++) {
      const slot = this.slots[i];
      if (!slot.active) continue;

      slot.life += dt;
      if (slot.life >= slot.maxLife) {
        slot.active = false;
        slot.mesh.visible = false;
        continue;
      }

      const t = slot.life / slot.maxLife;
      const eased = 1 - (1 - t) * (1 - t); // easeOutQuad
      const scale = slot.startScale + (slot.endScale - slot.startScale) * eased;

      if (slot.followPlayer) {
        slot.px = playerX;
        slot.pz = playerZ;
        slot.yOffset += slot.vy * dt;
        slot.py = playerY + slot.yOffset;
      } else {
        slot.py += slot.vy * dt;
      }

      slot.rotY += slot.spinY * dt;
      slot.mesh.position.set(slot.px, slot.py, slot.pz);
      slot.mesh.rotation.set(slot.rotX, slot.rotY, slot.rotZ);
      slot.mesh.scale.setScalar(scale);
      slot.mat.opacity = (1 - t) * 0.85;
    }
  }

  public clear(): void {
    for (let i = 0; i < POOL_SIZE; i++) {
      this.slots[i].active = false;
      this.slots[i].mesh.visible = false;
    }
  }

  public dispose(): void {
    this.ringGeo.dispose();
    for (const slot of this.slots) {
      slot.mat.dispose();
    }
  }
}
