import type { ReactNode } from 'react';
import { SiteDocument } from '~/components/document';
import { siteMetadata } from '~/lib/metadata';
import '../globals.css';

export function generateMetadata() {
  return siteMetadata('en', '/');
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return <SiteDocument lang="en">{children}</SiteDocument>;
}
