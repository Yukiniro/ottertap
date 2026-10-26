'use client';
import { useEffect, useState } from 'react';
import { FloatingController } from '@/components/floating';
import { getDemo } from './demo-runtime';

export default function FloatingDemo({ mediaTitle }: { mediaTitle: string }) {
  const [demo] = useState(() => getDemo(mediaTitle));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => setReady(demo.media.readyState >= 1 && !demo.media.error);
    demo.media.addEventListener('loadedmetadata', sync);
    demo.media.addEventListener('error', sync);
    sync();
    return () => { demo.media.removeEventListener('loadedmetadata', sync); demo.media.removeEventListener('error', sync); };
  }, [demo]);
  return ready ? <FloatingController client={demo.client} /> : null;
}
