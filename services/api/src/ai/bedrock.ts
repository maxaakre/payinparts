import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { tracer } from '../http';

const client = tracer.captureAWSv3Client(new BedrockRuntimeClient({}));

export interface ModelAnswer {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export async function askModel(system: string, userMessage: string): Promise<ModelAnswer> {
  const modelId = process.env.MODEL_ID;
  if (!modelId) throw new Error('MODEL_ID is not set');

  const res = await client.send(
    new ConverseCommand({
      modelId,
      system: [{ text: system }],
      messages: [{ role: 'user', content: [{ text: userMessage }] }],
      inferenceConfig: { maxTokens: 400, temperature: 0.3 },
    }),
    { abortSignal: AbortSignal.timeout(15_000) },
  );

  const text = (res.output?.message?.content ?? []).map((c) => c.text ?? '').join('').trim();
  if (!text) throw new Error('Empty model response');
  return { text, inputTokens: res.usage?.inputTokens ?? 0, outputTokens: res.usage?.outputTokens ?? 0 };
}
