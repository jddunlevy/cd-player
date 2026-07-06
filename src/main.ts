import '@fontsource/vt323';
import './styles/theme.css';
import './styles/scene.css';
import { fitStage } from './scene/stage';
import { Lcd } from './scene/lcd';

const stage = document.getElementById('stage')!;
fitStage(stage);

// TEMPORARY: Visual test for LCD canvas
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
