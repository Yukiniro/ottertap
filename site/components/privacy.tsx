import { Ban, Database, Globe, ShieldCheck } from 'lucide-react';
import type { T } from '~/lib/locale';

export function Privacy({ t }: { t: T }) {
  const items = [{ icon: Database, key: 'privacyStorage' }, { icon: Globe, key: 'privacyHosts' }, { icon: Ban, key: 'privacyNone' }];
  return <section id="privacy" className="px-5 py-20 md:py-28">
    <div className="mx-auto grid max-w-6xl gap-10 rounded-3xl border bg-card p-8 shadow-card md:grid-cols-2 md:p-12">
      <div className="flex flex-col gap-4">
        <ShieldCheck className="size-9 text-primary" strokeWidth={1.5} />
        <p className="eyebrow mb-0">{t('privacyEyebrow')}</p>
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{t('privacyTitle')}</h2>
        <p className="text-lg leading-relaxed text-muted-foreground">{t('privacyBody')}</p>
      </div>
      <div>
        <h3 className="mb-4 text-sm font-semibold text-muted-foreground">{t('privacyPermissionsTitle')}</h3>
        <ul className="grid gap-3">
          {items.map(({ icon: Icon, key }) => <li key={key} className="flex gap-3 rounded-xl bg-background p-4 text-sm leading-relaxed"><Icon className="mt-0.5 size-4 shrink-0 text-primary" />{t(key)}</li>)}
        </ul>
      </div>
    </div>
  </section>;
}
