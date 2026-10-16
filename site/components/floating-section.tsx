import { ArrowRight } from 'lucide-react';
import type { T } from '~/lib/locale';

export function FloatingSection({ t }: { t: T }) {
  const points = ['floatingPoint1', 'floatingPoint2', 'floatingPoint3', 'floatingPoint4'];
  return <section className="border-y bg-card/60 px-5 py-20">
    <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-[1fr_1.1fr]">
      <div>
        <p className="eyebrow">{t('floatingEyebrow')}</p>
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{t('floatingTitle')}</h2>
        <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">{t('floatingBody')}</p>
        <p aria-hidden="true" className="mt-6 hidden items-center gap-2 text-sm font-medium text-primary md:flex">{t('floatingTry')}<ArrowRight className="size-4 animate-pulse motion-reduce:animate-none" /></p>
      </div>
      <ol className="grid gap-3">
        {points.map((key, index) => <li key={key} className="flex gap-4 rounded-xl border bg-background p-4 shadow-card">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{index + 1}</span>
          <span className="text-sm leading-relaxed">{t(key)}</span>
        </li>)}
      </ol>
    </div>
  </section>;
}
