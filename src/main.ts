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
import { FishField } from './scene/fish';
import {
  extractAlbumColors, paletteFromAlbum, inkForBackground, inkForDark,
  luminance, toCss, type Palette, type RGB,
} from './scene/colors';
import { panelText, statusFlag, progressFraction } from './scene/panel';

const stage = document.getElementById('stage')!;
fitStage(stage);

const art = new ArtLayers(document.getElementById('art-well')!);
const jellies = new JellyfishField(
  document.getElementById('field-jelly') as HTMLCanvasElement,
);
const fish = new FishField(
  document.getElementById('field-fish') as HTMLCanvasElement,
);
const bgA = document.getElementById('bg-a')!;
const bgB = document.getElementById('bg-b')!;
const artistText = document.getElementById('artist-text')!;
const trackText = document.getElementById('track-text')!;
const statusEl = document.getElementById('status')!;
const slider = document.getElementById('slider')!;
const playBtn = document.getElementById('btn-play')!;
const moonBtn = document.getElementById('btn-moon')!;
const fishBtn = document.getElementById('btn-fish')!;
const gate = document.getElementById('auth-gate')!;
const authButton = document.getElementById('auth-button')!;

const LS_DARK = 'cdp.dark';
const LS_SCENE = 'cdp.scene';

type Scene = 'jelly' | 'fish' | 'both';
const storedScene = localStorage.getItem(LS_SCENE);
let scene: Scene =
  storedScene === 'fish' || storedScene === 'both' ? storedScene : 'jelly';

let shownArtId: string | null = null;
let bgFrontIsA = false;
let lastPair: [RGB, RGB] | null = null;
let dark = localStorage.getItem(LS_DARK) === '1';

/** Both fields keep the same ink so toggling scenes never desyncs color. */
function setInk(color: string): void {
  jellies.setInk(color);
  fish.setInk(color);
}

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

/** Background + jellyfish ink for the current mode and album colors. */
function applyTheme(): void {
  if (dark) {
    setBackground('rgb(0 0 0)', 'rgb(0 0 0)');
    setInk(lastPair ? inkForDark(lastPair) : 'rgb(255 255 255)');
  } else if (lastPair) {
    const ombre = [...lastPair].sort((a, b) => luminance(b) - luminance(a));
    setBackground(toCss(ombre[0]), toCss(ombre[1])); // lighter on top
    setInk(inkForBackground(lastPair));
  } else {
    setBackground('var(--bg)', 'var(--bg)');
    setInk('rgb(0 0 0)'); // default theme bg is pale
  }
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
    lastPair = pair;
    applyPalette(paletteFromAlbum(pair));
    applyTheme();
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

moonBtn.classList.toggle('lit', dark);
moonBtn.addEventListener('click', () => {
  dark = !dark;
  localStorage.setItem(LS_DARK, dark ? '1' : '0');
  moonBtn.classList.toggle('lit', dark);
  applyTheme();
});
if (dark) applyTheme();

/** Each scene runs on its own canvas layer; 'both' runs the two together. */
function applyScene(): void {
  if (scene === 'fish') jellies.stop(); else jellies.start();
  if (scene === 'jelly') fish.stop(); else fish.start();
  fishBtn.classList.toggle('lit', scene !== 'jelly');
  fishBtn.textContent = scene === 'both' ? '\u224B' : '\u2248'; // ≋ / ≈
  fishBtn.title = `scene: ${scene}`;
}

fishBtn.addEventListener('click', () => {
  scene = scene === 'jelly' ? 'fish' : scene === 'fish' ? 'both' : 'jelly';
  localStorage.setItem(LS_SCENE, scene);
  applyScene();
});
applyScene();

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
  );
  poller.start();
}

void boot();
