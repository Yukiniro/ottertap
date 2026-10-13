import { createRoot } from 'react-dom/client';
import { SettingsPage } from '../../components/settings-page';
import { ThemeProvider } from '../../components/theme';
import { extensionStore } from '../../lib/extension-store';
import '../../assets/style.css';

createRoot(document.getElementById('root')!).render(<ThemeProvider store={extensionStore}><SettingsPage store={extensionStore} /></ThemeProvider>);
