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

/** Seek-slider position in [0, 1]. */
export function progressFraction(s: DisplayState): number {
  const duration = s.np?.durationMs ?? 0;
  if (duration <= 0) return 0;
  return Math.min(1, Math.max(0, s.progressMs / duration));
}
