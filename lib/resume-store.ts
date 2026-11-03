import { clearResumeEntries, resumeEntries, resumeEntryKey, resumePrefix, type ResumeEntry } from './resume';

/**
 * Ledger access from extension pages (settings). The live global is read lazily,
 * so tests that render the settings page without a browser stay quiet.
 */
type Storage = {
  local?: { get(keys: null): Promise<Record<string, unknown>>; remove(keys: string[]): Promise<void> };
  onChanged?: { addListener?(listener: (changes: Record<string, unknown>, area: string) => void): void; removeListener?(listener: (changes: Record<string, unknown>, area: string) => void): void };
};

function storage(): { local?: Storage['local']; onChanged?: Storage['onChanged'] } | undefined {
  const root = globalThis as { browser?: { storage?: Storage }; chrome?: { storage?: Storage } };
  return (root.browser ?? root.chrome)?.storage;
}

export async function readResumeLedger() {
  const area = storage()?.local;
  if (!area) return [];
  return resumeEntries(await area.get(null));
}

export function forgetResumeEntry(entry: Pick<ResumeEntry, 'page' | 'media'>) {
  const area = storage()?.local;
  return area ? area.remove([resumeEntryKey(entry.page, entry.media)]) : Promise.resolve();
}

export function clearResumeLedger() {
  const area = storage()?.local;
  return area ? clearResumeEntries(area) : Promise.resolve();
}

export function watchResumeLedger(onChange: () => void) {
  const events = storage()?.onChanged;
  const listener = (changes: Record<string, unknown>, area: string) => {
    if (area === 'local' && Object.keys(changes).some(key => key.startsWith(resumePrefix))) onChange();
  };
  if (!events?.addListener) return () => {};
  events.addListener(listener);
  return () => events.removeListener?.(listener);
}
