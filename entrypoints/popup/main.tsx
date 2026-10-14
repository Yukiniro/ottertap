import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { MediaPanel } from '../../components/media-panel';
import { ThemeProvider } from '../../components/theme';
import { extensionStore } from '../../lib/extension-store';
import { createExtensionClient } from '../../lib/extension-client';
import '../../assets/style.css';

document.body.className = 'popup-body';
async function main() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const client = createExtensionClient(tab?.id);
  createRoot(document.getElementById('root')!).render(<ThemeProvider store={extensionStore}><MediaPanel client={client} openSettings={() => void browser.runtime.openOptionsPage()} /></ThemeProvider>);
}
void main().catch(() => { document.getElementById('root')!.textContent = '无法读取当前页面，请重新打开小獭。'; });
