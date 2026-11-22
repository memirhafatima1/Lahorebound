import * as THREE from 'three';
import type { CharacterSkin, SkinCosmeticId } from './types';

export interface RunnerPoseState {
  isGrounded: boolean;
  isSliding: boolean;
  vy: number;
  laneVelX: number;
  runCycle: number;
  squashY: number;
  hasShield: boolean;
  magnetTimer: number;
  multiplierTimer: number;
  chronosTimer: number;
  powerupSurge: number;
  hitFlash: number;
  showcaseMode: boolean;
}

export class LowPolyCharacter {
  public readonly root = new THREE.Group();
  private readonly bodyRig = new THREE.Group();
  private readonly torsoGroup = new THREE.Group();
  private readonly headGroup = new THREE.Group();
  private readonly leftArmPivot = new THREE.Group();
  private readonly rightArmPivot = new THREE.Group();
  private readonly leftLegPivot = new THREE.Group();
  private readonly rightLegPivot = new THREE.Group();
  private readonly accessoryGroup = new THREE.Group();
  private readonly cosmeticGroup = new THREE.Group();
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

  private readonly primaryMat: THREE.MeshStandardMaterial;
  private readonly secondaryMat: THREE.MeshStandardMaterial;
  private readonly accentMat: THREE.MeshStandardMaterial;
  private readonly visorMat: THREE.MeshStandardMaterial;

  private currentSkin: CharacterSkin;
  private currentCosmeticId: SkinCosmeticId | null = null;

  constructor(initialSkin: CharacterSkin, initialCosmeticId: SkinCosmeticId | null = null) {
    this.currentSkin = initialSkin;
    this.currentCosmeticId = initialCosmeticId;

    // Varied roughness/metalness across silhouette parts per Three.js directives
    this.primaryMat = new THREE.MeshStandardMaterial({
      color: initialSkin.primaryColor,
      roughness: initialSkin.roughness,
      metalness: initialSkin.metalness,
      flatShading: true,
    });
    this.secondaryMat = new THREE.MeshStandardMaterial({
      color: initialSkin.secondaryColor,
      roughness: Math.min(0.85, initialSkin.roughness + 0.28),
      metalness: Math.max(0.05, initialSkin.metalness * 0.35),
      flatShading: true,
    });
    this.accentMat = new THREE.MeshStandardMaterial({
      color: initialSkin.accentColor,
      roughness: 0.25,
      metalness: 0.72,
      flatShading: true,
    });
    this.visorMat = new THREE.MeshStandardMaterial({
      color: initialSkin.visorColor,
      emissive: initialSkin.visorColor,
      emissiveIntensity: initialSkin.emissiveIntensity,
      roughness: 0.14,
      metalness: 0.85,
      flatShading: true,
    });

    // Contact shadow anchored beneath character
    const shadowGeo = new THREE.CircleGeometry(0.56, 16);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x070d18,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    this.contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.contactShadow.position.y = 0.025;
    this.root.add(this.contactShadow);

    this.root.add(this.bodyRig);

    // Legs (pivoted at hip y = 0.68, soles touch y = 0)
    const thighGeo = new THREE.BoxGeometry(0.22, 0.38, 0.24);
    const bootGeo = new THREE.BoxGeometry(0.25, 0.30, 0.34);

    const buildLeg = (pivot: THREE.Group, xOffset: number) => {
      pivot.position.set(xOffset, 0.68, 0);
      const thigh = new THREE.Mesh(thighGeo, this.secondaryMat);
      thigh.position.set(0, -0.19, 0);
      thigh.castShadow = true;
      pivot.add(thigh);

      const boot = new THREE.Mesh(bootGeo, this.accentMat);
      boot.position.set(0, -0.53, -0.04);
      boot.castShadow = true;
      pivot.add(boot);

      this.bodyRig.add(pivot);
    };
    buildLeg(this.leftLegPivot, -0.17);
    buildLeg(this.rightLegPivot, 0.17);

    // Torso (primary silhouette)
    this.torsoGroup.position.set(0, 0.68, 0);
    this.bodyRig.add(this.torsoGroup);

    const chestGeo = new THREE.CylinderGeometry(0.32, 0.25, 0.66, 6);
    const chest = new THREE.Mesh(chestGeo, this.primaryMat);
    chest.position.set(0, 0.33, 0);
    chest.rotation.y = Math.PI / 6;
    chest.castShadow = true;
    this.torsoGroup.add(chest);

    // Chest armor plate + glowing core badge (secondary + accent detail)
    const plateGeo = new THREE.BoxGeometry(0.44, 0.34, 0.12);
    const plate = new THREE.Mesh(plateGeo, this.accentMat);
    plate.position.set(0, 0.41, -0.22);
    plate.castShadow = true;
    this.torsoGroup.add(plate);

    const coreGeo = new THREE.OctahedronGeometry(0.095, 0);
    const core = new THREE.Mesh(coreGeo, this.visorMat);
    core.position.set(0, 0.42, -0.29);
    this.torsoGroup.add(core);

    // Waist belt
    const beltGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.11, 6);
    const belt = new THREE.Mesh(beltGeo, this.accentMat);
    belt.position.set(0, 0.05, 0);
    belt.rotation.y = Math.PI / 6;
    this.torsoGroup.add(belt);

