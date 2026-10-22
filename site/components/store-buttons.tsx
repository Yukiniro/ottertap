import { ArrowUpRight } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { links, listedStores, type T } from '~/lib/site-locales';

const labels = { chrome: 'ctaInstallChrome', edge: 'ctaInstallEdge' } as const;

export function StoreButtons({ t }: { t: T }) {
  const className = cn(buttonVariants({ size: 'lg' }), 'h-11 px-5');
  const stores = listedStores();
  if (stores.length === 0) return <a className={className} href={links.releases} target="_blank" rel="noreferrer">{t('ctaReleases')}</a>;
  return stores.map(store => <a key={store.id} className={className} href={store.href} target="_blank" rel="noreferrer"><ArrowUpRight />{t(labels[store.id])}</a>);
}
