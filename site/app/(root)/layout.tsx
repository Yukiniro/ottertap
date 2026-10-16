import type { ReactNode } from 'react';
import { siteMetadata } from '~/lib/metadata';
import { themeScript } from '~/lib/theme-script';
import '../globals.css';

export function generateMetadata() {
  return siteMetadata('en', '/');
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
    <body>{children}</body>
  </html>;
}
