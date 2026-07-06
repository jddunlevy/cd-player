import '@fontsource/vt323/index.css';
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
