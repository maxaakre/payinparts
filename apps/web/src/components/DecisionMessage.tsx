import { formatKr, type PaymentOption, type StoredDecision } from '@payinparts/core';
import { useI18n } from '../i18n';

export function DecisionMessage({
  decision,
  onSwitch,
}: {
  decision: StoredDecision;
  onSwitch: (option: PaymentOption) => void;
}) {
  const { t, lang } = useI18n();

  if (decision.status === 'approved') {
    return <p className="notice ok" role="status">{t('approved')}</p>;
  }

  const payNow = (
    <button className="secondary" onClick={() => onSwitch('pay_now')}>
      {t('switchToPayNow')}
    </button>
  );

  if (decision.status === 'declined') {
    return (
      <div className="notice calm" role="status">
        <p>{t('declined')}</p>
        {payNow}
      </div>
    );
  }

  return (
    <div className="notice calm" role="status">
      <p>{t('approvedLowerLimit')}</p>
      {decision.alternatives.length > 0 ? (
        <div className="row">
          {decision.alternatives.map((o) => (
            <button key={o} className="secondary" onClick={() => onSwitch(o)}>
              {t('tryOption', { option: t(`option_${o}`) })}
            </button>
          ))}
        </div>
      ) : (
        <p>{t('maxAmount', { amount: formatKr(decision.limitOre, lang) })}</p>
      )}
      {payNow}
    </div>
  );
}
