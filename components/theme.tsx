import { useEffect, type ReactNode } from 'react';
import { useSettings } from '../hooks/use-settings';
import type { SettingsStore } from '../lib/types';

export function ThemeProvider({ store, children, target }: { store: SettingsStore; children: ReactNode; target?: HTMLElement }) {
  const { settings } = useSettings(store);
  useEffect(() => {
    const root = target ?? document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => { const dark = settings.theme === 'dark' || (settings.theme === 'system' && media.matches); root.classList.toggle('dark', dark); root.style.colorScheme = dark ? 'dark' : 'light'; };
    apply(); media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings.theme, target]);
  return children;
}
