/**
 * A non-Alt wheel may join the hover-volume gesture.
 * Shift stays on the player so it can take the coarse step.
 * A text field that has focus, or that the wheel lands on, keeps that Shift wheel.
 */
export function hoverWheelTrackTarget(event: { altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; deltaY: number }, target: string | undefined, onStage: boolean, typing: boolean) {
  if (event.altKey || event.ctrlKey || event.metaKey || !event.deltaY || !onStage || !target) return undefined;
  if (event.shiftKey && typing) return undefined;
  return target;
}

/** A page scroll cannot become a volume gesture until the wheel rests. */
export function createHoverWheelGesture() {
  let lastAt = -Infinity;
  let origin: string | undefined;
  return (target: string | undefined, now: number) => {
    if (now - lastAt >= 300) origin = target;
    else if (target !== origin) origin = undefined;
    lastAt = now;
    return origin;
  };
}
