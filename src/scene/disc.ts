export interface SpinState {
  angleDeg: number;
  rps: number;
}

const TIME_CONSTANT_MS = 500; // exponential ease for spin-up/down

export function stepSpin(
  current: SpinState,
  targetRps: number,
  dtMs: number,
): SpinState {
  const k = 1 - Math.exp(-dtMs / TIME_CONSTANT_MS);
  const rps = current.rps + (targetRps - current.rps) * k;
  // integrate with average speed over the step for smoothness
  const avg = (current.rps + rps) / 2;
  const angleDeg = ((current.angleDeg + avg * 360 * (dtMs / 1000)) % 360 + 360) % 360;
  return { angleDeg, rps };
}

const FULL_RPS = 0.55; // ~1.8s per revolution

export class Disc {
  private state: SpinState = { angleDeg: 0, rps: 0 };
  private target = 0;
  private lastT = 0;
  private running = false;
  private artA: HTMLImageElement;
  private artB: HTMLImageElement;
  private frontIsA = true;

  constructor(private root: HTMLElement) {
    this.artA = root.querySelector('#art-a')!;
    this.artB = root.querySelector('#art-b')!;
    this.startLoop();
  }

  private startLoop(): void {
    if (this.running) return;
    this.running = true;
    this.lastT = 0; // reset timestamp so first dt isn't huge after a long idle
    requestAnimationFrame((t) => this.frame(t));
  }

  private frame(t: number): void {
    const dt = this.lastT ? Math.min(t - this.lastT, 100) : 16;
    this.lastT = t;
    this.state = stepSpin(this.state, this.target, dt);
    this.root.style.transform = `rotate(${this.state.angleDeg}deg)`;

    // Stop scheduling frames when the disc is fully idle to save CPU/GPU
    if (this.target === 0 && this.state.rps < 0.001) {
      this.running = false;
      return;
    }
    requestAnimationFrame((next) => this.frame(next));
  }

  play(): void {
    this.target = FULL_RPS;
    this.startLoop(); // restart loop if it was stopped while idle
  }

  pause(): void { this.target = 0; }

  setVisible(v: boolean): void {
    this.root.style.visibility = v ? 'visible' : 'hidden';
  }

  /** Crossfade to new art; null shows the bare silver disc (no art layer). */
  setArt(url: string | null): void {
    const front = this.frontIsA ? this.artA : this.artB;
    const back = this.frontIsA ? this.artB : this.artA;
    if (url) {
      back.src = url;
      // Reassign both handlers each call so stale callbacks from a superseded
      // load cannot fire after a subsequent setArt call replaces them.
      back.onload = () => {
        back.style.opacity = '1';
        front.style.opacity = '0';
        this.frontIsA = !this.frontIsA;
        back.onload = null;
        back.onerror = null;
      };
      back.onerror = () => {
        // Image failed to load — leave the current front art showing and clear
        // the pending swap state so a later setArt call works normally.
        back.src = '';
        back.onload = null;
        back.onerror = null;
      };
    } else {
      this.artA.style.opacity = '0';
      this.artB.style.opacity = '0';
    }
  }
}
