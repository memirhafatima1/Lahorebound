import * as THREE from 'three';

const SPEED_LINE_COUNT = 108;

/**
 * Computes continuous [0..1.15] peripheral speed-line intensity scaled smoothly
 * from brisk cruising speeds (1.12x) through high-velocity Overdrive (3.0x+).
 */
export function computeSpeedLineIntensity(
  speedMultiplier: number,
  forwardSpeed: number,
  chronosStrength: number,
  sonicBreakIntensity = 0,
): number {
  const chronosDamp = THREE.MathUtils.clamp(1 - chronosStrength, 0, 1);
  if (chronosDamp <= 0.001) return 0;

  const effectiveMult = Math.max(speedMultiplier, forwardSpeed / 11.2);
  if (effectiveMult < 1.12 && sonicBreakIntensity <= 0.004) return 0;

  let rawIntensity = 0;
  if (effectiveMult >= 1.12 && effectiveMult < 1.85) {
    rawIntensity = THREE.MathUtils.lerp(0, 0.24, (effectiveMult - 1.12) / 0.73);
  } else if (effectiveMult >= 1.85 && effectiveMult < 2.5) {
    rawIntensity = THREE.MathUtils.lerp(0.24, 0.62, (effectiveMult - 1.85) / 0.65);
  } else if (effectiveMult >= 2.5) {
    rawIntensity = THREE.MathUtils.lerp(
      0.62,
      1.0,
      THREE.MathUtils.clamp((effectiveMult - 2.5) / 0.85, 0, 1),
    );
  }
  rawIntensity = Math.min(1.15, rawIntensity + sonicBreakIntensity * 0.22);
  return rawIntensity * chronosDamp;
}

export class SpeedLinesEffect {
  public readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.InstancedBufferGeometry;
  private readonly material: THREE.ShaderMaterial;

  private intensity = 0;
  private overdrive = 0;
  private travel = 0;

