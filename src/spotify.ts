export type PlaybackKind = 'track' | 'episode' | 'ad';

export interface NowPlaying {
  kind: PlaybackKind;
  id: string;
  title: string;
  artist: string;
  artUrl: string | null;
  durationMs: number;
  progressMs: number;
  isPlaying: boolean;
  fetchedAt: number; // epoch ms when this snapshot was taken
}

const ENDPOINT =
  'https://api.spotify.com/v1/me/player/currently-playing?additional_types=episode';

interface Image { url: string; height: number; width: number }

function largest(images: Image[] | undefined): string | null {
  if (!images?.length) return null;
  return [...images].sort((a, b) => b.width - a.width)[0].url;
}

export function parseNowPlaying(json: unknown, fetchedAt: number): NowPlaying | null {
  if (!json || typeof json !== 'object') return null;
  const j = json as Record<string, any>;
  const type = j.currently_playing_type as string | undefined;

  if (type === 'ad') {
    return {
      kind: 'ad', id: 'ad', title: '', artist: '', artUrl: null,
      durationMs: 0, progressMs: j.progress_ms ?? 0,
      isPlaying: Boolean(j.is_playing), fetchedAt,
    };
  }
  const item = j.item;
  if (!item || (type !== 'track' && type !== 'episode')) return null;

  return {
    kind: type,
    id: item.id,
    title: item.name,
    artist:
      type === 'track'
        ? (item.artists as { name: string }[]).map((a) => a.name).join(', ')
        : item.show.name,
    artUrl: largest(type === 'track' ? item.album?.images : item.images),
    durationMs: item.duration_ms,
    progressMs: j.progress_ms ?? 0,
    isPlaying: Boolean(j.is_playing),
    fetchedAt,
  };
}

export type FetchResult =
  | { ok: true; np: NowPlaying | null }
  | { ok: false; retryAfterMs: number };

export async function fetchNowPlaying(
  getToken: () => Promise<string>,
  fetchFn: typeof fetch = fetch,
): Promise<FetchResult> {
  try {
    const token = await getToken();
    const res = await fetchFn(ENDPOINT, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 204) return { ok: true, np: null };
    if (res.status === 429) {
      const s = Number(res.headers.get('Retry-After') ?? '10');
      return { ok: false, retryAfterMs: s * 1000 };
    }
    if (!res.ok) return { ok: false, retryAfterMs: 10_000 };
    const json = await res.json();
    return { ok: true, np: parseNowPlaying(json, Date.now()) };
  } catch {
    return { ok: false, retryAfterMs: 10_000 };
  }
}
