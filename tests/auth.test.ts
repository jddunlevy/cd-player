import { describe, it, expect } from 'vitest';
import {
  randomVerifier, base64url, codeChallenge,
  mergeTokenResponse, shouldRefresh, type Tokens,
} from '../src/auth';

describe('randomVerifier', () => {
  it('is 64 chars of the PKCE-legal alphabet by default', () => {
    const v = randomVerifier();
    expect(v).toHaveLength(64);
    expect(v).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });
  it('produces distinct values', () => {
    expect(randomVerifier()).not.toBe(randomVerifier());
  });
});

describe('base64url', () => {
  it('strips padding and uses url-safe alphabet', () => {
    // 0xfb 0xff -> base64 "+/8=" ... use bytes that exercise + and /
    const bytes = new Uint8Array([251, 255, 191]).buffer;
    const out = base64url(bytes);
    expect(out).not.toMatch(/[+/=]/);
  });
});

describe('codeChallenge', () => {
  it('matches the RFC 7636 appendix B test vector', async () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    expect(await codeChallenge(verifier)).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });
});

describe('token lifecycle', () => {
  const NOW = 1_000_000;
  it('mergeTokenResponse computes expiresAt and keeps old refresh token if absent', () => {
    const prev: Tokens = { accessToken: 'a', refreshToken: 'r-old', expiresAt: 0 };
    const merged = mergeTokenResponse(
      prev, { access_token: 'a2', expires_in: 3600 }, NOW,
    );
    expect(merged).toEqual({
      accessToken: 'a2', refreshToken: 'r-old', expiresAt: NOW + 3_600_000,
    });
  });
  it('mergeTokenResponse prefers a newly issued refresh token', () => {
    const merged = mergeTokenResponse(
      null, { access_token: 'a', refresh_token: 'r-new', expires_in: 60 }, NOW,
    );
    expect(merged.refreshToken).toBe('r-new');
  });
  it('shouldRefresh triggers inside the 60s safety margin', () => {
    const t: Tokens = { accessToken: 'a', refreshToken: 'r', expiresAt: NOW + 59_000 };
    expect(shouldRefresh(t, NOW)).toBe(true);
    expect(shouldRefresh({ ...t, expiresAt: NOW + 61_000 }, NOW)).toBe(false);
  });
});
