import { describe, expect, it } from 'vitest';
import { kr } from '../src/money';
import { calculatePlan, PAYMENT_OPTIONS, needsCreditCheck } from '../src/plans';

const sum = (xs: { amountOre: number }[]) => xs.reduce((s, x) => s + x.amountOre, 0);

describe('calculatePlan', () => {
  it('pay now costs exactly the price', () => {
    const plan = calculatePlan(kr(2490), 'pay_now');
    expect(plan.months).toBe(0);
    expect(plan.monthlyCostOre).toBe(0);
    expect(plan.totalCostOre).toBe(kr(2490));
    expect(plan.payments).toEqual([{ month: 0, amountOre: kr(2490) }]);
    expect(plan.effectiveAnnualRate).toBe(0);
  });

  it('invoice in 30 days adds one 29 kr fee', () => {
    const plan = calculatePlan(kr(2490), 'invoice_30');
    expect(plan.payments).toEqual([{ month: 1, amountOre: kr(2519) }]);
    expect(plan.totalFeesOre).toBe(kr(29));
    expect(plan.totalCostOre).toBe(kr(2519));
    // 29/2490 per month ≈ 14.9 % per year
    expect(plan.effectiveAnnualRate).toBeCloseTo(0.149, 2);
  });

  it('split into 3 months is interest free with a monthly fee', () => {
    const plan = calculatePlan(kr(3000), 'split_3');
    expect(plan.monthlyCostOre).toBe(kr(1029));
    expect(plan.totalInterestOre).toBe(0);
    expect(plan.totalFeesOre).toBe(kr(87));
    expect(plan.totalCostOre).toBe(kr(3087));
    expect(plan.payments.map((p) => p.amountOre)).toEqual([kr(1029), kr(1029), kr(1029)]);
  });

  it('puts rounding leftovers in the last payment', () => {
    const plan = calculatePlan(kr(2990), 'split_3');
    expect(plan.payments.map((p) => p.amountOre)).toEqual([102567, 102567, 102566]);
    expect(plan.totalCostOre).toBe(kr(2990) + kr(87));
  });

  it('split into 12 months uses the annuity formula and charges the setup fee once', () => {
    const plan = calculatePlan(kr(12000), 'split_12');
    // annuity for 12 000 kr at 14.95 %/12 ≈ 1 082.82 kr + 29 kr fee
    expect(Math.abs(plan.monthlyCostOre - 111182)).toBeLessThanOrEqual(10);
    expect(plan.payments[0]!.amountOre - plan.payments[1]!.amountOre).toBe(kr(195));
    expect(plan.totalInterestOre).toBeGreaterThan(0);
    expect(plan.effectiveAnnualRate).toBeGreaterThan(0.1495);
    expect(plan.effectiveAnnualRate).toBeLessThan(0.4);
  });

  it('keeps totals consistent for every option', () => {
    for (const option of PAYMENT_OPTIONS) {
      for (const price of [kr(2490), kr(8990), kr(14990), kr(24990)]) {
        const plan = calculatePlan(price, option);
        expect(plan.totalCostOre).toBe(sum(plan.payments));
        expect(plan.totalCostOre).toBe(price + plan.totalInterestOre + plan.totalFeesOre);
        expect(plan.payments.every((p) => Number.isInteger(p.amountOre))).toBe(true);
      }
    }
  });

  it('rejects zero or fractional amounts', () => {
    expect(() => calculatePlan(0, 'split_3')).toThrow(RangeError);
    expect(() => calculatePlan(100.5, 'split_3')).toThrow(RangeError);
  });
});

describe('needsCreditCheck', () => {
  it('is false only for pay now', () => {
    expect(needsCreditCheck('pay_now')).toBe(false);
    expect(needsCreditCheck('invoice_30')).toBe(true);
    expect(needsCreditCheck('split_12')).toBe(true);
  });
});
