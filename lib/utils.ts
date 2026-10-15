import { i18n } from '#i18n';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return i18n.t('live');
  const time = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(time / 3600);
  return `${hours ? `${hours}:` : ''}${String(Math.floor(time / 60) % 60).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;
}