  constructor(initialAspect = 16 / 9) {
    const positions = new Float32Array([
      0, -0.5, 0,
      1, -0.5, 0,
      1, 0.5, 0,
      0, 0.5, 0,
    ]);
    const uvs = new Float32Array([
      0, 0,
      1, 0,
      1, 1,
      0, 1,
    ]);

    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.setIndex([0, 1, 2, 0, 2, 3]);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this.geometry.instanceCount = SPEED_LINE_COUNT;

    const angles = new Float32Array(SPEED_LINE_COUNT);
    const phases = new Float32Array(SPEED_LINE_COUNT);
    const speeds = new Float32Array(SPEED_LINE_COUNT);
    const scales = new Float32Array(SPEED_LINE_COUNT * 2);
    const seeds = new Float32Array(SPEED_LINE_COUNT * 2);

    for (let i = 0; i < SPEED_LINE_COUNT; i++) {
      // Even angular distribution with gentle side-edge bias for crisp peripheral tunnel vision
      const t = (i + 0.5) / SPEED_LINE_COUNT;
      let angle = t * Math.PI * 2 + (Math.random() - 0.5) * 0.055;
      // Nudge a subset slightly toward lateral flanks where tunnel framing feels strongest
      if (i % 4 === 0) {
        angle += Math.sin(angle * 2) * 0.14;
      }
      angles[i] = angle;

      // Golden-ratio stagger prevents radial banding
      phases[i] = (i * 0.61803398875 + Math.random() * 0.12) % 1.0;

      // Quantized to 0.05 increments so modulo wrap at 1000.0 is seamless
      speeds[i] = 0.8 + Math.round(Math.random() * 13) * 0.05;

      // (length, NDC thickness)
      scales[i * 2] = 0.24 + Math.random() * 0.28;
      scales[i * 2 + 1] = 0.006 + Math.random() * 0.009;

      // (colorMix, radiusJitter)
      seeds[i * 2] = Math.random();
      seeds[i * 2 + 1] = Math.random() * 0.16;
    }

    this.geometry.setAttribute('aAngle', new THREE.InstancedBufferAttribute(angles, 1));
    this.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
    this.geometry.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speeds, 1));
    this.geometry.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 2));
    this.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 2));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTravel: { value: 0 },
        uIntensity: { value: 0 },
        uOverdrive: { value: 0 },
        uAspect: { value: Math.max(0.5, initialAspect) },
        uNight: { value: 0 },
        uLandmarkColor: { value: new THREE.Color(0xf97316) },
      },
      vertexShader: `
        attribute float aAngle;
        attribute float aPhase;
        attribute float aSpeed;
        attribute vec2 aScale;
        attribute vec2 aSeed;

        uniform float uTravel;
        uniform float uIntensity;
        uniform float uAspect;

        varying vec2 vUv;
        varying float vLife;
        varying float vColorMix;

        void main() {
          vUv = uv;
          float life = fract(aPhase + uTravel * aSpeed);
          vLife = life;
          vColorMix = aSeed.x;

          vec2 centerNdc = vec2(0.0, 0.12);
          vec2 rayDir = vec2(cos(aAngle), sin(aAngle));

          // Keep central runner & obstacle lanes completely clear while framing all screen edges
          float vertSafe = rayDir.y > 0.0 ? 0.68 : 0.78;
          float safeRadius = 1.0 / length(vec2(rayDir.x / 0.58, rayDir.y / vertSafe));

          // Exact distance from vanishing center to outer viewport border along this ray
          float tx = 1.12 / max(abs(rayDir.x), 0.001);
          float ty = (rayDir.y > 0.0 ? 1.00 : 1.24) / max(abs(rayDir.y), 0.001);
          float edgeDist = min(tx, ty);

          float rStart = min(edgeDist * 0.74, safeRadius + aSeed.y);
          float rEnd = edgeDist + 0.38;

          float radialT = pow(life, 1.45);
          float tailR = mix(rStart, rEnd, radialT);
          float streakLen = aScale.x * (0.42 + 1.25 * radialT) * (0.65 + 0.65 * uIntensity);
          float tipR = tailR + streakLen;

          // Aspect-corrected perpendicular vector so streaks keep uniform pixel thickness around 360 deg
          vec2 visDir = normalize(vec2(rayDir.x * uAspect, rayDir.y));
          vec2 perpNdc = vec2(-visDir.y / uAspect, visDir.x);

          float width = aScale.y * (0.65 + 0.68 * radialT) * (0.72 + 0.42 * uIntensity);
          vec2 ndcPos =
            centerNdc +
            rayDir * mix(tailR, tipR, position.x) +
            perpNdc * (position.y * width);

          gl_Position = vec4(ndcPos, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uIntensity;
        uniform float uOverdrive;
        uniform float uNight;
        uniform vec3 uLandmarkColor;

        varying vec2 vUv;
        varying float vLife;
        varying float vColorMix;

        void main() {
          // Motion-blur needle profile: bright fast-moving leading head + smeared exponential trailing wash
          float leadingHead = smoothstep(0.0, 0.22, vUv.x) * (1.0 - smoothstep(0.62, 1.0, vUv.x));
          float trailingBlur = exp(-max(0.0, 0.72 - vUv.x) * 3.4) * smoothstep(0.0, 0.08, vUv.x);
          float axialShape = max(leadingHead, trailingBlur * 0.62);

          float distFromAxis = abs(vUv.y - 0.5) * 2.0;
          float halfWidth = max(0.07, axialShape);
          float crossProfile = 1.0 - smoothstep(0.0, halfWidth, distFromAxis);
          if (crossProfile <= 0.004) discard;

          float core = pow(crossProfile, 2.35);
          float lifeFade = smoothstep(0.0, 0.16, vLife) * (1.0 - smoothstep(0.76, 1.0, vLife));
          float alpha = (crossProfile * 0.44 + core * 0.56) * lifeFade * clamp(uIntensity, 0.0, 1.15) * 0.64;
          alpha *= mix(0.88, 1.1, uNight);
          if (alpha <= 0.003) discard;

          // Blend active Lahore landmark accent with warm atmospheric gold-cyan -> 3.0x supersonic violet-white
          vec3 cruiseA = mix(vec3(1.0, 0.86, 0.46), uLandmarkColor, 0.55);
          vec3 cruiseB = mix(vec3(0.45, 0.90, 1.0), uLandmarkColor, 0.35);
          vec3 superA = mix(vec3(0.76, 0.38, 1.0), uLandmarkColor, 0.28);
          vec3 superB = vec3(0.98, 0.56, 0.96);

          vec3 baseColor = mix(
            mix(cruiseA, cruiseB, vColorMix),
            mix(superA, superB, vColorMix),
            uOverdrive
          );
          vec3 streakColor = mix(baseColor, vec3(0.98, 0.99, 1.0), core * (0.45 + 0.30 * uOverdrive));

          gl_FragColor = vec4(streakColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 998;
    this.mesh.visible = false;
  }

  public setAspect(aspect: number): void {
    this.material.uniforms.uAspect.value = Math.max(0.5, aspect);
  }

  public update(
    dt: number,
    speedMultiplier: number,
    chronosStrength: number,
    sonicBreakIntensity: number,
    nightFactor: number,
    timeScale = 1,
    forwardSpeed = speedMultiplier * 11.2,
    landmarkColor?: THREE.Color,
  ): void {
    const chronosDamp = THREE.MathUtils.clamp(1 - chronosStrength, 0, 1);
    const targetIntensity = computeSpeedLineIntensity(
      speedMultiplier,
      forwardSpeed,
      chronosStrength,
      sonicBreakIntensity,
    );

    const intensityLerpAlpha = Math.min(1, dt * (targetIntensity > this.intensity ? 5.2 : 6.8));
    this.intensity = THREE.MathUtils.lerp(this.intensity, targetIntensity, intensityLerpAlpha);
    if (targetIntensity === 0 && this.intensity < 0.004) {
      this.intensity = 0;
    }

    let rawOverdrive = 0;
    if (speedMultiplier > 2.05) {
      if (speedMultiplier < 3.0) {
        rawOverdrive = THREE.MathUtils.lerp(0, 0.58, (speedMultiplier - 2.05) / 0.95);
      } else {
        rawOverdrive = THREE.MathUtils.lerp(
          0.58,
          1.0,
          THREE.MathUtils.clamp((speedMultiplier - 3.0) / 0.35, 0, 1),
        );
      }
      rawOverdrive = Math.min(1, rawOverdrive + sonicBreakIntensity * 0.25);
    }
    const targetOverdrive = rawOverdrive * chronosDamp;
    this.overdrive = THREE.MathUtils.lerp(
      this.overdrive,
      targetOverdrive,
      Math.min(1, dt * 5.8),
    );

    if (landmarkColor) {
      (this.material.uniforms.uLandmarkColor.value as THREE.Color).copy(landmarkColor);
    }

    this.mesh.visible = this.intensity > 0.004;
    if (!this.mesh.visible) return;

    const speedFactor =
      1.35 + Math.max(0, speedMultiplier - 1.12) * 1.45 + this.overdrive * 0.85;
    this.travel = (this.travel + dt * speedFactor * timeScale) % 1000;

    this.material.uniforms.uTravel.value = this.travel;
    this.material.uniforms.uIntensity.value = this.intensity;
    this.material.uniforms.uOverdrive.value = this.overdrive;
    this.material.uniforms.uNight.value = nightFactor;
  }

  public getIntensity(): number {
    return this.intensity;
  }

  public reset(): void {
    this.intensity = 0;
    this.overdrive = 0;
    this.travel = 0;
    this.mesh.visible = false;
    this.material.uniforms.uIntensity.value = 0;
    this.material.uniforms.uOverdrive.value = 0;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

