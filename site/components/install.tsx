import { ArrowDownToLine, RefreshCw } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { links, type T } from '~/lib/locale';

export function Install({ t }: { t: T }) {
  const steps = [1, 2, 3, 4];
  return <section id="install" className="border-y bg-card/60 px-5 py-20 md:py-28">
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">{t('installEyebrow')}</p>
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">{t('installTitle')}</h2>
        </div>
        <a className={cn(buttonVariants({ size: 'lg' }), 'h-11 px-5')} href={links.latest} target="_blank" rel="noreferrer"><ArrowDownToLine />{t('ctaDownload')}</a>
      </div>
      <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(step => <li key={step} className="flex flex-col gap-3 rounded-2xl border bg-background p-6 shadow-card">
          <span aria-hidden="true" className="text-4xl font-bold text-primary/30 tabular-nums">{`0${step}`}</span>
          <h3 className="text-lg font-semibold">{t(`installStep${step}Title`)}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{t(`installStep${step}Body`)}</p>
        </li>)}
      </ol>
      <p className="flex items-start gap-2 text-sm text-muted-foreground"><RefreshCw className="mt-0.5 size-4 shrink-0" />{t('installUpdate')}</p>
    </div>
  </section>;
}
