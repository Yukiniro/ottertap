import type { ReactNode } from 'react';
import { Analytics } from '~/components/analytics';
import { siteMetadata } from '~/lib/metadata';
import { themeScript } from '~/lib/theme-script';
import '../globals.css';

export function generateMetadata() {
  return siteMetadata('zh', '/zh/');
}

export default function ChineseLayout({ children }: { children: ReactNode }) {
  return <html lang="zh-CN" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
    <body>{children}<Analytics /></body>
  </html>;
}
