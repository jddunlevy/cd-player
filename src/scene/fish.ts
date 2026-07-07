import { GRID_W, GRID_H } from './grid';
import { AsciiField } from './field';

/**
 * Hand-drawn right-facing fish. Each species has two full-sprite frames —
 * tail fork tilted up / down — with identical dimensions so the wag never
 * shifts the body. Same glyph family as the jellyfish scene.
 */
export interface FishSpecies {
  frames: [string[], string[]];
  speed: number;  // cells/second at full surge
  alpha: number;
  tailHz: number; // tail beats per second
}

export const SPECIES: FishSpecies[] = [
  { // minnow: small, quick
    speed: 7, alpha: 0.4, tailHz: 2.4,
    frames: [
      [
        '\\    .--.',
        ' >-( ~ o >',
        ' /   `--\'',
      ],
      [
        ' \\   .--.',
        ' >-( ~ o >',
        '/    `--\'',
      ],
    ],
  },
  { // tetra: medium
    speed: 4.5, alpha: 0.55, tailHz: 1.8,
    frames: [
      [
        '      ____',
        '\\    / ~  \\',
        ' >--(  ~ o >',
        ' /   \\____/',
      ],
      [
        '      ____',
        ' \\   / ~  \\',
        ' >--(  ~ o >',
        '/    \\____/',
      ],
    ],
  },
  { // bass: large, slow, reads closer so more opaque
    speed: 2.5, alpha: 0.7, tailHz: 1.2,
    frames: [
      [
        '           _',
        '       ___/ \\____',
        '\\     / ~ ~ ~ ~  \\',
        ' >---(  ~ ~ ~  o  >',
        ' /    \\____ _____/',
        '           \\/',
      ],
      [
        '           _',
        '       ___/ \\____',
        ' \\    / ~ ~ ~ ~  \\',
        ' >---(  ~ ~ ~  o  >',
        '/     \\____ _____/',
        '           \\/',
      ],
    ],
  },
];

export function spriteWidth(sp: FishSpecies): number {
  return Math.max(...sp.frames[0].map((r) => r.length));
}

export function spriteHeight(sp: FishSpecies): number {
  return sp.frames[0].length;
}

/** Which tail frame shows at time t: fork up on the beat's rise, down on the fall. */
export function tailFrame(tSec: number, hz: number, phase: number): 0 | 1 {
  return Math.sin(2 * Math.PI * (tSec * hz + phase)) >= 0 ? 0 : 1;
}

export interface Fish {
  species: number;  // index into SPECIES
  x: number;        // left column of the sprite
  baseY: number;    // bob center (top row of the sprite)
  y: number;        // current top row
  t: number;        // age, seconds
  tailHz: number;
  tailPhase: number;
  bobAmp: number;
  bobHz: number;
  bobPhase: number;
  speed: number;    // cells/second rightward at full surge
  alpha: number;
}

export function makeFish(rng: () => number, scatter: boolean): Fish {
  const species = Math.floor(rng() * SPECIES.length);
  const sp = SPECIES[species];
  const baseY = 1 + rng() * (GRID_H - spriteHeight(sp) - 2);
  return {
    species,
    x: scatter ? rng() * GRID_W : -spriteWidth(sp) - rng() * 40,
    baseY,
    y: baseY,
    t: rng() * 100,
    tailHz: sp.tailHz * (0.85 + rng() * 0.3),
    tailPhase: rng(),
    bobAmp: 0.5 + rng() * 1.5,
    bobHz: 0.05 + rng() * 0.1,
    bobPhase: rng() * Math.PI * 2,
    speed: sp.speed * (0.75 + rng() * 0.5),
    alpha: sp.alpha,
  };
}

/**
 * Advance one fish: it surges forward on each tail beat and bobs gently
 * around its lane. Once fully past the right edge, respawn off the left.
 */
export function stepFish(f: Fish, dtSec: number, rng: () => number): Fish {
  f.t += dtSec;
  const surge = 0.7 + 0.6 * Math.max(
    0,
    Math.sin(2 * Math.PI * (f.t * f.tailHz + f.tailPhase)),
  );
  f.x += f.speed * surge * dtSec;
  f.y = f.baseY + f.bobAmp * Math.sin(2 * Math.PI * f.t * f.bobHz + f.bobPhase);
  if (f.x > GRID_W) return makeFish(rng, false);
  return f;
}

// ---- canvas field renderer (verified visually, not unit-tested) ----

export class FishField extends AsciiField {
  private fish: Fish[];

  constructor(
    canvas: HTMLCanvasElement,
    count = 10,
    private rng: () => number = Math.random,
  ) {
    super(canvas);
    this.fish = Array.from({ length: count }, () => makeFish(rng, true));
  }

  protected step(dtSec: number): void {
    this.fish = this.fish.map((f) => stepFish(f, dtSec, this.rng));
  }

  protected draw(c: CanvasRenderingContext2D): void {
    for (const f of this.fish) {
      const frame =
        SPECIES[f.species].frames[tailFrame(f.t, f.tailHz, f.tailPhase)];
      const gx = Math.round(f.x);
      const gy = Math.round(f.y);
      c.globalAlpha = f.alpha;
      frame.forEach((row, dy) => {
        for (let i = 0; i < row.length; i++) {
          if (row[i] !== ' ') this.putChar(row[i], gx + i, gy + dy);
        }
      });
    }
  }
}
