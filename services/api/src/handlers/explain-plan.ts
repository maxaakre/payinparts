import { MetricUnit } from '@aws-lambda-powertools/metrics';
import { calculatePlan, ExplainRequest, PAYMENT_OPTIONS, type ExplainResponse } from '@payinparts/core';
import { askModel, type ModelAnswer } from '../ai/bedrock';
import { buildSystemPrompt, buildUserMessage, MAX_AI_QUESTIONS, MAX_AI_QUESTIONS_PER_DAY } from '../ai/prompt';
import { incrementAiCount, incrementDailyAiCount } from '../db';
import { requireOrderMeta } from '../require-order';
import { HttpError, httpHandler, logger, metrics, ok, parseBody, pathId } from '../http';

export const handler = httpHandler(async (event) => {
  const id = pathId(event);
  const input = parseBody(event, ExplainRequest);

  const order = await requireOrderMeta(id);

  const count = await incrementAiCount(id, MAX_AI_QUESTIONS);
  if (count === undefined) {
    throw new HttpError(429, 'RATE_LIMITED', 'You have used all questions for this order.');
  }

  // Global spend cap, checked after the per-order limit so one abuser cannot burn the budget on a full order
  if ((await incrementDailyAiCount(MAX_AI_QUESTIONS_PER_DAY)) === undefined) {
    throw new HttpError(429, 'RATE_LIMITED', 'The AI helper has reached its daily limit. Please try again tomorrow.');
  }

  // The AI compares; it never calculates. We compute every alternative here.
  const alternatives = PAYMENT_OPTIONS.filter((o) => o !== order.option).map((o) =>
    calculatePlan(order.plan.purchaseOre, o),
  );

  let answer: ModelAnswer;
  try {
    answer = await askModel(
      buildSystemPrompt(input.language),
      buildUserMessage({ productName: order.productName[input.language], plan: order.plan, alternatives, question: input.question }),
    );
  } catch (err) {
    logger.error('Bedrock call failed', err as Error);
    throw new HttpError(503, 'AI_UNAVAILABLE', 'The helper is not available right now.');
  }

  metrics.addMetric('AiQuestions', MetricUnit.Count, 1);
  metrics.addMetric('AiInputTokens', MetricUnit.Count, answer.inputTokens);
  metrics.addMetric('AiOutputTokens', MetricUnit.Count, answer.outputTokens);

  const body: ExplainResponse = { answer: answer.text, questionsLeft: MAX_AI_QUESTIONS - count };
  return ok(body);
});
