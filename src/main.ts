import '@fontsource/vt323/index.css';
import './styles/theme.css';
import './styles/scene.css';
import { fitStage } from './scene/stage';
import {
  beginLogin, handleCallbackIfPresent, loadTokens, getAccessToken,
} from './auth';
import { fetchNowPlaying, type NowPlaying } from './spotify';
import { PlayerPoller, type DisplayState } from './player-state';
import { ArtLayers } from './scene/art';
import { JellyfishField } from './scene/jellyfish';
import {
  extractAlbumColors, paletteFromAlbum, inkForBackground, toCss, type Palette,
} from './scene/colors';
import { panelText, statusFlag, progressFraction } from './scene/panel';

const stage = document.getElementById('stage')!;
fitStage(stage);

const art = new ArtLayers(document.getElementById('art-well')!);
const jellies = new JellyfishField(
  document.getElementById('jellyfish') as HTMLCanvasElement,
);
const bgA = document.getElementById('bg-a')!;
const bgB = document.getElementById('bg-b')!;
const artistText = document.getElementById('artist-text')!;
const trackText = document.getElementById('track-text')!;
const statusEl = document.getElementById('status')!;
const slider = document.getElementById('slider')!;
const playBtn = document.getElementById('btn-play')!;
const gate = document.getElementById('auth-gate')!;
const authButton = document.getElementById('auth-button')!;

let shownArtId: string | null = null;
let bgFrontIsA = false;

/** Crossfade the stage background to a new two-stop vertical ombre. */
function setBackground(top: string, bottom: string): void {
  const front = bgFrontIsA ? bgA : bgB;
  const back = bgFrontIsA ? bgB : bgA;
  back.style.background = `linear-gradient(180deg, ${top}, ${bottom})`;
  back.style.opacity = '1';
  front.style.opacity = '0';
  bgFrontIsA = !bgFrontIsA;
}

/** Retint the 5 theme tokens; every element styled with them follows. */
function applyPalette(p: Palette): void {
  const root = document.documentElement.style;
  root.setProperty('--bg', p.bg);
  root.setProperty('--surface', p.surface);
  root.setProperty('--text', p.text);
  root.setProperty('--muted', p.muted);
  root.setProperty('--accent', p.accent);
}

function showArt(np: NowPlaying): void {
  if (shownArtId === np.id) return;
  shownArtId = np.id;
  art.setArt(np.artUrl);
  if (!np.artUrl) return;
  const forId = np.id;
  void extractAlbumColors(np.artUrl).then((pair) => {
    // ignore results that arrive after another track took over
    if (!pair || shownArtId !== forId) return;
    setBackground(toCss(pair[0]), toCss(pair[1]));
    applyPalette(paletteFromAlbum(pair));
    jellies.setInk(inkForBackground(pair));
  });
}

function applyState(s: DisplayState): void {
  const text = panelText(s);
  artistText.textContent = text.artist;
  trackText.textContent = text.track;
  statusEl.textContent = statusFlag(s);
  slider.style.setProperty('--frac', progressFraction(s).toFixed(4));
  playBtn.classList.toggle('lit', s.status === 'playing');

  switch (s.status) {
    case 'idle':
    case 'error':
      if (shownArtId !== null) art.setArt(null); // fade art; bg keeps last colors
      shownArtId = null;
      break;
    case 'ad':
      if (shownArtId !== 'ad') {
        art.setArt(null); // bare glass well for ads
        shownArtId = 'ad';
      }
      break;
    case 'paused':
    case 'playing':
      showArt(s.np!);
      break;
  }
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

  const poller = new PlayerPoller(
    () => fetchNowPlaying(getAccessToken),
    applyState,
    () => {}, // art swaps are handled directly in applyState
  );
  poller.start();
}

void boot();
