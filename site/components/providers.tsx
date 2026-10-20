'use client';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@/components/theme';
import { setExtensionMessages } from '~/lib/ext-i18n';
import { store } from './demo-runtime';

export function Providers({ extension, children }: { extension: Record<string, string>; children: ReactNode }) {
  setExtensionMessages(extension);
  // Defaults are the settled settings, so the hero panel can paint its final rows before localStorage loads.
  return <ThemeProvider store={store} initialLoading={false}>{children}</ThemeProvider>;
}
