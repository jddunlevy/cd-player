import type { NowPlaying, FetchResult } from './spotify';
import { POLL_INTERVAL_MS } from './config';

export type DisplayStatus = 'playing' | 'paused' | 'idle' | 'ad' | 'error';

export interface DisplayState {
  status: DisplayStatus;
  np: NowPlaying | null;
  progressMs: number;
  stale: boolean;
}

export function interpolateProgress(np: NowPlaying, now: number): number {
  if (!np.isPlaying) return np.progressMs;
  return Math.min(np.durationMs, np.progressMs + (now - np.fetchedAt));
}

export function deriveStatus(
  np: NowPlaying | null,
  lastPollFailed: boolean,
): DisplayStatus {
  if (np) {
    if (np.kind === 'ad') return 'ad';
    return np.isPlaying ? 'playing' : 'paused';
  }
  return lastPollFailed ? 'error' : 'idle';
}

const TICK_MS = 250;

export class PlayerPoller {
  private np: NowPlaying | null = null;
  private lastPollFailed = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private endPolled = false; // one early poll per track-end
  private polling = false;

  constructor(
    private fetchNow: () => Promise<FetchResult>,
    private onUpdate: (s: DisplayState) => void,
    private onTrackChange: (prev: NowPlaying | null, next: NowPlaying) => void,
  ) {}

  start(): void {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => this.tick(), TICK_MS);
    void this.poll();
  }

  stop(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.pollTimer = null;
    this.tickTimer = null;
    this.polling = false;
  }

  private emit(): void {
    const now = Date.now();
    this.onUpdate({
      status: deriveStatus(this.np, this.lastPollFailed),
      np: this.np,
      progressMs: this.np ? interpolateProgress(this.np, now) : 0,
      stale: this.lastPollFailed && this.np !== null,
    });
  }

  private tick(): void {
    if (!this.np) return;
    this.emit();
    const done =
      this.np.isPlaying &&
      interpolateProgress(this.np, Date.now()) >= this.np.durationMs;
    if (done && !this.endPolled) {
      this.endPolled = true;
      this.schedule(0);
    }
  }

  private schedule(delayMs: number): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => void this.poll(), delayMs);
  }

  private async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    const result = await this.fetchNow();
    this.polling = false;

    if (result.ok) {
      this.lastPollFailed = false;
      const prev = this.np;
      const next = result.np;
      if (next && next.kind !== 'ad' && next.id !== prev?.id && prev !== null) {
        this.onTrackChange(prev, next);
      }
      this.np = next;
      this.endPolled = false;
      this.schedule(POLL_INTERVAL_MS);
    } else {
      this.lastPollFailed = true;
      this.schedule(result.retryAfterMs);
    }
    this.emit();
  }
}
