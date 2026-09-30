import { kr, type Ore } from './money';

export const PAYMENT_OPTIONS = ['pay_now', 'invoice_30', 'split_3', 'split_6', 'split_12'] as const;
export type PaymentOption = (typeof PAYMENT_OPTIONS)[number];

export const CREDIT_OPTIONS = ['invoice_30', 'split_3', 'split_6', 'split_12'] as const;
export type CreditOption = (typeof CREDIT_OPTIONS)[number];

export const needsCreditCheck = (option: PaymentOption): option is CreditOption =>
  option !== 'pay_now';

interface Terms {
  months: number;
  yearlyRate: number;
  setupFeeOre: Ore;
  monthlyFeeOre: Ore;
}

export const TERMS: Record<PaymentOption, Terms> = {
  pay_now: { months: 0, yearlyRate: 0, setupFeeOre: 0, monthlyFeeOre: 0 },
  invoice_30: { months: 1, yearlyRate: 0, setupFeeOre: 0, monthlyFeeOre: kr(29) },
  split_3: { months: 3, yearlyRate: 0, setupFeeOre: 0, monthlyFeeOre: kr(29) },
  split_6: { months: 6, yearlyRate: 0.0995, setupFeeOre: kr(195), monthlyFeeOre: kr(29) },
  split_12: { months: 12, yearlyRate: 0.1495, setupFeeOre: kr(195), monthlyFeeOre: kr(29) },
};

export interface Payment {
  month: number;
  amountOre: Ore;
}

export interface PaymentPlan {
  option: PaymentOption;
  purchaseOre: Ore;
  months: number;
  yearlyRate: number;
  setupFeeOre: Ore;
  monthlyFeeOre: Ore;
  /** Typical monthly payment incl. monthly fee, excl. the one-time setup fee. */
  monthlyCostOre: Ore;
  totalInterestOre: Ore;
  totalFeesOre: Ore;
  totalCostOre: Ore;
  effectiveAnnualRate: number;
  payments: Payment[];
}

export function calculatePlan(purchaseOre: Ore, option: PaymentOption): PaymentPlan {
  if (!Number.isInteger(purchaseOre) || purchaseOre <= 0) {
    throw new RangeError('purchaseOre must be a positive integer');
  }
  const t = TERMS[option];
  const base = { option, purchaseOre, months: t.months, yearlyRate: t.yearlyRate, setupFeeOre: t.setupFeeOre, monthlyFeeOre: t.monthlyFeeOre };

  if (t.months === 0) {
    return { ...base, monthlyCostOre: 0, totalInterestOre: 0, totalFeesOre: 0, totalCostOre: purchaseOre, effectiveAnnualRate: 0, payments: [{ month: 0, amountOre: purchaseOre }] };
  }

  const r = t.yearlyRate / 12;
  // Annuity: equal monthly payment of principal + interest
  const annuity = r === 0 ? purchaseOre / t.months : (purchaseOre * r) / (1 - (1 + r) ** -t.months);
  const installment = Math.round(annuity);

  let balance = purchaseOre;
  let totalInterestOre = 0;
  const payments: Payment[] = [];
  for (let month = 1; month <= t.months; month++) {
    const interest = Math.round(balance * r);
    // Last month pays off whatever is left, so rounding never leaves a balance
    const principal = month === t.months ? balance : installment - interest;
    balance -= principal;
    totalInterestOre += interest;
    const fees = t.monthlyFeeOre + (month === 1 ? t.setupFeeOre : 0);
    payments.push({ month, amountOre: principal + interest + fees });
  }

  const totalFeesOre = t.setupFeeOre + t.monthlyFeeOre * t.months;
  return {
    ...base,
    monthlyCostOre: installment + t.monthlyFeeOre,
    totalInterestOre,
    totalFeesOre,
    totalCostOre: purchaseOre + totalInterestOre + totalFeesOre,
    effectiveAnnualRate: effectiveAnnualRate(purchaseOre, payments),
    payments,
  };
}

/** Yearly rate that makes the payments' present value equal the purchase (fees included). */
export function effectiveAnnualRate(purchaseOre: Ore, payments: readonly Payment[]): number {
  const total = payments.reduce((s, p) => s + p.amountOre, 0);
  if (total <= purchaseOre) return 0;

  const npv = (monthlyRate: number) =>
    payments.reduce((s, p) => s + p.amountOre / (1 + monthlyRate) ** p.month, 0) - purchaseOre;

  // npv falls as the rate rises; find where it crosses zero by bisection
  let lo = 0;
  let hi = 1;
  while (npv(hi) > 0 && hi < 1e6) hi *= 2;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (npv(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (1 + lo) ** 12 - 1;
}
