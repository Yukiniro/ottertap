export function snapDraggedVolume(percent: number) {
  return Math.abs(percent - 100) <= 3 ? 100 : percent;
}

export function snapVolumeStep(previous: number, next: number) {
  // Converting gain to percent can leave a tiny remainder at the baseline.
  if (Math.abs(next - 100) < 1e-9) return 100;
  return (previous < 100 && next > 100) || (previous > 100 && next < 100) ? 100 : next;
}

export function steppedVolume(previous: number, delta: number, max: number) {
  return snapVolumeStep(previous, Math.max(0, Math.min(max, previous + delta)));
}
