import { kr, type Ore } from './money';
import { calculatePlan, CREDIT_OPTIONS, type CreditOption } from './plans';

export const RULES_VERSION = 'rules-2026-09-v1';
export const MAX_CREDIT_LIMIT_ORE = kr(50_000);
/** Below this limit we do not offer a lower amount; we decline. */
export const MIN_OFFER_ORE = kr(1_000);

export interface Persona {
  id: string;
  name: string;
  defaultMonthlyIncomeKr: number;
  alwaysDecline: boolean;
}

/** Fake test customers. There is no free-text personal number anywhere. */
export const PERSONAS: readonly Persona[] = [
  { id: 'anna', name: 'Anna', defaultMonthlyIncomeKr: 38_000, alwaysDecline: false },
  { id: 'erik', name: 'Erik', defaultMonthlyIncomeKr: 22_000, alwaysDecline: false },
  { id: 'sara', name: 'Sara', defaultMonthlyIncomeKr: 65_000, alwaysDecline: false },
  { id: 'olle', name: 'Olle', defaultMonthlyIncomeKr: 30_000, alwaysDecline: true },
];

export const findPersona = (id: string): Persona | undefined => PERSONAS.find((p) => p.id === id);

export type DecisionStatus = 'approved' | 'approved_lower_limit' | 'declined';

export interface CreditDecision {
  status: DecisionStatus;
  limitOre: Ore;
  maxMonthlyCostOre: Ore;
  /** Other options that would be approved (only for approved_lower_limit). */
  alternatives: CreditOption[];
  rulesVersion: string;
  personaId: string;
  monthlyIncomeOre: Ore;
}

export const creditLimit = (monthlyIncomeOre: Ore): Ore =>
  Math.min(Math.floor(monthlyIncomeOre * 0.5), MAX_CREDIT_LIMIT_ORE);

export function decideCredit(input: {
  purchaseOre: Ore;
  option: CreditOption;
  persona: Persona;
  monthlyIncomeOre: Ore;
}): CreditDecision {
  const { purchaseOre, option, persona, monthlyIncomeOre } = input;
  const limitOre = creditLimit(monthlyIncomeOre);
  const maxMonthlyCostOre = Math.floor(monthlyIncomeOre * 0.1);
  const base = { limitOre, maxMonthlyCostOre, rulesVersion: RULES_VERSION, personaId: persona.id, monthlyIncomeOre };

  if (persona.alwaysDecline || monthlyIncomeOre <= 0) {
    return { ...base, status: 'declined', alternatives: [] };
  }

  const passes = (o: CreditOption) =>
    purchaseOre <= limitOre && calculatePlan(purchaseOre, o).monthlyCostOre <= maxMonthlyCostOre;

  if (passes(option)) return { ...base, status: 'approved', alternatives: [] };

  const alternatives = CREDIT_OPTIONS.filter((o) => o !== option && passes(o));
  const canOfferLowerAmount = purchaseOre > limitOre && limitOre >= MIN_OFFER_ORE;
  if (alternatives.length > 0 || canOfferLowerAmount) {
    return { ...base, status: 'approved_lower_limit', alternatives };
  }
  return { ...base, status: 'declined', alternatives: [] };
}
