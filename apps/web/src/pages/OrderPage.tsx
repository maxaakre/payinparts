import { needsCreditCheck, type Order, type PaymentOption } from '@payinparts/core';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, ApiRequestError } from '../api';
import { CreditCheckForm } from '../components/CreditCheckForm';
import { DecisionMessage } from '../components/DecisionMessage';
import { ExplainPanel } from '../components/ExplainPanel';
import { PlanTable } from '../components/PlanTable';
import { useI18n } from '../i18n';

function withoutDecision(order: Order): Order {
  const copy = { ...order };
  delete copy.decision;
  return copy;
}

type LoadState = 'loading' | 'ready' | 'notfound' | 'error';

export function OrderPage() {
  const { id = '' } = useParams();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setState('loading');
    api
      .getOrder(id)
      .then((o) => {
        setOrder(o);
        setState('ready');
      })
      .catch((err: unknown) => setState(err instanceof ApiRequestError && err.status === 404 ? 'notfound' : 'error'));
  }, [id]);

  if (state === 'loading') return <p>{t('loading')}</p>;
  if (state === 'notfound') return <p className="error" role="alert">{t('orderNotFound')}</p>;
  if (state === 'error' || !order) return <p className="error" role="alert">{t('errorGeneric')}</p>;

  if (order.status === 'confirmed') {
    return (
      <section>
        <h1>✅ {t('confirmedTitle')}</h1>
        <p>{t('confirmedText')}</p>
        <p>
          {t('orderNumber')}: <code>{order.id}</code>
        </p>
        <PlanTable plan={order.plan} />
        <Link to="/">{t('backToShop')}</Link>
      </section>
    );
  }

  // Runs one API action with shared busy/error handling
  async function run<T>(action: () => Promise<T>, onDone: (value: T) => void) {
    setBusy(true);
    setActionError(null);
    try {
      onDone(await action());
    } catch {
      setActionError(t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  const current = order;
  const switchTo = (option: PaymentOption) =>
    run(() => api.createOrder({ productId: current.productId, option }), (o) => navigate(`/orders/${o.id}`));
  const canConfirm = !needsCreditCheck(order.option) || order.decision?.status === 'approved';

  return (
    <section>
      <h1>{order.productName[lang]}</h1>
      <p className="muted">{t(`option_${order.option}`)}</p>
      <PlanTable plan={order.plan} />

      {needsCreditCheck(order.option) && (
        <>
          <CreditCheckForm
            disabled={busy}
            onChange={() => setOrder((o) => (o?.decision ? withoutDecision(o) : o))}
            onSubmit={(input) => run(() => api.creditCheck(current.id, input), (decision) => setOrder({ ...current, decision }))}
          />
          {order.decision && <DecisionMessage decision={order.decision} onSwitch={switchTo} />}
        </>
      )}

      {canConfirm && (
        <button disabled={busy} onClick={() => run(() => api.confirm(current.id), setOrder)}>
          {t('confirm')}
        </button>
      )}
      {actionError && <p className="error" role="alert">{actionError}</p>}

      <ExplainPanel key={order.id} orderId={order.id} />
    </section>
  );
}
