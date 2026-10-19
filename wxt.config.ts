import { resolve } from 'node:path';
import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { manifestCommands } from './lib/commands';

export default defineConfig({
  modules: ['@wxt-dev/module-react', '@wxt-dev/i18n/module'],
  vite: () => ({ plugins: [tailwindcss()] }),
  hooks: {
    'build:publicAssets'(wxt, files) {
      files.push({ absoluteSrc: resolve(wxt.config.root, 'LICENSE'), relativeDest: 'LICENSE' });
    }
  },
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    permissions: ['storage'],
    host_permissions: ['http://*/*', 'https://*/*'],
    icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
    commands: manifestCommands()
  }
});
