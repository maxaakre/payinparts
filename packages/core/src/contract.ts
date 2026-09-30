import { z } from 'zod';
import type { CreditDecision } from './credit';
import type { Lang } from './money';
import { PAYMENT_OPTIONS, type PaymentOption, type PaymentPlan } from './plans';

export const CreateOrderRequest = z.strictObject({
  productId: z.string().min(1).max(50),
  option: z.enum(PAYMENT_OPTIONS),
});
export type CreateOrderInput = z.infer<typeof CreateOrderRequest>;

export const CreditCheckRequest = z.strictObject({
  personaId: z.string().min(1).max(50),
  monthlyIncomeKr: z.number().int().min(0).max(200_000),
});
export type CreditCheckInput = z.infer<typeof CreditCheckRequest>;

export const ExplainRequest = z.strictObject({
  question: z.string().trim().min(1).max(500),
  language: z.enum(['sv', 'en']),
});
export type ExplainInput = z.infer<typeof ExplainRequest>;

export type OrderStatus = 'draft' | 'confirmed';

export interface StoredDecision extends CreditDecision {
  decidedAt: string;
}

export interface Order {
  id: string;
  productId: string;
  productName: Record<Lang, string>;
  option: PaymentOption;
  plan: PaymentPlan;
  status: OrderStatus;
  createdAt: string;
  confirmedAt?: string;
  decision?: StoredDecision;
}

export interface ExplainResponse {
  answer: string;
  questionsLeft: number;
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'AI_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export interface ApiError {
  error: { code: ErrorCode; message: string };
}
