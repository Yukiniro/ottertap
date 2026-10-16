'use client';
import { useState } from 'react';
import { FloatingController } from '@/components/floating';
import { getDemo } from './demo-runtime';

export default function FloatingDemo({ mediaTitle }: { mediaTitle: string }) {
  const [demo] = useState(() => getDemo(mediaTitle));
  return <FloatingController client={demo.client} />;
}
