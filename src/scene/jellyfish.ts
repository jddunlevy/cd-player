import { STAGE_W, STAGE_H } from '../config';

// character grid over the 2560x1440 stage
export const CELL_W = 16;
export const CELL_H = 20;
export const GRID_W = STAGE_W / CELL_W; // 160
export const GRID_H = STAGE_H / CELL_H; // 72

export interface Jelly {
  baseX: number;    // drift center (columns)
  x: number;        // current center column
  y: number;        // top row of the bell
  radius: number;   // bell half-width in cells
  t: number;        // age, seconds
  pulseHz: number;
  pulsePhase: number;
  driftAmp: number;
  driftHz: number;
  driftPhase: number;
  speed: number;    // cells/second upward at full thrust
  alpha: number;
}

export interface Glyph {
  dx: number; // columns from jelly center
  dy: number; // rows below the tentacle root
  ch: string;
  a: number;  // alpha multiplier
}

/** Bell squash factor over the pulse cycle: >1 relaxed/wide, <1 contracted. */
export function pulseQ(j: Jelly): number {
  return 1 + 0.2 * Math.sin(2 * Math.PI * (j.t * j.pulseHz + j.pulsePhase));
}

export function bellHeight(radius: number, q: number): number {
  return Math.max(3, Math.round(radius * (2 - q) * 0.75) + 1);
}

/**
 * The bell as text rows: underscore crown, dome walls of / \ then ( ),
 * dithered ~ interior, and a \___/ rim the tentacles hang from.
 */
export function bellRows(radius: number, q: number): string[] {
  const w = Math.max(2, Math.round(radius * q));
  const h = bellHeight(radius, q);
  const width = 2 * w + 1; // columns -w..w
  const rows: string[] = [];
  for (let r = 0; r < h; r++) {
    const cells: string[] = new Array<string>(width).fill(' ');
    if (r === 0) {
      const hw = Math.max(1, Math.round(w * 0.45));
      for (let x = -hw; x <= hw; x++) cells[x + w] = '_';
    } else if (r < h - 1) {
      const f = Math.sin((Math.PI / 2) * (r / (h - 2)));
      const hw = Math.max(1, Math.round(w * f));
      cells[w - hw] = r === 1 ? '/' : '(';
      cells[w + hw] = r === 1 ? '\\' : ')';
      for (let x = -hw + 1; x < hw; x++) {
        if ((x + r) % 2 === 0) cells[x + w] = '~';
      }
    } else {
      cells[0] = '\\';
      cells[width - 1] = '/';
      for (let x = 1; x < width - 1; x++) cells[x] = '_';
    }
    rows.push(cells.join(''));
  }
  return rows;
}

export function tentacleLen(radius: number): number {
  return Math.round(radius * 2.6);
}

/** Tentacle anchor columns: every 2nd cell across the rim. */
export function tentacleOffsets(radius: number): number[] {
  const out: number[] = [];
  for (let x = -(radius - 1); x <= radius - 1; x += 2) out.push(x);
  return out;
}

const SWAY_HZ = 0.25;
const TENTACLE_CHARS = ['(', '|', ')'] as const;

/** Trailing tentacles; sway grows toward the tips, which fade out as ' . */
export function tentacleGlyphs(
  radius: number,
  tSec: number,
  phase: number,
): Glyph[] {
  const len = tentacleLen(radius);
  const amp = 1 + radius * 0.15;
  const glyphs: Glyph[] = [];
  tentacleOffsets(radius).forEach((ox, i) => {
    const xAt = (d: number) =>
      ox +
      Math.round(
        amp * (d / len) *
          Math.sin(2 * Math.PI * SWAY_HZ * tSec + phase + i * 1.7 + d * 0.55),
      );
    for (let d = 1; d <= len; d++) {
      const dx = xAt(d);
      const dir = Math.sign(xAt(d + 1) - dx);
      const ch =
        d === len ? '.' : d === len - 1 ? "'" : TENTACLE_CHARS[dir + 1];
      glyphs.push({ dx, dy: d, ch, a: d >= len - 1 ? 0.45 : 0.7 });
    }
  });
  return glyphs;
}

