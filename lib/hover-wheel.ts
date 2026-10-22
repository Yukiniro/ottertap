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
