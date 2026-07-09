import { describe, it, expect } from 'vitest';
import { commandFor, sendCommand, type Action } from '../src/controls';

const getToken = async () => 'tok';

function fetchStub(status: number, body?: string): typeof fetch {
  // 204/404 must have a null body or the Response constructor throws
  return (async () => new Response(body ?? null, { status })) as typeof fetch;
}

describe('commandFor', () => {
  it('play resumes via PUT', () =>
    expect(commandFor({ type: 'play' })).toEqual({
      method: 'PUT',
      url: 'https://api.spotify.com/v1/me/player/play',
    }));
  it('pause via PUT', () =>
    expect(commandFor({ type: 'pause' }).method).toBe('PUT'));
  it('next skips via POST', () =>
    expect(commandFor({ type: 'next' })).toEqual({
      method: 'POST',
      url: 'https://api.spotify.com/v1/me/player/next',
    }));
  it('previous skips via POST', () =>
    expect(commandFor({ type: 'previous' }).method).toBe('POST'));
  it('seek carries a rounded position', () =>
    expect(commandFor({ type: 'seek', positionMs: 1234.6 })).toEqual({
      method: 'PUT',
      url: 'https://api.spotify.com/v1/me/player/seek?position_ms=1235',
    }));
});

describe('sendCommand', () => {
  const play: Action = { type: 'play' };

  it('ok on 2xx', async () => {
    expect(await sendCommand(getToken, play, fetchStub(204))).toBe('ok');
  });

  it('scope on 403 mentioning scope', async () => {
    const body = JSON.stringify({
      error: { status: 403, message: 'Insufficient client scope' },
    });
    expect(await sendCommand(getToken, play, fetchStub(403, body))).toBe('scope');
  });

  it('error on other 403s (e.g. non-premium)', async () => {
    const body = JSON.stringify({
      error: { status: 403, message: 'Player command failed: Premium required' },
    });
    expect(await sendCommand(getToken, play, fetchStub(403, body))).toBe('error');
  });

  it('error on 404 (no active device)', async () => {
    expect(await sendCommand(getToken, play, fetchStub(404))).toBe('error');
  });

  it('error when fetch throws', async () => {
    const boom = (async () => {
      throw new Error('net');
    }) as unknown as typeof fetch;
    expect(await sendCommand(getToken, play, boom)).toBe('error');
  });

  it('error when the token fetch fails', async () => {
    const noToken = async () => {
      throw new Error('not-authenticated');
    };
    expect(await sendCommand(noToken, play, fetchStub(204))).toBe('error');
  });

  it('sends the bearer token', async () => {
    let auth = '';
    const spy = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      auth = (init?.headers as Record<string, string>).Authorization;
      return new Response(null, { status: 204 });
    }) as typeof fetch;
    await sendCommand(getToken, play, spy);
    expect(auth).toBe('Bearer tok');
  });
});
