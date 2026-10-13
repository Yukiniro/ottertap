import { useCallback, useEffect, useState } from 'react';
import { defaultSettings, type Settings, type SettingsStore } from '../lib/types';

export function useSettings(store: SettingsStore) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const unwatch = store.watch(value => { if (active) setSettings(value); });
    store.load().then(value => { if (active) setSettings(value); }).catch(() => { if (active) setError('设置读取失败，请重试。'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; unwatch(); };
  }, [store]);
  const update = useCallback(async (next: Settings) => {
    try { await store.save(next); setSettings(next); setError(''); return true; }
    catch { setError('设置未保存，请重试。'); return false; }
  }, [store]);
  return { settings, loading, error, update };
}
