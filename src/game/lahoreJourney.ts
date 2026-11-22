import type { BiomeId, LahoreLandmarkKind } from './types';

export interface TrackJourneyStop {
  index: number;
  landmark: LahoreLandmarkKind;
  name: string;
  shortName: string;
  subtitle: string;
  bannerText: string;
  biome: BiomeId;
  accentHex: string;
  era: string;
  architecturalHighlight: string;
  encounterMeters: number;
  imageUrl: string;
  imageAlt: string;
  guideTrivia: string;
  history: string;
}

export const JOURNEY_SEGMENT_METERS = 180;

export const LAHORE_TRACK_STOPS: TrackJourneyStop[] = [
  {
    index: 0,
    landmark: 'gate',
    name: 'Delhi Gate',
    shortName: 'Delhi Gate',
    subtitle: 'Androon Walled City',
    bannerText: 'DELHI GATE · ANDROON LAHORE',
    biome: 'canyon',
    accentHex: '#f97316',
    era: '16th Century · Mughal Era',
    architecturalHighlight: 'Royal Shahi Guzargah Trailhead',
    encounterMeters: 12,
    imageUrl: '/src/assets/images/lahore_delhi_gate_1795326526568.jpg',
    imageAlt: 'Golden hour view of Delhi Gate archway in the Walled City of Lahore',
    guideTrivia:
      'Built during the Mughal era as the eastern portal facing Delhi, its restored brick arches open onto the royal Shahi Guzargah trail.',
    history:
      'One of thirteen historic gates encircling Lahore’s Walled City, Delhi Gate opened onto the old imperial highway leading east toward Delhi. Passing beneath its sandstone arches leads into the Shahi Guzargah—past the 17th-century Shahi Hammam and Wazir Khan Mosque.',
  },
  {
    index: 1,
    landmark: 'bazaar',
    name: 'Anarkali Bazaar',
    shortName: 'Anarkali',
    subtitle: 'Lantern Arcade',
    bannerText: 'ANARKALI BAZAAR · LANTERN ARCADE',
    biome: 'canyon',
    accentHex: '#fbbf24',
    era: '18th–19th Century · Historic Market',
    architecturalHighlight: 'Lantern-Lit Merchant Arcade',
    encounterMeters: 180,
    imageUrl: '/src/assets/images/lahore_anarkali_bazaar_1795326526161.jpg',
    imageAlt: 'Evening lantern arcade inside historic Anarkali Bazaar in Lahore',
    guideTrivia:
      'Over 200 years old, Anarkali Bazaar is one of South Asia’s oldest surviving markets, famous for glowing lanterns, textiles, and spices.',
    history:
      'Named after the nearby 16th-century tomb of Anarkali, this bustling corridor is one of the oldest surviving marketplaces in South Asia. For generations, its covered arcades have hummed with spice merchants, hand-crafted textiles, booksellers, and midnight street kitchens.',
  },
  {
    index: 2,
    landmark: 'mosque',
    name: 'Badshahi Mosque',
    shortName: 'Badshahi',
    subtitle: 'Royal Courtyard',
    bannerText: 'BADSHAHI MOSQUE · ROYAL COURTYARD',
    biome: 'canyon',
    accentHex: '#ef4444',
    era: '1673 CE · Emperor Aurangzeb',
    architecturalHighlight: 'Red Sandstone & Triple Marble Domes',
    encounterMeters: 360,
    imageUrl: '/src/assets/images/lahore_badshahi_mosque_1795326526122.jpg',
    imageAlt: 'Sunset panorama of Badshahi Mosque red sandstone courtyard and marble domes',
    guideTrivia:
      'Completed in 1673 under Emperor Aurangzeb, its grand sandstone courtyard held the record as the world’s largest mosque for 313 years.',
    history:
      'Constructed in carved red sandstone inlaid with white marble calligraphy, Badshahi Mosque stood as the largest mosque in the world for over 300 years. Its monumental courtyard and four octagonal minarets face Lahore Fort across Hazuri Bagh.',
  },
  {
    index: 3,
    landmark: 'minar',
    name: 'Minar-e-Pakistan',
    shortName: 'Minar Park',
    subtitle: 'Greater Iqbal Park',
    bannerText: 'MINAR-E-PAKISTAN · IQBAL PARK',
    biome: 'skybridge',
    accentHex: '#16a34a',
    era: '1968 CE · Nasreddin Murat-Khan',
    architecturalHighlight: '62m Star-Petal National Tower',
    encounterMeters: 540,
    imageUrl: '/src/assets/images/lahore_minar_pakistan_1795326525530.jpg',
    imageAlt: 'Golden hour view of Minar-e-Pakistan floral tower in Greater Iqbal Park',
    guideTrivia:
      'Rising 62 meters from a star-shaped floral base, the tower marks the exact park where the historic 1940 Lahore Resolution was passed.',
    history:
      'Rising 62 meters from a star-shaped base like a blooming flower in Greater Iqbal Park, the tower marks the exact site of the historic 1940 Lahore Resolution. Its design fuses classic Mughal pointed arches with soaring modernist concrete petals.',
  },
  {
    index: 4,
    landmark: 'gardens',
    name: 'Shalimar Gardens',
    shortName: 'Shalimar',
    subtitle: 'Marble Terraces',
    bannerText: 'SHALIMAR GARDENS · MARBLE TERRACES',
    biome: 'skybridge',
    accentHex: '#10b981',
    era: '1641 CE · Emperor Shah Jahan',
    architecturalHighlight: 'Three Descending Charbagh Terraces',
    encounterMeters: 720,
    imageUrl: '/src/assets/images/lahore_shalimar_gardens_1795326526357.jpg',
    imageAlt: 'Marble pavilions and terraced fountain pools at Shalimar Gardens in Lahore',
    guideTrivia:
      'Engineered in 1641 with gravity-fed hydraulics from the Ravi River, its 410 marble fountains cascade across three imperial terraces.',
    history:
      'A UNESCO World Heritage masterpiece commissioned by Emperor Shah Jahan, Shalimar Gardens unfolds across three terraced levels fed by the historic Shah Nahar canal. Over 400 marble fountains, carved waterfalls, and baradari pavilions cool the courtyard air.',
  },
  {
    index: 5,
    landmark: 'canal',
    name: 'Canal Road',
    shortName: 'Canal Rd',
    subtitle: 'Willow Flyover',
    bannerText: 'CANAL ROAD · ILLUMINATED FLYOVER',
    biome: 'obsidian',
    accentHex: '#06b6d4',
    era: 'Late 19th Century · Urban Greenway',
    architecturalHighlight: 'Willow-Lined Turquoise Waterway',
    encounterMeters: 900,
    imageUrl: '/src/assets/images/lahore_canal_road_1795327762038.jpg',
    imageAlt: 'Sunset reflections along tree-lined Lahore Canal with blooming gulmohar trees',
    guideTrivia:
      'Shaded by weeping willows and fiery red gulmohar blossoms, the Lahore Canal runs past decorative bridges that glow with lanterns at night.',
    history:
      'Carving a bright turquoise ribbon through the heart of Lahore, the Lahore Canal is shaded by weeping willows, coral-red gulmohar trees, and sweeping underpasses. During festive city nights, illuminated bridges and lanterns mirror across the water.',
  },
  {
    index: 6,
    landmark: 'liberty',
    name: 'Liberty Chowk',
    shortName: 'Liberty',
    subtitle: 'Gulberg Nights',
    bannerText: 'LIBERTY CHOWK · GULBERG NIGHTS',
    biome: 'obsidian',
    accentHex: '#ec4899',
    era: 'Modern Lahore · Gulberg Heart',
    architecturalHighlight: 'Illuminated Civic Fountain & Plaza',
    encounterMeters: 1080,
    imageUrl: '/src/assets/images/lahore_liberty_chowk_1795327761925.jpg',
    imageAlt: 'Twilight view of Liberty Chowk illuminated circular fountain in Gulberg Lahore',
    guideTrivia:
      'Anchored by a glowing fountain roundabout in the heart of Gulberg, Liberty Chowk bridges historic markets, stadiums, and lively evening cafes.',
    history:
      'At the center of Gulberg’s Main Boulevard, Liberty Chowk connects historic markets, outdoor cafes, and nearby Gaddafi Stadium. At dusk, its glowing circular fountain and lively avenues capture the kinetic spirit of contemporary Lahore.',
  },
];

