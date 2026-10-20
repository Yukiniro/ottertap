import { ArrowUpRight } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { links, listedStores, type T } from '~/lib/site-locales';

const labels = { chrome: 'ctaInstallChrome', edge: 'ctaInstallEdge' } as const;

export function StoreButtons({ t, prominent = false }: { t: T; prominent?: boolean }) {
  const className = cn(buttonVariants({ size: 'lg' }), 'h-11 px-5', prominent && 'shadow-lg shadow-primary/20');
  const stores = listedStores();
  if (stores.length === 0) return <a className={cn(buttonVariants({ size: 'lg', variant: 'secondary' }), 'h-11 px-5')} href={links.releases} target="_blank" rel="noreferrer">{t('ctaReleases')}</a>;
  return stores.map(store => <a key={store.id} className={className} href={store.href} target="_blank" rel="noreferrer"><ArrowUpRight />{t(labels[store.id])}</a>);
}
