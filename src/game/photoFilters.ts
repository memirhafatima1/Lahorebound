export type LahorePhotoFilterId =
  | 'original'
  | 'lollywood_70s'
  | 'shahi_vintage'
  | 'androon_noir'
  | 'truck_art_pop';

export interface LahorePhotoFilterPreset {
  id: LahorePhotoFilterId;
  name: string;
  shortLabel: string;
  eraTag: string;
  description: string;
  swatchPrimary: string;
  swatchSecondary: string;
  contrast: number;
  brightness: number;
  saturation: number;
  sepiaMix: number;
  monochromeMix: number;
  shadowFade: number;
  shadowTint: [number, number, number];
  highlightTint: [number, number, number];
  grainAmount: number;
  vignetteAlpha: number;
  warmLeakAlpha: number;
}

export const LAHORE_PHOTO_FILTERS: LahorePhotoFilterPreset[] = [
  {
    id: 'original',
    name: 'Natural Frame',
    shortLabel: 'Natural',
    eraTag: 'Raw Render',
    description: 'Unfiltered Lahore lighting and colors',
    swatchPrimary: '#38bdf8',
    swatchSecondary: '#e2e8f0',
    contrast: 1.0,
    brightness: 0,
    saturation: 1.0,
    sepiaMix: 0,
    monochromeMix: 0,
    shadowFade: 0,
    shadowTint: [0, 0, 0],
    highlightTint: [0, 0, 0],
    grainAmount: 0,
    vignetteAlpha: 0,
    warmLeakAlpha: 0,
  },
  {
    id: 'lollywood_70s',
    name: "Lollywood '70s",
    shortLabel: "Lollywood '70s",
    eraTag: 'Technicolor Warm',
    description: 'Golden-age studio warmth, rich contrast & amber halation',
    swatchPrimary: '#f59e0b',
    swatchSecondary: '#fb7185',
    contrast: 1.15,
    brightness: 4,
    saturation: 1.14,
    sepiaMix: 0.14,
    monochromeMix: 0,
    shadowFade: 8,
    shadowTint: [10, -4, -12],
    highlightTint: [22, 11, -14],
    grainAmount: 7,
    vignetteAlpha: 0.34,
    warmLeakAlpha: 0.14,
  },
  {
    id: 'shahi_vintage',
    name: 'Shahi Vintage',
    shortLabel: 'Shahi Reel',
    eraTag: 'Archival 35mm',
    description: 'Aged sepia celluloid, lifted blacks & nostalgic film grain',
    swatchPrimary: '#d97706',
    swatchSecondary: '#fde68a',
    contrast: 1.08,
    brightness: 6,
    saturation: 0.62,
    sepiaMix: 0.62,
    monochromeMix: 0,
    shadowFade: 18,
    shadowTint: [18, 8, -10],
    highlightTint: [20, 12, -8],
    grainAmount: 13,
    vignetteAlpha: 0.42,
    warmLeakAlpha: 0.08,
  },
  {
    id: 'androon_noir',
    name: 'Androon Noir',
    shortLabel: 'Androon Noir',
    eraTag: 'Silver Screen',
    description: 'High-contrast monochrome drama with cool moonlit shadows',
    swatchPrimary: '#e2e8f0',
    swatchSecondary: '#475569',
    contrast: 1.32,
    brightness: -4,
    saturation: 0.15,
    sepiaMix: 0,
    monochromeMix: 0.94,
    shadowFade: 4,
    shadowTint: [-8, -2, 14],
    highlightTint: [10, 9, 4],
    grainAmount: 11,
    vignetteAlpha: 0.52,
    warmLeakAlpha: 0,
  },
  {
    id: 'truck_art_pop',
    name: 'Truck Art Cinema',
    shortLabel: 'Truck Art',
    eraTag: 'New Wave Pop',
    description: 'High-contrast vivid magenta, marigold & emerald color pop',
    swatchPrimary: '#ec4899',
    swatchSecondary: '#10b981',
    contrast: 1.22,
    brightness: 2,
    saturation: 1.36,
    sepiaMix: 0,
    monochromeMix: 0,
    shadowFade: 0,
    shadowTint: [-8, 8, 12],
    highlightTint: [16, 4, -8],
    grainAmount: 4,
    vignetteAlpha: 0.28,
    warmLeakAlpha: 0.06,
  },
];

