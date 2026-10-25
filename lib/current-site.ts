export interface SiteTab {
  id?: number;
  windowId?: number;
  active?: boolean;
  url?: string;
  pendingUrl?: string;
  lastAccessed?: number;
}

export interface SiteTabSelf {
  id?: number;
  windowId?: number;
}

type TabEvent = {
  addListener?: (listener: () => void) => void;
  removeListener?: (listener: () => void) => void;
};

type TabApi = {
  getCurrent?: () => Promise<SiteTab | undefined> | SiteTab | undefined;
  query?: (queryInfo: Record<string, never>) => Promise<SiteTab[] | undefined> | SiteTab[] | undefined;
  onRemoved?: TabEvent;
  onUpdated?: TabEvent;
  onActivated?: TabEvent;
};

const httpHost = (value: string | undefined): string | null => {
  if (!value || !/^https?:\/\//i.test(value)) return null;
  try {
    const host = new URL(value).hostname.replace(/\.$/, '').toLowerCase();
    return host || null;
  } catch {
    return null;
  }
};

const tabHost = (tab: SiteTab) => httpHost(tab.url) ?? httpHost(tab.pendingUrl);

const sameHost = (items: readonly { host: string }[]) => {
  if (!items.length) return null;
  const host = items[0]!.host;
  return items.every(item => item.host === host) ? host : null;
};

/**
 * Hostname of the website tab in this window. The settings tab, extension pages,
 * and any non-HTTP URL are not hosts. Several different hosts are resolved only
 * from the active tab, or from the tab that was active most recently. Otherwise
 * the result is null so the caller does not invent a host.
 */
export function currentSiteHost(tabs: readonly SiteTab[], self: SiteTabSelf | null): string | null {
  const pages = tabs.flatMap(tab => {
    if (self?.id !== undefined && tab.id === self.id) return [];
    const host = tabHost(tab);
    return host ? [{ tab, host }] : [];
  });
  const windowId = self?.windowId;
  const knownWindow = typeof windowId === 'number' && Number.isInteger(windowId) && windowId >= 0;
  const scoped = knownWindow ? pages.filter(item => item.tab.windowId === windowId) : pages;
  if (!scoped.length) return null;
  const shared = sameHost(scoped);
  if (!knownWindow) return shared;
  if (scoped.length === 1) return scoped[0]!.host;
  const active = scoped.filter(item => item.tab.active === true);
  if (active.length === 1) return active[0]!.host;
  if (active.length > 1) return sameHost(active);
  if (shared) return shared;
  if (scoped.some(item => typeof item.tab.lastAccessed !== 'number' || item.tab.lastAccessed <= 0)) return null;
  const ranked = [...scoped].sort((a, b) => b.tab.lastAccessed! - a.tab.lastAccessed!);
  const newest = ranked[0]!.tab.lastAccessed;
  return sameHost(ranked.filter(item => item.tab.lastAccessed === newest));
}

function siteTabApi(): TabApi | undefined {
  const root = globalThis as { browser?: { tabs?: TabApi }; chrome?: { tabs?: TabApi } };
  return root.browser?.tabs ?? root.chrome?.tabs;
}

/** Reads the current website hostname with the existing tabs API. Missing APIs and query failures stay null. */
export async function readCurrentSiteHost(): Promise<string | null> {
  const tabs = siteTabApi();
  if (!tabs?.getCurrent || !tabs.query) return null;
  try {
    const [self, all] = await Promise.all([Promise.resolve(tabs.getCurrent()), Promise.resolve(tabs.query({}))]);
    if (!Array.isArray(all)) return null;
    const here = self && typeof self === 'object' ? { id: self.id, windowId: self.windowId } : null;
    return currentSiteHost(all, here);
  } catch {
    return null;
  }
}

/** Subscribes to tab changes that can make the current hostname appear or disappear. */
export function watchSiteTabs(onChange: () => void): () => void {
  const tabs = siteTabApi();
  if (!tabs) return () => {};
  const listen = (event: TabEvent | undefined) => {
    event?.addListener?.(onChange);
    return () => { event?.removeListener?.(onChange); };
  };
  const stop = [listen(tabs.onRemoved), listen(tabs.onUpdated), listen(tabs.onActivated)];
  return () => { for (const fn of stop) fn(); };
}
