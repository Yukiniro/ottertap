import { cpSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const pub = new URL('../public/', import.meta.url);
cpSync(new URL('preview/demo.wav', root), new URL('demo.wav', pub));
cpSync(new URL('public/icon/128.png', root), new URL('icon.png', pub));
cpSync(new URL('public/icon/32.png', root), new URL('favicon.png', pub));
cpSync(new URL('../assets/og.jpg', import.meta.url), new URL('og.jpg', pub));
cpSync(new URL('../assets/apple-touch-icon.png', import.meta.url), new URL('apple-touch-icon.png', pub));
