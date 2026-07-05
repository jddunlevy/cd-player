import { describe, it, expect, vi } from 'vitest';
import { parseNowPlaying, fetchNowPlaying } from '../src/spotify';
import track from './fixtures/track.json';
import episode from './fixtures/episode.json';
import ad from './fixtures/ad.json';

const T = 1_700_000_000_000;

describe('parseNowPlaying', () => {
  it('parses a track: joined artists, largest image', () => {
    const np = parseNowPlaying(track, T)!;
    expect(np).toEqual({
      kind: 'track',
      id: '4uLU6hMCjMI75M1A2tKUQC',
      title: 'Never Gonna Give You Up',
      artist: 'Rick Astley, Guest Artist',
      artUrl: 'https://i.scdn.co/image/640.jpg',
      durationMs: 213573,
      progressMs: 43000,
      isPlaying: true,
      fetchedAt: T,
    });
  });
  it('parses an episode: show name as artist', () => {
    const np = parseNowPlaying(episode, T)!;
    expect(np.kind).toBe('episode');
    expect(np.artist).toBe('Deep Thoughts');
    expect(np.artUrl).toBe('https://i.scdn.co/image/ep640.jpg');
  });
  it('parses an ad: no art, no title', () => {
    const np = parseNowPlaying(ad, T)!;
    expect(np.kind).toBe('ad');
    expect(np.artUrl).toBeNull();
    expect(np.id).toBe('ad');
  });
  it('returns null for empty/invalid payloads', () => {
    expect(parseNowPlaying(null, T)).toBeNull();
    expect(parseNowPlaying({}, T)).toBeNull();
  });
});

function mockFetch(status: number, body?: unknown, headers?: Record<string, string>) {
  return vi.fn(async () =>
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers,
    }),
  ) as unknown as typeof fetch;
}

describe('fetchNowPlaying', () => {
  const token = async () => 'tok';

  it('returns parsed NowPlaying on 200', async () => {
    const r = await fetchNowPlaying(token, mockFetch(200, track));
    expect(r).toMatchObject({ ok: true, np: { kind: 'track' } });
  });
  it('returns np: null on 204 (nothing playing)', async () => {
    const r = await fetchNowPlaying(token, mockFetch(204));
    expect(r).toEqual({ ok: true, np: null });
  });
  it('honours Retry-After on 429', async () => {
    const r = await fetchNowPlaying(token, mockFetch(429, undefined, { 'Retry-After': '7' }));
    expect(r).toEqual({ ok: false, retryAfterMs: 7000 });
  });
  it('reports failure with default backoff on 5xx', async () => {
    const r = await fetchNowPlaying(token, mockFetch(502));
    expect(r).toEqual({ ok: false, retryAfterMs: 10000 });
  });
  it('reports failure when token retrieval throws', async () => {
    const r = await fetchNowPlaying(async () => { throw new Error('not-authenticated'); });
    expect(r).toEqual({ ok: false, retryAfterMs: 10000 });
  });
});