export function totalRows(radius: number): number {
  return bellHeight(radius, 1) + tentacleLen(radius);
}

export function makeJelly(rng: () => number, scatter: boolean): Jelly {
  const radius = 4 + Math.floor(rng() * 4); // 4..7
  const baseX = 6 + rng() * (GRID_W - 12);
  return {
    baseX,
    x: baseX,
    y: scatter ? rng() * GRID_H : GRID_H + 2 + rng() * 24,
    radius,
    t: rng() * 100,
    pulseHz: 0.35 + rng() * 0.25,
    pulsePhase: rng(),
    driftAmp: 2 + rng() * 4,
    driftHz: 0.02 + rng() * 0.03,
    driftPhase: rng() * Math.PI * 2,
    speed: 0.55 + radius * 0.28 + rng() * 0.5,
    alpha: 0.3 + radius * 0.06, // bigger reads closer: more opaque
  };
}

/**
 * Advance one jelly: thrust peaks as the bell contracts, lateral drift is a
 * slow sine wander. Once fully above the top edge, respawn below the bottom.
 */
export function stepJelly(j: Jelly, dtSec: number, rng: () => number): Jelly {
  j.t += dtSec;
  const thrust = Math.max(
    0,
    Math.sin(2 * Math.PI * (j.t * j.pulseHz + j.pulsePhase) - Math.PI / 4),
  );
  j.y -= j.speed * (0.55 + 0.9 * thrust) * dtSec;
  j.x = j.baseX + j.driftAmp * Math.sin(2 * Math.PI * j.t * j.driftHz + j.driftPhase);
  if (j.y + totalRows(j.radius) < 0) return makeJelly(rng, false);
  return j;
}

// ---- canvas field renderer (verified visually, not unit-tested) ----

const FRAME_MS = 1000 / 12; // chunky flipbook cadence suits ASCII

export class JellyfishField {
  private ctx: CanvasRenderingContext2D;
  private jellies: Jelly[];
  private last = 0;
  private ink = 'rgb(0 0 0)'; // default theme bg is pale -> black ink

  constructor(
    canvas: HTMLCanvasElement,
    count = 12,
    private rng: () => number = Math.random,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.jellies = Array.from({ length: count }, () => makeJelly(rng, true));
    requestAnimationFrame(this.frame);
  }

  /** Swap ink when the background changes (black on light, white on dark). */
  setInk(color: string): void {
    this.ink = color;
  }

  private frame = (t: number): void => {
    if (!this.last) this.last = t;
    const elapsed = t - this.last;
    if (elapsed >= FRAME_MS) {
      this.last = t - (elapsed % FRAME_MS);
      const dt = Math.min(elapsed, 250) / 1000;
      this.jellies = this.jellies.map((j) => stepJelly(j, dt, this.rng));
      this.draw();
    }
    requestAnimationFrame(this.frame);
  };

  private putChar(ch: string, cx: number, cy: number): void {
    if (cx < 0 || cx >= GRID_W || cy < -1 || cy > GRID_H) return;
    this.ctx.fillText(ch, (cx + 0.5) * CELL_W, (cy + 0.5) * CELL_H);
  }

  private draw(): void {
    const c = this.ctx;
    c.clearRect(0, 0, STAGE_W, STAGE_H);
    c.fillStyle = this.ink;
    c.font = '26px VT323, monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';

    for (const j of this.jellies) {
      const rows = bellRows(j.radius, pulseQ(j));
      const w = (rows[0].length - 1) / 2;
      const gx = Math.round(j.x);
      const gy = Math.round(j.y);

      c.globalAlpha = j.alpha;
      rows.forEach((row, dy) => {
        for (let i = 0; i < row.length; i++) {
          if (row[i] !== ' ') this.putChar(row[i], gx - w + i, gy + dy);
        }
      });

      const root = gy + rows.length - 1; // tentacles hang from the rim
      for (const g of tentacleGlyphs(j.radius, j.t, j.pulsePhase * 7)) {
        c.globalAlpha = j.alpha * g.a;
        this.putChar(g.ch, gx + g.dx, root + g.dy);
      }
    }
    c.globalAlpha = 1;
  }
}
