import * as THREE from 'three';
import type { LahoreLandmarkKind, WeatherCondition } from './types';
import type { LandmarkForecast } from './weather';

export interface AmbientOverlayProfile {
  leavesWeight: number;
  shimmerWeight: number;
  mistWeight: number;
  summary: string;
}

const LEAF_COUNT = 52;
const SHIMMER_COUNT = 44;
const MIST_RIBBON_COUNT = 56;

const LEAF_PALETTE = [
  0xf59e0b, // Chinar amber
  0xfbbf24, // Sunlit gold leaf
  0xf97316, // Gulmohar orange
  0xef4444, // Gulmohar blossom crimson
  0x34d399, // Shalimar willow emerald
  0x10b981, // Garden jade leaf
  0xd97706, // Warm autumn ochre
] as const;

const _tmpMat = new THREE.Matrix4();
const _tmpPos = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();
const _tmpScale = new THREE.Vector3();
const _tmpEuler = new THREE.Euler();
const _tmpColor = new THREE.Color();

export function getAmbientOverlayProfile(
  forecast: LandmarkForecast,
  landmark: LahoreLandmarkKind,
): AmbientOverlayProfile {
  // Primary meteorological blend driven by the active landmark's forecast condition
  let leavesWeight = 0.35;
  let shimmerWeight = 0;
  let mistWeight = 0;

  switch (forecast.condition) {
    case 'sunny_haze':
      shimmerWeight = 0.9;
      leavesWeight = 0.28;
      mistWeight = 0;
      break;
    case 'mist':
      mistWeight = 0.92;
      leavesWeight = 0.72;
      shimmerWeight = 0;
      break;
    case 'light_rain':
      leavesWeight = 0.92;
      mistWeight = 0.64;
      shimmerWeight = 0;
      break;
    case 'clear':
    default:
      leavesWeight = 0.56;
      mistWeight = 0.14;
      shimmerWeight = 0.12;
      break;
  }

  // Zone-specific atmospheric micro-tuning per Lahore landmark
  let summary = 'Swirling Breeze Leaves';
  switch (landmark) {
    case 'gate':
      shimmerWeight = Math.max(shimmerWeight, 0.92);
      leavesWeight = 0.34;
      summary = 'Warm Sandstone Heat Shimmer · Courtyard Breeze';
      break;
    case 'bazaar':
      shimmerWeight = Math.max(shimmerWeight, 0.86);
      leavesWeight = 0.22;
      summary = 'Bazaar Heat Shimmer · Golden Air Motes';
      break;
    case 'mosque':
      shimmerWeight = Math.max(shimmerWeight, 0.96);
      leavesWeight = 0.36;
      summary = 'Royal Courtyard Heat Shimmer · Swirling Leaves';
      break;
    case 'minar':
      leavesWeight = 0.96;
      mistWeight = Math.max(mistWeight, 0.56);
      summary = 'Swirling Park Leaves · Light Monsoon Mist';
      break;
    case 'gardens':
      mistWeight = Math.max(mistWeight, 0.96);
      leavesWeight = 0.8;
      summary = 'Marble Fountain Mist · Swirling Garden Leaves';
      break;
    case 'canal':
      leavesWeight = 1.0;
      mistWeight = Math.max(mistWeight, 0.72);
      summary = 'Willow & Gulmohar Leaves · Canal Mist';
      break;
    case 'liberty':
      mistWeight = Math.max(mistWeight, 0.62);
      leavesWeight = 0.56;
      shimmerWeight = Math.max(shimmerWeight, 0.28);
      summary = 'Boulevard Light Mist · Evening Breeze Leaves';
      break;
  }

  return {
    leavesWeight,
    shimmerWeight,
    mistWeight,
    summary,
  };
}

