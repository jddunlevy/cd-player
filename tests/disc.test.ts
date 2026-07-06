import { describe, it, expect } from 'vitest';
import { stepSpin, type SpinState } from '../src/scene/disc';

const FULL = 0.55; // rps

describe('stepSpin', () => {
  it('accelerates toward target', () => {
    const s = stepSpin({ angleDeg: 0, rps: 0 }, FULL, 100);
    expect(s.rps).toBeGreaterThan(0);
    expect(s.rps).toBeLessThan(FULL);
  });
  it('decelerates toward zero', () => {
    const s = stepSpin({ angleDeg: 0, rps: FULL }, 0, 100);
    expect(s.rps).toBeLessThan(FULL);
    expect(s.rps).toBeGreaterThan(0);
  });
  it('advances angle by rps * dt', () => {
    // at steady full speed, 1000ms -> 0.55 rev -> 198 degrees
    const s = stepSpin({ angleDeg: 0, rps: FULL }, FULL, 1000);
    expect(s.angleDeg).toBeCloseTo(198, 0);
  });
  it('converges: near-stopped after 3s of decel', () => {
    let s: SpinState = { angleDeg: 0, rps: FULL };
    for (let i = 0; i < 30; i++) s = stepSpin(s, 0, 100);
    expect(s.rps).toBeLessThan(0.01);
  });
  it('wraps angle into [0, 360)', () => {
    const s = stepSpin({ angleDeg: 359, rps: FULL }, FULL, 1000);
    expect(s.angleDeg).toBeGreaterThanOrEqual(0);
    expect(s.angleDeg).toBeLessThan(360);
  });
});
