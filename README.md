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
