import { describe, it, expect } from 'vitest';
import { computeStageScale } from '../src/scene/stage';

describe('computeStageScale', () => {
  it('is 1 at native 2560x1440', () => {
    expect(computeStageScale(2560, 1440)).toBe(1);
  });
  it('letterboxes a wider viewport by height', () => {
    expect(computeStageScale(3440, 1440)).toBe(1);
  });
  it('scales down for 1080p', () => {
    expect(computeStageScale(1920, 1080)).toBeCloseTo(0.75);
  });
  it('upscales for 4K', () => {
    expect(computeStageScale(3840, 2160)).toBeCloseTo(1.5);
  });
});
