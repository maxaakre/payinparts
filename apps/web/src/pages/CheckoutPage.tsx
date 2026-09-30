import { calculatePlan, findProduct, formatKr, PAYMENT_OPTIONS, type PaymentOption } from '@payinparts/core';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { api } from '../api';
import { PlanTable } from '../components/PlanTable';
import { useI18n } from '../i18n';

export function CheckoutPage() {
  const { productId = '' } = useParams();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [option, setOption] = useState<PaymentOption>('split_3');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const product = findProduct(productId);
  if (!product) return <p className="error" role="alert">{t('productNotFound')}</p>;

  // Same code as the backend, so the preview matches the saved plan
  const priceLabel = (o: PaymentOption) => {
    const plan = calculatePlan(product.priceOre, o);
    return o === 'pay_now' || o === 'invoice_30'
      ? formatKr(plan.totalCostOre, lang)
      : `${formatKr(plan.monthlyCostOre, lang)}${t('perMonth')}`;
  };

  async function onContinue() {
    setBusy(true);
    setError(null);
    try {
      const order = await api.createOrder({ productId, option });
      navigate(`/orders/${order.id}`);
    } catch {
      setError(t('errorGeneric'));
      setBusy(false);
    }
  }

  return (
    <section>
      <h1>{t('checkoutTitle')}</h1>
      <p>
        {product.emoji} <strong>{product.name[lang]}</strong> — {formatKr(product.priceOre, lang)}
      </p>
      <fieldset className="options">
        {PAYMENT_OPTIONS.map((o) => (
          <label key={o} className={o === option ? 'option selected' : 'option'}>
            <input type="radio" name="option" value={o} checked={o === option} onChange={() => setOption(o)} />
            <span>{t(`option_${o}`)}</span>
            <span className="muted">{priceLabel(o)}</span>
          </label>
        ))}
      </fieldset>
      <PlanTable plan={calculatePlan(product.priceOre, option)} />
      {error && <p className="error" role="alert">{error}</p>}
      <button onClick={onContinue} disabled={busy}>
        {t('continue')}
      </button>
    </section>
  );
}