    // Arms (pivoted at shoulders)
    const upperArmGeo = new THREE.BoxGeometry(0.16, 0.42, 0.18);
    const gloveGeo = new THREE.BoxGeometry(0.18, 0.16, 0.2);

    const buildArm = (pivot: THREE.Group, xOffset: number) => {
      pivot.position.set(xOffset, 0.58, 0);
      const sleeve = new THREE.Mesh(upperArmGeo, this.primaryMat);
      sleeve.position.set(0, -0.21, 0);
      sleeve.castShadow = true;
      pivot.add(sleeve);

      const glove = new THREE.Mesh(gloveGeo, this.accentMat);
      glove.position.set(0, -0.45, -0.02);
      glove.castShadow = true;
      pivot.add(glove);

      this.torsoGroup.add(pivot);
    };
    buildArm(this.leftArmPivot, -0.39);
    buildArm(this.rightArmPivot, 0.39);

    // Head & glowing low-poly visor
    this.headGroup.position.set(0, 0.72, 0);
    this.torsoGroup.add(this.headGroup);

    const helmetGeo = new THREE.DodecahedronGeometry(0.29, 0);
    const helmet = new THREE.Mesh(helmetGeo, this.secondaryMat);
    helmet.position.set(0, 0.22, 0);
    helmet.castShadow = true;
    this.headGroup.add(helmet);

    const visorGeo = new THREE.BoxGeometry(0.38, 0.13, 0.22);
    const visor = new THREE.Mesh(visorGeo, this.visorMat);
    visor.position.set(0, 0.23, -0.18);
    this.headGroup.add(visor);

    // Accessory & Weekly Cosmetic mounts on torso
    this.torsoGroup.add(this.accessoryGroup);
    this.torsoGroup.add(this.cosmeticGroup);
    this.rebuildAccessory(initialSkin);
    this.rebuildCosmetic(initialCosmeticId);

    // Shimmering Dual-Layer Protective Shield Bubble
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
    this.shieldBubble.position.y = 0.92;
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
    this.shieldInnerShell.position.y = 0.92;
    this.shieldInnerShell.visible = false;
    this.root.add(this.shieldInnerShell);

    // Orbiting Emerald Magnet Field Rings
    const magRingGeo = new THREE.TorusGeometry(0.84, 0.036, 6, 16);
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
    this.magnetAuraGroup.position.y = 0.88;
    this.magnetAuraGroup.visible = false;
    this.root.add(this.magnetAuraGroup);

    // 2x Multiplier Overdrive Orbital Halo & Prisms
    const multRingGeo = new THREE.TorusGeometry(0.76, 0.038, 6, 12);
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

