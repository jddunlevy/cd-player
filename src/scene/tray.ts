export interface TrayLike {
  open(): Promise<void>;
  close(): Promise<void>;
}

export interface DiscLike {
  setArt(url: string | null): void;
  play(): void;
  pause(): void;
}

const TRAY_MS = 600;
const SWAP_SETTLE_MS = 250; // let the art crossfade finish while tray is out

function afterTransition(el: HTMLElement, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener('transitionend', finish);
      resolve();
    };
    el.addEventListener('transitionend', finish);
    setTimeout(finish, timeoutMs + 100); // fallback if transitionend is missed
  });
}

export class Tray implements TrayLike {
  constructor(private el: HTMLElement) {}

  open(): Promise<void> {
    this.el.classList.add('tray-open');
    return afterTransition(this.el, TRAY_MS);
  }

  close(): Promise<void> {
    this.el.classList.remove('tray-open');
    return afterTransition(this.el, TRAY_MS);
  }
}

export async function changeDisc(
  tray: TrayLike,
  disc: DiscLike,
  artUrl: string | null,
): Promise<void> {
  disc.pause();
  await tray.open();
  disc.setArt(artUrl);
  await new Promise((r) => setTimeout(r, SWAP_SETTLE_MS));
  await tray.close();
  disc.play();
}