export interface LandmarkLightingTheme {
  skyHex: number;
  fogHex: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  nightGlowHex: number;
  nightGlowIntensity: number;
}

export const LAHORE_LANDMARK_THEMES: Record<LahoreLandmarkKind, LandmarkLightingTheme> = {
  gate: {
    skyHex: 0xf4a261,
    fogHex: 0xf6d4a8,
    hemiSkyHex: 0xfef3c7,
    hemiGroundHex: 0x9a4b2b,
    nightGlowHex: 0xfb923c,
    nightGlowIntensity: 1.05,
  },
  bazaar: {
    skyHex: 0xf59e0b,
    fogHex: 0xfde68a,
    hemiSkyHex: 0xfef08a,
    hemiGroundHex: 0x854d0e,
    nightGlowHex: 0xfbbf24,
    nightGlowIntensity: 1.25,
  },
  mosque: {
    skyHex: 0xe07a5f,
    fogHex: 0xf5cbc1,
    hemiSkyHex: 0xffe4e6,
    hemiGroundHex: 0x7f1d1d,
    nightGlowHex: 0xf87171,
    nightGlowIntensity: 1.1,
  },
  minar: {
    skyHex: 0x4ade80,
    fogHex: 0xdcfce7,
    hemiSkyHex: 0xe0f2fe,
    hemiGroundHex: 0x166534,
    nightGlowHex: 0x22c55e,
    nightGlowIntensity: 1.1,
  },
  gardens: {
    skyHex: 0x34d399,
    fogHex: 0xd1fae5,
    hemiSkyHex: 0xecfdf5,
    hemiGroundHex: 0x065f46,
    nightGlowHex: 0x10b981,
    nightGlowIntensity: 1.0,
  },
  canal: {
    skyHex: 0x38bdf8,
    fogHex: 0xcffafe,
    hemiSkyHex: 0xe0f2fe,
    hemiGroundHex: 0x155e75,
    nightGlowHex: 0x06b6d4,
    nightGlowIntensity: 1.15,
  },
  liberty: {
    skyHex: 0xf472b6,
    fogHex: 0xfbcfe8,
    hemiSkyHex: 0xfdf2f8,
    hemiGroundHex: 0x701a75,
    nightGlowHex: 0xec4899,
    nightGlowIntensity: 1.3,
  },
};

