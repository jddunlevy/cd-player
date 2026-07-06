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
