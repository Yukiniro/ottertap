import type { FloatingPosition } from './types';

export const dockSize = 48;
const edge = 8;
const peek = dockSize / 2;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

export interface Viewport { width: number; height: number }

export function dockedPoint(position: FloatingPosition, viewport: Viewport, revealed: boolean) {
  const x = position.side === 'left' ? (revealed ? edge : -peek) : viewport.width - (revealed ? dockSize + edge : peek);
  return { x, y: clamp(position.y * viewport.height - dockSize / 2, edge, viewport.height - dockSize - edge) };
}

export function dropPosition(point: { x: number; y: number }, viewport: Viewport): FloatingPosition {
  return { side: point.x + dockSize / 2 < viewport.width / 2 ? 'left' : 'right', y: clamp((point.y + dockSize / 2) / viewport.height, 0, 1) };
}

export function nudgePosition(position: FloatingPosition, key: string, viewport: Viewport): FloatingPosition | null {
  if (key === 'ArrowLeft') return { ...position, side: 'left' };
  if (key === 'ArrowRight') return { ...position, side: 'right' };
  if (key !== 'ArrowUp' && key !== 'ArrowDown') return null;
  return { ...position, y: clamp(position.y + (key === 'ArrowUp' ? -20 : 20) / viewport.height, 0, 1) };
}
