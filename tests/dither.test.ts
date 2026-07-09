import { describe, it, expect } from 'vitest';
import { glyphFor, renderDither, RAMP } from '../src/scene/dither';

describe('RAMP', () => {
  it('runs sparse to dense', () => {
    expect(RAMP[0]).toBe(' ');
    expect(RAMP[RAMP.length - 1]).toBe('\u2588');
  });
});

describe('glyphFor', () => {
  it('dark ink: black pixel is densest, white pixel is blank', () => {
    expect(glyphFor(0, false)).toBe('\u2588');
    expect(glyphFor(255, false)).toBe(' ');
  });

  it('light ink: white pixel is densest, black pixel is blank', () => {
    expect(glyphFor(255, true)).toBe('\u2588');
    expect(glyphFor(0, true)).toBe(' ');
  });

  it('mid luminance lands mid-ramp either way', () => {
    const mid = Math.floor(RAMP.length / 2);
    expect(Math.abs(RAMP.indexOf(glyphFor(128, false)) - mid)).toBeLessThanOrEqual(1);
    expect(Math.abs(RAMP.indexOf(glyphFor(128, true)) - mid)).toBeLessThanOrEqual(1);
  });

  it('covers every ramp glyph across the range', () => {
    const seen = new Set<string>();
    for (let l = 0; l <= 255; l++) seen.add(glyphFor(l, false));
    expect(seen.size).toBe(RAMP.length);
  });

  it('clamps out-of-range luminance', () => {
    expect(glyphFor(-10, false)).toBe('\u2588');
    expect(glyphFor(300, false)).toBe(' ');
  });
});

describe('renderDither', () => {
  it('shapes a flat luminance array into rows of cols chars', () => {
    const lums = new Array(12).fill(0);
    const rows = renderDither(lums, 4, false);
    expect(rows).toHaveLength(3);
    for (const r of rows) expect(r).toHaveLength(4);
  });

  it('maps each cell through the ramp', () => {
    // one dark row, one light row, dark ink
    const rows = renderDither([0, 0, 255, 255], 2, false);
    expect(rows[0]).toBe('\u2588\u2588');
    expect(rows[1]).toBe('  ');
  });

  it('inverts with light ink', () => {
    const rows = renderDither([0, 0, 255, 255], 2, true);
    expect(rows[0]).toBe('  ');
    expect(rows[1]).toBe('\u2588\u2588');
  });
});
