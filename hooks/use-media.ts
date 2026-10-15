import { i18n } from '#i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import { lockedMedia } from '../lib/media';
import type { MediaClient, MediaCommand, PageState } from '../lib/types';

export function useMedia(client: MediaClient) {
  const [page, setPage] = useState<PageState>({ enabled: true, host: '', media: [], selectedId: '' });
  const [picked, setPicked] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const alive = useRef(true);
  const reading = useRef(false);
  const refresh = useCallback(async () => {
    if (reading.current) return;
    reading.current = true;
    try { const next = await client.read(); if (alive.current) { setPage(next); setLoading(false); } }
    catch { if (alive.current) { setError(i18n.t('cannotConnect')); setLoading(false); } }
    finally { reading.current = false; }
  }, [client]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 700);
    return () => { alive.current = false; window.clearInterval(timer); };
  }, [refresh]);
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
