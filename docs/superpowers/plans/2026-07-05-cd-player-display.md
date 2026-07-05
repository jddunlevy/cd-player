# CD Player Now-Playing Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fullscreen Spotify now-playing display for a second monitor, styled as a real-photo CD player with a crisp rotating album-art disc, pixelated LCD, and tray animation on track change.

**Architecture:** Single static Vite + vanilla TypeScript app, no backend. Client-side Authorization Code + PKCE keeps tokens in localStorage and self-refreshes. A poller hits `/me/player/currently-playing` every 5s and a local ticker interpolates progress between polls. The scene is a fixed 2560×1440 stage of absolutely-positioned layers (backdrop gradient, photo cutouts, disc, tray, LCD canvas) scaled to fit the viewport.

**Tech Stack:** Vite, vanilla TypeScript, Vitest, `@fontsource/vt323`. No UI framework, no PixiJS.

## Global Constraints

- Design resolution: fixed **2560×1440** stage, `transform: scale()` letterboxed to viewport
- Palette (avocado, from ascii-editor PLAN.md §13): `--bg: #d4e3c0`, `--surface: #e8efd9`, `--text: #2d3a1f`, `--muted: #5a6b46`, `--accent: #3d5a2a`
- Typography: VT323 for the LCD canvas only; JetBrains Mono fallback stack (`'JetBrains Mono', 'Consolas', monospace`) for any non-LCD text (auth button, error text)
- Style rules (CLAUDE.md): 1px solid borders, **no border-radius** (sole exception: the disc and its spindle hole — physical circles), no shadows, no emoji, ASCII symbols only, transitions limited to what the physical animations require
- Spotify: scope `user-read-currently-playing` only; redirect URI exactly `http://127.0.0.1:5173/callback`; app must always be opened at `http://127.0.0.1:5173` (NOT `localhost` — different origin, tokens would land in the wrong localStorage, and Spotify rejects non-loopback http)
- Poll cadence: 5000ms + local interpolation; immediate re-poll when interpolated progress reaches duration
- Vite dev server: `strictPort: true` so the port never drifts from the registered redirect URI
- All new logic that is pure (no DOM, no network) gets a Vitest test first (TDD)
- Node ≥ 20 assumed (provides `crypto.subtle` and `fetch` in Vitest's node environment)

## Prerequisites (human, before Task 9 can be verified end-to-end)

1. Create an app at https://developer.spotify.com/dashboard (development mode; owner needs Spotify Premium). Add redirect URI `http://127.0.0.1:5173/callback`. Copy the Client ID.
2. Put the Client ID in `.env.local` as `VITE_SPOTIFY_CLIENT_ID=...` (Task 1 creates the file with a placeholder).
3. Photo assets per `docs/assets-spec.md` (Task 10) — development proceeds on placeholders until then.

## File Structure

```
cd-player/
├── index.html                  # stage skeleton: layer divs, LCD canvas, auth gate
├── package.json
├── tsconfig.json
├── vite.config.ts              # strictPort 5173
├── .env.local                  # VITE_SPOTIFY_CLIENT_ID (gitignored)
├── .gitignore
├── public/assets/              # photo cutout PNGs (placeholders → real)
├── docs/
│   ├── assets-spec.md          # asset shopping list for the human
│   └── superpowers/plans/      # this plan
├── src/
│   ├── main.ts                 # boot: auth gate, wiring poller → scene
│   ├── config.ts               # client id, redirect uri, stage/LCD dimensions
│   ├── auth.ts                 # PKCE helpers, token store, login/callback/refresh
│   ├── spotify.ts              # NowPlaying type, response parsing, fetch wrapper
│   ├── player-state.ts         # DisplayState, interpolation, PlayerPoller
│   ├── scene/
│   │   ├── stage.ts            # computeStageScale + viewport fitting
│   │   ├── disc.ts             # spin physics (stepSpin) + disc DOM (art, crossfade)
│   │   ├── tray.ts             # tray open/close + track-change sequencer
│   │   └── lcd.ts              # formatTime, marqueeSlice, canvas renderer
│   └── styles/
│       ├── theme.css           # avocado tokens, fonts, base reset
│       └── scene.css           # stage, layers, disc, tray, LCD positioning
└── tests/
    ├── stage.test.ts
    ├── auth.test.ts
    ├── spotify.test.ts
    ├── player-state.test.ts
    ├── lcd.test.ts
    ├── disc.test.ts
    ├── tray.test.ts
    └── fixtures/
        ├── track.json          # trimmed currently-playing responses
        ├── episode.json
        └── ad.json
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `.env.local`, `index.html` (minimal for now), `src/main.ts` (stub), `tests/smoke.test.ts`

**Interfaces:**
- Produces: a running `npm run dev` on port 5173 and a passing `npm test` (Vitest); directory layout all later tasks assume.

- [ ] **Step 1: Init git and npm project**

```bash
cd "C:/Users/jaxon/code/cd-player"
git init
npm init -y
npm install -D vite typescript vitest
npm install @fontsource/vt323
```

- [ ] **Step 2: Write config files**

`package.json` — replace the `scripts` block (keep npm-generated fields, remove `"main"`):

```json
{
  "name": "cd-player",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

`vite.config.ts`:

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
  },
});
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "types": ["vite/client"]
  },
  "include": ["src", "tests"]
}
```

`.gitignore`:

```
node_modules/
dist/
.env.local
```

`.env.local`:

```
VITE_SPOTIFY_CLIENT_ID=PASTE_CLIENT_ID_HERE
```

`index.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>CD PLAYER</title>
</head>
<body>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

`src/main.ts`:

```ts
console.log('cd-player boot');
```

- [ ] **Step 3: Write smoke test**

`tests/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('toolchain', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2);
  });
  it('has web crypto available', () => {
    expect(typeof crypto.subtle.digest).toBe('function');
  });
});
```

- [ ] **Step 4: Verify test passes and dev server starts**

Run: `npm test`
Expected: 2 passed.

