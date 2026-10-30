/**
 * Resume ledger: where the user left off in long seekable media, kept in `chrome.storage.local`.
 * Separate from settings and from the in-page progress mark, which never leaves the page.
 *
 * One storage key per media, `ottertap-resume-v1:<page> <media>`, holding a `ResumeEntry`.
 * A periodic save rewrites one small key, so the `storage.onChanged` fan-out to every frame stays small,
 * and a later lookup reads one key instead of the whole ledger.
 */
export const resumePrefix = 'ottertap-resume-v1:';
export const resumeLimit = 200;
/** Shorter media is a clip, not something to come back to. */
export const resumeMinDuration = 120;
export const resumeSaveIntervalMs = 10_000;

export interface ResumeEntry {
  /** Address of the document that holds the media, without the fragment. */
  page: string;
  /** `src:` + origin and path of an http(s) source. Blob, data, or missing sources use `dur:` + whole-second duration. */
  media: string;
  /** Seconds. */
  time: number;
  /** Seconds, finite. */
  duration: number;
  /** `Date.now()` of the last save. The oldest is evicted first. */
  savedAt: number;
}

export type ResumeReport = Pick<ResumeEntry, 'media' | 'time' | 'duration'>;

export function resumePage(address: string) {
  let url: URL;
  try { url = new URL(address); } catch { return ''; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
  url.hash = '';
  return url.href;
}

/** Signed query strings change between visits, so an http(s) source keeps only origin and path. */
export function resumeMedia(source: string, duration: number) {
  try {
    const url = new URL(source);
    if (url.protocol === 'http:' || url.protocol === 'https:') return `src:${url.origin}${url.pathname}`;
  } catch { /* Not an absolute address. */ }
  return `dur:${Math.round(duration)}`;
}

export function resumeEntryKey(page: string, media: string) {
  return `${resumePrefix}${page} ${media}`;
}

/** Near the end counts as finished. Credits on long media take a few percent. */
export function resumeTailSeconds(duration: number) {
  return Math.max(30, duration * 0.05);
}

/** `skip` writes nothing, `drop` forgets a finished media, `save` records the position. */
export function resumeVerdict(report: Pick<ResumeReport, 'time' | 'duration'>): 'skip' | 'drop' | 'save' {
  const { time, duration } = report;
  if (!Number.isFinite(time) || !Number.isFinite(duration) || time < 0 || duration < resumeMinDuration) return 'skip';
  return duration - time <= resumeTailSeconds(duration) ? 'drop' : 'save';
}

/** Null for live, unseekable, unloaded, or short media. */
export function readResume(element: HTMLMediaElement): ResumeReport | null {
  const duration = element.duration;
  if (!Number.isFinite(duration) || duration < resumeMinDuration) return null;
  const ranges = element.seekable;
  if (!ranges.length || !(ranges.end(ranges.length - 1) > ranges.start(0))) return null;
  const source = element.currentSrc || element.getAttribute('src') || '';
  return { media: resumeMedia(source, duration), time: element.currentTime, duration };
}

/**
 * Whether this progress event should be reported.
 * Playback reports after each interval, counted from the first tick, so a glance at a page saves nothing.
 * A pause reports right away and restarts the count.
 */
export function createResumeClock(interval = resumeSaveIntervalMs) {
  const last = new WeakMap<HTMLMediaElement, number>();
  return (element: HTMLMediaElement, paused: boolean, now: number) => {
    if (paused) { last.delete(element); return true; }
    const since = last.get(element);
    if (since === undefined) { last.set(element, now); return false; }
    if (now - since < interval) return false;
    last.set(element, now);
    return true;
  };
}

function isResumeEntry(value: unknown): value is ResumeEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<ResumeEntry>;
  return typeof entry.page === 'string' && typeof entry.media === 'string' && Number.isFinite(entry.time) && Number.isFinite(entry.duration) && Number.isFinite(entry.savedAt);
}

/** Every ledger entry in storage, newest first. Values that do not match their key are left out. */
export function resumeEntries(stored: Record<string, unknown>): ResumeEntry[] {
  return Object.entries(stored)
    .filter((pair): pair is [string, ResumeEntry] => pair[0].startsWith(resumePrefix) && isResumeEntry(pair[1]) && pair[0] === resumeEntryKey(pair[1].page, pair[1].media))
    .map(([, entry]) => entry)
    .sort((a, b) => b.savedAt - a.savedAt);
}

/** Ledger keys past the limit, oldest first, plus any malformed value under the prefix. */
export function staleResumeKeys(stored: Record<string, unknown>, limit = resumeLimit) {
  const kept = new Set(resumeEntries(stored).slice(0, limit).map(entry => resumeEntryKey(entry.page, entry.media)));
  return Object.keys(stored).filter(key => key.startsWith(resumePrefix) && !kept.has(key));
}

export interface ResumeArea {
  get(keys: null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

/** Applies one report for `page`. Callers serialize writes so eviction sees every earlier save. Invalid reports write nothing. */
export async function writeResume(area: ResumeArea, page: string, report: ResumeReport, now: number) {
  const verdict = resumeVerdict(report);
  if (verdict === 'skip' || !page || !/^(?:src:https?:\/\/\S+|dur:\d+)$/.test(report.media)) return;
  const key = resumeEntryKey(page, report.media);
  if (verdict === 'drop') { await area.remove(key); return; }
  const entry: ResumeEntry = { page, media: report.media, time: report.time, duration: report.duration, savedAt: now };
  await area.set({ [key]: entry });
  const stale = staleResumeKeys(await area.get(null));
  if (stale.length) await area.remove(stale);
}
