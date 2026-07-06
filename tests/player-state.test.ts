import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  interpolateProgress, deriveStatus, PlayerPoller,
} from '../src/player-state';
import type { NowPlaying, FetchResult } from '../src/spotify';

function np(over: Partial<NowPlaying> = {}): NowPlaying {
  return {
    kind: 'track', id: 't1', title: 'T', artist: 'A',
    artUrl: 'u', durationMs: 200_000, progressMs: 50_000,
    isPlaying: true, fetchedAt: 1_000_000, ...over,
  };
}

describe('interpolateProgress', () => {
  it('advances by wall-clock time while playing', () => {
    expect(interpolateProgress(np(), 1_003_000)).toBe(53_000);
  });
  it('freezes while paused', () => {
    expect(interpolateProgress(np({ isPlaying: false }), 1_003_000)).toBe(50_000);
  });
  it('clamps at duration', () => {
    expect(interpolateProgress(np({ progressMs: 199_500 }), 1_005_000)).toBe(200_000);
  });
});

describe('deriveStatus', () => {
  it('maps states', () => {
    expect(deriveStatus(np(), false)).toBe('playing');
    expect(deriveStatus(np({ isPlaying: false }), false)).toBe('paused');
    expect(deriveStatus(np({ kind: 'ad' }), false)).toBe('ad');
    expect(deriveStatus(null, false)).toBe('idle');
    expect(deriveStatus(null, true)).toBe('error');
    // poll failed but we still have last data -> keep showing it
    expect(deriveStatus(np(), true)).toBe('playing');
  });
});

describe('PlayerPoller', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // fetchedAt must be "now" under fake timers — a stale timestamp makes
  // interpolation instantly hit duration and fires the track-end early poll
  const fresh = (over: Partial<NowPlaying> = {}) =>
    np({ fetchedAt: Date.now(), ...over });

  function makePoller(results: FetchResult[]) {
    const fetchNow = vi.fn(async () => results.shift() ?? results[0] ?? { ok: true as const, np: null });
    const onUpdate = vi.fn();
    const onTrackChange = vi.fn();
    const p = new PlayerPoller(fetchNow, onUpdate, onTrackChange);
    return { p, fetchNow, onUpdate, onTrackChange };
  }

  it('polls immediately on start, then every 5s', async () => {
    const { p, fetchNow } = makePoller([{ ok: true, np: fresh() }]);
    p.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchNow).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchNow).toHaveBeenCalledTimes(3);
    p.stop();
  });

  it('fires onTrackChange when id changes, not on first load', async () => {
    const a = fresh({ id: 'a' });
    const b = fresh({ id: 'b' });
    const { p, onTrackChange } = makePoller([
      { ok: true, np: a }, { ok: true, np: b },
    ]);
    p.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(onTrackChange).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(onTrackChange).toHaveBeenCalledWith(a, b);
    p.stop();
  });

  it('does not fire onTrackChange for ads', async () => {
    const { p, onTrackChange } = makePoller([
      { ok: true, np: fresh({ id: 'a' }) },
      { ok: true, np: fresh({ id: 'ad', kind: 'ad' }) },
    ]);
    p.start();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(onTrackChange).not.toHaveBeenCalled();
    p.stop();
  });

  it('delays next poll by retryAfterMs on failure and flags stale', async () => {
    const { p, fetchNow, onUpdate } = makePoller([
      { ok: true, np: fresh() },
      { ok: false, retryAfterMs: 12_000 },
      { ok: true, np: fresh() },
    ]);
    p.start();
    await vi.advanceTimersByTimeAsync(5_000); // failure lands here
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ stale: true }),
    );
    const calls = fetchNow.mock.calls.length; // 2 so far
    await vi.advanceTimersByTimeAsync(5_000); // only 5s elapsed of 12
    expect(fetchNow).toHaveBeenCalledTimes(calls);
    await vi.advanceTimersByTimeAsync(7_000);
    expect(fetchNow).toHaveBeenCalledTimes(calls + 1);
    p.stop();
  });

  it('re-polls immediately when interpolated progress reaches duration', async () => {
    const nearEnd = fresh({ progressMs: 198_000, durationMs: 200_000 });
    const { p, fetchNow } = makePoller([{ ok: true, np: nearEnd }]);
    p.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchNow).toHaveBeenCalledTimes(1);
    // ticker crosses duration ~2s in; expect an early poll well before 5s
    await vi.advanceTimersByTimeAsync(2_600);
    expect(fetchNow).toHaveBeenCalledTimes(2);
    p.stop();
  });
});
