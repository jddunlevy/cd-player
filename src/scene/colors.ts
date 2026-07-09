export type RGB = [number, number, number];

const BIN_SHIFT = 5;        // 3 bits/channel -> 8 levels -> 512 bins
const BINS = 8;
const MIN_DISTANCE = 90;    // euclidean RGB distance for "visually distinct"
const MIN_ALPHA = 128;
const CHROMA_MIN = 40;      // max-min channel spread to count as "colorful"
const CHROMATIC_SHARE = 0.08; // colorful pixel share that outranks neutrals

export function toCss([r, g, b]: RGB): string {
  return `rgb(${r} ${g} ${b})`;
}

export function luminance([r, g, b]: RGB): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function distance(a: RGB, b: RGB): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function chroma([r, g, b]: RGB): number {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

/**
 * Two dominant colors from RGBA pixel data, by coarse-bin frequency.
 * If enough of the art is chromatic, neutrals (white/black/gray) are
 * excluded so colorful covers don't yield gray ombres. The second color
 * is the most frequent bin visually distinct from the first; if none
 * qualifies, a darkened variant of the first keeps the ombre two-stop.
 */
export function dominantPair(data: Uint8ClampedArray): [RGB, RGB] {
  const count = new Uint32Array(BINS * BINS * BINS);
  const sumR = new Float64Array(count.length);
  const sumG = new Float64Array(count.length);
  const sumB = new Float64Array(count.length);

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < MIN_ALPHA) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const bin =
      ((r >> BIN_SHIFT) * BINS + (g >> BIN_SHIFT)) * BINS + (b >> BIN_SHIFT);
    count[bin]++;
    sumR[bin] += r;
    sumG[bin] += g;
    sumB[bin] += b;
  }

  let order = [...count.keys()]
    .filter((i) => count[i] > 0)
    .sort((a, b) => count[b] - count[a]);
  if (order.length === 0) return [[128, 128, 128], [64, 64, 64]];

  const avg = (bin: number): RGB => [
    Math.round(sumR[bin] / count[bin]),
    Math.round(sumG[bin] / count[bin]),
    Math.round(sumB[bin] / count[bin]),
  ];

  const total = order.reduce((n, bin) => n + count[bin], 0);
  const chromatic = order.filter((bin) => chroma(avg(bin)) >= CHROMA_MIN);
  const share = chromatic.reduce((n, bin) => n + count[bin], 0) / total;
  if (share >= CHROMATIC_SHARE) order = chromatic;

  const first = avg(order[0]);
  for (const bin of order.slice(1)) {
    const c = avg(bin);
    if (distance(first, c) >= MIN_DISTANCE) return [first, c];
  }
  return [first, first.map((v) => Math.round(v * 0.55)) as RGB];
}

export function rgbToHsl([r, g, b]: RGB): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  switch (max) {
    case rn: h = ((gn - bn) / d) % 6; break;
    case gn: h = (bn - rn) / d + 2; break;
    default: h = (rn - gn) / d + 4;
  }
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

export interface Palette {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
}

// Saturation/lightness of the base green theme tokens (theme.css), so the
// derived palette keeps the same muted structure with the album's hue.
const TOKEN_SL: [keyof Palette, number, number][] = [
  ['bg', 0.39, 0.82],
  ['surface', 0.41, 0.89],
  ['text', 0.30, 0.17],
  ['muted', 0.21, 0.35],
  ['accent', 0.36, 0.26],
];

const FULL_SAT = 0.35; // album saturation at/above this keeps full token sat
const MIN_SAT_SCALE = 0.12; // b/w albums collapse to a near-neutral palette

/**
 * Theme tokens retinted to the album: hue comes from the more saturated of
 * the two dominant colors; token saturation scales down for washed-out or
 * monochrome art so grays stay gray.
 */
export function paletteFromAlbum(pair: [RGB, RGB]): Palette {
  const [a, b] = pair.map(rgbToHsl);
  const src = a.s >= b.s ? a : b;
  const h = Math.round(src.h);
  const k = Math.min(1, Math.max(MIN_SAT_SCALE, src.s / FULL_SAT));
  const out = {} as Palette;
  for (const [token, s, l] of TOKEN_SL) {
    out[token] = `hsl(${h} ${Math.round(s * k * 100)}% ${Math.round(l * 100)}%)`;
  }
  return out;
}

// White ink is strongly preferred; black only on genuinely light backgrounds.
const BLACK_INK_MIN_LUMINANCE = 200;

/** Jellyfish ink against the ombre pair: white unless the bg is very light. */
export function inkForBackground(pair: [RGB, RGB]): string {
  const avg = (luminance(pair[0]) + luminance(pair[1])) / 2;
  return avg > BLACK_INK_MIN_LUMINANCE ? 'rgb(0 0 0)' : 'rgb(255 255 255)';
}

const DARK_INK_MIN_L = 0.5; // floor so dark album colors read on black

/** Dark-mode jellyfish ink: the album's dominant color, lifted if too dark. */
export function inkForDark(pair: [RGB, RGB]): string {
  const { h, s, l } = rgbToHsl(pair[0]);
  const lift = Math.max(l, DARK_INK_MIN_L);
  return `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(lift * 100)}%)`;
}

const SAMPLE = 40; // downscale target; plenty for dominant-color binning

/**
 * Dominant color pair for an image URL, most frequent first.
 * Returns null on any load/CORS failure.
 */
export async function extractAlbumColors(
  url: string,
): Promise<[RGB, RGB] | null> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  try {
    await img.decode();
  } catch {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE;
  canvas.height = SAMPLE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
  } catch {
    return null; // canvas tainted (no CORS) — keep current background
  }
  return dominantPair(data);
}
