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
    const fetchNow = vi.fn(async (): Promise<FetchResult> => results.shift() ?? results[0] ?? { ok: true, np: null });
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

  it('start() twice does not create a second ticker', async () => {
    const { p, fetchNow } = makePoller([
      { ok: true, np: fresh() },
      { ok: true, np: fresh() },
      { ok: true, np: fresh() },
    ]);
    p.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchNow).toHaveBeenCalledTimes(1); // initial poll
    p.start(); // second start() - without guard, calls poll() again
    await vi.advanceTimersByTimeAsync(0);
    // With guard: still 1 call (second start ignored)
    // Without guard: 2 calls (poll() called again)
    expect(fetchNow).toHaveBeenCalledTimes(1);
    p.stop();
  });

  it('stop() clears polling flag allowing start() to poll again', async () => {
    // Scenario: if stop() doesn't clear polling flag, subsequent start() will have polling=true
    // and poll() will return early due to the guard at start of poll()
    const fetchResults = [
      { ok: true, np: fresh() },
      { ok: true, np: fresh() },
    ];
    const fetchNow = vi.fn(async (): Promise<FetchResult> => {
      // Immediate return, but the point is the polling flag lifecycle
      return (fetchResults.shift() ?? { ok: true, np: null }) as FetchResult;
    });
    const onUpdate = vi.fn();
    const onTrackChange = vi.fn();
    const p = new PlayerPoller(fetchNow, onUpdate, onTrackChange);

    p.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchNow).toHaveBeenCalledTimes(1);
    // At this point polling flag was set to true by poll(), then set to false when it returned
    // But if we stop() before poll() returns, the flag stays true

    // Stop the poller
    p.stop();

    // Start again immediately - this should work because stop() should have cleared polling
    p.start();
    // Without the fix: polling flag is still true from first poll, poll() no-ops
    // With the fix: stop() clears polling=false, poll() executes
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchNow).toHaveBeenCalledTimes(2);
    p.stop();
  });
});
