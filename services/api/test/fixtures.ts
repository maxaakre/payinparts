import { calculatePlan, kr, RULES_VERSION, type DecisionStatus } from '@payinparts/core';

export function orderItem(overrides: Record<string, unknown> = {}) {
  const option = (overrides.option as 'split_3' | 'pay_now' | undefined) ?? 'split_3';
  return {
    PK: 'ORDER#o1',
    SK: 'META',
    id: 'o1',
    productId: 'headphones',
    productName: { sv: 'Trådlösa hörlurar', en: 'Wireless headphones' },
    option,
    plan: calculatePlan(kr(2490), option),
    status: 'draft',
    createdAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

export function decisionItem(status: DecisionStatus) {
  return {
    PK: 'ORDER#o1',
    SK: 'DECISION',
    status,
    limitOre: kr(19000),
    maxMonthlyCostOre: kr(3800),
    alternatives: [],
    rulesVersion: RULES_VERSION,
    personaId: 'anna',
    monthlyIncomeOre: kr(38000),
    decidedAt: '2026-10-01T10:01:00.000Z',
  };
}
