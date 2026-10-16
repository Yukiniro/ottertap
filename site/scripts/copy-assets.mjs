import { cpSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const pub = new URL('../public/', import.meta.url);
cpSync(new URL('preview/demo.wav', root), new URL('demo.wav', pub));
cpSync(new URL('public/icon/128.png', root), new URL('icon.png', pub));
