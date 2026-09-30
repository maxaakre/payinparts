import { useI18n } from '../i18n';

export function DemoBanner() {
  const { t } = useI18n();
  return (
    <div className="demo-banner" role="note">
      ⚠️ {t('demoBanner')}
    </div>
  );
}