function createCurvedLeafGeometry(): THREE.BufferGeometry {
  // Lightweight 6-vertex curved double-diamond leaf blade (4 triangles, zero indices overhead)
  const positions = new Float32Array([
    // Left half
    0.0, 0.0, -0.14,
    -0.075, 0.022, 0.0,
    0.0, 0.032, 0.01,

    -0.075, 0.022, 0.0,
    0.0, -0.012, 0.15,
    0.0, 0.032, 0.01,

    // Right half
    0.0, 0.0, -0.14,
    0.0, 0.032, 0.01,
    0.075, 0.02, 0.0,

    0.0, 0.032, 0.01,
    0.0, -0.012, 0.15,
    0.075, 0.02, 0.0,
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

function createMistWispTexture(size = 96): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size * 0.5;
    const cy = size * 0.5;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1.35, 0.72);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.34);
    grad.addColorStop(0, 'rgba(241, 245, 249, 0.65)');
    grad.addColorStop(0.45, 'rgba(226, 232, 240, 0.28)');
    grad.addColorStop(1, 'rgba(226, 232, 240, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export class AmbientWeatherOverlay {
  public readonly group = new THREE.Group();

  private enabled = true;
  private activeForecastCondition: WeatherCondition = 'sunny_haze';
  private activeLandmark: LahoreLandmarkKind = 'gate';
  private activeSummary = 'Warm Sandstone Heat Shimmer · Courtyard Breeze';

  private targetLeaves = 0.34;
  private targetShimmer = 0.92;
  private targetMist = 0;

  private leavesStrength = 0.34;
  private shimmerStrength = 0.92;
  private mistStrength = 0;

  // 1. Swirling 3D Breeze Leaves (single InstancedMesh draw call)
  private readonly leafGeo: THREE.BufferGeometry;
  private readonly leafMat: THREE.MeshStandardMaterial;
  private readonly leafMesh: THREE.InstancedMesh;
  private readonly leafX = new Float32Array(LEAF_COUNT);
  private readonly leafY = new Float32Array(LEAF_COUNT);
  private readonly leafZ = new Float32Array(LEAF_COUNT);
  private readonly leafSeed = new Float32Array(LEAF_COUNT);
  private readonly leafSwirl = new Float32Array(LEAF_COUNT);
  private readonly leafScale = new Float32Array(LEAF_COUNT);
  private readonly leafRotX = new Float32Array(LEAF_COUNT);
  private readonly leafRotY = new Float32Array(LEAF_COUNT);
  private readonly leafRotZ = new Float32Array(LEAF_COUNT);

  // 2. Heat Shimmer Rising Mirage Wisps (custom ShaderMaterial Points)
  private readonly shimmerPositions = new Float32Array(SHIMMER_COUNT * 3);
  private readonly shimmerSeeds = new Float32Array(SHIMMER_COUNT);
  private readonly shimmerScales = new Float32Array(SHIMMER_COUNT);
  private readonly shimmerGeo: THREE.BufferGeometry;
  private readonly shimmerMat: THREE.ShaderMaterial;
  private readonly shimmerPoints: THREE.Points;

  // 3. Light Mist Breeze Ribbons (soft elliptical mist Clouds)
  private readonly mistPositions = new Float32Array(MIST_RIBBON_COUNT * 3);
  private readonly mistSeeds = new Float32Array(MIST_RIBBON_COUNT * 2);
  private readonly mistGeo: THREE.BufferGeometry;
  private readonly mistTex: THREE.CanvasTexture;
  private readonly mistMat: THREE.PointsMaterial;
  private readonly mistPoints: THREE.Points;

  // 4. Feather-light Viewport Perimeter Atmospheric Veil (strictly clear center)
  private readonly veilGeo: THREE.PlaneGeometry;
  private readonly veilMat: THREE.ShaderMaterial;
  private readonly veilMesh: THREE.Mesh;

  constructor(
    initialForecast: LandmarkForecast,
    initialLandmark: LahoreLandmarkKind = 'gate',
    initialEnabled = true,
  ) {
    this.enabled = initialEnabled;

    // --- 1. Swirling Breeze Leaves ---
    this.leafGeo = createCurvedLeafGeometry();
    this.leafMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.62,
      metalness: 0.04,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.leafMesh = new THREE.InstancedMesh(this.leafGeo, this.leafMat, LEAF_COUNT);
    this.leafMesh.frustumCulled = false;

    for (let i = 0; i < LEAF_COUNT; i++) {
      // Bias leaves slightly toward roadside shoulders & mid-upper air so center lanes stay crisp
      const side = i % 2 === 0 ? -1 : 1;
      const shoulder = 1.6 + Math.random() * 8.5;
      this.leafX[i] = i % 5 === 0 ? (Math.random() - 0.5) * 6.5 : side * shoulder;
      this.leafY[i] = 0.6 + Math.random() * 5.8;
      this.leafZ[i] = -46 + Math.random() * 54;
      this.leafSeed[i] = Math.random() * Math.PI * 2;
      this.leafSwirl[i] = 0.7 + Math.random() * 1.15;
      this.leafScale[i] = 0.78 + Math.random() * 0.72;
      this.leafRotX[i] = Math.random() * Math.PI * 2;
      this.leafRotY[i] = Math.random() * Math.PI * 2;
      this.leafRotZ[i] = Math.random() * Math.PI * 2;

      _tmpColor.setHex(LEAF_PALETTE[i % LEAF_PALETTE.length]);
      this.leafMesh.setColorAt(i, _tmpColor);
    }
    if (this.leafMesh.instanceColor) {
      this.leafMesh.instanceColor.needsUpdate = true;
    }
    this.group.add(this.leafMesh);

    // --- 2. Heat Shimmer Mirage Wisps ---
    for (let i = 0; i < SHIMMER_COUNT; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.shimmerPositions[i * 3] = side * (2.2 + Math.random() * 9.5);
      this.shimmerPositions[i * 3 + 1] = 0.35 + Math.random() * 3.8;
      this.shimmerPositions[i * 3 + 2] = -48 + Math.random() * 54;
      this.shimmerSeeds[i] = Math.random() * Math.PI * 2;
      this.shimmerScales[i] = 1.1 + Math.random() * 1.25;
    }
    this.shimmerGeo = new THREE.BufferGeometry();
    this.shimmerGeo.setAttribute('position', new THREE.BufferAttribute(this.shimmerPositions, 3));
    this.shimmerGeo.setAttribute('aSeed', new THREE.BufferAttribute(this.shimmerSeeds, 1));
    this.shimmerGeo.setAttribute('aScale', new THREE.BufferAttribute(this.shimmerScales, 1));

    this.shimmerMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uStrength: { value: 0 },
        uNight: { value: 0 },
        uPixelRatio: { value: 1 },
      },
      vertexShader: `
        attribute float aSeed;
        attribute float aScale;
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vSeed;
        varying float vDistFade;

        void main() {
          vSeed = aSeed;
          vec3 shifted = position;
          shifted.x += sin(uTime * 1.8 + aSeed) * 0.28;
          vec4 mvPos = modelViewMatrix * vec4(shifted, 1.0);
          float depth = max(1.0, -mvPos.z);
          vDistFade = smoothstep(56.0, 12.0, depth) * smoothstep(1.5, 6.0, depth);
          gl_PointSize = clamp(aScale * uPixelRatio * (210.0 / depth), 10.0, 74.0);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uStrength;
        uniform float uNight;
        varying float vSeed;
        varying float vDistFade;

        void main() {
          vec2 uv = gl_PointCoord * 2.0 - 1.0;
          // Horizontal undulating mirage wave ripples rising upwards
          float waveShift = sin(uv.y * 8.0 - uTime * 5.2 + vSeed) * 0.16;
          vec2 warped = vec2(uv.x + waveShift, uv.y * 1.45);
          float radial = exp(-dot(warped, warped) * 2.85);
          float bands = 0.55 + 0.45 * sin(uv.y * 16.0 - uTime * 7.4 + vSeed * 2.0);
          float alpha = radial * bands * uStrength * vDistFade * mix(0.24, 0.11, uNight);
          if (alpha < 0.004) discard;
          vec3 dayHeat = vec3(1.0, 0.87, 0.58);
          vec3 nightHeat = vec3(0.96, 0.56, 0.30);
          vec3 col = mix(dayHeat, nightHeat, uNight);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    this.shimmerPoints = new THREE.Points(this.shimmerGeo, this.shimmerMat);
    this.shimmerPoints.frustumCulled = false;
    this.group.add(this.shimmerPoints);

    // --- 3. Light Breeze Mist Ribbons ---
    for (let i = 0; i < MIST_RIBBON_COUNT; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.mistPositions[i * 3] = i % 4 === 0 ? (Math.random() - 0.5) * 14 : side * (3.2 + Math.random() * 11);
      this.mistPositions[i * 3 + 1] = 0.45 + Math.random() * 2.55;
      this.mistPositions[i * 3 + 2] = -52 + Math.random() * 62;
      this.mistSeeds[i * 2] = Math.random() * Math.PI * 2;
      this.mistSeeds[i * 2 + 1] = 0.65 + Math.random() * 0.9;
    }
    this.mistGeo = new THREE.BufferGeometry();
    this.mistGeo.setAttribute('position', new THREE.BufferAttribute(this.mistPositions, 3));
    this.mistTex = createMistWispTexture(96);
    this.mistMat = new THREE.PointsMaterial({
      size: 5.4,
      sizeAttenuation: true,
      map: this.mistTex,
      color: 0xdbeafe,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: true,
    });
    this.mistPoints = new THREE.Points(this.mistGeo, this.mistMat);
    this.mistPoints.frustumCulled = false;
    this.group.add(this.mistPoints);

    // --- 4. Viewport Perimeter Atmospheric Veil (center completely transparent) ---
    this.veilGeo = new THREE.PlaneGeometry(2, 2);
    this.veilMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uShimmer: { value: 0 },
        uMist: { value: 0 },
        uNight: { value: 0 },
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
        uniform float uShimmer;
        uniform float uMist;
        uniform float uNight;
        varying vec2 vUv;

        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float radialDist = length(vec2(p.x * 0.85, p.y));
          // Strictly zero out the center corridor for pristine obstacle clarity
          float outerMask = smoothstep(0.56, 1.28, radialDist);

          // Rising heat shimmer breath along lower/horizon edges
          float shimmerWave = 0.5 + 0.5 * sin(vUv.y * 28.0 - uTime * 4.8 + sin(vUv.x * 12.0 + uTime));
          float lowerHorizonMask = smoothstep(0.65, 0.0, vUv.y) * outerMask;
          float shimmerAlpha = lowerHorizonMask * shimmerWave * uShimmer * mix(0.085, 0.04, uNight);

          // Soft curling perimeter mist along outer corners
          float mistDrift = 0.5 + 0.5 * sin(vUv.x * 5.0 + uTime * 0.45 + cos(vUv.y * 4.0 - uTime * 0.35));
          float mistAlpha = outerMask * (0.55 + 0.45 * mistDrift) * uMist * mix(0.11, 0.075, uNight);

          vec3 shimmerCol = mix(vec3(1.0, 0.84, 0.5), vec3(0.95, 0.55, 0.28), uNight);
          vec3 mistCol = mix(vec3(0.86, 0.93, 0.99), vec3(0.42, 0.54, 0.72), uNight);

          float totalAlpha = clamp(shimmerAlpha + mistAlpha, 0.0, 0.16);
          if (totalAlpha < 0.002) discard;
          vec3 blended = (shimmerCol * shimmerAlpha + mistCol * mistAlpha) / max(0.0001, shimmerAlpha + mistAlpha);
          gl_FragColor = vec4(blended, totalAlpha);
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.veilMesh = new THREE.Mesh(this.veilGeo, this.veilMat);
    this.veilMesh.frustumCulled = false;
    this.veilMesh.renderOrder = 997;
    this.group.add(this.veilMesh);

    this.setForecast(initialForecast, initialLandmark, true);
    this.update(0.016, 0, 0, 0, 0, 0, 0, 1);
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.group.visible = false;
    } else {
      this.group.visible = true;
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setForecast(
    forecast: LandmarkForecast,
    landmark: LahoreLandmarkKind,
    immediate = false,
  ): void {
    this.activeForecastCondition = forecast.condition;
    this.activeLandmark = landmark;
    const profile = getAmbientOverlayProfile(forecast, landmark);
    this.targetLeaves = profile.leavesWeight;
    this.targetShimmer = profile.shimmerWeight;
    this.targetMist = profile.mistWeight;
    this.activeSummary = profile.summary;

    if (immediate) {
      this.leavesStrength = this.enabled ? this.targetLeaves : 0;
      this.shimmerStrength = this.enabled ? this.targetShimmer : 0;
      this.mistStrength = this.enabled ? this.targetMist : 0;
    }
  }

  public getSummary(): string {
    return this.activeSummary;
  }

  public getActiveCondition(): WeatherCondition {
    return this.activeForecastCondition;
  }

  public getActiveLandmark(): LahoreLandmarkKind {
    return this.activeLandmark;
  }

  public update(
    dt: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    nightFactor: number,
    simTime: number,
    speedRatio = 0,
    pixelRatio = 1,
  ): void {
    const goalLeaves = this.enabled ? this.targetLeaves : 0;
    const goalShimmer = this.enabled ? this.targetShimmer : 0;
    const goalMist = this.enabled ? this.targetMist : 0;

    this.leavesStrength = THREE.MathUtils.damp(this.leavesStrength, goalLeaves, 2.0, dt);
    this.shimmerStrength = THREE.MathUtils.damp(this.shimmerStrength, goalShimmer, 2.0, dt);
    this.mistStrength = THREE.MathUtils.damp(this.mistStrength, goalMist, 2.0, dt);

    const anyActive =
      this.leavesStrength > 0.015 ||
      this.shimmerStrength > 0.015 ||
      this.mistStrength > 0.015;
    this.group.visible = this.enabled || anyActive;
    if (!this.group.visible) return;

    // 1. Update Swirling 3D Breeze Leaves
    if (this.leavesStrength > 0.015) {
      this.leafMesh.visible = true;
      this.leafMat.opacity = this.leavesStrength * 0.88;

      const xMin = playerX - 14;
      const xMax = playerX + 14;
      const zMin = playerZ - 46;
      const zMax = playerZ + 8;
      const breezeScale = 1.0 + speedRatio * 0.65;

      for (let i = 0; i < LEAF_COUNT; i++) {
        const seed = this.leafSeed[i];
        const swirl = this.leafSwirl[i];

        // Swirling wind eddy motion + gentle descent
        let x =
          this.leafX[i] +
          (Math.sin(simTime * 1.45 * swirl + seed) * 1.65 +
            Math.cos(simTime * 0.55 + seed * 1.7) * 0.55) *
            dt *
            breezeScale;
        let y =
          this.leafY[i] +
          (Math.sin(simTime * 2.1 + seed) * 0.58 - 0.34) * dt;
        let z =
          this.leafZ[i] +
          (Math.cos(simTime * 1.3 * swirl + seed) * 1.1 + 0.8 * speedRatio) * dt;

        if (x < xMin) x += 28;
        if (x > xMax) x -= 28;
        if (y < playerY + 0.35) y = playerY + 5.2 + Math.random() * 1.6;
        if (y > playerY + 7.2) y = playerY + 0.8 + Math.random() * 1.2;
        if (z > zMax) {
          z = zMin + Math.random() * 10;
          const side = i % 2 === 0 ? -1 : 1;
          x =
            i % 5 === 0
              ? playerX + (Math.random() - 0.5) * 6.5
              : playerX + side * (1.8 + Math.random() * 8.2);
        } else if (z < zMin) {
          z += 54;
        }

        this.leafX[i] = x;
        this.leafY[i] = y;
        this.leafZ[i] = z;

        this.leafRotX[i] += dt * (2.2 + swirl) * breezeScale;
        this.leafRotY[i] += dt * (1.6 + swirl * 0.8);
        this.leafRotZ[i] += dt * (2.6 - swirl * 0.5);

        _tmpPos.set(x, y, z);
        _tmpEuler.set(this.leafRotX[i], this.leafRotY[i], this.leafRotZ[i]);
        _tmpQuat.setFromEuler(_tmpEuler);
        const s = this.leafScale[i];
        _tmpScale.set(s, s, s);
        _tmpMat.compose(_tmpPos, _tmpQuat, _tmpScale);
        this.leafMesh.setMatrixAt(i, _tmpMat);
      }
      this.leafMesh.instanceMatrix.needsUpdate = true;
    } else {
      this.leafMesh.visible = false;
    }

    // 2. Update Heat Shimmer Mirage Wisps
    if (this.shimmerStrength > 0.015) {
      this.shimmerPoints.visible = true;
      this.shimmerMat.uniforms.uTime.value = simTime;
      this.shimmerMat.uniforms.uStrength.value = this.shimmerStrength;
      this.shimmerMat.uniforms.uNight.value = nightFactor;
      this.shimmerMat.uniforms.uPixelRatio.value = pixelRatio;

      const xMin = playerX - 13;
      const xMax = playerX + 13;
      const zMin = playerZ - 48;
      const zMax = playerZ + 7;
      const posAttr = this.shimmerGeo.attributes.position as THREE.BufferAttribute;
      const arr = this.shimmerPositions;

      for (let i = 0; i < SHIMMER_COUNT; i++) {
        const seed = this.shimmerSeeds[i];
        let x = arr[i * 3] + Math.sin(simTime * 1.15 + seed) * dt * 0.45;
        let y = arr[i * 3 + 1] + dt * (0.72 + 0.24 * Math.sin(seed));
        let z = arr[i * 3 + 2];

        if (x < xMin) x += 26;
        if (x > xMax) x -= 26;
        if (y > playerY + 4.6) {
          y = playerY + 0.25 + Math.random() * 0.4;
          const side = i % 2 === 0 ? -1 : 1;
          x = playerX + side * (2.0 + Math.random() * 9.5);
        } else if (y < playerY + 0.15) {
          y = playerY + 0.35;
        }
        if (z > zMax) {
          z = zMin + Math.random() * 8;
        } else if (z < zMin) {
          z += 55;
        }

        arr[i * 3] = x;
        arr[i * 3 + 1] = y;
        arr[i * 3 + 2] = z;
      }
      posAttr.needsUpdate = true;
    } else {
      this.shimmerPoints.visible = false;
    }

    // 3. Update Light Mist Breeze Ribbons
    if (this.mistStrength > 0.015) {
      this.mistPoints.visible = true;
      this.mistMat.opacity = this.mistStrength * (nightFactor > 0.5 ? 0.16 : 0.21);
      this.mistMat.color.setHex(nightFactor > 0.5 ? 0x94a3b8 : 0xe0f2fe);

      const xMin = playerX - 16;
      const xMax = playerX + 16;
      const zMin = playerZ - 52;
      const zMax = playerZ + 10;
      const mAttr = this.mistGeo.attributes.position as THREE.BufferAttribute;
      const mArr = this.mistPositions;

      for (let i = 0; i < MIST_RIBBON_COUNT; i++) {
        const seed = this.mistSeeds[i * 2];
        const rate = this.mistSeeds[i * 2 + 1];
        let x = mArr[i * 3] + Math.sin(simTime * 0.52 + seed) * dt * 1.05 * rate;
        const y = THREE.MathUtils.clamp(
          mArr[i * 3 + 1] + Math.cos(simTime * 0.65 + seed) * dt * 0.2,
          playerY + 0.35,
          playerY + 3.2,
        );
        let z = mArr[i * 3 + 2] + Math.sin(simTime * 0.35 + seed) * dt * 0.35;

        if (x < xMin) x += 32;
        if (x > xMax) x -= 32;
        if (z > zMax) {
          z = zMin + Math.random() * 12;
          x = xMin + Math.random() * 32;
        } else if (z < zMin) {
          z += 62;
        }

        mArr[i * 3] = x;
        mArr[i * 3 + 1] = y;
        mArr[i * 3 + 2] = z;
      }
      mAttr.needsUpdate = true;
    } else {
      this.mistPoints.visible = false;
    }

    // 4. Update Screen-Edge Perimeter Atmospheric Veil
    const showVeil = this.shimmerStrength > 0.02 || this.mistStrength > 0.02;
    this.veilMesh.visible = showVeil;
    if (showVeil) {
      this.veilMat.uniforms.uTime.value = simTime;
      this.veilMat.uniforms.uShimmer.value = this.shimmerStrength;
      this.veilMat.uniforms.uMist.value = this.mistStrength;
      this.veilMat.uniforms.uNight.value = nightFactor;
    }
  }

  public dispose(): void {
    this.leafGeo.dispose();
    this.leafMat.dispose();
    this.leafMesh.dispose();
    this.shimmerGeo.dispose();
    this.shimmerMat.dispose();
    this.mistGeo.dispose();
    this.mistMat.dispose();
    this.mistTex.dispose();
    this.veilGeo.dispose();
    this.veilMat.dispose();
  }
}
