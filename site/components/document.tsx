import type { ReactNode } from 'react';
import { Analytics } from '~/components/analytics';
import { localeById, type Lang } from '~/lib/site-locales';
import { themeScript } from '~/lib/theme-script';

export function SiteDocument({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <html lang={localeById(lang).htmlLang} suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
    <body>{children}<Analytics /></body>
  </html>;
}