    const starGeo = new THREE.OctahedronGeometry(0.13, 0);
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
      star.position.set(Math.cos(angle) * 0.78, 0, Math.sin(angle) * 0.78);
      this.multiplierAuraGroup.add(star);
    }
    this.multiplierAuraGroup.position.y = 0.92;
    this.multiplierAuraGroup.visible = false;
    this.root.add(this.multiplierAuraGroup);

    // Chronos-Crystal Time-Dilation Orbital Rings
    const chronosRingGeoA = new THREE.TorusGeometry(0.92, 0.03, 6, 20);
    const chronosMatA = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.chronosRingA = new THREE.Mesh(chronosRingGeoA, chronosMatA);
    this.chronosRingA.rotation.set(Math.PI / 2.2, 0.25, 0);

    const chronosRingGeoB = new THREE.TorusGeometry(0.8, 0.025, 6, 20);
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
    this.chronosAuraGroup.position.y = 0.92;
    this.chronosAuraGroup.visible = false;
    this.root.add(this.chronosAuraGroup);
  }

  public applySkin(skin: CharacterSkin): void {
    this.currentSkin = skin;
    this.primaryMat.color.setHex(skin.primaryColor);
    this.primaryMat.roughness = skin.roughness;
    this.primaryMat.metalness = skin.metalness;

    this.secondaryMat.color.setHex(skin.secondaryColor);
    this.secondaryMat.roughness = Math.min(0.85, skin.roughness + 0.28);
    this.secondaryMat.metalness = Math.max(0.05, skin.metalness * 0.35);

    this.accentMat.color.setHex(skin.accentColor);
    this.visorMat.color.setHex(skin.visorColor);
    this.visorMat.emissive.setHex(skin.visorColor);
    this.visorMat.emissiveIntensity = skin.emissiveIntensity;

    this.rebuildAccessory(skin);
  }

  public applyCosmetic(cosmeticId: SkinCosmeticId | null): void {
    if (this.currentCosmeticId === cosmeticId) return;
    this.currentCosmeticId = cosmeticId;
    this.rebuildCosmetic(cosmeticId);
  }

  private disposeCosmeticChildren(): void {
    while (this.cosmeticGroup.children.length > 0) {
      const child = this.cosmeticGroup.children.pop();
      if (!child) continue;
      child.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    }
  }

  private rebuildCosmetic(cosmeticId: SkinCosmeticId | null): void {
    this.disposeCosmeticChildren();
    if (!cosmeticId) return;

    if (cosmeticId === 'starlight_crown') {
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.72,
        roughness: 0.2,
        metalness: 0.85,
        flatShading: true,
      });
      const emeraldMat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x34d399,
        emissiveIntensity: 0.85,
        roughness: 0.25,
        metalness: 0.5,
        flatShading: true,
      });

      const crownPivot = new THREE.Group();
      crownPivot.name = 'crownPivot';
      crownPivot.position.set(0, 1.38, 0);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.032, 6, 12), goldMat);
      ring.rotation.x = Math.PI / 2;
      crownPivot.add(ring);

      const spikeGeo = new THREE.ConeGeometry(0.055, 0.16, 4);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const spike = new THREE.Mesh(spikeGeo, i % 2 === 0 ? goldMat : emeraldMat);
        spike.position.set(Math.cos(a) * 0.28, 0.09, Math.sin(a) * 0.28);
        crownPivot.add(spike);
      }

      const topGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), emeraldMat);
      topGem.position.set(0, 0.2, 0);
      crownPivot.add(topGem);

      this.cosmeticGroup.add(crownPivot);
    } else if (cosmeticId === 'truckart_wings') {
      const roseMat = new THREE.MeshStandardMaterial({
        color: 0xec4899,
        emissive: 0xf43f5e,
        emissiveIntensity: 0.65,
        roughness: 0.28,
        metalness: 0.45,
        flatShading: true,
      });
      const cyanMat = new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.72,
        roughness: 0.25,
        metalness: 0.55,
        flatShading: true,
      });
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.55,
        roughness: 0.25,
        metalness: 0.75,
        flatShading: true,
      });

      const wingPivot = new THREE.Group();
      wingPivot.name = 'wingPivot';
      wingPivot.position.set(0, 0.46, 0.3);

      const upperBladeGeo = new THREE.BoxGeometry(0.72, 0.16, 0.05);
      const lowerBladeGeo = new THREE.BoxGeometry(0.52, 0.12, 0.05);

      for (const side of [-1, 1]) {
        const upper = new THREE.Mesh(upperBladeGeo, roseMat);
        upper.position.set(side * 0.48, 0.12, 0.04);
        upper.rotation.set(0.18, side * 0.28, side * -0.34);
        wingPivot.add(upper);

        const lower = new THREE.Mesh(lowerBladeGeo, cyanMat);
        lower.position.set(side * 0.4, -0.08, 0.06);
        lower.rotation.set(0.15, side * 0.22, side * -0.18);
        wingPivot.add(lower);

        const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), goldMat);
        jewel.position.set(side * 0.2, 0.05, 0.04);
        wingPivot.add(jewel);
      }

      this.cosmeticGroup.add(wingPivot);
    } else if (cosmeticId === 'emerald_crest') {
      const pakGreenMat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x10b981,
        emissiveIntensity: 0.75,
        roughness: 0.28,
        metalness: 0.5,
        flatShading: true,
      });
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.65,
        roughness: 0.22,
        metalness: 0.8,
        flatShading: true,
      });

      const crestPivot = new THREE.Group();
      crestPivot.name = 'crestPivot';

      for (const side of [-1, 1]) {
        const pauldron = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.34, 4), pakGreenMat);
        pauldron.position.set(side * 0.44, 0.72, 0);
        pauldron.rotation.z = side * -0.42;
        crestPivot.add(pauldron);

        const trim = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), goldMat);
        trim.position.set(side * 0.48, 0.86, -0.02);
        crestPivot.add(trim);
      }

      const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.44, 4), goldMat);
      dorsal.position.set(0, 0.52, 0.34);
      dorsal.rotation.x = -0.85;
      crestPivot.add(dorsal);

      this.cosmeticGroup.add(crestPivot);
    } else if (cosmeticId === 'comet_halo') {
      const cyanMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.85,
        roughness: 0.18,
        metalness: 0.7,
        flatShading: true,
      });
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xfde047,
        emissive: 0xfbbf24,
        emissiveIntensity: 0.9,
        roughness: 0.2,
        metalness: 0.8,
        flatShading: true,
      });

      const haloPivot = new THREE.Group();
      haloPivot.name = 'cometPivot';
      haloPivot.position.set(0, 0.44, 0.34);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.036, 6, 16), cyanMat);
      haloPivot.add(ring);

      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), goldMat);
        orb.position.set(Math.cos(a) * 0.46, Math.sin(a) * 0.46, 0);
        haloPivot.add(orb);
      }

      this.cosmeticGroup.add(haloPivot);
    } else if (cosmeticId === 'marigold_scarf') {
      const saffronMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.45,
        roughness: 0.45,
        metalness: 0.25,
        flatShading: true,
      });
      const crimsonMat = new THREE.MeshStandardMaterial({
        color: 0xe11d48,
        emissive: 0xbe123c,
        emissiveIntensity: 0.5,
        roughness: 0.42,
        metalness: 0.25,
        flatShading: true,
      });
      const claspMat = new THREE.MeshStandardMaterial({
        color: 0xfde047,
        emissive: 0xfbbf24,
        emissiveIntensity: 0.65,
        roughness: 0.2,
        metalness: 0.85,
        flatShading: true,
      });

      const scarfPivot = new THREE.Group();
      scarfPivot.name = 'scarfPivot';
      scarfPivot.position.set(0, 0.62, 0.26);

      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.16), saffronMat);
      collar.position.set(0, 0.04, -0.04);
      scarfPivot.add(collar);

      const clasp = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), claspMat);
      clasp.position.set(0, 0.04, 0.06);
      scarfPivot.add(clasp);

      for (const side of [-1, 1]) {
        const upperRibbon = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.42, 0.05),
          side < 0 ? saffronMat : crimsonMat,
        );
        upperRibbon.position.set(side * 0.14, -0.14, 0.14);
        upperRibbon.rotation.set(0.48, side * 0.22, side * 0.18);
        scarfPivot.add(upperRibbon);

        const tailTip = new THREE.Mesh(
          new THREE.ConeGeometry(0.08, 0.24, 4),
          side < 0 ? crimsonMat : saffronMat,
        );
        tailTip.position.set(side * 0.2, -0.34, 0.28);
        tailTip.rotation.set(Math.PI * 0.72, 0, side * -0.2);
        scarfPivot.add(tailTip);
      }

      this.cosmeticGroup.add(scarfPivot);
    } else if (cosmeticId === 'badshahi_crest') {
      const sandstoneMat = new THREE.MeshStandardMaterial({
        color: 0xe11d48,
        emissive: 0x9f1239,
        emissiveIntensity: 0.42,
        roughness: 0.35,
        metalness: 0.45,
        flatShading: true,
      });
      const gildedMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.78,
        roughness: 0.2,
        metalness: 0.86,
        flatShading: true,
      });

      const shahiPivot = new THREE.Group();
      shahiPivot.name = 'shahiPivot';

      for (const side of [-1, 1]) {
        const spireBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.26, 6), sandstoneMat);
        spireBase.position.set(side * 0.42, 0.7, 0.02);
        spireBase.rotation.z = side * -0.26;
        shahiPivot.add(spireBase);

        const dome = new THREE.Mesh(new THREE.OctahedronGeometry(0.105, 0), gildedMat);
        dome.position.set(side * 0.46, 0.87, 0.02);
        shahiPivot.add(dome);
      }

      const backCrest = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 0), sandstoneMat);
      backCrest.position.set(0, 0.44, 0.31);
      shahiPivot.add(backCrest);

      const coreSeal = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.028, 6, 12), gildedMat);
      coreSeal.position.set(0, 0.44, 0.32);
      shahiPivot.add(coreSeal);

      this.cosmeticGroup.add(shahiPivot);
    } else if (cosmeticId === 'prism_thrusters') {
      const hullMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.3,
        metalness: 0.78,
        flatShading: true,
      });
      const cyanFinMat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x22d3ee,
        emissiveIntensity: 0.72,
        roughness: 0.24,
        metalness: 0.65,
        flatShading: true,
      });
      const plumeMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.95,
        roughness: 0.2,
        metalness: 0.35,
        flatShading: true,
      });

      const thrusterPivot = new THREE.Group();
      thrusterPivot.name = 'thrusterPivot';
      thrusterPivot.position.set(0, 0.42, 0.3);

      for (const side of [-1, 1]) {
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.42, 6), hullMat);
        pod.position.set(side * 0.22, 0.02, 0);
        pod.rotation.set(-0.36, 0, side * -0.18);
        thrusterPivot.add(pod);

        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.045), cyanFinMat);
        fin.position.set(side * 0.36, 0.1, 0.02);
        fin.rotation.set(0.15, side * -0.25, side * 0.38);
        thrusterPivot.add(fin);

        const plume = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.24, 5), plumeMat);
        plume.position.set(side * 0.25, -0.22, 0.1);
        plume.rotation.set(Math.PI - 0.36, 0, side * -0.18);
        thrusterPivot.add(plume);
      }

      this.cosmeticGroup.add(thrusterPivot);
    } else if (cosmeticId === 'golden_chakkar') {
      const brassMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xeab308,
        emissiveIntensity: 0.72,
        roughness: 0.2,
        metalness: 0.88,
        flatShading: true,
      });
      const jadeMat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x34d399,
        emissiveIntensity: 0.82,
        roughness: 0.26,
        metalness: 0.55,
        flatShading: true,
      });

      const chakkarPivot = new THREE.Group();
      chakkarPivot.name = 'chakkarPivot';
      chakkarPivot.position.set(0, 0.46, 0.36);

      const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.036, 6, 16), brassMat);
      chakkarPivot.add(outerRing);

      const innerCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), jadeMat);
      chakkarPivot.add(innerCore);

      const spokeGeo = new THREE.BoxGeometry(0.76, 0.045, 0.035);
      for (let i = 0; i < 4; i++) {
        const spoke = new THREE.Mesh(spokeGeo, i % 2 === 0 ? brassMat : jadeMat);
        spoke.rotation.z = (i * Math.PI) / 4;
        chakkarPivot.add(spoke);
      }

      this.cosmeticGroup.add(chakkarPivot);
    }
  }

  private rebuildAccessory(skin: CharacterSkin): void {
    while (this.accessoryGroup.children.length > 0) {
      const child = this.accessoryGroup.children.pop();
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    }

    if (skin.accessory === 'pack') {
      const packGeo = new THREE.BoxGeometry(0.42, 0.48, 0.24);
      const pack = new THREE.Mesh(packGeo, this.accentMat);
      pack.position.set(0, 0.36, 0.26);
      pack.castShadow = true;
      this.accessoryGroup.add(pack);

      const rollGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.46, 6);
      rollGeo.rotateZ(Math.PI / 2);
      const roll = new THREE.Mesh(rollGeo, this.visorMat);
      roll.position.set(0, 0.62, 0.26);
      this.accessoryGroup.add(roll);
    } else if (skin.accessory === 'crest') {
      const crystalGeo = new THREE.ConeGeometry(0.11, 0.38, 5);
      const leftCrystal = new THREE.Mesh(crystalGeo, this.visorMat);
      leftCrystal.position.set(-0.28, 0.68, 0.14);
      leftCrystal.rotation.set(-0.35, 0, 0.45);
      this.accessoryGroup.add(leftCrystal);

      const rightCrystal = new THREE.Mesh(crystalGeo.clone(), this.visorMat);
      rightCrystal.position.set(0.28, 0.68, 0.14);
      rightCrystal.rotation.set(-0.35, 0, -0.45);
      this.accessoryGroup.add(rightCrystal);

      const scarfGeo = new THREE.BoxGeometry(0.22, 0.1, 0.45);
      const scarf = new THREE.Mesh(scarfGeo, this.primaryMat);
      scarf.position.set(0, 0.64, 0.25);
      scarf.rotation.x = 0.28;
      this.accessoryGroup.add(scarf);
    } else if (skin.accessory === 'fins') {
      const finGeo = new THREE.ConeGeometry(0.13, 0.52, 4);
      const leftFin = new THREE.Mesh(finGeo, this.accentMat);
      leftFin.position.set(-0.22, 0.42, 0.28);
      leftFin.rotation.set(-0.55, 0, 0.24);
      this.accessoryGroup.add(leftFin);

      const rightFin = new THREE.Mesh(finGeo.clone(), this.accentMat);
      rightFin.position.set(0.22, 0.42, 0.28);
      rightFin.rotation.set(-0.55, 0, -0.24);
      this.accessoryGroup.add(rightFin);

      const flameGeo = new THREE.OctahedronGeometry(0.09, 0);
      const flameL = new THREE.Mesh(flameGeo, this.visorMat);
      flameL.position.set(-0.22, 0.22, 0.38);
      this.accessoryGroup.add(flameL);
      const flameR = new THREE.Mesh(flameGeo.clone(), this.visorMat);
      flameR.position.set(0.22, 0.22, 0.38);
      this.accessoryGroup.add(flameR);
    } else if (skin.accessory === 'hood') {
      const leafGeo = new THREE.ConeGeometry(0.32, 0.42, 5);
      const hood = new THREE.Mesh(leafGeo, this.primaryMat);
      hood.position.set(0, 1.06, 0.16);
      hood.rotation.x = -0.6;
      this.accessoryGroup.add(hood);

      const capeGeo = new THREE.BoxGeometry(0.46, 0.56, 0.06);
      const cape = new THREE.Mesh(capeGeo, this.secondaryMat);
      cape.position.set(0, 0.32, 0.24);
      cape.rotation.x = 0.24;
      this.accessoryGroup.add(cape);
    } else if (skin.accessory === 'wings') {
      const wingGeo = new THREE.BoxGeometry(0.55, 0.16, 0.06);
      const wingL = new THREE.Mesh(wingGeo, this.visorMat);
      wingL.position.set(-0.42, 0.48, 0.26);
      wingL.rotation.set(0.2, -0.35, 0.32);
      this.accessoryGroup.add(wingL);

      const wingR = new THREE.Mesh(wingGeo.clone(), this.visorMat);
      wingR.position.set(0.42, 0.48, 0.26);
      wingR.rotation.set(0.2, 0.35, -0.32);
      this.accessoryGroup.add(wingR);
    } else if (skin.accessory === 'halo') {
      const haloGeo = new THREE.TorusGeometry(0.30, 0.04, 6, 12);
      haloGeo.rotateX(Math.PI / 2);
      const halo = new THREE.Mesh(haloGeo, this.visorMat);
      halo.position.set(0, 1.28, 0.02);
      this.accessoryGroup.add(halo);

      const pauldronsGeo = new THREE.OctahedronGeometry(0.15, 0);
      const pL = new THREE.Mesh(pauldronsGeo, this.accentMat);
      pL.position.set(-0.38, 0.66, 0);
      this.accessoryGroup.add(pL);
      const pR = new THREE.Mesh(pauldronsGeo.clone(), this.accentMat);
      pR.position.set(0.38, 0.66, 0);
      this.accessoryGroup.add(pR);
    } else if (skin.accessory === 'carnival') {
      // Three-plume Basant / Truck-Art festival crown crest atop helm
      const centerPlume = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.36, 4), this.visorMat);
      centerPlume.position.set(0, 1.33, -0.02);
      centerPlume.rotation.x = -0.18;
      this.accessoryGroup.add(centerPlume);

      for (const side of [-1, 1]) {
        const sidePlume = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.28, 4), this.accentMat);
        sidePlume.position.set(side * 0.14, 1.27, 0.02);
        sidePlume.rotation.set(-0.22, 0, side * -0.45);
        this.accessoryGroup.add(sidePlume);

        // Dual sweeping Basant kite wing-ribbons & luminous shoulder gems
        const pennant = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.05), this.accentMat);
        pennant.position.set(side * 0.36, 0.56, 0.26);
        pennant.rotation.set(0.24, side * -0.42, side * 0.28);
        this.accessoryGroup.add(pennant);

        const ribbonTip = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), this.visorMat);
        ribbonTip.position.set(side * 0.54, 0.61, 0.34);
        this.accessoryGroup.add(ribbonTip);
      }

      // Dorsal street-lantern kite diamond emblem
      const lanternGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), this.visorMat);
      lanternGem.position.set(0, 0.48, 0.3);
      this.accessoryGroup.add(lanternGem);
    }
  }

  public updatePose(pose: RunnerPoseState, dt: number, groundHeightBelow: number): void {
    // Contact shadow tracks ground height under player
    const heightAboveGround = Math.max(0, this.root.position.y - groundHeightBelow);
    this.contactShadow.position.y = groundHeightBelow - this.root.position.y + 0.025;
    const shadowScale = THREE.MathUtils.clamp(1 - heightAboveGround * 0.14, 0.35, 1.05);
    this.contactShadow.scale.setScalar(pose.isSliding ? shadowScale * 1.15 : shadowScale);
    (this.contactShadow.material as THREE.MeshBasicMaterial).opacity =
      groundHeightBelow < -5 ? 0 : THREE.MathUtils.clamp(0.44 - heightAboveGround * 0.08, 0.1, 0.44);

    this.vfxTime += dt;

    // Hit flash, pickup surge, or Chronos temporal rim tint
    if (pose.hitFlash > 0) {
      this.primaryMat.emissive.setHex(0xffffff);
      this.primaryMat.emissiveIntensity = pose.hitFlash * 1.4;
    } else if (pose.powerupSurge > 0) {
      this.primaryMat.emissive.setHex(0xbae6fd);
      this.primaryMat.emissiveIntensity = pose.powerupSurge * 0.65;
    } else if (pose.chronosTimer > 0) {
      this.primaryMat.emissive.setHex(0x8b5cf6);
      this.primaryMat.emissiveIntensity = 0.34;
    } else {
      this.primaryMat.emissive.setHex(0x000000);
      this.primaryMat.emissiveIntensity = 0;
    }

    // Shield Shimmer Visual (dual-layer rotating & breathing hex dome)
    this.shieldBubble.visible = pose.hasShield;
    this.shieldInnerShell.visible = pose.hasShield;
    if (pose.hasShield) {
      const shimmer = 0.5 + 0.5 * Math.sin(this.vfxTime * 7.5);
      const baseScale = (pose.isSliding ? 0.78 : 1.0) * (1 + shimmer * 0.035 + pose.powerupSurge * 0.14);
      const yPos = pose.isSliding ? 0.56 : 0.92;

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
      this.magnetAuraGroup.position.y = pose.isSliding ? 0.52 : 0.88;
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
      this.multiplierAuraGroup.position.y = (pose.isSliding ? 0.52 : 0.92) + Math.sin(this.vfxTime * 6) * 0.08;
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
      this.chronosAuraGroup.position.y = (pose.isSliding ? 0.55 : 0.92) + Math.sin(this.vfxTime * 3.2) * 0.05;
      this.chronosRingA.rotation.z += dt * 1.9;
      this.chronosRingB.rotation.z -= dt * 2.5;
      this.chronosAuraGroup.rotation.y += dt * 1.2;
      this.chronosAuraGroup.scale.setScalar(pose.isSliding ? 0.8 : 1.0);
      (this.chronosRingA.material as THREE.MeshBasicMaterial).opacity = 0.72 * warnFlicker;
      (this.chronosRingB.material as THREE.MeshBasicMaterial).opacity = 0.78 * warnFlicker;
    }

    // Squash & stretch recovery
    const sy = pose.squashY;
    const sxz = 1 / Math.sqrt(Math.max(0.65, sy));
    this.bodyRig.scale.set(sxz, sy, sxz);

    // Lane banking tilt
    const targetBank = THREE.MathUtils.clamp(-pose.laneVelX * 0.042, -0.35, 0.35);
    this.bodyRig.rotation.z = THREE.MathUtils.damp(this.bodyRig.rotation.z, targetBank, 14, dt);

    if (pose.isSliding) {
      // Low baseball/parkour slide pose: leaned back, tucked height
      this.bodyRig.position.y = THREE.MathUtils.damp(this.bodyRig.position.y, -0.34, 22, dt);
      this.bodyRig.rotation.x = THREE.MathUtils.damp(this.bodyRig.rotation.x, 1.08, 22, dt);
      this.torsoGroup.rotation.x = THREE.MathUtils.damp(this.torsoGroup.rotation.x, 0.18, 18, dt);
      this.headGroup.rotation.x = THREE.MathUtils.damp(this.headGroup.rotation.x, -0.82, 18, dt);

      this.leftLegPivot.rotation.x = THREE.MathUtils.damp(this.leftLegPivot.rotation.x, 0.15, 20, dt);
      this.rightLegPivot.rotation.x = THREE.MathUtils.damp(this.rightLegPivot.rotation.x, -0.75, 20, dt);
      this.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.leftArmPivot.rotation.x, -0.8, 20, dt);
      this.rightArmPivot.rotation.x = THREE.MathUtils.damp(this.rightArmPivot.rotation.x, 0.75, 20, dt);
    } else if (!pose.isGrounded && !pose.showcaseMode) {
      // Airborne jump / fall pose
      this.bodyRig.position.y = THREE.MathUtils.damp(this.bodyRig.position.y, 0, 14, dt);
      const airPitch = THREE.MathUtils.clamp(pose.vy * 0.025, -0.25, 0.25);
      this.bodyRig.rotation.x = THREE.MathUtils.damp(this.bodyRig.rotation.x, -0.14 - airPitch, 12, dt);
      this.torsoGroup.rotation.x = THREE.MathUtils.damp(this.torsoGroup.rotation.x, 0.12, 12, dt);
      this.headGroup.rotation.x = THREE.MathUtils.damp(this.headGroup.rotation.x, 0.08, 12, dt);

      this.leftLegPivot.rotation.x = THREE.MathUtils.damp(this.leftLegPivot.rotation.x, 0.65, 14, dt);
      this.rightLegPivot.rotation.x = THREE.MathUtils.damp(this.rightLegPivot.rotation.x, -0.55, 14, dt);
      this.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.leftArmPivot.rotation.x, 1.25, 14, dt);
      this.rightArmPivot.rotation.x = THREE.MathUtils.damp(this.rightArmPivot.rotation.x, 1.05, 14, dt);
    } else {
      // Crisp brisk stride run cycle
      const s = Math.sin(pose.runCycle);
      const bob = Math.abs(Math.cos(pose.runCycle)) * 0.09;
      this.bodyRig.position.y = THREE.MathUtils.damp(this.bodyRig.position.y, bob, 18, dt);
      this.bodyRig.rotation.x = THREE.MathUtils.damp(this.bodyRig.rotation.x, -0.16, 14, dt);
      this.torsoGroup.rotation.x = THREE.MathUtils.damp(this.torsoGroup.rotation.x, -0.06, 14, dt);
      this.torsoGroup.rotation.y = THREE.MathUtils.damp(this.torsoGroup.rotation.y, s * 0.14, 16, dt);
      this.headGroup.rotation.x = THREE.MathUtils.damp(this.headGroup.rotation.x, 0.15, 14, dt);

      this.leftLegPivot.rotation.x = s * 0.92;
      this.rightLegPivot.rotation.x = -s * 0.92;
      this.leftArmPivot.rotation.x = -s * 0.88;
      this.rightArmPivot.rotation.x = s * 0.88;
    }

    // Animate equipped Weekly Challenge runner cosmetic
    if (this.currentCosmeticId && this.cosmeticGroup.children.length > 0) {
      const mainChild = this.cosmeticGroup.children[0];
      if (this.currentCosmeticId === 'starlight_crown') {
        mainChild.rotation.y += dt * 2.1;
        mainChild.position.y = 1.38 + Math.sin(this.vfxTime * 4.2) * 0.045;
      } else if (this.currentCosmeticId === 'truckart_wings') {
        mainChild.rotation.x = Math.sin(this.vfxTime * 7.5) * 0.08;
        const s = 1 + Math.sin(this.vfxTime * 6.0) * 0.04;
        mainChild.scale.set(s, s, 1);
      } else if (this.currentCosmeticId === 'comet_halo') {
        mainChild.rotation.z -= dt * 2.8;
      } else if (this.currentCosmeticId === 'emerald_crest') {
        const s = 1 + Math.sin(this.vfxTime * 5.2) * 0.045;
        mainChild.scale.setScalar(s);
      } else if (this.currentCosmeticId === 'marigold_scarf') {
        mainChild.rotation.z = Math.sin(this.vfxTime * 7.2) * 0.06;
        mainChild.rotation.x = Math.sin(this.vfxTime * 5.6) * 0.08;
      } else if (this.currentCosmeticId === 'badshahi_crest') {
        const s = 1 + Math.sin(this.vfxTime * 4.8) * 0.04;
        mainChild.scale.setScalar(s);
      } else if (this.currentCosmeticId === 'prism_thrusters') {
        const s = 1 + Math.sin(this.vfxTime * 12) * 0.05;
        mainChild.scale.set(1, s, s);
      } else if (this.currentCosmeticId === 'golden_chakkar') {
        mainChild.rotation.z += dt * 2.6;
      }
    }

    // Festive sway on Carnival Runner crest & kite ribbons
    if (this.currentSkin.accessory === 'carnival') {
      this.accessoryGroup.rotation.z = Math.sin(this.vfxTime * 6.4) * 0.045;
      this.accessoryGroup.position.y = Math.sin(this.vfxTime * 8.2) * 0.018;
    } else {
      this.accessoryGroup.rotation.z = 0;
      this.accessoryGroup.position.y = 0;
    }

    // Keep visor glowing brightly at current skin's intensity
    this.visorMat.emissiveIntensity = this.currentSkin.emissiveIntensity;
  }

  public dispose(): void {
    this.disposeCosmeticChildren();
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
      }
    });
    this.primaryMat.dispose();
    this.secondaryMat.dispose();
    this.accentMat.dispose();
    this.visorMat.dispose();
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
  }
}
