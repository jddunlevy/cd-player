import { CLIENT_ID, REDIRECT_URI, SCOPE } from './config';

const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const LS_TOKENS = 'cdp.tokens';
const LS_VERIFIER = 'cdp.verifier';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export function randomVerifier(): string {
  // 64 chars: 256 % 64 === 0, so byte % length is uniform
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const bytes = crypto.getRandomValues(new Uint8Array(64));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export function base64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  );
  return base64url(digest);
}

export function mergeTokenResponse(
  prev: Tokens | null,
  resp: TokenResponse,
  now: number,
): Tokens {
  return {
    accessToken: resp.access_token,
    refreshToken: resp.refresh_token ?? prev?.refreshToken ?? '',
    expiresAt: now + resp.expires_in * 1000,
  };
}

export function shouldRefresh(t: Tokens, now: number): boolean {
  return now >= t.expiresAt - 60_000;
}

export function loadTokens(): Tokens | null {
  const raw = localStorage.getItem(LS_TOKENS);
  return raw ? (JSON.parse(raw) as Tokens) : null;
}

export function saveTokens(t: Tokens): void {
  localStorage.setItem(LS_TOKENS, JSON.stringify(t));
}

/** Drop stored tokens (e.g. when their scope is stale) to force re-login. */
export function clearTokens(): void {
  localStorage.removeItem(LS_TOKENS);
}

export async function beginLogin(): Promise<void> {
  const verifier = randomVerifier();
  localStorage.setItem(LS_VERIFIER, verifier);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    code_challenge_method: 'S256',
    code_challenge: await codeChallenge(verifier),
  });
  location.assign(`${AUTH_URL}?${params}`);
}

async function requestTokens(body: URLSearchParams): Promise<Tokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`token endpoint ${res.status}`);
  const json = (await res.json()) as TokenResponse;
  const merged = mergeTokenResponse(loadTokens(), json, Date.now());
  saveTokens(merged);
  return merged;
}

/** Call on boot. Exchanges ?code= if present; cleans the URL. */
export async function handleCallbackIfPresent(): Promise<void> {
  const code = new URLSearchParams(location.search).get('code');
  if (!code) return;
  const verifier = localStorage.getItem(LS_VERIFIER) ?? '';
  await requestTokens(
    new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  );
  localStorage.removeItem(LS_VERIFIER);
  history.replaceState(null, '', '/');
}

export async function getAccessToken(): Promise<string> {
  const t = loadTokens();
  if (!t) throw new Error('not-authenticated');
  if (!shouldRefresh(t, Date.now())) return t.accessToken;
  const refreshed = await requestTokens(
    new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: t.refreshToken,
    }),
  );
  return refreshed.accessToken;
}
