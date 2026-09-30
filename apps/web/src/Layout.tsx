import { Link, Outlet } from 'react-router';
import { DemoBanner } from './components/DemoBanner';
import { useI18n } from './i18n';

export function Layout() {
  const { t, lang, setLang } = useI18n();
  return (
    <>
      <DemoBanner />
      <header className="top">
        <Link to="/" className="logo">
          {t('appName')}
        </Link>
        <button className="link" onClick={() => setLang(lang === 'sv' ? 'en' : 'sv')}>
          {t('switchLanguage')}
        </button>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
