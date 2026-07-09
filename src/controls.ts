export type Action =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'seek'; positionMs: number };

export type CommandResult = 'ok' | 'scope' | 'error';

const BASE = 'https://api.spotify.com/v1/me/player';

export function commandFor(a: Action): { method: 'PUT' | 'POST'; url: string } {
  switch (a.type) {
    case 'play': return { method: 'PUT', url: `${BASE}/play` };
    case 'pause': return { method: 'PUT', url: `${BASE}/pause` };
    case 'next': return { method: 'POST', url: `${BASE}/next` };
    case 'previous': return { method: 'POST', url: `${BASE}/previous` };
    case 'seek':
      return {
        method: 'PUT',
        url: `${BASE}/seek?position_ms=${Math.round(a.positionMs)}`,
      };
  }
}

/**
 * Fire a playback command. 'scope' singles out the insufficient-scope 403
 * (stale pre-controls token) so the caller can force a re-login; every other
 * failure is 'error' — the next poll snaps the UI back to the truth.
 */
export async function sendCommand(
  getToken: () => Promise<string>,
  action: Action,
  fetchFn: typeof fetch = fetch,
): Promise<CommandResult> {
  try {
    const token = await getToken();
    const { method, url } = commandFor(action);
    const res = await fetchFn(url, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return 'ok';
    if (res.status === 403 && /scope/i.test(await res.text())) return 'scope';
    return 'error';
  } catch {
    return 'error';
  }
}