export const LAHORE_PHOTO_FILTER_MAP: Record<LahorePhotoFilterId, LahorePhotoFilterPreset> =
  LAHORE_PHOTO_FILTERS.reduce(
    (acc, preset) => {
      acc[preset.id] = preset;
      return acc;
    },
    {} as Record<LahorePhotoFilterId, LahorePhotoFilterPreset>,
  );

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/**
 * Applies deterministic Pakistani-cinema color grading, split-toning, film grain,
 * warm light leak, and edge vignette directly to a 2D canvas context.
 */
export function applyLahorePhotoFilter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  filterId: LahorePhotoFilterId,
): void {
  const preset = LAHORE_PHOTO_FILTER_MAP[filterId];
  if (!preset || preset.id === 'original') return;

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const totalPixels = width * height;

  const {
    contrast,
    brightness,
    saturation,
    sepiaMix,
    monochromeMix,
    shadowFade,
    shadowTint,
    highlightTint,
    grainAmount,
  } = preset;

  for (let p = 0; p < totalPixels; p++) {
    const idx = p * 4;
    let r = data[idx];
    let g = data[idx + 1];
    let b = data[idx + 2];

    // 1. Contrast & brightness curve around midpoint
    r = (r - 128) * contrast + 128 + brightness;
    g = (g - 128) * contrast + 128 + brightness;
    b = (b - 128) * contrast + 128 + brightness;

    // 2. Compute perceptual luma & adjust saturation
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    if (saturation !== 1.0) {
      r = luma + (r - luma) * saturation;
      g = luma + (g - luma) * saturation;
      b = luma + (b - luma) * saturation;
    }

    // 3. Silver-screen monochrome blend (Androon Noir)
    if (monochromeMix > 0) {
      const mono = 0.299 * r + 0.587 * g + 0.114 * b;
      r = r + (mono - r) * monochromeMix;
      g = g + (mono - g) * monochromeMix;
      b = b + (mono - b) * monochromeMix;
    }

    // 4. Warm archival sepia tone blend (Shahi Vintage / Lollywood '70s)
    if (sepiaMix > 0) {
      const sr = r * 0.393 + g * 0.769 + b * 0.189;
      const sg = r * 0.349 + g * 0.686 + b * 0.168;
      const sb = r * 0.272 + g * 0.534 + b * 0.131;
      r = r + (sr - r) * sepiaMix;
      g = g + (sg - g) * sepiaMix;
      b = b + (sb - b) * sepiaMix;
    }

    // 5. Split-toning across shadows & highlights + vintage faded black floor
    const normLuma = Math.max(0, Math.min(1, luma / 255));
    const shadowWeight = (1 - normLuma) * (1 - normLuma);
    const highlightWeight = normLuma * normLuma;

    r += shadowFade * shadowWeight + shadowTint[0] * shadowWeight + highlightTint[0] * highlightWeight;
    g += shadowFade * shadowWeight + shadowTint[1] * shadowWeight + highlightTint[1] * highlightWeight;
    b += shadowFade * shadowWeight + shadowTint[2] * shadowWeight + highlightTint[2] * highlightWeight;

    // 6. Fast deterministic celluloid grain
    if (grainAmount > 0) {
      let hash = Math.imul(p ^ 0x9e3779b9, 0x85ebca6b);
      hash ^= hash >>> 13;
      const grain = (((hash & 255) / 255) - 0.5) * 2 * grainAmount;
      r += grain;
      g += grain;
      b += grain;
    }

    data[idx] = clampByte(r);
    data[idx + 1] = clampByte(g);
    data[idx + 2] = clampByte(b);
  }

  ctx.putImageData(imgData, 0, 0);

  // 7. Subtle warm edge halation / studio light leak
  if (preset.warmLeakAlpha > 0) {
    const leak = ctx.createLinearGradient(0, 0, width * 0.68, height * 0.55);
    leak.addColorStop(0, `rgba(251, 146, 60, ${preset.warmLeakAlpha})`);
    leak.addColorStop(0.42, `rgba(244, 114, 182, ${preset.warmLeakAlpha * 0.38})`);
    leak.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = leak;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // 8. Dramatic 35mm cinema lens vignette
  if (preset.vignetteAlpha > 0) {
    const cx = width * 0.5;
    const cy = height * 0.48;
    const innerR = Math.min(width, height) * 0.34;
    const outerR = Math.hypot(width * 0.55, height * 0.55);
    const vig = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(0.65, `rgba(10, 8, 12, ${preset.vignetteAlpha * 0.38})`);
    vig.addColorStop(1, `rgba(6, 5, 10, ${preset.vignetteAlpha})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
  }
}