export const JOURNEY_CYCLE_METERS = LAHORE_TRACK_STOPS.length * JOURNEY_SEGMENT_METERS; // 1260m

export interface TrackJourneyProgress {
  currentStop: TrackJourneyStop;
  nextStop: TrackJourneyStop;
  metersToNext: number;
  segmentProgress: number;
  lap: number;
}

export function getJourneyProgressForDistance(meters: number): TrackJourneyProgress {
  const safeMeters = Math.max(0, meters);
  const lap = Math.floor(safeMeters / JOURNEY_CYCLE_METERS) + 1;
  const cycleMeters = safeMeters % JOURNEY_CYCLE_METERS;
  const stopIdx = Math.min(
    LAHORE_TRACK_STOPS.length - 1,
    Math.floor(cycleMeters / JOURNEY_SEGMENT_METERS),
  );
  const nextIdx = (stopIdx + 1) % LAHORE_TRACK_STOPS.length;
  const intoSegment = cycleMeters - stopIdx * JOURNEY_SEGMENT_METERS;
  const metersToNext = Math.max(0, Math.ceil(JOURNEY_SEGMENT_METERS - intoSegment));

  return {
    currentStop: LAHORE_TRACK_STOPS[stopIdx],
    nextStop: LAHORE_TRACK_STOPS[nextIdx],
    metersToNext,
    segmentProgress: Math.min(1, Math.max(0, intoSegment / JOURNEY_SEGMENT_METERS)),
    lap,
  };
}
