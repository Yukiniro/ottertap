import { i18n } from '#i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import { lockedMedia, mediaPresenceEvent } from '../lib/media';
import type { MediaClient, MediaCommand, PageState } from '../lib/types';

export function useMedia(client: MediaClient, options?: { pauseWhenEmpty?: boolean; initial?: PageState }) {
  const [page, setPage] = useState<PageState>(options?.initial ?? { enabled: true, host: '', media: [], selectedId: '' });
  const [picked, setPicked] = useState('');
  const [loading, setLoading] = useState(!options?.initial);
  const [error, setError] = useState('');
  const alive = useRef(true);
  const reading = useRef(false);
  const queued = useRef(false);
  const tracking = useRef(!options?.pauseWhenEmpty);
  const refresh = useCallback(async () => {
    if (reading.current) { queued.current = true; return; }
    reading.current = true;
    try {
      const next = await client.read();
      if (alive.current) {
        if (options?.pauseWhenEmpty) tracking.current = next.media.length > 0;
        setPage(next);
        setLoading(false);
      }
    }
    catch { if (alive.current) { setError(i18n.t('cannotConnect')); setLoading(false); } }
    finally {
      reading.current = false;
      if (queued.current && alive.current) { queued.current = false; void refresh(); }
    }
  }, [client, options?.pauseWhenEmpty]);
  useEffect(() => {
    alive.current = true;
    const pull = () => { void refresh(); };
    if (options?.pauseWhenEmpty) window.addEventListener(mediaPresenceEvent, pull);
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden && tracking.current) void refresh(); }, 700);
    return () => {
      alive.current = false;
      window.clearInterval(timer);
      if (options?.pauseWhenEmpty) window.removeEventListener(mediaPresenceEvent, pull);
    };
  }, [options?.pauseWhenEmpty, refresh]);
  const selected = lockedMedia(page.media, picked || page.selectedId);
  const selectedId = selected?.id ?? '';
  useEffect(() => {
    if (picked && (page.selectedId === picked || !page.media.some(item => item.id === picked))) setPicked('');
  }, [picked, page.media, page.selectedId]);
  useEffect(() => {
    if (!picked && !page.selectedId && selectedId) void client.select(selectedId);
  }, [client, picked, selectedId, page.selectedId]);
  const select = (id: string) => { setPicked(id); void client.select(id).finally(() => { void refresh(); }); };
  const command = async (value: MediaCommand) => {
    if (!selected) return;
    try { await client.command(selected, value); setError(''); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : i18n.t('actionFailed')); }
  };
  return { page, selected, selectedId, select, command, refresh, loading, error };
}
