import { STAGE_W, STAGE_H } from '../config';

export function computeStageScale(vw: number, vh: number): number {
  return Math.min(vw / STAGE_W, vh / STAGE_H);
}

export function fitStage(stage: HTMLElement): void {
  const apply = () => {
    const s = computeStageScale(window.innerWidth, window.innerHeight);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  };
  window.addEventListener('resize', apply);
  apply();
}
