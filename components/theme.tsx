import { i18n } from '#i18n';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { Provider, useAtomValue } from 'jotai';
import { createSettingsAtoms, type SettingsAtoms } from '../lib/settings-atoms';
import type { SettingsStore } from '../lib/types';

const SettingsAtomsContext = createContext<SettingsAtoms | null>(null);

export function useSettingsAtoms() {
  const atoms = useContext(SettingsAtomsContext);
  if (!atoms) throw new Error(i18n.t('missingSettings'));
  return atoms;
}

export function ThemeProvider({ store, children, target, initialLoading }: { store: SettingsStore; children: ReactNode; target?: HTMLElement; initialLoading?: boolean }) {
  const atoms = useMemo(() => createSettingsAtoms(store, { initialLoading }), [store, initialLoading]);
  useEffect(() => atoms.mount(), [atoms]);
  return <SettingsAtomsContext.Provider value={atoms}>
    <Provider store={atoms.store}><ThemeClass target={target}>{children}</ThemeClass></Provider>
  </SettingsAtomsContext.Provider>;
}

function ThemeClass({ target, children }: { target?: HTMLElement; children: ReactNode }) {
  const { themeAtom } = useSettingsAtoms();
  const theme = useAtomValue(themeAtom);
  useEffect(() => {
    const root = target ?? document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => { const dark = theme === 'dark' || (theme === 'system' && media.matches); root.classList.toggle('dark', dark); root.style.colorScheme = dark ? 'dark' : 'light'; };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme, target]);
  return children;
}
