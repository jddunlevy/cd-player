import type { DisplayState } from '../player-state';

export interface PanelText {
  artist: string;
  track: string;
}

/** Text for the ARTIST / TRACK field boxes. */
export function panelText(s: DisplayState): PanelText {
  switch (s.status) {
    case 'idle':
      return { artist: '—', track: 'NO DISC' };
    case 'error': // deriveStatus only yields 'error' when np is null
      return { artist: '—', track: 'ERR' };
    case 'ad':
      return { artist: '—', track: 'AD BREAK' };
    case 'paused':
    case 'playing':
      return { artist: s.np!.artist, track: s.np!.title };
  }
}

/** Title-bar status flag: 'PAUSE', 'ERR', both, or ''. */
export function statusFlag(s: DisplayState): string {
  const flags: string[] = [];
  if (s.status === 'paused') flags.push('PAUSE');
  if (s.stale) flags.push('ERR');
  return flags.join(' ');
}

/** Milliseconds as "m:ss", or "h:mm:ss" for hour-plus durations. */
export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/** "elapsed / total" readout; empty when there's nothing to time. */
export function timeText(s: DisplayState): string {
  if (s.status !== 'playing' && s.status !== 'paused') return '';
  return `${formatTime(s.progressMs)} / ${formatTime(s.np!.durationMs)}`;
}

/** Seek-slider position in [0, 1]. */
export function progressFraction(s: DisplayState): number {
  const duration = s.np?.durationMs ?? 0;
  if (duration <= 0) return 0;
  return Math.min(1, Math.max(0, s.progressMs / duration));
}
