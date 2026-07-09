/** Sparse-to-dense glyph ramp; all present in VT323/CP437-era fonts. */
export const RAMP = [' ', '\u00b7', '\u2591', '\u2592', '\u2593', '\u2588'];

/**
 * Glyph for a 0-255 luminance. Density tracks distance from the background:
 * dark ink on a light bg makes dark pixels dense; light ink inverts.
 */
export function glyphFor(lum: number, lightInk: boolean): string {
  const clamped = Math.min(255, Math.max(0, lum));
  const density = lightInk ? clamped : 255 - clamped;
  return RAMP[Math.round((density / 255) * (RAMP.length - 1))];
}

/** Flat luminance array (row-major) to rows of glyphs. */
export function renderDither(
  lums: number[], cols: number, lightInk: boolean,
): string[] {
  const rows: string[] = [];
  for (let i = 0; i < lums.length; i += cols) {
    rows.push(
      lums.slice(i, i + cols).map((l) => glyphFor(l, lightInk)).join(''),
    );
  }
  return rows;
}

// ---- canvas renderer (verified visually, not unit-tested) ----

const COLS = 176;
const ROWS = 88;
const CELL_W = 4; // 176 * 4 = 704 = art-well width
const CELL_H = 8; //  88 * 8 = 704 = art-well height

/**
 * Static ASCII rendering of the album cover on a canvas over the art imgs.
 * Redraws only on new art or ink change; no animation loop.
 */
export class DitherArt {
  private ctx: CanvasRenderingContext2D;
  private lums: number[] | null = null;
  private ink = 'rgb(0 0 0)';
  private lightInk = false;
  private loadId = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** True when art has been sampled and the canvas shows something. */
  get ready(): boolean {
    return this.lums !== null;
  }

  /** Sample new art into the cell grid; null clears. Resolves when drawn. */
  async setImage(url: string | null): Promise<void> {
    const id = ++this.loadId;
    if (!url) {
      this.lums = null;
      this.draw();
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    try {
      await img.decode();
    } catch {
      return; // keep whatever is currently shown; caller falls back to photo
    }
    if (id !== this.loadId) return; // superseded by a newer track

    const off = document.createElement('canvas');
    off.width = COLS;
    off.height = ROWS;
    const octx = off.getContext('2d', { willReadFrequently: true })!;
    octx.drawImage(img, 0, 0, COLS, ROWS); // browser averages each cell
    let data: Uint8ClampedArray;
    try {
      data = octx.getImageData(0, 0, COLS, ROWS).data;
    } catch {
      return; // tainted canvas (no CORS) — photo fallback
    }
    const lums: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      lums.push(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
    }
    this.lums = lums;
    this.draw();
  }

  /** Ink color plus polarity (light ink inverts the density ramp). */
  setInk(color: string, lightInk: boolean): void {
    this.ink = color;
    this.lightInk = lightInk;
    this.draw();
  }

  private draw(): void {
    const c = this.ctx;
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.lums) return;
    c.fillStyle = this.ink;
    c.font = `${CELL_H}px VT323, monospace`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    renderDither(this.lums, COLS, this.lightInk).forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== ' ') {
          c.fillText(row[x], (x + 0.5) * CELL_W, (y + 0.5) * CELL_H);
        }
      }
    });
  }
}
