import type { DisplayState } from '../player-state';
import { LCD_W, LCD_H } from '../config';

export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const PAUSE_TICKS = 20; // hold at each end (ticks are ~100ms -> 2s)
const STEP_PX = 2;

export function marqueeOffset(
  textPx: number,
  windowPx: number,
  tick: number,
): number {
  const max = textPx - windowPx;
  if (max <= 0) return 0;
  const travelTicks = Math.ceil(max / STEP_PX);
  const cycle = PAUSE_TICKS + travelTicks + PAUSE_TICKS;
  const t = tick % cycle;
  if (t < PAUSE_TICKS) return 0;
  return Math.min(max, (t - PAUSE_TICKS) * STEP_PX);
}

// ---- canvas rendering (verified visually, not unit-tested) ----

const BG = '#1d2914';      // dark LCD glass — darker sibling of --text
const INK = '#b8d68f';     // backlit green — lighter sibling of --bg
const DIM = '#4a5c36';     // unlit segments
const PAD = 8;
const TITLE_Y = 30;
const ARTIST_Y = 54;
const BAR_Y = 72;
const BAR_H = 8;
const CELL = 6;            // progress bar cell width (4px block + 2px gap)

export class Lcd {
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  render(state: DisplayState, tick: number): void {
    const c = this.ctx;
    c.fillStyle = BG;
    c.fillRect(0, 0, LCD_W, LCD_H);
    c.fillStyle = INK;
    c.textBaseline = 'alphabetic';

    switch (state.status) {
      case 'idle':
        c.font = '24px VT323';
        c.fillText('NO DISC', PAD, TITLE_Y);
        return;
      case 'error':
        if (!state.np) {
          c.font = '24px VT323';
          c.fillText('ERR', PAD, TITLE_Y);
          return;
        }
        break; // stale data: fall through and render it, plus ERR flag
      case 'ad':
        c.font = '24px VT323';
        c.fillText('AD BREAK', PAD, TITLE_Y);
        return;
    }

    const np = state.np!;
    const windowPx = LCD_W - PAD * 2;

    // title row (marquee)
    c.font = '24px VT323';
    const titlePx = Math.ceil(c.measureText(np.title).width);
    c.save();
    c.beginPath();
    c.rect(PAD, 0, windowPx, LCD_H);
    c.clip();
    c.fillText(np.title, PAD - marqueeOffset(titlePx, windowPx, tick), TITLE_Y);
    c.restore();

    // artist row
    c.font = '16px VT323';
    c.fillText(np.artist, PAD, ARTIST_Y);

    // time, right-aligned on artist row
    const time = `${formatTime(state.progressMs)}/${formatTime(np.durationMs)}`;
    c.fillText(time, LCD_W - PAD - c.measureText(time).width, ARTIST_Y);

    // PAUSE blink / stale ERR flag, top-right
    // When both apply, render ERR at the far right and PAUSE to its left with
    // a small gap so the two labels never overlap.
    c.font = '16px VT323';
    const bothFlags =
      state.stale && state.status === 'paused' && Math.floor(tick / 5) % 2 === 0;
    if (bothFlags) {
      const errW = c.measureText('ERR').width;
      c.fillText('ERR', LCD_W - PAD - errW, 16);
      c.fillText('PAUSE', LCD_W - PAD - errW - 4 - c.measureText('PAUSE').width, 16);
    } else {
      if (state.status === 'paused' && Math.floor(tick / 5) % 2 === 0) {
        c.fillText('PAUSE', LCD_W - PAD - c.measureText('PAUSE').width, 16);
      }
      if (state.stale) {
        c.fillText('ERR', LCD_W - PAD - c.measureText('ERR').width, 16);
      }
    }

    // chunky progress bar
    const cells = Math.floor(windowPx / CELL);
    const filled = np.durationMs
      ? Math.round((state.progressMs / np.durationMs) * cells)
      : 0;
    for (let i = 0; i < cells; i++) {
      c.fillStyle = i < filled ? INK : DIM;
      c.fillRect(PAD + i * CELL, BAR_Y, CELL - 2, BAR_H);
    }
  }
}
