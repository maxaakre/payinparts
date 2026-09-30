import { formatKr, type PaymentPlan } from '@payinparts/core';
import { useI18n } from '../i18n';

export function PlanTable({ plan }: { plan: PaymentPlan }) {
  const { t, lang } = useI18n();
  const money = (ore: number) => formatKr(ore, lang);
  const percent = (rate: number) => `${(rate * 100).toFixed(2).replace('.', lang === 'sv' ? ',' : '.')} %`;

  if (plan.option === 'pay_now') {
    return (
      <table className="plan">
        <tbody>
          <tr className="total">
            <th scope="row">{t('payNowTotal')}</th>
            <td>{money(plan.totalCostOre)}</td>
          </tr>
        </tbody>
      </table>
    );
  }

  const rows: [string, string][] = [
    [t('monthlyCost'), money(plan.monthlyCostOre)],
    [t('numberOfPayments'), String(plan.months)],
    [t('interestRate'), percent(plan.yearlyRate)],
    [t('setupFee'), money(plan.setupFeeOre)],
    [t('feePerPayment'), money(plan.monthlyFeeOre)],
    [t('totalInterest'), money(plan.totalInterestOre)],
    [t('totalFees'), money(plan.totalFeesOre)],
    [t('effectiveRate'), percent(plan.effectiveAnnualRate)],
  ];

  return (
    <table className="plan">
      <caption>{t('planTitle')}</caption>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            <td>{value}</td>
          </tr>
        ))}
        <tr className="total">
          <th scope="row">{t('totalCost')}</th>
          <td>{money(plan.totalCostOre)}</td>
        </tr>
      </tbody>
    </table>
  );
}
