// Only CP437-era blocks: Consolas/JetBrains Mono carry these natively, while
// eighth-blocks (▁▂▃…) trigger per-glyph font fallback and render as a mess.
const GLYPHS = ' \u2584\u2588'; // ' ', ▄, █ — empty / half / full cell
const FRAME_MS = 1000 / 12; // same chunky cadence as the ascii fields
const SMOOTH = 8;           // per-second pull toward target
const RETARGET_HZ = 3;      // avg new targets per bar per second

export interface Bar {
  level: number;  // current height, [0, 1]
  target: number; // where it's drifting to
}

export function makeBars(count: number, rng: () => number = Math.random): Bar[] {
  return Array.from({ length: count }, () => ({ level: 0, target: rng() }));
}

/** Drift each bar toward its target; retarget at random while playing. */
export function stepBars(
  bars: Bar[], dtSec: number, playing: boolean, rng: () => number = Math.random,
): void {
  const k = Math.min(1, SMOOTH * dtSec);
  for (const b of bars) {
    if (!playing) b.target = 0;
    else if (rng() < RETARGET_HZ * dtSec) b.target = rng() ** 1.5; // favor low
    b.level += (b.target - b.level) * k;
  }
}

/** Multi-line block-char EQ: one char per bar, one space between bars. */
export function renderBars(bars: Bar[], rows: number): string {
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    const below = (rows - 1 - r) * 2; // half-cells already filled below this row
    lines.push(bars.map((b) => {
      const halves = Math.round(b.level * rows * 2) - below;
      const idx = Math.max(0, Math.min(2, halves));
      // faint baseline so paused doesn't go fully blank
      return r === rows - 1 && idx === 0 ? '_' : GLYPHS[idx];
    }).join(' '));
  }
  return lines.join('\n');
}

/** DOM renderer: owns the rAF loop and writes text into a <pre>. */
export class Visualizer {
  private bars: Bar[];
  private playing = false;
  private last = 0;
  private raf: number | null = null;
  private shown = '';

  private rows: number;

  constructor(
    private el: HTMLElement,
    barCount: number,
    private rng: () => number = Math.random,
  ) {
    // fill whatever height the panel gives us, one row per text line
    const line = parseFloat(getComputedStyle(el).lineHeight) || 24;
    this.rows = el.clientHeight >= line
      ? Math.floor(el.clientHeight / line)
      : 4;
    this.bars = makeBars(barCount, rng);
    this.raf = requestAnimationFrame(this.frame);
  }

  setPlaying(playing: boolean): void {
    this.playing = playing;
  }

  private frame = (t: number): void => {
    if (!this.last) this.last = t;
    const elapsed = t - this.last;
    if (elapsed >= FRAME_MS) {
      this.last = t - (elapsed % FRAME_MS);
      stepBars(this.bars, Math.min(elapsed, 250) / 1000, this.playing, this.rng);
      const text = renderBars(this.bars, this.rows);
      if (text !== this.shown) {
        this.shown = text;
        this.el.textContent = text;
      }
    }
    this.raf = requestAnimationFrame(this.frame);
  };
}
