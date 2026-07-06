import { describe, it, expect } from 'vitest';
import { formatTime, marqueeOffset } from '../src/scene/lcd';

describe('formatTime', () => {
  it('formats zero', () => expect(formatTime(0)).toBe('0:00'));
  it('pads seconds', () => expect(formatTime(61_000)).toBe('1:01'));
  it('collapses hours into minutes', () =>
    expect(formatTime(4_389_000)).toBe('73:09'));
  it('floors partial seconds', () => expect(formatTime(999)).toBe('0:00'));
});

describe('marqueeOffset', () => {
  const WINDOW = 100;
  it('never scrolls text that fits', () => {
    expect(marqueeOffset(80, WINDOW, 0)).toBe(0);
    expect(marqueeOffset(80, WINDOW, 999)).toBe(0);
  });
  it('holds at 0 during the lead-in pause (first 20 ticks)', () => {
    expect(marqueeOffset(300, WINDOW, 0)).toBe(0);
    expect(marqueeOffset(300, WINDOW, 19)).toBe(0);
  });
  it('advances 2px per tick after the pause', () => {
    expect(marqueeOffset(300, WINDOW, 20)).toBe(0);
    expect(marqueeOffset(300, WINDOW, 25)).toBe(10);
  });
  it('clamps at the end and holds (max = textPx - windowPx)', () => {
    // max offset 200 -> reached at tick 120; holds for 20 ticks then loops
    expect(marqueeOffset(300, WINDOW, 120)).toBe(200);
    expect(marqueeOffset(300, WINDOW, 139)).toBe(200);
  });
  it('loops back to the lead-in pause after the end hold', () => {
    expect(marqueeOffset(300, WINDOW, 140)).toBe(0);
  });
});
