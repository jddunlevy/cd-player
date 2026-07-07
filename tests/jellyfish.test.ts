import { describe, it, expect } from 'vitest';
import {
  bellRows, bellHeight, pulseQ, tentacleOffsets, tentacleLen, tentacleGlyphs,
  makeJelly, stepJelly, totalRows, type Jelly,
} from '../src/scene/jellyfish';
import { GRID_H, GRID_W } from '../src/scene/grid';

const MIRROR: Record<string, string> = {
  '(': ')', ')': '(', '/': '\\', '\\': '/',
  '~': '~', '_': '_', ' ': ' ', '|': '|',
};
const mirror = (row: string): string =>
  [...row].reverse().map((ch) => MIRROR[ch]).join('');

function jelly(overrides: Partial<Jelly> = {}): Jelly {
  return {
    baseX: 80, x: 80, y: 40, radius: 4, t: 0,
    pulseHz: 0.5, pulsePhase: 0, driftAmp: 3, driftHz: 0.03, driftPhase: 0,
    speed: 2, alpha: 0.3,
    ...overrides,
  };
}

describe('bellRows', () => {
  it('every row is horizontally symmetric', () => {
    for (const radius of [3, 4, 5, 6]) {
      for (const q of [0.8, 1, 1.2]) {
        for (const row of bellRows(radius, q)) {
          expect(mirror(row)).toBe(row);
        }
      }
    }
  });
  it('starts with an underscore crown and ends with a \\___/ rim', () => {
    const rows = bellRows(4, 1);
    expect(rows[0].trim()).toMatch(/^_+$/);
    const rim = rows[rows.length - 1];
    expect(rim[0]).toBe('\\');
    expect(rim[rim.length - 1]).toBe('/');
    expect(rim.slice(1, -1)).toMatch(/^_+$/);
  });
  it('is wider when relaxed than when contracted', () => {
    expect(bellRows(5, 1.2)[0].length).toBeGreaterThan(bellRows(5, 0.8)[0].length);
  });
  it('is taller when contracted (squash conserves bulk)', () => {
    expect(bellHeight(5, 0.8)).toBeGreaterThan(bellHeight(5, 1.2));
  });
});

describe('pulseQ', () => {
  it('stays within the squash bounds [0.8, 1.2]', () => {
    const j = jelly();
    for (let t = 0; t < 10; t += 0.05) {
      j.t = t;
      const q = pulseQ(j);
      expect(q).toBeGreaterThanOrEqual(0.8);
      expect(q).toBeLessThanOrEqual(1.2);
    }
  });
});

describe('tentacles', () => {
  it('anchors are symmetric and 2 cells apart', () => {
    expect(tentacleOffsets(4)).toEqual([-3, -1, 1, 3]);
    expect(tentacleOffsets(3)).toEqual([-2, 0, 2]);
  });
  it('uses only tentacle characters, fading tips', () => {
    const glyphs = tentacleGlyphs(4, 1.3, 0.4);
    for (const g of glyphs) expect("(|)'.").toContain(g.ch);
    const len = tentacleLen(4);
    expect(glyphs.filter((g) => g.dy === len).every((g) => g.ch === '.')).toBe(true);
    expect(glyphs.filter((g) => g.dy >= len - 1).every((g) => g.a < 0.7)).toBe(true);
  });
  it('emits one glyph per row per tentacle', () => {
    expect(tentacleGlyphs(4, 0, 0)).toHaveLength(
      tentacleOffsets(4).length * tentacleLen(4),
    );
  });
});

describe('stepJelly', () => {
  it('swims upward', () => {
    const j = jelly();
    stepJelly(j, 1, () => 0.5);
    expect(j.y).toBeLessThan(40);
  });
  it('wanders around baseX within driftAmp', () => {
    const j = jelly();
    for (let i = 0; i < 100; i++) {
      stepJelly(j, 0.1, () => 0.5);
      expect(Math.abs(j.x - j.baseX)).toBeLessThanOrEqual(j.driftAmp);
    }
  });
  it('respawns below the bottom once fully above the top', () => {
    const j = jelly({ y: -totalRows(4) - 1 });
    const next = stepJelly(j, 0.01, () => 0.5);
    expect(next).not.toBe(j);
    expect(next.y).toBeGreaterThanOrEqual(GRID_H);
  });
});

describe('makeJelly', () => {
  it('spawns within sane bounds', () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const j = makeJelly(() => r, true);
      expect(j.radius).toBeGreaterThanOrEqual(4);
      expect(j.radius).toBeLessThanOrEqual(7);
      expect(j.baseX).toBeGreaterThan(0);
      expect(j.baseX).toBeLessThan(GRID_W);
      expect(j.alpha).toBeGreaterThan(0.3);
      expect(j.alpha).toBeLessThan(0.8);
    }
  });
  it('scatter spawns on screen, otherwise below the fold', () => {
    expect(makeJelly(() => 0.5, true).y).toBeLessThan(GRID_H);
    expect(makeJelly(() => 0.5, false).y).toBeGreaterThanOrEqual(GRID_H);
  });
});
