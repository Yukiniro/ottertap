import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaClient, MediaCommand, PageState } from '../lib/types';

export function useMedia(client: MediaClient) {
  const [page, setPage] = useState<PageState>({ enabled: true, host: '', media: [] });
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const alive = useRef(true);
  const reading = useRef(false);
  const refresh = useCallback(async () => {
    if (reading.current) return;
    reading.current = true;
    try { const next = await client.read(); if (alive.current) { setPage(next); setLoading(false); } }
    catch { if (alive.current) { setError('无法连接此页面。请刷新网页后重试；浏览器内置页面不可控制。'); setLoading(false); } }
    finally { reading.current = false; }
  }, [client]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 700);
    return () => { alive.current = false; window.clearInterval(timer); };
  }, [refresh]);
  const selected = page.media.find(item => item.id === selectedId) ?? page.media.find(item => !item.paused) ?? page.media[0];
  const command = async (value: MediaCommand) => {
    if (!selected) return;
    try { await client.command(selected, value); setError(''); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : '操作失败，请重试。'); }
  };
  return { page, selected, selectedId, select: setSelectedId, command, refresh, loading, error };
}
