import { STAGE_W, STAGE_H } from '../config';
import { CELL_W, CELL_H, GRID_W, GRID_H } from './grid';

const FRAME_MS = 1000 / 12; // chunky flipbook cadence suits ASCII

/**
 * Shared canvas renderer for the background scenes. Subclasses advance
 * their creatures in step() and paint glyphs in draw(); the base owns the
 * rAF loop, frame pacing, ink, and glyph placement. Scenes share one
 * canvas, so exactly one field should be started at a time.
 */
export abstract class AsciiField {
  protected ctx: CanvasRenderingContext2D;
  protected ink = 'rgb(0 0 0)'; // default theme bg is pale -> black ink
  private last = 0;
  private raf: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** Swap ink when the background changes (black on light, white on dark). */
  setInk(color: string): void {
    this.ink = color;
  }

  start(): void {
    if (this.raf !== null) return;
    this.last = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    if (this.raf === null) return;
    cancelAnimationFrame(this.raf);
    this.raf = null;
    this.ctx.clearRect(0, 0, STAGE_W, STAGE_H);
  }

  private frame = (t: number): void => {
    if (!this.last) this.last = t;
    const elapsed = t - this.last;
    if (elapsed >= FRAME_MS) {
      this.last = t - (elapsed % FRAME_MS);
      this.step(Math.min(elapsed, 250) / 1000);
      const c = this.ctx;
      c.clearRect(0, 0, STAGE_W, STAGE_H);
      c.fillStyle = this.ink;
      c.font = '26px VT323, monospace';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      this.draw(c);
      c.globalAlpha = 1;
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  protected putChar(ch: string, cx: number, cy: number): void {
    if (cx < 0 || cx >= GRID_W || cy < -1 || cy > GRID_H) return;
    this.ctx.fillText(ch, (cx + 0.5) * CELL_W, (cy + 0.5) * CELL_H);
  }

  protected abstract step(dtSec: number): void;
  protected abstract draw(c: CanvasRenderingContext2D): void;
}
