'use client';
import dynamic from 'next/dynamic';

// The floating control reads the viewport while rendering and is position:fixed, so skipping SSR does not move the page.
export const FloatingDemo = dynamic(() => import('./floating-demo'), { ssr: false });
