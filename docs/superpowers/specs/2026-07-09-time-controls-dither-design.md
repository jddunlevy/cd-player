# Time Readout, Playback Controls, Album Art Dithering

Approved design, 2026-07-09. Three additions to the CD player wall display.

## 1. Time readout

- `panel.ts` gains pure functions:
  - `formatTime(ms)` → `"2:41"`, `"1:02:15"` for hour-plus, `"0:00"` floor.
  - `timeText(state)` → `"<elapsed> / <total>"` for playing/paused; `""` for
    idle/error/ad (element hidden via empty content).
- `<div id="time-readout">` sits directly under the slider. `applyState` in
  main.ts writes it each 250ms tick; no new timers.
- Style: VT323, muted color, part of the palette-transition group.

## 2. Playback controls

- Scope becomes `user-read-currently-playing user-modify-playback-state`
  (config.ts). Existing tokens lack the scope; on a 403 whose body mentions
  scope, main.ts clears stored tokens and reloads so the auth gate reappears
  (one-time re-login). Spotify Premium is required by the API for these
  endpoints; non-Premium failures simply snap back on the next poll.
- New `src/controls.ts`:
  - Command table: `play` PUT `/me/player/play`, `pause` PUT
    `/me/player/pause`, `next` POST `/me/player/next`, `previous` POST
    `/me/player/previous`, `seek` PUT `/me/player/seek?position_ms=N`.
  - `sendCommand(getToken, action, fetchFn?)` → `'ok' | 'scope' | 'error'`.
- `PlayerPoller.pollSoon(delayMs = 300)`: public wrapper over the existing
  scheduler, used after every command so the UI re-syncs quickly.
- main.ts wiring:
  - ▶ toggles play/pause and flips its lit state optimistically.
  - New ◀◀ / ▶▶ buttons at the start of the transport row.
  - Clicking the slider seeks: click fraction × duration; `--frac` set
    optimistically.
  - All controls no-op when no track is loaded (idle/error).

## 3. Album art dithering

- New `src/scene/dither.ts`:
  - Pure: `glyphFor(lum, lightInk)` maps 0–255 luminance onto the ramp
    ` ·░▒▓█`. Dark ink (light mode): darker pixel → denser glyph. Light ink
    (dark mode / dark ombre): brighter pixel → denser glyph.
  - Pure: `renderDither(lums, cols)` → array of glyph-string rows.
  - `DitherArt` class (visual, untested like FishField): owns the
    `#art-dither` canvas (704×704) over the art imgs. On track change,
    downscales the cover to an 88×44 grid via offscreen canvas (one pixel per
    cell), stores luminances, draws glyphs once in VT323 at 8×16px cells.
    Re-draws on ink change only. Exposes readiness so the UI can fall back.
- `▒` transport button toggles photo ↔ dithered; lit when dithered;
  persisted as `cdp.dither`. Toggling applies `.dithered` to `#art-well`,
  fading imgs out / canvas in (200ms).
- Fallbacks: unreadable pixels (CORS taint, load failure) → photo stays even
  when toggled on; ad/idle clears the dither canvas alongside the art.

## Testing

- `tests/panel.test.ts`: formatTime cases, timeText per status.
- `tests/controls.test.ts`: command table; sendCommand ok / 403-scope /
  network error via mocked fetch.
- `tests/dither.test.ts`: ramp coverage, polarity, renderDither dimensions.
- `tests/player-state.test.ts`: pollSoon triggers a fetch.
- TDD for all pure logic; canvas drawing and DOM wiring verified visually.
