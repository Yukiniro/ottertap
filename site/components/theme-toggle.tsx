'use client';
import { useAtomValue, useSetAtom } from 'jotai';
import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettingsAtoms } from '@/components/theme';
import type { Theme } from '@/lib/types';

const order: Theme[] = ['system', 'light', 'dark'];
const icons = { system: Monitor, light: Sun, dark: Moon };

export function ThemeToggle({ label, names }: { label: string; names: Record<Theme, string> }) {
  const { themeAtom, writeSettingsAtom } = useSettingsAtoms();
  const theme = useAtomValue(themeAtom);
  const write = useSetAtom(writeSettingsAtom);
  const Icon = icons[theme];
  const next = order[(order.indexOf(theme) + 1) % order.length]!;
  return <Button variant="ghost" size="icon" aria-label={`${label}: ${names[theme]}`} title={names[theme]} onClick={() => void write({ theme: next })}><Icon /></Button>;
}
