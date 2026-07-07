import { describe, it, expect } from 'vitest';
import {
  SPECIES, spriteWidth, spriteHeight, tailFrame,
  makeFish, stepFish, type Fish,
} from '../src/scene/fish';
import { GRID_H, GRID_W } from '../src/scene/grid';

const ALLOWED = new Set([...'><()/\\~o._-\'`, ']);

function fish(overrides: Partial<Fish> = {}): Fish {
  return {
    species: 1, x: 40, baseY: 30, y: 30, t: 0,
    tailHz: 2, tailPhase: 0, bobAmp: 1, bobHz: 0.1, bobPhase: 0,
    speed: 4, alpha: 0.5,
    ...overrides,
  };
}

describe('SPECIES sprites', () => {
  it('has three species, two tail frames each', () => {
    expect(SPECIES).toHaveLength(3);
    for (const sp of SPECIES) expect(sp.frames).toHaveLength(2);
  });
  it('tail frames of a species share dimensions (no jump on wag)', () => {
    for (const sp of SPECIES) {
      const [a, b] = sp.frames;
      expect(a.length).toBe(b.length);
      expect(Math.max(...a.map((r) => r.length)))
        .toBe(Math.max(...b.map((r) => r.length)));
    }
  });
  it('uses only the scene glyph alphabet', () => {
    for (const sp of SPECIES)
      for (const frame of sp.frames)
        for (const row of frame)
          for (const ch of row) expect(ALLOWED.has(ch)).toBe(true);
  });
  it('every frame has exactly one eye and a mouth on the right edge', () => {
    for (const sp of SPECIES) {
      for (const frame of sp.frames) {
        const all = frame.join('');
        expect([...all].filter((ch) => ch === 'o')).toHaveLength(1);
        // mouth: some row ends with '>' at the sprite's max width
        const w = Math.max(...frame.map((r) => r.length));
        expect(frame.some((r) => r.length === w && r.endsWith('>'))).toBe(true);
      }
    }
  });
  it('species get bigger from minnow to bass', () => {
    expect(spriteHeight(SPECIES[0])).toBeLessThan(spriteHeight(SPECIES[2]));
    expect(spriteWidth(SPECIES[0])).toBeLessThan(spriteWidth(SPECIES[2]));
  });
});

describe('tailFrame', () => {
  it('alternates between frames over a beat cycle', () => {
    // 2 Hz -> half period 0.25s apart lands on opposite frames
    expect(tailFrame(0.1, 2, 0)).not.toBe(tailFrame(0.35, 2, 0));
  });
  it('is a valid frame index', () => {
    for (let t = 0; t < 3; t += 0.07) expect([0, 1]).toContain(tailFrame(t, 2, 0.3));
  });
});

describe('makeFish', () => {
  it('spawns within sane bounds', () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const f = makeFish(() => r, true);
      expect(f.species).toBeGreaterThanOrEqual(0);
      expect(f.species).toBeLessThan(SPECIES.length);
      expect(f.baseY).toBeGreaterThanOrEqual(1);
      expect(f.baseY + spriteHeight(SPECIES[f.species])).toBeLessThan(GRID_H);
      expect(f.speed).toBeGreaterThan(0);
      expect(f.alpha).toBeGreaterThan(0.2);
      expect(f.alpha).toBeLessThanOrEqual(0.8);
    }
  });
  it('scatter spawns on screen, otherwise off the left edge', () => {
    expect(makeFish(() => 0.5, true).x).toBeGreaterThanOrEqual(0);
    expect(makeFish(() => 0.5, true).x).toBeLessThan(GRID_W);
    expect(makeFish(() => 0.5, false).x).toBeLessThan(0);
  });
});

describe('stepFish', () => {
  it('swims rightward', () => {
    const f = fish();
    stepFish(f, 1, () => 0.5);
    expect(f.x).toBeGreaterThan(40);
  });
  it('bobs around baseY within bobAmp', () => {
    const f = fish({ bobAmp: 2 });
    for (let i = 0; i < 100; i++) {
      stepFish(f, 0.1, () => 0.5);
      expect(Math.abs(f.y - f.baseY)).toBeLessThanOrEqual(2);
    }
  });
  it('respawns off the left edge once fully past the right edge', () => {
    const f = fish({ x: GRID_W + 1 });
    const next = stepFish(f, 0.01, () => 0.5);
    expect(next).not.toBe(f);
    expect(next.x).toBeLessThan(0);
  });
});
