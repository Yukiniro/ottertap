import { i18n } from '#i18n';
import { createRoot } from 'react-dom/client';
import { SettingsPage } from '../../components/settings-page';
import { ThemeProvider } from '../../components/theme';
import { extensionStore } from '../../lib/extension-store';
import '../../assets/style.css';

document.documentElement.lang = i18n.t('locale');
document.title = i18n.t('optionsTitle');
createRoot(document.getElementById('root')!).render(<ThemeProvider store={extensionStore}><SettingsPage /></ThemeProvider>);
