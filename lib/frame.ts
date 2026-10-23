/** One presented frame. 30 fps is the fallback when the element never reports an interval. */
export const fallbackFrameSeconds = 1 / 30;
const minFrameSeconds = 1 / 120;
const maxFrameSeconds = 0.1;

export function usableFrameSeconds(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  if (value < minFrameSeconds || value > maxFrameSeconds) return null;
  return value;
}

/** Prefer a measured presentation interval, then a track frame rate, else 1/30. */
export function resolveFrameSeconds(presented?: number | null, frameRate?: number | null) {
  const measured = usableFrameSeconds(presented);
  if (measured != null) return measured;
  if (typeof frameRate === 'number' && Number.isFinite(frameRate) && frameRate >= 10 && frameRate <= 120) return 1 / frameRate;
  return fallbackFrameSeconds;
}

/**
 * The next frame boundary in `direction`. A time already on a boundary moves one whole frame.
 * A time between boundaries snaps to the neighbor in that direction.
 */
export function adjacentFrameTime(current: number, direction: 1 | -1, frame: number) {
  const quantum = usableFrameSeconds(frame) ?? fallbackFrameSeconds;
  const origin = Number.isFinite(current) ? current : 0;
  const index = Math.round(origin / quantum);
  const nearest = index * quantum;
  if (Math.abs(origin - nearest) <= quantum * 0.2) return (index + direction) * quantum;
  const quotient = origin / quantum;
  const boundary = direction > 0 ? Math.ceil(quotient - 1e-9) : Math.floor(quotient + 1e-9);
  return boundary * quantum;
}

export function canStepFrames(media: { live: boolean; seekable: { start: number; end: number }[] }) {
  if (media.live) return false;
  const ranges = media.seekable;
  if (!ranges.length) return false;
  const start = ranges[0]?.start;
  const end = ranges[ranges.length - 1]?.end;
  return typeof start === 'number' && typeof end === 'number' && Number.isFinite(start) && Number.isFinite(end) && end > start;
}

interface FrameTrack { selected?: boolean; frameRate?: number }
interface FrameTrackList { length: number; selectedIndex?: number; [index: number]: FrameTrack | undefined }

export function readVideoFrameRate(element: object) {
  const tracks = (element as { videoTracks?: FrameTrackList }).videoTracks;
  if (!tracks || typeof tracks.length !== 'number' || tracks.length <= 0) return null;
  const selectedIndex = typeof tracks.selectedIndex === 'number' ? tracks.selectedIndex : -1;
  let chosen: FrameTrack | undefined = selectedIndex >= 0 ? tracks[selectedIndex] : undefined;
  if (typeof chosen?.frameRate !== 'number') {
    chosen = undefined;
    for (let index = 0; index < tracks.length; index += 1) {
      const track = tracks[index];
      if (track?.selected) { chosen = track; break; }
      chosen ??= track;
    }
  }
  const rate = chosen?.frameRate;
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 10 || rate > 120) return null;
  return rate;
}

type FrameCallback = (now: number, metadata: { mediaTime?: number }) => void;
type VideoFrameElement = HTMLMediaElement & {
  requestVideoFrameCallback?: (callback: FrameCallback) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

const presented = new WeakMap<HTMLMediaElement, number>();
const handles = new WeakMap<HTMLMediaElement, number>();
const watching = new Set<HTMLMediaElement>();

export function presentedFrameSeconds(element: HTMLMediaElement) {
  return presented.get(element) ?? null;
}

export function stopPresentedFrames(element: HTMLMediaElement) {
  const video = element as VideoFrameElement;
  const handle = handles.get(element);
  if (handle != null) video.cancelVideoFrameCallback?.(handle);
  handles.delete(element);
  watching.delete(element);
}

export function stopAllPresentedFrames() {
  for (const element of [...watching]) stopPresentedFrames(element);
}

/** Sample presentation intervals while a video is playing. A paused element keeps the last sample. */
export function watchPresentedFrames(element: HTMLMediaElement) {
  if (element.localName !== 'video' || element.paused || !element.isConnected || handles.has(element)) return;
  const video = element as VideoFrameElement;
  if (typeof video.requestVideoFrameCallback !== 'function') return;
  let last = Number.NaN;
  const tick: FrameCallback = (_now, metadata) => {
    handles.delete(element);
    watching.delete(element);
    const time = metadata?.mediaTime;
    if (typeof time === 'number' && Number.isFinite(last)) {
      const usable = usableFrameSeconds(time - last);
      if (usable != null) presented.set(element, usable);
    }
    if (typeof time === 'number' && Number.isFinite(time)) last = time;
    if (!element.isConnected || element.paused) return;
    const next = video.requestVideoFrameCallback?.(tick);
    if (typeof next !== 'number') return;
    handles.set(element, next);
    watching.add(element);
  };
  const handle = video.requestVideoFrameCallback(tick);
  handles.set(element, handle);
  watching.add(element);
}

export function frameStepSeconds(element: HTMLMediaElement) {
  return resolveFrameSeconds(presentedFrameSeconds(element), readVideoFrameRate(element));
}
