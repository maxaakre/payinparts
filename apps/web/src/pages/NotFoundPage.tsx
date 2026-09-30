import { Link } from 'react-router';
import { useI18n } from '../i18n';

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <section>
      <p className="error" role="alert">{t('pageNotFound')}</p>
      <Link to="/">{t('backToShop')}</Link>
    </section>
  );
}