Run: `npm run dev` (then Ctrl+C)
Expected: `Local: http://localhost:5173/` — confirms strictPort binding; the app itself must always be *opened* via `http://127.0.0.1:5173`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite + typescript + vitest project"
```

---

### Task 2: Theme, stage skeleton, and viewport scaling

**Files:**
- Create: `src/config.ts`, `src/styles/theme.css`, `src/styles/scene.css`, `src/scene/stage.ts`
- Modify: `index.html`, `src/main.ts`
- Test: `tests/stage.test.ts`

**Interfaces:**
- Produces:
  - `config.ts`: `STAGE_W = 2560`, `STAGE_H = 1440`, `LCD_W = 320`, `LCD_H = 96`, `CLIENT_ID: string`, `REDIRECT_URI: string`, `SCOPE: string`, `POLL_INTERVAL_MS = 5000`
  - `stage.ts`: `computeStageScale(vw: number, vh: number): number`, `fitStage(stage: HTMLElement): void`
  - DOM ids all later tasks target: `#stage`, `#holder`, `#player`, `#tray`, `#disc`, `#art-a`, `#art-b`, `#lcd` (canvas), `#auth-gate`, `#auth-button`

- [ ] **Step 1: Write the failing test**

`tests/stage.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- stage`
Expected: FAIL — cannot resolve `../src/scene/stage`.

- [ ] **Step 3: Implement config, stage module, styles, and HTML skeleton**

`src/config.ts`:

```ts
export const STAGE_W = 2560;
export const STAGE_H = 1440;

export const LCD_W = 320;   // native LCD canvas pixels
export const LCD_H = 96;    // CSS upscales the canvas 4x -> 1280x384 on stage

export const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string;
export const REDIRECT_URI = 'http://127.0.0.1:5173/callback';
export const SCOPE = 'user-read-currently-playing';
export const POLL_INTERVAL_MS = 5000;
```

`src/scene/stage.ts`:

```ts
import { STAGE_W, STAGE_H } from '../config';

export function computeStageScale(vw: number, vh: number): number {
  return Math.min(vw / STAGE_W, vh / STAGE_H);
}

export function fitStage(stage: HTMLElement): void {
  const apply = () => {
    const s = computeStageScale(window.innerWidth, window.innerHeight);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  };
  window.addEventListener('resize', apply);
  apply();
}
```

`src/styles/theme.css`:

```css
@font-face { /* provided by @fontsource import in main.ts */ }

:root {
  --bg: #d4e3c0;
  --surface: #e8efd9;
  --text: #2d3a1f;
  --muted: #5a6b46;
  --accent: #3d5a2a;
  --mono: 'JetBrains Mono', 'Consolas', monospace;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

html, body {
  height: 100%;
  overflow: hidden;
  background: #0d1208; /* letterbox bars darker than stage */
  font-family: var(--mono);
  color: var(--text);
}
```

`src/styles/scene.css`:

```css
#stage {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2560px;
  height: 1440px;
  transform: translate(-50%, -50%) scale(1);
  transform-origin: center center;
  overflow: hidden;
  background:
    linear-gradient(180deg, var(--surface) 0%, var(--bg) 70%, #c3d4ad 100%);
}

#stage > * { position: absolute; }

/* Layer stack (z-index): stage gradient, holder 10, tray 20, player 30, lcd 40 */
#holder  { z-index: 10; left: 1880px; top: 480px;  width: 480px;  height: 720px; }
#tray    { z-index: 20; left: 640px;  top: 560px;  width: 900px;  height: 560px; }
#player  { z-index: 30; left: 480px;  top: 280px;  width: 1280px; height: 900px; pointer-events: none; }
#lcd     { z-index: 40; left: 640px;  top: 980px;  width: 1280px; height: 384px;
           image-rendering: pixelated; }

/* Positions above are placeholder-era guesses; retune when real cutouts land. */

#auth-gate {
  z-index: 50;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
}
#auth-gate[hidden] { display: none; }

#auth-button {
  font-family: var(--mono);
  font-size: 24px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--text);
  padding: 12px 48px;
  cursor: pointer;
  transition: color 80ms, background-color 80ms;
}
#auth-button:hover { background: var(--accent); color: var(--surface); }
```

`index.html` (replace body):

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>CD PLAYER</title>
</head>
<body>
  <div id="stage">
    <img id="holder" alt="" draggable="false" />
    <div id="tray">
      <div id="disc">
        <img id="art-a" class="art" alt="" draggable="false" />
        <img id="art-b" class="art" alt="" draggable="false" />
        <div id="disc-rim"></div>
        <div id="disc-hole"></div>
      </div>
    </div>
    <img id="player" alt="" draggable="false" />
    <canvas id="lcd" width="320" height="96"></canvas>
    <div id="auth-gate">
      <button id="auth-button">&#9654; CONNECT SPOTIFY</button>
    </div>
  </div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

`src/main.ts` (replace):

```ts
import '@fontsource/vt323';
import './styles/theme.css';
import './styles/scene.css';
import { fitStage } from './scene/stage';

const stage = document.getElementById('stage')!;
fitStage(stage);
```

- [ ] **Step 4: Run tests, verify visually**

Run: `npm test -- stage`
Expected: 4 passed.

Run: `npm run dev`, open `http://127.0.0.1:5173` — expect the avocado gradient stage centered with dark letterbox bars when the window aspect ≠ 16:9, and the CONNECT SPOTIFY gate centered.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: avocado theme, 2560x1440 stage with viewport scaling"
```

---

### Task 3: PKCE auth module

**Files:**
- Create: `src/auth.ts`
- Test: `tests/auth.test.ts`

**Interfaces:**
- Consumes: `CLIENT_ID`, `REDIRECT_URI`, `SCOPE` from `src/config.ts`
- Produces (used by Task 4/9):
  - `interface Tokens { accessToken: string; refreshToken: string; expiresAt: number }`
  - `randomVerifier(length?: number): string`
  - `base64url(bytes: ArrayBuffer): string`
  - `codeChallenge(verifier: string): Promise<string>`
  - `mergeTokenResponse(prev: Tokens | null, resp: TokenResponse, now: number): Tokens`
  - `shouldRefresh(t: Tokens, now: number): boolean`
  - `loadTokens(): Tokens | null`, `saveTokens(t: Tokens): void`
  - `beginLogin(): Promise<void>` (redirects to Spotify)
  - `handleCallbackIfPresent(): Promise<boolean>` (true if a code was exchanged)
  - `getAccessToken(): Promise<string>` (refreshes when needed; throws `Error('not-authenticated')` if no tokens)

- [ ] **Step 1: Write the failing tests (pure parts only)**

`tests/auth.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- auth`
Expected: FAIL — cannot resolve `../src/auth`.

- [ ] **Step 3: Implement `src/auth.ts`**

```ts
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

