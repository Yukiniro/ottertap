'use client';
import dynamic from 'next/dynamic';

// The extension components read the DOM and HTMLMediaElement directly, so they only render in the browser.
export const HeroDemo = dynamic(() => import('./hero-demo'), {
  ssr: false,
  loading: () => <div className="h-[520px] w-[400px] max-w-full animate-pulse rounded-[13px] border bg-card" />
});

export const FloatingDemo = dynamic(() => import('./floating-demo'), { ssr: false });
