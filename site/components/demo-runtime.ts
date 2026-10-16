import { createDemo, createDemoStore } from '@/lib/demo';
import { settingsKey } from '~/lib/theme-script';

export const store = createDemoStore(settingsKey);

let demo: ReturnType<typeof createDemo> | undefined;

/** One demo media per page, shared by the hero panel and the floating controller. */
export function getDemo(title: string) {
  demo ??= createDemo(document, { src: '/demo.wav', title, store });
  return demo;
}
