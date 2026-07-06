import { describe, it, expect } from 'vitest';
import { panelText, statusFlag, progressFraction } from '../src/scene/panel';
import type { DisplayState } from '../src/player-state';
import type { NowPlaying } from '../src/spotify';

const np: NowPlaying = {
  kind: 'track',
  id: 't1',
  title: 'Song Title',
  artist: 'Some Artist',
  artUrl: 'http://art',
  durationMs: 200_000,
  progressMs: 50_000,
  isPlaying: true,
  fetchedAt: 0,
};

const base: DisplayState = { status: 'playing', np, progressMs: 50_000, stale: false };

describe('panelText', () => {
  it('idle shows NO DISC', () =>
    expect(panelText({ ...base, status: 'idle', np: null })).toEqual({
      artist: '—',
      track: 'NO DISC',
    }));
  it('error shows ERR', () =>
    expect(panelText({ ...base, status: 'error', np: null })).toEqual({
      artist: '—',
      track: 'ERR',
    }));
  it('ad shows AD BREAK', () =>
    expect(panelText({ ...base, status: 'ad' }).track).toBe('AD BREAK'));
  it('playing shows artist and title', () =>
    expect(panelText(base)).toEqual({ artist: 'Some Artist', track: 'Song Title' }));
  it('paused shows artist and title', () =>
    expect(panelText({ ...base, status: 'paused' })).toEqual({
      artist: 'Some Artist',
      track: 'Song Title',
    }));
});

describe('statusFlag', () => {
  it('empty while playing fresh', () => expect(statusFlag(base)).toBe(''));
  it('PAUSE while paused', () =>
    expect(statusFlag({ ...base, status: 'paused' })).toBe('PAUSE'));
  it('ERR while stale', () => expect(statusFlag({ ...base, stale: true })).toBe('ERR'));
  it('both when paused and stale', () =>
    expect(statusFlag({ ...base, status: 'paused', stale: true })).toBe('PAUSE ERR'));
});

describe('progressFraction', () => {
  it('maps progress to [0,1]', () => expect(progressFraction(base)).toBeCloseTo(0.25));
  it('clamps past-the-end progress to 1', () =>
    expect(progressFraction({ ...base, progressMs: 999_000 })).toBe(1));
  it('zero when no track', () =>
    expect(progressFraction({ ...base, np: null, progressMs: 0 })).toBe(0));
  it('zero for zero-duration (ad snapshots)', () =>
    expect(
      progressFraction({ ...base, np: { ...np, durationMs: 0 }, progressMs: 10 }),
    ).toBe(0));
});
