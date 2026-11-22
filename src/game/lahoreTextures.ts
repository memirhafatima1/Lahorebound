import * as THREE from 'three';

export interface ComicBoardSpec {
  id: string;
  bgTop: string;
  bgBottom: string;
  accent: string;
  badgeColor: string;
  urduLine: string;
  punjabiTag: string;
  artKind: 'chai' | 'rickshaw' | 'karahi' | 'cricket' | 'samosa' | 'lahore';
}

const COMIC_SPECS: ComicBoardSpec[] = [
  {
    id: 'chai',
    bgTop: '#fef3c7',
    bgBottom: '#fde68a',
    accent: '#dc2626',
    badgeColor: '#15803d',
    urduLine: 'چائے پی کے بھاگ اوئے!',
    punjabiTag: 'CHAI DHABBA · لاہور دی جان',
    artKind: 'chai',
  },
  {
    id: 'rickshaw',
    bgTop: '#dcfce7',
    bgBottom: '#bbf7d0',
    accent: '#ea580c',
    badgeColor: '#eab308',
    urduLine: 'ہٹ جا سوہنیا! رکشہ آیا!',
    punjabiTag: 'PIPP PIPP · ہارن بجا اوئے!',
    artKind: 'rickshaw',
  },
  {
    id: 'karahi',
    bgTop: '#ffe4e6',
    bgBottom: '#fecdd3',
    accent: '#b91c1c',
    badgeColor: '#f59e0b',
    urduLine: 'لاہور نہ ویکھیا تے کی ویکھیا!',
    punjabiTag: 'FOOD STREET · جے گل اے!',
    artKind: 'karahi',
  },
  {
    id: 'cricket',
    bgTop: '#e0f2fe',
    bgBottom: '#bae6fd',
    accent: '#0369a1',
    badgeColor: '#16a34a',
    urduLine: 'چک دے پھٹے لاہوری!',
    punjabiTag: 'SIXER SHOT · چھکا مار!',
    artKind: 'cricket',
  },
  {
    id: 'samosa',
    bgTop: '#ffedd5',
    bgBottom: '#fed7aa',
    accent: '#c2410c',
    badgeColor: '#db2777',
    urduLine: 'گرما گرم سموسے، تیز بھاگ!',
    punjabiTag: 'ANARKALI BAZAAR · واہ جی واہ!',
    artKind: 'samosa',
  },
  {
    id: 'lahore',
    bgTop: '#f3e8ff',
    bgBottom: '#e9d5ff',
    accent: '#7e22ce',
    badgeColor: '#10b981',
    urduLine: 'زندہ باد لاہور · واہ اوئے شیر!',
    punjabiTag: 'SADA LAHORE · سوہنا شہر!',
    artKind: 'lahore',
  },
];

