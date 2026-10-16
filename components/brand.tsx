import { i18n } from '#i18n';
import otterMark from '../assets/otter-mark';
import { cn } from '../lib/utils';
export function Brand({ className }: { className?: string }) {
  return <span className={cn('inline-flex items-center gap-2.5 text-xl font-bold tracking-tight text-foreground', className)}><img src={otterMark} alt="" aria-hidden="true" className="size-8 shrink-0 object-contain" /><span>{i18n.t('brandName')}</span>{i18n.t('locale').startsWith('zh') && <small className="text-[11px] font-semibold tracking-normal text-muted-foreground max-[260px]:hidden">OtterTap</small>}</span>;
}
