export interface TabSnapshot {
  id?: number;
  windowId?: number;
  index?: number;
  title?: string;
  favIconUrl?: string;
  audible?: boolean;
  mutedInfo?: { muted?: boolean };
  lastAccessed?: number;
}

export interface SoundingTab {
  id: number;
  windowId: number;
  title: string;
  favIconUrl: string;
  muted: boolean;
}

export interface SoundingTabsClient {
  list(): Promise<SoundingTab[]>;
  focus(tabId: number): Promise<void>;
  mute(tabId: number, muted: boolean): Promise<void>;
  watch(onChange: () => void): () => void;
}

export function soundingTabChanged(change: { audible?: boolean; mutedInfo?: unknown; title?: string; favIconUrl?: string }) {
  return change.audible !== undefined || change.mutedInfo !== undefined || change.title !== undefined || change.favIconUrl !== undefined;
}

export function tabFavicon(url: string | undefined) {
  if (!url) return '';
  try {
    const protocol = new URL(url).protocol;
    return protocol === 'http:' || protocol === 'https:' ? url : '';
  } catch {
    return '';
  }
}

export function soundingTabs(tabs: readonly TabSnapshot[], currentTabId?: number): SoundingTab[] {
  const merged = new Map<number, SoundingTab & { audible: boolean; lastAccessed: number; index: number }>();
  for (const tab of tabs) {
    if (typeof tab.id !== 'number' || tab.id < 0 || tab.id === currentTabId) continue;
    const audible = tab.audible === true;
    const muted = tab.mutedInfo?.muted === true;
    if (!audible && !muted) continue;
    const title = tab.title?.trim() ?? '';
    const favIconUrl = tabFavicon(tab.favIconUrl);
    const existing = merged.get(tab.id);
    if (existing) {
      existing.audible = existing.audible || audible;
      existing.muted = existing.muted || muted;
      if (!existing.title && title) existing.title = title;
      if (!existing.favIconUrl && favIconUrl) existing.favIconUrl = favIconUrl;
      if (typeof tab.lastAccessed === 'number') existing.lastAccessed = Math.max(existing.lastAccessed, tab.lastAccessed);
      continue;
    }
    merged.set(tab.id, {
      id: tab.id,
      windowId: typeof tab.windowId === 'number' ? tab.windowId : -1,
      title,
      favIconUrl,
      muted,
      audible,
      lastAccessed: tab.lastAccessed ?? 0,
      index: tab.index ?? 0,
    });
  }
  return [...merged.values()].sort((a, b) => {
    const heard = Number(b.audible && !b.muted) - Number(a.audible && !a.muted);
    if (heard) return heard;
    if (a.lastAccessed !== b.lastAccessed) return b.lastAccessed - a.lastAccessed;
    if (a.index !== b.index) return a.index - b.index;
    return a.id - b.id;
  }).map(({ id, windowId, title, favIconUrl, muted }) => ({ id, windowId, title, favIconUrl, muted }));
}
