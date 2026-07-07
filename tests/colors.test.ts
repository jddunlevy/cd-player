import { describe, it, expect } from 'vitest';
import {
  dominantPair, luminance, toCss, rgbToHsl, paletteFromAlbum, inkForBackground,
  type RGB,
} from '../src/scene/colors';

function pixels(...runs: [RGB, number][]): Uint8ClampedArray {
  const total = runs.reduce((n, [, count]) => n + count, 0);
  const data = new Uint8ClampedArray(total * 4);
  let i = 0;
  for (const [[r, g, b], count] of runs) {
    for (let k = 0; k < count; k++) {
      data[i++] = r; data[i++] = g; data[i++] = b; data[i++] = 255;
    }
  }
  return data;
}

describe('dominantPair', () => {
  it('picks the two most frequent distinct colors, most frequent first', () => {
    const data = pixels([[200, 30, 30], 100], [[30, 30, 200], 60], [[30, 200, 30], 10]);
    expect(dominantPair(data)).toEqual([[200, 30, 30], [30, 30, 200]]);
  });

  it('skips a runner-up too close to the winner', () => {
    // 210,30,30 lands in a neighboring bin of 200,30,30 (distance ~10 < 90)
    const data = pixels(
      [[200, 30, 30], 100],
      [[224, 30, 30], 80],
      [[30, 30, 200], 40],
    );
    expect(dominantPair(data)).toEqual([[200, 30, 30], [30, 30, 200]]);
  });

  it('derives a darker second stop for monochrome art', () => {
    const data = pixels([[100, 150, 200], 50]);
    expect(dominantPair(data)).toEqual([[100, 150, 200], [55, 83, 110]]);
  });

  it('ignores transparent pixels', () => {
    const data = pixels([[200, 30, 30], 10], [[30, 30, 200], 5]);
    // make the red run transparent
    for (let k = 0; k < 10; k++) data[k * 4 + 3] = 0;
    expect(dominantPair(data)[0]).toEqual([30, 30, 200]);
  });

  it('averages within a bin', () => {
    const data = pixels([[200, 30, 30], 1], [[202, 31, 31], 1]); // same 32-wide bin
    expect(dominantPair(data)[0]).toEqual([201, 31, 31]);
  });

  it('falls back to gray for fully transparent data', () => {
    const data = new Uint8ClampedArray(16); // 4 pixels, alpha 0
    expect(dominantPair(data)).toEqual([[128, 128, 128], [64, 64, 64]]);
  });
});

describe('toCss', () => {
  it('formats modern rgb()', () => expect(toCss([1, 2, 3])).toBe('rgb(1 2 3)'));
});

describe('luminance', () => {
  it('ranks white above black', () => {
    expect(luminance([255, 255, 255])).toBeGreaterThan(luminance([0, 0, 0]));
  });
});

describe('rgbToHsl', () => {
  it('pure red', () => expect(rgbToHsl([255, 0, 0])).toEqual({ h: 0, s: 1, l: 0.5 }));
  it('pure blue', () => expect(rgbToHsl([0, 0, 255]).h).toBe(240));
  it('gray has zero saturation', () => {
    const { s, l } = rgbToHsl([128, 128, 128]);
    expect(s).toBe(0);
    expect(l).toBeCloseTo(0.5);
  });
});

describe('inkForBackground', () => {
  it('black ink only on very light backgrounds', () =>
    expect(inkForBackground([[230, 230, 220], [180, 200, 190]])).toBe('rgb(0 0 0)'));
  it('white ink on a dark background', () =>
    expect(inkForBackground([[30, 30, 60], [10, 10, 20]])).toBe('rgb(255 255 255)'));
  it('white ink on a medium-light background (white is preferred)', () =>
    // avg luminance ~150: above mid-gray but below the 200 black threshold
    expect(inkForBackground([[160, 160, 160], [140, 140, 140]])).toBe('rgb(255 255 255)'));
  it('white ink for a light/dark split (avg mid)', () =>
    expect(inkForBackground([[255, 255, 255], [0, 0, 0]])).toBe('rgb(255 255 255)'));
});

describe('paletteFromAlbum', () => {
  it('takes the hue of the more saturated dominant color', () => {
    // saturated blue + washed-out red -> blue-hued palette
    const p = paletteFromAlbum([[40, 40, 200], [140, 120, 120]]);
    for (const token of Object.values(p)) expect(token).toMatch(/^hsl\(2(3[5-9]|4[0-5]) /);
  });
  it('keeps the token lightness structure (accent dark, bg pale)', () => {
    const p = paletteFromAlbum([[40, 40, 200], [140, 120, 120]]);
    expect(p.bg).toMatch(/ 82%\)$/);
    expect(p.surface).toMatch(/ 89%\)$/);
    expect(p.text).toMatch(/ 17%\)$/);
    expect(p.muted).toMatch(/ 35%\)$/);
    expect(p.accent).toMatch(/ 26%\)$/);
  });
  it('collapses to near-neutral for monochrome albums', () => {
    const p = paletteFromAlbum([[220, 220, 220], [30, 30, 30]]);
    // MIN_SAT_SCALE 0.12 * accent sat 0.36 -> 4%
    expect(p.accent).toMatch(/^hsl\(\d+ [0-5]% 26%\)$/);
  });
});
