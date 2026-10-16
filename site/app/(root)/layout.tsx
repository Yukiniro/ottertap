import type { ReactNode } from 'react';
import { themeScript } from '~/lib/theme-script';
import '../globals.css';

export const metadata = { title: 'OtterTap', icons: { icon: '/icon.png' } };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
    <body>{children}</body>
  </html>;
}
