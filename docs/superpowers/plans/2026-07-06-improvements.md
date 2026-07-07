# Improvement Areas (from 2026-07-06 code audit)

Noted during the dead-code audit; none implemented yet.

## 1. No re-auth path on refresh failure
If Spotify revokes the refresh token, `getAccessToken` (src/auth.ts) throws
forever and the UI shows ERR every 10s. Catch a 400/401 from the token
endpoint, clear stored tokens, and re-show the auth gate so recovery doesn't
require manually clearing localStorage.

## 2. `loadTokens` trusts localStorage
`JSON.parse` on raw storage (src/auth.ts). Corrupt data throws during
`boot()` and blanks the app. Wrap in try/catch returning null so it degrades
to the auth gate.

## 3. Poller can wedge on a throwing fetch
`poll()` (src/player-state.ts) sets `polling = true` before
`await this.fetchNow()` with no try/finally. Safe today only because
`fetchNowPlaying` catches everything; a future callsite that throws would
silently stop all polling. Add try/finally around the await.

## 4. No idle/hidden teardown for animation
`JellyfishField`'s rAF loop and the 250ms poller tick run even when the tab
is hidden. Fine for a dedicated wall display; a `document.visibilitychange`
pause would cut idle CPU.

## 5. README setup references an uncommitted file
Step 2 says "Copy `.env.local`" but `.env.local` is gitignored, so a fresh
clone has nothing to copy. Commit a `.env.example` and update the README.
