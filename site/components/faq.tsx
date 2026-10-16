import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { T } from '~/lib/locale';

export function Faq({ t }: { t: T }) {
  const items = ['Boost', 'Pages', 'Override', 'Browsers'];
  return <section id="faq" className="px-5 py-20 md:py-28">
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-8 text-center text-3xl font-bold tracking-tight md:text-4xl">{t('faqTitle')}</h2>
      <Accordion className="rounded-2xl border bg-card px-6 shadow-card">
        {items.map(key => <AccordionItem key={key} value={key}>
          <AccordionTrigger className="py-5 text-base hover:no-underline">{t(`faq${key}Q`)}</AccordionTrigger>
          <AccordionContent className="pb-5 leading-relaxed text-muted-foreground">{t(`faq${key}A`)}</AccordionContent>
        </AccordionItem>)}
      </Accordion>
    </div>
  </section>;
}
