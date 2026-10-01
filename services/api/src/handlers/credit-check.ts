import { MetricUnit } from '@aws-lambda-powertools/metrics';
import {
  CreditCheckRequest,
  decideCredit,
  findPersona,
  kr,
  needsCreditCheck,
  type StoredDecision,
} from '@payinparts/core';
import { putDecision } from '../db';
import { requireOrderMeta } from '../require-order';
import { HttpError, httpHandler, logger, metrics, ok, parseBody, pathId } from '../http';

export const handler = httpHandler(async (event) => {
  const id = pathId(event);
  const input = parseBody(event, CreditCheckRequest);
  const persona = findPersona(input.personaId);
  if (!persona) throw new HttpError(400, 'VALIDATION_ERROR', 'Unknown test customer');

  const order = await requireOrderMeta(id);
  if (order.status === 'confirmed') throw new HttpError(409, 'CONFLICT', 'Order is already confirmed');
  if (!needsCreditCheck(order.option)) {
    throw new HttpError(409, 'CONFLICT', 'Pay now does not need a credit check');
  }

  const decision: StoredDecision = {
    ...decideCredit({
      purchaseOre: order.plan.purchaseOre,
      option: order.option,
      persona,
      monthlyIncomeOre: kr(input.monthlyIncomeKr),
    }),
    decidedAt: new Date().toISOString(),
  };
  await putDecision(id, decision);

  const single = metrics.singleMetric();
  single.addDimension('Result', decision.status);
  single.addMetric('CreditDecision', MetricUnit.Count, 1);
  logger.info('Credit decision', { orderId: id, status: decision.status, rulesVersion: decision.rulesVersion });

  return ok(decision);
});
