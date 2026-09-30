import { describe, expect, it } from 'vitest';
import { creditLimit, decideCredit, findPersona, PERSONAS, RULES_VERSION } from '../src/credit';
import { kr } from '../src/money';

const persona = (id: string) => findPersona(id)!;

describe('creditLimit', () => {
  it('is half the monthly income', () => {
    expect(creditLimit(kr(38000))).toBe(kr(19000));
  });

  it('is capped at 50 000 kr', () => {
    expect(creditLimit(kr(150000))).toBe(kr(50000));
  });
});

describe('decideCredit', () => {
  it('approves when amount and monthly cost fit', () => {
    const d = decideCredit({ purchaseOre: kr(2490), option: 'split_3', persona: persona('anna'), monthlyIncomeOre: kr(38000) });
    expect(d.status).toBe('approved');
    expect(d.alternatives).toEqual([]);
    expect(d.rulesVersion).toBe(RULES_VERSION);
    expect(d.maxMonthlyCostOre).toBe(kr(3800));
  });

  it('suggests longer plans when the monthly cost is too high', () => {
    // invoice: 8 990 kr + 29 kr in one payment > 10 % of 38 000 kr
    const d = decideCredit({ purchaseOre: kr(8990), option: 'invoice_30', persona: persona('anna'), monthlyIncomeOre: kr(38000) });
    expect(d.status).toBe('approved_lower_limit');
    expect(d.alternatives).toEqual(['split_3', 'split_6', 'split_12']);
  });

  it('offers a lower limit when the amount is above the limit', () => {
    const d = decideCredit({ purchaseOre: kr(14990), option: 'invoice_30', persona: persona('erik'), monthlyIncomeOre: kr(22000) });
    expect(d.status).toBe('approved_lower_limit');
    expect(d.alternatives).toEqual([]);
    expect(d.limitOre).toBe(kr(11000));
  });

  it('declines the always-decline persona', () => {
    const d = decideCredit({ purchaseOre: kr(2490), option: 'split_3', persona: persona('olle'), monthlyIncomeOre: kr(30000) });
    expect(d.status).toBe('declined');
  });

  it('declines zero income', () => {
    const d = decideCredit({ purchaseOre: kr(2490), option: 'split_12', persona: persona('anna'), monthlyIncomeOre: 0 });
    expect(d.status).toBe('declined');
  });

  it('declines when the limit is too small to offer anything', () => {
    const d = decideCredit({ purchaseOre: kr(2490), option: 'split_12', persona: persona('anna'), monthlyIncomeOre: kr(1500) });
    expect(d.status).toBe('declined');
  });
});

describe('PERSONAS', () => {
  it('has exactly one always-decline persona', () => {
    expect(PERSONAS.filter((p) => p.alwaysDecline)).toHaveLength(1);
  });
});
