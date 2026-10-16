import { buttonVariants } from '@/components/ui/button';
import { loadMessages } from '~/lib/locale';

export default function Home() {
  const en = loadMessages('en').site;
  const zh = loadMessages('zh').site;
  return <main className="grid min-h-screen place-items-center px-6 py-12">
    <section className="flex max-w-xl flex-col items-center gap-6 text-center">
      <h1 className="text-4xl font-bold">OtterTap</h1>
      <p className="text-muted-foreground">{en.metaDescription}</p>
      <p lang="zh-CN" className="text-muted-foreground">{zh.metaDescription}</p>
      <div className="flex gap-4">
        <a className={buttonVariants()} href="/en/" hrefLang="en" lang="en">English</a>
        <a className={buttonVariants({ variant: 'outline' })} href="/zh/" hrefLang="zh-CN" lang="zh-CN">中文</a>
      </div>
    </section>
  </main>;
}
