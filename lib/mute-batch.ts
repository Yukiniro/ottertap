export const muteBatchKey = 'ottertap-mute-batch-v1';

export interface TabMuteFact {
  id: number;
  muted: boolean;
  reason?: string;
  extensionId?: string;
}

/** One tab this extension actually changed. Later batches can record a different written bit, including the current tab. */
export interface MuteBatchEntry {
  tabId: number;
  previousMuted: boolean;
  writtenMuted: boolean;
}

export interface MuteBatch {
  entries: MuteBatchEntry[];
}

type MuteInfo = { muted?: boolean; reason?: string; extensionId?: string };

export function tabMuteFact(tab: { id?: number; mutedInfo?: MuteInfo } | null | undefined): TabMuteFact | null {
  if (!tab || typeof tab.id !== 'number' || !Number.isInteger(tab.id) || tab.id < 0) return null;
  const fact: TabMuteFact = { id: tab.id, muted: tab.mutedInfo?.muted === true };
  if (typeof tab.mutedInfo?.reason === 'string' && tab.mutedInfo.reason) fact.reason = tab.mutedInfo.reason;
  if (typeof tab.mutedInfo?.extensionId === 'string' && tab.mutedInfo.extensionId) fact.extensionId = tab.mutedInfo.extensionId;
  return fact;
}

export function attributedTo(tab: TabMuteFact, extensionId: string, muted: boolean) {
  return extensionId.length > 0 && tab.muted === muted && tab.reason === 'extension' && tab.extensionId === extensionId;
}

export function recordableWrite(before: TabMuteFact, writtenMuted: boolean, after: TabMuteFact | null, extensionId: string): MuteBatchEntry | null {
  if (!after || before.id !== after.id || before.muted === writtenMuted) return null;
  if (!attributedTo(after, extensionId, writtenMuted)) return null;
  return { tabId: before.id, previousMuted: before.muted, writtenMuted };
}

export function canRestore(entry: MuteBatchEntry, tab: TabMuteFact | null | undefined, extensionId: string) {
  if (!tab || tab.id !== entry.tabId || entry.previousMuted === entry.writtenMuted) return false;
  return attributedTo(tab, extensionId, entry.writtenMuted);
}

export function parseMuteBatch(raw: unknown): MuteBatch | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const entries = (raw as { entries?: unknown }).entries;
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const parsed: MuteBatchEntry[] = [];
  const seen = new Set<number>();
  for (const item of entries) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const { tabId, previousMuted, writtenMuted } = item as { tabId?: unknown; previousMuted?: unknown; writtenMuted?: unknown };
    if (typeof tabId !== 'number' || !Number.isInteger(tabId) || tabId < 0 || seen.has(tabId)) return null;
    if (typeof previousMuted !== 'boolean' || typeof writtenMuted !== 'boolean' || previousMuted === writtenMuted) return null;
    seen.add(tabId);
    parsed.push({ tabId, previousMuted, writtenMuted });
  }
  return { entries: parsed };
}

export function withoutEntry(batch: MuteBatch | null, tabId: number): MuteBatch | null {
  if (!batch) return null;
  const entries = batch.entries.filter(entry => entry.tabId !== tabId);
  return entries.length ? { entries } : null;
}
