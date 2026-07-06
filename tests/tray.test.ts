import { describe, it, expect, vi } from 'vitest';
import { changeDisc, type TrayLike, type DiscLike } from '../src/scene/tray';

describe('changeDisc', () => {
  it('runs pause -> open -> setArt -> close -> play, in order, awaited', async () => {
    const log: string[] = [];
    const tray: TrayLike = {
      open: vi.fn(async () => { log.push('open'); }),
      close: vi.fn(async () => { log.push('close'); }),
    };
    const disc: DiscLike = {
      pause: vi.fn(() => log.push('pause')),
      setArt: vi.fn(() => log.push('setArt')),
      play: vi.fn(() => log.push('play')),
    };
    await changeDisc(tray, disc, 'http://art');
    expect(log).toEqual(['pause', 'open', 'setArt', 'close', 'play']);
  });

  it('passes the art url through (null for bare disc)', async () => {
    const tray: TrayLike = { open: async () => {}, close: async () => {} };
    const setArt = vi.fn();
    const disc: DiscLike = { pause: () => {}, setArt, play: () => {} };
    await changeDisc(tray, disc, null);
    expect(setArt).toHaveBeenCalledWith(null);
  });

  it('waits SWAP_SETTLE_MS between setArt and close', async () => {
    vi.useFakeTimers();
    try {
      const log: string[] = [];
      const tray: TrayLike = {
        open: vi.fn(async () => { log.push('open'); }),
        close: vi.fn(async () => { log.push('close'); }),
      };
      const disc: DiscLike = {
        pause: vi.fn(() => log.push('pause')),
        setArt: vi.fn(() => log.push('setArt')),
        play: vi.fn(() => log.push('play')),
      };
      const promise = changeDisc(tray, disc, 'http://art');

      // Advance just enough to resolve open, but not the settle timer
      vi.advanceTimersByTime(600);
      await Promise.resolve(); // flush microtasks
      expect(log).toEqual(['pause', 'open', 'setArt']); // close not yet called

      // Advance timers by less than SWAP_SETTLE_MS (250ms)
      vi.advanceTimersByTime(249);
      await Promise.resolve(); // flush microtasks
      expect(log).toEqual(['pause', 'open', 'setArt']); // close still not called

      // Advance past SWAP_SETTLE_MS
      vi.advanceTimersByTime(1);
      await Promise.resolve(); // flush microtasks

      // Allow close promise to resolve
      vi.advanceTimersByTime(600);
      await Promise.resolve();
      expect(log).toEqual(['pause', 'open', 'setArt', 'close', 'play']);

      await promise;
    } finally {
      vi.useRealTimers();
    }
  });
});
