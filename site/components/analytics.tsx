'use client';
import dynamic from 'next/dynamic';

export const Analytics = dynamic(
  () => import('@vercel/analytics/next').then(module => module.Analytics),
  { ssr: false }
);
