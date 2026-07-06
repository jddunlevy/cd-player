import '@fontsource/vt323/index.css';
import './styles/theme.css';
import './styles/scene.css';
import { fitStage } from './scene/stage';
import {
  beginLogin, handleCallbackIfPresent, loadTokens, getAccessToken,
} from './auth';
import { fetchNowPlaying, type NowPlaying } from './spotify';
import { PlayerPoller, type DisplayState } from './player-state';
import { Disc } from './scene/disc';
import { panelText, statusFlag, progressFraction } from './scene/panel';

const stage = document.getElementById('stage')!;
fitStage(stage);

const disc = new Disc(document.getElementById('disc')!);
const artistText = document.getElementById('artist-text')!;
const trackText = document.getElementById('track-text')!;
const statusEl = document.getElementById('status')!;
const slider = document.getElementById('slider')!;
const playBtn = document.getElementById('btn-play')!;
const gate = document.getElementById('auth-gate')!;
const authButton = document.getElementById('auth-button')!;

let shownArtId: string | null = null;

function showArt(np: NowPlaying): void {
  if (shownArtId !== np.id) {
    disc.setArt(np.artUrl);
    shownArtId = np.id;
  }
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
      disc.setVisible(false);
      shownArtId = null;
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
      showArt(s.np!);
      disc.pause();
      break;
    case 'playing':
      disc.setVisible(true);
      showArt(s.np!);
      disc.play();
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
