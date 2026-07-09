import { describe, it, expect } from 'vitest';
import { makeBars, stepBars, renderBars, type Bar } from '../src/scene/visualizer';

// Consolas/JetBrains Mono only carry the CP437 blocks; eighth-blocks fall
// back to Segoe UI Symbol and render as floating squares. Stick to the safe set.
const ALLOWED = new Set([...' \u2584\u2588_']); // ' ', ▄, █, _

function bars(levels: number[]): Bar[] {
  return levels.map((level) => ({ level, target: level }));
}

function columns(text: string): string[][] {
  const lines = text.split('\n');
  // bars sit at even char positions; odd positions are gaps
  const out: string[][] = [];
  for (let x = 0; x < lines[0].length; x += 2) {
    out.push(lines.map((l) => l[x]));
  }
  return out;
}

describe('renderBars', () => {
  it('renders the requested number of rows', () => {
    expect(renderBars(bars([0.5, 0.5]), 4).split('\n')).toHaveLength(4);
  });

  it('renders equal-width lines: one char per bar, one-space gaps', () => {
    const lines = renderBars(bars([0, 0.3, 1]), 4).split('\n');
    for (const l of lines) expect(l).toHaveLength(3 * 2 - 1);
  });

  it('uses only font-safe glyphs (no eighth-blocks)', () => {
    for (let lv = 0; lv <= 1.0001; lv += 0.05) {
      for (const ch of renderBars(bars([lv]), 4)) {
        if (ch === '\n') continue;
        expect(ALLOWED.has(ch)).toBe(true);
      }
    }
  });

  it('gap columns are always blank', () => {
    const lines = renderBars(bars([1, 1, 1]), 4).split('\n');
    for (const l of lines) {
      expect(l[1]).toBe(' ');
      expect(l[3]).toBe(' ');
    }
  });

  it('full level fills the whole column with full blocks', () => {
    const [col] = columns(renderBars(bars([1]), 4));
    expect(col).toEqual(['\u2588', '\u2588', '\u2588', '\u2588']);
  });

  it('zero level shows only the baseline underscore', () => {
    const [col] = columns(renderBars(bars([0]), 4));
    expect(col).toEqual([' ', ' ', ' ', '_']);
  });

  it('columns are contiguous from the bottom (no floating blocks)', () => {
    for (let lv = 0; lv <= 1.0001; lv += 0.03) {
      const [col] = columns(renderBars(bars([lv]), 4));
      const top = col.findIndex((ch) => ch !== ' ');
      // everything below the topmost mark is a full block (or lone baseline)
      for (let y = top + 1; y < col.length; y++) {
        expect(col[y]).toBe('\u2588');
      }
      // a half block can only be the topmost mark, never buried
      for (let y = top + 1; y < col.length; y++) {
        expect(col[y]).not.toBe('\u2584');
      }
    }
  });

  it('height grows monotonically with level', () => {
    let prev = 0;
    for (let lv = 0; lv <= 1.0001; lv += 0.05) {
      const [col] = columns(renderBars(bars([lv]), 5));
      const filled = col.filter((ch) => ch === '\u2588').length
        + 0.5 * col.filter((ch) => ch === '\u2584').length;
      expect(filled).toBeGreaterThanOrEqual(prev);
      prev = filled;
    }
    expect(prev).toBe(5); // reaches full height
  });
});

describe('makeBars', () => {
  it('creates the requested count, starting flat', () => {
    const b = makeBars(8, () => 0.5);
    expect(b).toHaveLength(8);
    for (const bar of b) expect(bar.level).toBe(0);
  });
});

describe('stepBars', () => {
  it('keeps levels in [0, 1]', () => {
    const b = makeBars(6, Math.random);
    for (let i = 0; i < 200; i++) stepBars(b, 0.08, true, Math.random);
    for (const bar of b) {
      expect(bar.level).toBeGreaterThanOrEqual(0);
      expect(bar.level).toBeLessThanOrEqual(1);
    }
  });

  it('moves while playing', () => {
    const b = makeBars(4, () => 0.9);
    stepBars(b, 0.1, true, () => 0.9);
    expect(b.some((bar) => bar.level > 0)).toBe(true);
  });

  it('decays to flat when not playing', () => {
    const b = bars([1, 0.7, 0.4, 0.9]);
    for (let i = 0; i < 100; i++) stepBars(b, 0.08, false, () => 0.5);
    for (const bar of b) expect(bar.level).toBeLessThan(0.01);
  });
});
