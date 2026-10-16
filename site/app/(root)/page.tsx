import { LangRedirect } from '~/components/lang-redirect';

export default function Home() {
  return <main className="grid min-h-screen place-items-center">
    <LangRedirect />
    <noscript><p className="flex gap-4 text-sm"><a href="/zh/">中文</a><a href="/en/">English</a></p></noscript>
  </main>;
}