export function randomVerifier(length = 64): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
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
export async function handleCallbackIfPresent(): Promise<boolean> {
  const code = new URLSearchParams(location.search).get('code');
  if (!code) return false;
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
  return true;
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
```

Note: `import.meta.env` in `config.ts` is undefined under Vitest's node environment unless configured — but `auth.test.ts` only touches pure functions, and Vite defines it at serve time. If the import chain errors in tests, add to `vite.config.ts`: `test: { env: { VITE_SPOTIFY_CLIENT_ID: 'test-id' } }` (Vitest reads the `test` key from vite config; also change the config import to `vitest/config`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- auth`
Expected: 7 passed (RFC test vector is the canary — if it fails, the base64url or digest is wrong).

- [ ] **Step 5: Commit**

```bash
git add src/auth.ts tests/auth.test.ts vite.config.ts
git commit -m "feat: client-side PKCE auth with token refresh"
```

---

### Task 4: Spotify client — parsing and fetch wrapper

**Files:**
- Create: `src/spotify.ts`, `tests/fixtures/track.json`, `tests/fixtures/episode.json`, `tests/fixtures/ad.json`
- Test: `tests/spotify.test.ts`

**Interfaces:**
- Consumes: `getAccessToken()` from Task 3 (injected as a function, not imported, for testability)
- Produces (used by Tasks 5/9):
  - `type PlaybackKind = 'track' | 'episode' | 'ad'`
  - `interface NowPlaying { kind: PlaybackKind; id: string; title: string; artist: string; artUrl: string | null; durationMs: number; progressMs: number; isPlaying: boolean; fetchedAt: number }`
  - `parseNowPlaying(json: unknown, fetchedAt: number): NowPlaying | null`
  - `type FetchResult = { ok: true; np: NowPlaying | null } | { ok: false; retryAfterMs: number }`
  - `fetchNowPlaying(getToken: () => Promise<string>, fetchFn?: typeof fetch): Promise<FetchResult>`

- [ ] **Step 1: Create trimmed API fixtures**

`tests/fixtures/track.json`:

```json
{
  "progress_ms": 43000,
  "is_playing": true,
  "currently_playing_type": "track",
  "item": {
    "id": "4uLU6hMCjMI75M1A2tKUQC",
    "name": "Never Gonna Give You Up",
    "duration_ms": 213573,
    "artists": [{ "name": "Rick Astley" }, { "name": "Guest Artist" }],
    "album": {
      "images": [
        { "url": "https://i.scdn.co/image/640.jpg", "height": 640, "width": 640 },
        { "url": "https://i.scdn.co/image/300.jpg", "height": 300, "width": 300 }
      ]
    }
  }
}
```

`tests/fixtures/episode.json`:

```json
{
  "progress_ms": 120000,
  "is_playing": true,
  "currently_playing_type": "episode",
  "item": {
    "id": "512ojhOuo1ktJprKbVcKyQ",
    "name": "Episode 42: The Answer",
    "duration_ms": 3600000,
    "show": { "name": "Deep Thoughts" },
    "images": [
      { "url": "https://i.scdn.co/image/ep640.jpg", "height": 640, "width": 640 }
    ]
  }
}
```

`tests/fixtures/ad.json`:

```json
{
  "progress_ms": 5000,
  "is_playing": true,
  "currently_playing_type": "ad",
  "item": null
}
```

- [ ] **Step 2: Write the failing tests**

`tests/spotify.test.ts`:

```ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- spotify`
Expected: FAIL — cannot resolve `../src/spotify`.

Note: importing JSON needs `"resolveJsonModule": true` — add it to `tsconfig.json` `compilerOptions` now.

- [ ] **Step 4: Implement `src/spotify.ts`**

```ts
export type PlaybackKind = 'track' | 'episode' | 'ad';

export interface NowPlaying {
  kind: PlaybackKind;
  id: string;
  title: string;
  artist: string;
  artUrl: string | null;
  durationMs: number;
  progressMs: number;
  isPlaying: boolean;
  fetchedAt: number; // epoch ms when this snapshot was taken
}

const ENDPOINT =
  'https://api.spotify.com/v1/me/player/currently-playing?additional_types=episode';

interface Image { url: string; height: number; width: number }

function largest(images: Image[] | undefined): string | null {
  if (!images?.length) return null;
  return [...images].sort((a, b) => b.width - a.width)[0].url;
}

export function parseNowPlaying(json: unknown, fetchedAt: number): NowPlaying | null {
  if (!json || typeof json !== 'object') return null;
  const j = json as Record<string, any>;
  const type = j.currently_playing_type as string | undefined;

  if (type === 'ad') {
    return {
      kind: 'ad', id: 'ad', title: '', artist: '', artUrl: null,
      durationMs: 0, progressMs: j.progress_ms ?? 0,
      isPlaying: Boolean(j.is_playing), fetchedAt,
    };
  }
  const item = j.item;
  if (!item || (type !== 'track' && type !== 'episode')) return null;

  return {
    kind: type,
    id: item.id,
    title: item.name,
    artist:
      type === 'track'
        ? (item.artists as { name: string }[]).map((a) => a.name).join(', ')
        : item.show.name,
    artUrl: largest(type === 'track' ? item.album?.images : item.images),
    durationMs: item.duration_ms,
    progressMs: j.progress_ms ?? 0,
    isPlaying: Boolean(j.is_playing),
    fetchedAt,
  };
}

export type FetchResult =
  | { ok: true; np: NowPlaying | null }
  | { ok: false; retryAfterMs: number };

export async function fetchNowPlaying(
  getToken: () => Promise<string>,
  fetchFn: typeof fetch = fetch,
): Promise<FetchResult> {
  try {
    const token = await getToken();
    const res = await fetchFn(ENDPOINT, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 204) return { ok: true, np: null };
    if (res.status === 429) {
      const s = Number(res.headers.get('Retry-After') ?? '10');
      return { ok: false, retryAfterMs: s * 1000 };
    }
    if (!res.ok) return { ok: false, retryAfterMs: 10_000 };
    const json = await res.json();
    return { ok: true, np: parseNowPlaying(json, Date.now()) };
  } catch {
    return { ok: false, retryAfterMs: 10_000 };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- spotify`
Expected: 9 passed.

- [ ] **Step 6: Commit**

```bash
git add src/spotify.ts tests/spotify.test.ts tests/fixtures tsconfig.json
git commit -m "feat: currently-playing client with track/episode/ad parsing"
```

---

### Task 5: Player state — interpolation and polling loop

**Files:**
- Create: `src/player-state.ts`
- Test: `tests/player-state.test.ts`

**Interfaces:**
- Consumes: `NowPlaying`, `FetchResult` from Task 4; `POLL_INTERVAL_MS` from `config.ts`
- Produces (used by Task 9):
  - `type DisplayStatus = 'playing' | 'paused' | 'idle' | 'ad' | 'error'`
  - `interface DisplayState { status: DisplayStatus; np: NowPlaying | null; progressMs: number; stale: boolean }` (`stale` = last poll failed, showing last-known data)
  - `interpolateProgress(np: NowPlaying, now: number): number`
  - `deriveStatus(np: NowPlaying | null, lastPollFailed: boolean): DisplayStatus`
  - `class PlayerPoller { constructor(fetchNow: () => Promise<FetchResult>, onUpdate: (s: DisplayState) => void, onTrackChange: (prev: NowPlaying | null, next: NowPlaying) => void); start(): void; stop(): void }`
- Track change definition: `next.id !== prev?.id` (kind `ad` never fires onTrackChange)

- [ ] **Step 1: Write the failing tests**

`tests/player-state.test.ts`:

```ts
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
    const fetchNow = vi.fn(async () => results.shift() ?? results[0] ?? { ok: true as const, np: null });
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- player-state`
Expected: FAIL — cannot resolve `../src/player-state`.

- [ ] **Step 3: Implement `src/player-state.ts`**

```ts
import type { NowPlaying, FetchResult } from './spotify';
import { POLL_INTERVAL_MS } from './config';

export type DisplayStatus = 'playing' | 'paused' | 'idle' | 'ad' | 'error';

export interface DisplayState {
  status: DisplayStatus;
  np: NowPlaying | null;
  progressMs: number;
  stale: boolean;
}

export function interpolateProgress(np: NowPlaying, now: number): number {
  if (!np.isPlaying) return np.progressMs;
  return Math.min(np.durationMs, np.progressMs + (now - np.fetchedAt));
}

export function deriveStatus(
  np: NowPlaying | null,
  lastPollFailed: boolean,
): DisplayStatus {
  if (np) {
    if (np.kind === 'ad') return 'ad';
    return np.isPlaying ? 'playing' : 'paused';
  }
  return lastPollFailed ? 'error' : 'idle';
}

const TICK_MS = 250;

export class PlayerPoller {
  private np: NowPlaying | null = null;
  private lastPollFailed = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private endPolled = false; // one early poll per track-end
  private polling = false;

  constructor(
    private fetchNow: () => Promise<FetchResult>,
    private onUpdate: (s: DisplayState) => void,
    private onTrackChange: (prev: NowPlaying | null, next: NowPlaying) => void,
  ) {}

  start(): void {
    this.tickTimer = setInterval(() => this.tick(), TICK_MS);
    void this.poll();
  }

  stop(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.pollTimer = null;
    this.tickTimer = null;
  }

  private emit(): void {
    const now = Date.now();
    this.onUpdate({
      status: deriveStatus(this.np, this.lastPollFailed),
      np: this.np,
      progressMs: this.np ? interpolateProgress(this.np, now) : 0,
      stale: this.lastPollFailed && this.np !== null,
    });
  }

  private tick(): void {
    if (!this.np) return;
    this.emit();
    const done =
      this.np.isPlaying &&
      interpolateProgress(this.np, Date.now()) >= this.np.durationMs;
    if (done && !this.endPolled) {
      this.endPolled = true;
      this.schedule(0);
    }
  }

  private schedule(delayMs: number): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => void this.poll(), delayMs);
  }

  private async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    const result = await this.fetchNow();
    this.polling = false;

    if (result.ok) {
      this.lastPollFailed = false;
      const prev = this.np;
      const next = result.np;
      if (next && next.kind !== 'ad' && next.id !== prev?.id && prev !== null) {
        this.onTrackChange(prev, next);
      }
      this.np = next;
      this.endPolled = false;
      this.schedule(POLL_INTERVAL_MS);
    } else {
      this.lastPollFailed = true;
      this.schedule(result.retryAfterMs);
    }
    this.emit();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- player-state`
Expected: 9 passed. If the track-end test is flaky, the ticker interval (250ms) vs. the 2600ms advance is the knob — do not weaken the assertion, fix the timing math.

- [ ] **Step 5: Commit**

```bash
git add src/player-state.ts tests/player-state.test.ts
git commit -m "feat: polling loop with progress interpolation and track-end re-poll"
```

---

### Task 6: LCD canvas renderer

**Files:**
- Create: `src/scene/lcd.ts`
- Test: `tests/lcd.test.ts`

**Interfaces:**
- Consumes: `DisplayState` from Task 5; `LCD_W`, `LCD_H` from `config.ts`
- Produces (used by Task 9):
  - `formatTime(ms: number): string` — `M:SS`, hours collapse into minutes (`73:09` ok)
  - `marqueeOffset(textPx: number, windowPx: number, tick: number): number` — scroll offset in px for a given animation tick
  - `class Lcd { constructor(canvas: HTMLCanvasElement); render(state: DisplayState, tick: number): void }`
- Rendering contract: canvas stays at native 320×96; CSS upscales it 4× with `image-rendering: pixelated` (already in `scene.css`). VT323 drawn at 24px (its native-feeling size) for the title row, 16px for artist/time. All text `--text` on `--surface`-derived LCD background.

- [ ] **Step 1: Write the failing tests (pure parts)**

`tests/lcd.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lcd`
Expected: FAIL — cannot resolve `../src/scene/lcd`.

- [ ] **Step 3: Implement `src/scene/lcd.ts`**

```ts
import type { DisplayState } from '../player-state';
import { LCD_W, LCD_H } from '../config';

export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const PAUSE_TICKS = 20; // hold at each end (ticks are ~100ms -> 2s)
const STEP_PX = 2;

export function marqueeOffset(
  textPx: number,
  windowPx: number,
  tick: number,
): number {
  const max = textPx - windowPx;
  if (max <= 0) return 0;
  const travelTicks = Math.ceil(max / STEP_PX);
  const cycle = PAUSE_TICKS + travelTicks + PAUSE_TICKS;
  const t = tick % cycle;
  if (t < PAUSE_TICKS) return 0;
  return Math.min(max, (t - PAUSE_TICKS) * STEP_PX);
}

// ---- canvas rendering (verified visually, not unit-tested) ----

const BG = '#1d2914';      // dark LCD glass — darker sibling of --text
const INK = '#b8d68f';     // backlit green — lighter sibling of --bg
const DIM = '#4a5c36';     // unlit segments
const PAD = 8;
const TITLE_Y = 30;
const ARTIST_Y = 54;
const BAR_Y = 72;
const BAR_H = 8;
const CELL = 6;            // progress bar cell width (4px block + 2px gap)

export class Lcd {
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  render(state: DisplayState, tick: number): void {
    const c = this.ctx;
    c.fillStyle = BG;
    c.fillRect(0, 0, LCD_W, LCD_H);
    c.fillStyle = INK;
    c.textBaseline = 'alphabetic';

    switch (state.status) {
      case 'idle':
        c.font = '24px VT323';
        c.fillText('NO DISC', PAD, TITLE_Y);
        return;
      case 'error':
        if (!state.np) {
          c.font = '24px VT323';
          c.fillText('ERR', PAD, TITLE_Y);
          return;
        }
        break; // stale data: fall through and render it, plus ERR flag
      case 'ad':
        c.font = '24px VT323';
        c.fillText('AD BREAK', PAD, TITLE_Y);
        return;
    }

    const np = state.np!;
    const windowPx = LCD_W - PAD * 2;

    // title row (marquee)
    c.font = '24px VT323';
    const titlePx = Math.ceil(c.measureText(np.title).width);
    c.save();
    c.beginPath();
    c.rect(PAD, 0, windowPx, LCD_H);
    c.clip();
    c.fillText(np.title, PAD - marqueeOffset(titlePx, windowPx, tick), TITLE_Y);
    c.restore();

    // artist row
    c.font = '16px VT323';
    c.fillText(np.artist, PAD, ARTIST_Y);

    // time, right-aligned on artist row
    const time = `${formatTime(state.progressMs)}/${formatTime(np.durationMs)}`;
    c.fillText(time, LCD_W - PAD - c.measureText(time).width, ARTIST_Y);

    // PAUSE blink / stale ERR flag, top-right
    if (state.status === 'paused' && Math.floor(tick / 5) % 2 === 0) {
      c.font = '16px VT323';
      c.fillText('PAUSE', LCD_W - PAD - c.measureText('PAUSE').width, 16);
    }
    if (state.stale) {
      c.font = '16px VT323';
      c.fillText('ERR', LCD_W - PAD - c.measureText('ERR').width, 16);
    }

    // chunky progress bar
    const cells = Math.floor(windowPx / CELL);
    const filled = np.durationMs
      ? Math.round((state.progressMs / np.durationMs) * cells)
      : 0;
    for (let i = 0; i < cells; i++) {
      c.fillStyle = i < filled ? INK : DIM;
      c.fillRect(PAD + i * CELL, BAR_Y, CELL - 2, BAR_H);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lcd`
Expected: 9 passed.

- [ ] **Step 5: Visual check of the canvas**

Temporarily add to `src/main.ts` (delete before committing Task 9's wiring, or keep behind a comment):

```ts
import { Lcd } from './scene/lcd';
const lcd = new Lcd(document.getElementById('lcd') as HTMLCanvasElement);
document.fonts.load('24px VT323').then(() => {
  let tick = 0;
  setInterval(() => lcd.render({
    status: 'playing',
    np: {
      kind: 'track', id: 'x',
      title: 'An Extremely Long Track Title That Definitely Overflows The LCD',
      artist: 'Some Artist', artUrl: null,
      durationMs: 213_000, progressMs: 43_000,
      isPlaying: true, fetchedAt: Date.now(),
    },
    progressMs: 43_000, stale: false,
  }, tick++), 100);
});
```

Run: `npm run dev`, open `http://127.0.0.1:5173`, hide `#auth-gate` in devtools.
Expected: chunky green-on-dark LCD, title marqueeing with end-pauses, blocky progress bar, crisp fat pixels (no smoothing).

- [ ] **Step 6: Commit**

```bash
git add src/scene/lcd.ts tests/lcd.test.ts src/main.ts
git commit -m "feat: pixelated LCD canvas with marquee, time, progress bar"
```

---

### Task 7: Disc — spin physics and art layers

**Files:**
- Create: `src/scene/disc.ts`
- Modify: `src/styles/scene.css` (disc styles)
- Test: `tests/disc.test.ts`

**Interfaces:**
- Consumes: DOM ids `#disc`, `#art-a`, `#art-b`, `#disc-rim`, `#disc-hole` from Task 2's `index.html`
- Produces (used by Tasks 8/9):
  - `stepSpin(current: SpinState, targetRps: number, dtMs: number): SpinState` where `interface SpinState { angleDeg: number; rps: number }` (rps = revolutions per second)
  - `class Disc { constructor(root: HTMLElement); setArt(url: string | null): void` (crossfades A/B layers; null = bare silver disc)`; play(): void` (target 0.55 rps)`; pause(): void` (target 0)`; setVisible(v: boolean): void }`
- Spin feel: ~1.8s per revolution at full speed; spin-up/down eases exponentially (~0.5s time constant), giving the decel-to-stop pause behavior.

- [ ] **Step 1: Write the failing test**

`tests/disc.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- disc`
Expected: FAIL — cannot resolve `../src/scene/disc`.

- [ ] **Step 3: Implement `src/scene/disc.ts` and disc CSS**

`src/scene/disc.ts`:

```ts
export interface SpinState {
  angleDeg: number;
  rps: number;
}

const TIME_CONSTANT_MS = 500; // exponential ease for spin-up/down

export function stepSpin(
  current: SpinState,
  targetRps: number,
  dtMs: number,
): SpinState {
  const k = 1 - Math.exp(-dtMs / TIME_CONSTANT_MS);
  const rps = current.rps + (targetRps - current.rps) * k;
  // integrate with average speed over the step for smoothness
  const avg = (current.rps + rps) / 2;
  const angleDeg = (current.angleDeg + avg * 360 * (dtMs / 1000)) % 360;
  return { angleDeg, rps };
}

const FULL_RPS = 0.55; // ~1.8s per revolution

export class Disc {
  private state: SpinState = { angleDeg: 0, rps: 0 };
  private target = 0;
  private lastT = 0;
  private artA: HTMLImageElement;
  private artB: HTMLImageElement;
  private frontIsA = true;

  constructor(private root: HTMLElement) {
    this.artA = root.querySelector('#art-a')!;
    this.artB = root.querySelector('#art-b')!;
    requestAnimationFrame((t) => this.frame(t));
  }

  private frame(t: number): void {
    const dt = this.lastT ? Math.min(t - this.lastT, 100) : 16;
    this.lastT = t;
    this.state = stepSpin(this.state, this.target, dt);
    this.root.style.transform = `rotate(${this.state.angleDeg}deg)`;
    requestAnimationFrame((next) => this.frame(next));
  }

  play(): void { this.target = FULL_RPS; }
  pause(): void { this.target = 0; }

  setVisible(v: boolean): void {
    this.root.style.visibility = v ? 'visible' : 'hidden';
  }

  /** Crossfade to new art; null shows the bare silver disc (no art layer). */
  setArt(url: string | null): void {
    const front = this.frontIsA ? this.artA : this.artB;
    const back = this.frontIsA ? this.artB : this.artA;
    if (url) {
      back.src = url;
      back.style.opacity = '1';
      front.style.opacity = '0';
      this.frontIsA = !this.frontIsA;
    } else {
      this.artA.style.opacity = '0';
      this.artB.style.opacity = '0';
    }
  }
}
```

Append to `src/styles/scene.css`:

```css
/* Disc sits inside #tray; both dimensions equal -> circle */
#disc {
  position: absolute;
  left: 100px;
  top: 20px;
  width: 520px;
  height: 520px;
  border-radius: 50%; /* physical-object exception to the no-radius rule */
  overflow: hidden;
  background:
    conic-gradient(#cfd4c8, #f2f4ee, #b9beb2, #eef0ea, #cfd4c8); /* bare silver */
  will-change: transform;
}

#disc .art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 200ms linear;
}

/* pressed-CD look: clear plastic ring at edge + hub */
#disc-rim {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 10px solid rgba(255, 255, 255, 0.25);
  pointer-events: none;
}

#disc-hole {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 88px;
  height: 88px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: var(--bg); /* reads as the spindle hole against the tray */
  border: 14px solid rgba(255, 255, 255, 0.35); /* clear hub ring */
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- disc`
Expected: 5 passed.

- [ ] **Step 5: Visual check**

Temporary in `src/main.ts`:

```ts
import { Disc } from './scene/disc';
const disc = new Disc(document.getElementById('disc')!);
disc.setArt('https://i.scdn.co/image/ab67616d0000b273fc2101e6889d6ce9025f85f2');
disc.play();
setTimeout(() => disc.pause(), 6000); // watch the decel
```

Run: `npm run dev` — expect a circular disc with crisp album art rotating ~1.8s/rev, easing to a stop after 6s, hub hole and rim ring visible over the art.

- [ ] **Step 6: Commit**

```bash
git add src/scene/disc.ts tests/disc.test.ts src/styles/scene.css src/main.ts
git commit -m "feat: disc with eased spin physics and art crossfade"
```

---

### Task 8: Tray animation and track-change sequencer

**Files:**
- Create: `src/scene/tray.ts`
- Modify: `src/styles/scene.css` (tray transition)
- Test: `tests/tray.test.ts`

**Interfaces:**
- Consumes: `Disc` from Task 7 (as a structural type, injected)
- Produces (used by Task 9):
  - `class Tray { constructor(el: HTMLElement); open(): Promise<void>; close(): Promise<void> }`
  - `changeDisc(tray: TrayLike, disc: DiscLike, artUrl: string | null): Promise<void>` — the full sequence: pause spin → tray out → swap art → tray in → play
  - `interface TrayLike { open(): Promise<void>; close(): Promise<void> }`
  - `interface DiscLike { setArt(url: string | null): void; play(): void; pause(): void }`
- Tray motion: `#tray` slides down-forward via `transform: translateY(340px)` over 600ms `cubic-bezier(0.2, 0.8, 0.3, 1)`. (Slides *down* from behind the player chassis since the photo is front-facing; retune direction when the real cutout lands.)

- [ ] **Step 1: Write the failing test (sequencer order)**

`tests/tray.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tray`
Expected: FAIL — cannot resolve `../src/scene/tray`.

- [ ] **Step 3: Implement `src/scene/tray.ts` and tray CSS**

`src/scene/tray.ts`:

```ts
export interface TrayLike {
  open(): Promise<void>;
  close(): Promise<void>;
}

export interface DiscLike {
  setArt(url: string | null): void;
  play(): void;
  pause(): void;
}

const TRAY_MS = 600;
const SWAP_SETTLE_MS = 250; // let the art crossfade finish while tray is out

function afterTransition(el: HTMLElement, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener('transitionend', finish);
      resolve();
    };
    el.addEventListener('transitionend', finish);
    setTimeout(finish, timeoutMs + 100); // fallback if transitionend is missed
  });
}

export class Tray implements TrayLike {
  constructor(private el: HTMLElement) {}

  open(): Promise<void> {
    this.el.classList.add('tray-open');
    return afterTransition(this.el, TRAY_MS);
  }

  close(): Promise<void> {
    this.el.classList.remove('tray-open');
    return afterTransition(this.el, TRAY_MS);
  }
}

export async function changeDisc(
  tray: TrayLike,
  disc: DiscLike,
  artUrl: string | null,
): Promise<void> {
  disc.pause();
  await tray.open();
  disc.setArt(artUrl);
  await new Promise((r) => setTimeout(r, SWAP_SETTLE_MS));
  await tray.close();
  disc.play();
}
```

Append to `src/styles/scene.css`:

```css
#tray {
  transition: transform 600ms cubic-bezier(0.2, 0.8, 0.3, 1);
}
#tray.tray-open {
  transform: translateY(340px);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tray`
Expected: 2 passed.

- [ ] **Step 5: Visual check**

Temporary in `src/main.ts`:

```ts
import { Tray, changeDisc } from './scene/tray';
const tray = new Tray(document.getElementById('tray')!);
setInterval(() => void changeDisc(tray, disc,
  'https://i.scdn.co/image/ab67616d0000b2734e0362c225863f6ae2432651'), 8000);
```

Run: `npm run dev` — expect: spin eases down, tray slides out, art crossfades while out, tray slides back, spin eases up. Sequence must never overlap itself on repeated triggers (8s interval > full sequence).

- [ ] **Step 6: Commit**

```bash
git add src/scene/tray.ts tests/tray.test.ts src/styles/scene.css src/main.ts
git commit -m "feat: tray slide animation and track-change sequencer"
```

---

### Task 9: Wire it together — auth gate, poller, scene

**Files:**
- Modify: `src/main.ts` (replace entirely, removing all temporary visual-check code from Tasks 6–8)

**Interfaces:**
- Consumes: everything produced by Tasks 2–8 (exact imports shown below)
- Produces: the working app. No new exports.

- [ ] **Step 1: Replace `src/main.ts`**

```ts
import '@fontsource/vt323';
import './styles/theme.css';
import './styles/scene.css';
import { fitStage } from './scene/stage';
import {
  beginLogin, handleCallbackIfPresent, loadTokens, getAccessToken,
} from './auth';
import { fetchNowPlaying, type NowPlaying } from './spotify';
import { PlayerPoller, type DisplayState } from './player-state';
import { Lcd } from './scene/lcd';
import { Disc } from './scene/disc';
import { Tray, changeDisc } from './scene/tray';

const stage = document.getElementById('stage')!;
fitStage(stage);

const lcd = new Lcd(document.getElementById('lcd') as HTMLCanvasElement);
const disc = new Disc(document.getElementById('disc')!);
const tray = new Tray(document.getElementById('tray')!);
const gate = document.getElementById('auth-gate')!;
const authButton = document.getElementById('auth-button')!;

let latest: DisplayState = { status: 'idle', np: null, progressMs: 0, stale: false };
let shownArtId: string | null = null;
let sequencing = false;
let sequence = Promise.resolve();

function applyState(s: DisplayState): void {
  latest = s;
  if (sequencing) return; // the tray sequence owns the disc right now

  switch (s.status) {
    case 'idle':
    case 'error':
      if (!s.np) {
        disc.setVisible(false);
        shownArtId = null; // next track gets a direct art swap, no tray
      }
      break;
    case 'ad':
      disc.setVisible(true);
      if (shownArtId !== 'ad') {
        disc.setArt(null); // bare silver disc for ads
        shownArtId = 'ad';
      }
      disc.play();
      break;
    case 'paused':
      disc.setVisible(true);
      showArtDirect(s.np!);
      disc.pause();
      break;
    case 'playing':
      disc.setVisible(true);
      showArtDirect(s.np!);
      disc.play();
      break;
  }
}

/** First load / recovery from idle: art appears without the tray ceremony. */
function showArtDirect(np: NowPlaying): void {
  if (shownArtId === null) {
    disc.setArt(np.artUrl);
    shownArtId = np.id;
  }
}

function onTrackChange(_prev: NowPlaying | null, next: NowPlaying): void {
  // serialize sequences; rapid skips play out in order, never overlapping
  sequence = sequence.then(async () => {
    sequencing = true;
    shownArtId = next.id;
    await changeDisc(tray, disc, next.artUrl);
    sequencing = false;
    applyState(latest); // reconcile with whatever happened meanwhile
  });
}

// hide cursor after 3s idle (it's a wall display)
let cursorTimer: ReturnType<typeof setTimeout> | undefined;
document.addEventListener('mousemove', () => {
  document.body.style.cursor = '';
  clearTimeout(cursorTimer);
  cursorTimer = setTimeout(() => {
    document.body.style.cursor = 'none';
  }, 3000);
});

async function boot(): Promise<void> {
  await handleCallbackIfPresent();

  if (!loadTokens()) {
    authButton.addEventListener('click', () => void beginLogin());
    return; // auth gate stays visible
  }
  gate.hidden = true;

  await Promise.all([
    document.fonts.load('24px VT323'),
    document.fonts.load('16px VT323'),
  ]);

  const poller = new PlayerPoller(
    () => fetchNowPlaying(getAccessToken),
    applyState,
    onTrackChange,
  );
  poller.start();

  let tick = 0;
  setInterval(() => lcd.render(latest, tick++), 100);
}

void boot();
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all suites pass (smoke, stage, auth, spotify, player-state, lcd, disc, tray).

- [ ] **Step 3: End-to-end verification (requires Client ID in `.env.local`)**

Run: `npm run dev`, open `http://127.0.0.1:5173` (must be 127.0.0.1). Verify in order:

1. CONNECT SPOTIFY gate shows → click → Spotify consent → redirected back, gate gone
2. Play a track on any device → within 5s: LCD shows title/artist/time, disc appears with crisp album art, spinning ~1.8s/rev, progress bar advances smoothly (interpolated, no 5s jumps)
3. Skip to the next track → spin-down, tray out, art crossfade, tray in, spin-up
4. Pause in Spotify → disc eases to a stop, blinking `PAUSE` on LCD
5. Long-titled track → marquee scrolls with end pauses
6. Stop playback / close Spotify → within ~30s of Spotify dropping the session: `NO DISC`, disc hidden
7. Kill network (toggle Wi-Fi) → `ERR` flag appears, last state stays; restore → recovers within ~10s
8. Reload the page → no re-auth needed (tokens persisted); wait ~1h+ → still polling (refresh works)
9. Leave mouse still 3s → cursor vanishes

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire auth gate, poller, and scene into working display"
```

---

### Task 10: Placeholder assets, asset spec, README

**Files:**
- Create: `public/assets/player-placeholder.svg`, `public/assets/holder-placeholder.svg`, `docs/assets-spec.md`, `README.md`
- Modify: `index.html` (point `#player`/`#holder` at placeholders), `src/styles/scene.css` (placeholder tray styling)

**Interfaces:**
- Produces: a scene that reads as a composed layout before real photos exist; the shopping list the human uses to source real cutouts.

- [ ] **Step 1: Create placeholder SVGs**

`public/assets/player-placeholder.svg` (mostly transparent — it sits *above* the tray/disc layer, so only a frame):

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="900" viewBox="0 0 1280 900">
  <rect x="1" y="1" width="1278" height="898" fill="none" stroke="#2d3a1f" stroke-width="2"/>
  <rect x="1" y="1" width="1278" height="240" fill="#e8efd9" stroke="#2d3a1f" stroke-width="2"/>
  <text x="32" y="72" font-family="monospace" font-size="28" fill="#5a6b46">[ CD PLAYER CHASSIS &#8212; real cutout pending ]</text>
  <text x="32" y="110" font-family="monospace" font-size="18" fill="#5a6b46">tray + disc visible through this window</text>
</svg>
```

`public/assets/holder-placeholder.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="720" viewBox="0 0 480 720">
  <rect x="1" y="1" width="478" height="718" fill="#e8efd9" stroke="#2d3a1f" stroke-width="2"/>
  <g font-family="monospace" font-size="20" fill="#5a6b46">
    <text x="24" y="48">[ CD HOLDER ]</text>
    <text x="24" y="80">real cutout</text>
    <text x="24" y="104">pending</text>
  </g>
  <g stroke="#5a6b46" stroke-width="1">
    <line x1="24" y1="160" x2="456" y2="160"/>
    <line x1="24" y1="240" x2="456" y2="240"/>
    <line x1="24" y1="320" x2="456" y2="320"/>
    <line x1="24" y1="400" x2="456" y2="400"/>
    <line x1="24" y1="480" x2="456" y2="480"/>
  </g>
</svg>
```

- [ ] **Step 2: Point the scene at the placeholders**

In `index.html`, set the image sources:

```html
<img id="holder" src="/assets/holder-placeholder.svg" alt="" draggable="false" />
...
<img id="player" src="/assets/player-placeholder.svg" alt="" draggable="false" />
```

Append to `src/styles/scene.css`:

```css
/* placeholder tray look — delete when tray.png lands as background-image */
#tray {
  background: var(--surface);
  border: 1px solid var(--muted);
}
```

- [ ] **Step 3: Write `docs/assets-spec.md`**

```markdown
# Asset Shopping List

All assets: transparent-background PNG, front-facing (or the same near-front
angle across ALL objects — perspective mismatch reads as clipart soup).
Any background-removal tool is fine. Drop files into `public/assets/`.

## 1. player.png — CD player chassis (required)
- Front-facing hi-fi / boombox-style CD player, tray-loading (not slot-loading)
- Min 1600px wide (displayed at 1280px on a 2560-wide stage)
- The disc window / tray area should be cuttable: we need the chassis WITHOUT
  the tray — erase the tray area to transparent so the animated tray layer
  shows through from behind
- Glossy plastic encouraged (that is the frutiger aero carrier)

## 2. tray.png — the tray itself (required)
- Ideally cut from the SAME source photo as player.png
- The disc indent should be visibly circular; our disc renders on top of it
- Min 1100px wide (displayed at 900px)

## 3. holder.png — CD holder / rack (required)
- Spindle, rack, or tower holding CDs; same perspective family as the player
- Min 600px wide (displayed at 480px)

## 4. disc.png — bare silver CD (optional)
- Top-down, straight-on. Replaces the CSS conic-gradient fallback for the
  ad-break/bare state. Min 700px square.

## Integration steps (code side, after files land)
1. `index.html`: swap `#player`/`#holder` src to the new PNGs
2. `scene.css`: set `#tray { background: url('/assets/tray.png') no-repeat; background-size: contain; border: none; }`
3. Retune positions/sizes of `#player`, `#tray`, `#disc`, `#holder`, `#lcd`
   in `scene.css` to match the photos' geometry (LCD must sit over the
   chassis' display area; disc centered in the tray indent)
4. Retune the tray travel (`#tray.tray-open` transform) to match the photo's
   tray direction
```

- [ ] **Step 4: Write `README.md`**

```markdown
# cd-player

Spotify now-playing display styled as a photo-real CD player.
Fullscreen it on a second monitor.

## Setup (once)
1. https://developer.spotify.com/dashboard -> create app (development mode
   is fine; the account needs Premium). Add redirect URI exactly:
   `http://127.0.0.1:5173/callback`
2. Copy `.env.local` -> set `VITE_SPOTIFY_CLIENT_ID=<your client id>`
3. `npm install`

## Run
    npm run dev

Open http://127.0.0.1:5173  (must be 127.0.0.1, NOT localhost -- different
localStorage origin and Spotify rejects non-loopback http redirect URIs).
Click CONNECT SPOTIFY once; tokens persist and self-refresh after that.
F11 for fullscreen on the target monitor.

## Test
    npm test

## Assets
Placeholder frames render until real photo cutouts land -- see
`docs/assets-spec.md` for the shopping list.
```

- [ ] **Step 5: Verify visually and run suite**

Run: `npm run dev` — the scene should read as a composed layout: framed chassis window with the disc spinning inside the placeholder tray, holder rack to the right, LCD below.

Run: `npm test`
Expected: all pass (no logic changed; regression check).

- [ ] **Step 6: Commit**

```bash
git add public/assets docs/assets-spec.md README.md index.html src/styles/scene.css
git commit -m "feat: placeholder assets, asset spec, and README"
```




