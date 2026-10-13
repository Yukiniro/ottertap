import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: '小獭 OtterTap · 网页媒体控制',
    description: '在弹出面板或页面浮动控制器中调节播放、进度、音量和倍速。',
    permissions: ['storage'],
    host_permissions: ['http://*/*', 'https://*/*'],
    icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' }
  }
});