function drawTruckArtBorder(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string): void {
  // Outer dark ink frame
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, h);

  // Inner bright base border
  ctx.fillStyle = accent;
  ctx.fillRect(6, 6, w - 12, h - 12);

  // Truck-art diamond & scalloped triangles along top & bottom edges
  const colors = ['#facc15', '#ec4899', '#06b6d4', '#22c55e', '#f97316'];
  const step = 24;
  for (let x = 14; x < w - 14; x += step) {
    const col = colors[Math.floor(x / step) % colors.length];
    ctx.fillStyle = col;
    // Top triangle
    ctx.beginPath();
    ctx.moveTo(x, 6);
    ctx.lineTo(x + step * 0.5, 19);
    ctx.lineTo(x + step, 6);
    ctx.closePath();
    ctx.fill();

    // Bottom triangle
    ctx.beginPath();
    ctx.moveTo(x, h - 6);
    ctx.lineTo(x + step * 0.5, h - 19);
    ctx.lineTo(x + step, h - 6);
    ctx.closePath();
    ctx.fill();
  }

  // Side marigold dots
  for (let y = 26; y < h - 22; y += 22) {
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(13, y, 4.5, 0, Math.PI * 2);
    ctx.arc(w - 13, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawComicHalftoneBurst(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  spikes: number,
  fill: string,
): void {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / spikes;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#0f172a';
  ctx.stroke();
  ctx.restore();
}

function drawComicIllustration(
  ctx: CanvasRenderingContext2D,
  kind: ComicBoardSpec['artKind'],
  cx: number,
  cy: number,
): void {
  drawComicHalftoneBurst(ctx, cx, cy, 74, 54, 12, '#ffffff');

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3.5;

  if (kind === 'chai') {
    // Steaming cartoon kulhar / chai cup with goofy happy eyes!
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.moveTo(cx - 28, cy - 12);
    ctx.lineTo(cx + 28, cy - 12);
    ctx.lineTo(cx + 20, cy + 34);
    ctx.lineTo(cx - 20, cy + 34);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Chai froth top
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 12, 28, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Handle
    ctx.beginPath();
    ctx.arc(cx + 28, cy + 10, 12, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.stroke();

    // Cartoon eyes & grin
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - 9, cy + 8, 6, 0, Math.PI * 2);
    ctx.arc(cx + 9, cy + 8, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(cx - 8, cy + 8, 2.5, 0, Math.PI * 2);
    ctx.arc(cx + 10, cy + 8, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Steam swirls
    ctx.strokeStyle = '#ea580c';
    for (const sx of [-12, 0, 12]) {
      ctx.beginPath();
      ctx.moveTo(cx + sx, cy - 24);
      ctx.quadraticCurveTo(cx + sx - 7, cy - 36, cx + sx + 4, cy - 48);
      ctx.stroke();
    }
  } else if (kind === 'rickshaw') {
    // Cartoon green & yellow Lahore rickshaw zooming!
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.roundRect(cx - 34, cy - 30, 62, 26, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.roundRect(cx - 38, cy - 6, 74, 28, 6);
    ctx.fill();
    ctx.stroke();

    // Windshield & eyes
    ctx.fillStyle = '#bae6fd';
    ctx.fillRect(cx + 8, cy - 24, 18, 16);
    ctx.strokeRect(cx + 8, cy - 24, 18, 16);

    // Wheels
    ctx.fillStyle = '#1e293b';
    for (const wx of [-24, 24]) {
      ctx.beginPath();
      ctx.arc(cx + wx, cy + 25, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Speed lines
    ctx.strokeStyle = '#ef4444';
    for (const ly of [-18, 0, 14]) {
      ctx.beginPath();
      ctx.moveTo(cx - 44, cy + ly);
      ctx.lineTo(cx - 60, cy + ly);
      ctx.stroke();
    }
  } else if (kind === 'karahi') {
    // Grinning Lahori mustache face + chef hat & sizzling karahi pan
    ctx.fillStyle = '#fdba74';
    ctx.beginPath();
    ctx.arc(cx, cy + 4, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Tall chef hat / turban crest
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - 10, cy - 28, 13, 0, Math.PI * 2);
    ctx.arc(cx + 10, cy - 28, 13, 0, Math.PI * 2);
    ctx.arc(cx, cy - 34, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Big classic Punjabi twirled mustache
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(cx, cy + 8);
    ctx.quadraticCurveTo(cx - 24, cy + 2, cx - 28, cy + 16);
    ctx.quadraticCurveTo(cx - 12, cy + 18, cx, cy + 12);
    ctx.quadraticCurveTo(cx + 12, cy + 18, cx + 28, cy + 16);
    ctx.quadraticCurveTo(cx + 24, cy + 2, cx, cy + 8);
    ctx.fill();

    // Eyes
    ctx.beginPath();
    ctx.arc(cx - 9, cy - 4, 3.2, 0, Math.PI * 2);
    ctx.arc(cx + 9, cy - 4, 3.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'cricket') {
    // Cricket bat + flying glowing ball
    ctx.save();
    ctx.translate(cx - 6, cy + 6);
    ctx.rotate(-0.55);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-10, -28, 20, 48);
    ctx.strokeRect(-10, -28, 20, 48);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-4, -46, 8, 18);
    ctx.restore();

    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(cx + 24, cy - 18, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'samosa') {
    // Golden crispy cartoon samosa with sunglasses!
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 34);
    ctx.lineTo(cx + 34, cy + 26);
    ctx.lineTo(cx - 34, cy + 26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Shades
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(cx - 20, cy - 4, 16, 10);
    ctx.fillRect(cx + 4, cy - 4, 16, 10);
    ctx.fillRect(cx - 4, cy - 1, 8, 3);
  } else {
    // Minar-e-Pakistan cartoon emblem + crescent star
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 38);
    ctx.lineTo(cx + 8, cy - 38);
    ctx.lineTo(cx + 18, cy + 32);
    ctx.lineTo(cx - 18, cy + 32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#16a34a';
    ctx.fillRect(cx - 28, cy + 24, 56, 12);
    ctx.strokeRect(cx - 28, cy + 24, 56, 12);

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(cx + 26, cy - 24, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

function drawComicBoardTexture(
  spec: ComicBoardSpec,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  drawTruckArtBorder(ctx, w, h, spec.accent);

  // Inner comic panel backdrop
  const grad = ctx.createLinearGradient(0, 20, 0, h - 20);
  grad.addColorStop(0, spec.bgTop);
  grad.addColorStop(1, spec.bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(20, 20, w - 40, h - 40);

  ctx.lineWidth = 4;
  ctx.strokeStyle = '#0f172a';
  ctx.strokeRect(20, 20, w - 40, h - 40);

  // Subtle comic halftone dots on background
  ctx.fillStyle = 'rgba(15, 23, 42, 0.06)';
  for (let gx = 32; gx < w - 30; gx += 20) {
    for (let gy = 32; gy < h - 30; gy += 20) {
      ctx.beginPath();
      ctx.arc(gx, gy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Left panel illustration
  drawComicIllustration(ctx, spec.artKind, 108, 126);

  // White comic speech bubble on the right with tail pointing to cartoon!
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(194, 38, 280, 108, 20);
  ctx.fill();
  ctx.stroke();

  // Speech bubble tail
  ctx.beginPath();
  ctx.moveTo(196, 98);
  ctx.lineTo(168, 112);
  ctx.lineTo(196, 122);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Cover inner tail line
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(194, 99, 6, 22);
  ctx.restore();

  // Bold Urdu comic dialogue inside speech bubble
  ctx.save();
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 31px "Noto Nastaliq Urdu", "Noto Sans Arabic", Tahoma, Arial, sans-serif';
  ctx.fillText(spec.urduLine, 334, 92, 252);
  ctx.restore();

  // Bottom colorful Punjabi / Lahori banner ribbon
  ctx.save();
  ctx.fillStyle = spec.badgeColor;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.roundRect(196, 162, 276, 50, 12);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 20px system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif';
  ctx.fillText(spec.punjabiTag, 334, 188, 256);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.max(1, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

function createRoadAsphaltTexture(
  baseHex: string,
  grainHex: string,
  mode: 'brick' | 'garden' | 'asphalt',
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  if (mode === 'brick') {
    // Androon Lahore terracotta kharanja brick pattern + warm sandstone edge inlays
    const bw = 32;
    const bh = 16;
    ctx.strokeStyle = 'rgba(42, 18, 10, 0.34)';
    ctx.lineWidth = 2;
    for (let row = 0; row < size / bh; row++) {
      const y = row * bh;
      const offset = (row % 2) * (bw / 2);
      for (let col = -1; col <= size / bw; col++) {
        const x = col * bw + offset;
        ctx.fillStyle = (row + col) % 3 === 0 ? grainHex : baseHex;
        ctx.fillRect(x + 1, y + 1, bw - 2, bh - 2);
        ctx.strokeRect(x, y, bw, bh);
      }
    }
    ctx.fillStyle = 'rgba(251, 191, 36, 0.22)';
    ctx.fillRect(0, 0, 12, size);
    ctx.fillRect(size - 12, 0, 12, size);
  } else if (mode === 'garden') {
    // Minar Park & Shalimar Gardens limestone terrazzo pavers with Mughal emerald-gold border
    const tile = 32;
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.24)';
    ctx.lineWidth = 2;
    for (let row = 0; row < size / tile; row++) {
      for (let col = 0; col < size / tile; col++) {
        const x = col * tile;
        const y = row * tile;
        ctx.fillStyle = (row + col) % 2 === 0 ? baseHex : grainHex;
        ctx.fillRect(x + 1, y + 1, tile - 2, tile - 2);
        ctx.strokeRect(x, y, tile, tile);

        if ((row + col) % 4 === 0) {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.28)';
          ctx.beginPath();
          ctx.moveTo(x + tile * 0.5, y + 6);
          ctx.lineTo(x + tile - 6, y + tile * 0.5);
          ctx.lineTo(x + tile * 0.5, y + tile - 6);
          ctx.lineTo(x + 6, y + tile * 0.5);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    ctx.fillStyle = 'rgba(21, 128, 61, 0.45)';
    ctx.fillRect(0, 0, 14, size);
    ctx.fillRect(size - 14, 0, 14, size);
  } else {
    // Canal & Gulberg smooth asphalt with worn tire tracks & subtle sheen grain
    ctx.fillStyle = grainHex;
    for (let i = 0; i < 420; i++) {
      const x = (i * 73) % size;
      const y = (i * 137) % size;
      ctx.fillRect(x, y, 3, 3);
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(36, 0, 26, size);
    ctx.fillRect(114, 0, 26, size);
    ctx.fillRect(194, 0, 26, size);

    ctx.fillStyle = 'rgba(16, 185, 129, 0.24)';
    ctx.fillRect(0, 0, 10, size);
    ctx.fillRect(size - 10, 0, 10, size);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 8);
  tex.anisotropy = Math.max(1, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

function createTruckArtRailTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 256;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#15803d';
  ctx.fillRect(0, 6, w, h - 12);

  const colors = ['#facc15', '#ec4899', '#06b6d4', '#f97316', '#ffffff'];
  const step = 32;
  for (let x = 0; x < w; x += step) {
    const c = colors[(x / step) % colors.length];
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x + step * 0.5, 10);
    ctx.lineTo(x + step - 4, h * 0.5);
    ctx.lineTo(x + step * 0.5, h - 10);
    ctx.lineTo(x + 4, h * 0.5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(x + step * 0.5, h * 0.5, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(0, 0, w, 5);
  ctx.fillRect(0, h - 5, w, 5);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(4, 1);
  tex.anisotropy = Math.max(1, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

export interface LahoreTexturePack {
  comicTextures: THREE.CanvasTexture[];
  comicMaterials: THREE.MeshStandardMaterial[];
  walledRoadTex: THREE.CanvasTexture;
  gardenMarbleTex: THREE.CanvasTexture;
  asphaltRoadTex: THREE.CanvasTexture;
  truckArtRailTex: THREE.CanvasTexture;
  truckArtRailMat: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function createLahoreTexturePack(maxAnisotropy: number): LahoreTexturePack {
  const comicTextures = COMIC_SPECS.map((spec) =>
    drawComicBoardTexture(spec, maxAnisotropy),
  );
  const comicMaterials = comicTextures.map(
    (tex) =>
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.36,
        metalness: 0.08,
        emissive: 0xffffff,
        emissiveMap: tex,
        emissiveIntensity: 0.24,
      }),
  );

  const walledRoadTex = createRoadAsphaltTexture(
    '#6b4c3e',
    '#7c5847',
    'brick',
    maxAnisotropy,
  );
  const gardenMarbleTex = createRoadAsphaltTexture(
    '#525d6b',
    '#5e6b7b',
    'garden',
    maxAnisotropy,
  );
  const asphaltRoadTex = createRoadAsphaltTexture(
    '#2a313d',
    '#394252',
    'asphalt',
    maxAnisotropy,
  );
  const truckArtRailTex = createTruckArtRailTexture(maxAnisotropy);
  const truckArtRailMat = new THREE.MeshStandardMaterial({
    map: truckArtRailTex,
    roughness: 0.38,
    metalness: 0.22,
    emissive: 0xffffff,
    emissiveMap: truckArtRailTex,
    emissiveIntensity: 0.16,
  });

  return {
    comicTextures,
    comicMaterials,
    walledRoadTex,
    gardenMarbleTex,
    asphaltRoadTex,
    truckArtRailTex,
    truckArtRailMat,
    dispose: () => {
      for (const m of comicMaterials) m.dispose();
      for (const t of comicTextures) t.dispose();
      walledRoadTex.dispose();
      gardenMarbleTex.dispose();
      asphaltRoadTex.dispose();
      truckArtRailMat.dispose();
      truckArtRailTex.dispose();
    },
  };
}
