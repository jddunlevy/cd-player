/** Crossfading pair of art layers filling the art well. */
export class ArtLayers {
  private a: HTMLImageElement;
  private b: HTMLImageElement;
  private frontIsA = true;

  constructor(root: HTMLElement) {
    this.a = root.querySelector('#art-a')!;
    this.b = root.querySelector('#art-b')!;
  }

  /** Crossfade to new art; null fades out to the bare well. */
  setArt(url: string | null): void {
    const front = this.frontIsA ? this.a : this.b;
    const back = this.frontIsA ? this.b : this.a;
    if (url) {
      back.src = url;
      // Reassign both handlers each call so stale callbacks from a superseded
      // load cannot fire after a subsequent setArt call replaces them.
      back.onload = () => {
        back.style.opacity = '1';
        front.style.opacity = '0';
        this.frontIsA = !this.frontIsA;
        back.onload = null;
        back.onerror = null;
      };
      back.onerror = () => {
        // Image failed to load — leave the current front art showing and clear
        // the pending swap state so a later setArt call works normally.
        back.src = '';
        back.onload = null;
        back.onerror = null;
      };
    } else {
      this.a.style.opacity = '0';
      this.b.style.opacity = '0';
    }
  }
}
