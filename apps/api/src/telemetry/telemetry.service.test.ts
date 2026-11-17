import assert from 'node:assert/strict';
import test from 'node:test';

import type { PrismaService } from '../database/prisma.service';
import { TelemetryService } from './telemetry.service';

interface LlmFindManyInput {
  where: {
    userId: string;
  };
}

test('aggregates LLM telemetry by provider and task inside the user scope', async () => {
  const state: {
    findManyInput?: LlmFindManyInput;
  } = {};
  const service = new TelemetryService({
    llmCall: {
      findMany: async (input: LlmFindManyInput) => {
        state.findManyInput = input;
        return [
          llmCall({
            cacheHit: false,
            provider: 'MOCK',
            task: 'article-analysis',
            totalTokens: 100,
          }),
          llmCall({
            cacheHit: true,
            provider: 'MOCK',
            task: 'article-analysis',
            totalTokens: 0,
          }),
          llmCall({
            cacheHit: false,
            provider: 'OPENAI',
            task: 'digest-generation',
            totalTokens: 50,
          }),
        ];
      },
    },
  } as unknown as PrismaService);

  const result = await service.llm('user-1');

  assert.deepEqual(state.findManyInput?.where, {
    userId: 'user-1',
  });
  assert.equal(result.llm.totalCalls, 3);
  assert.equal(result.llm.totalTokens, 150);
  assert.equal(result.llm.cacheHits, 1);
  assert.equal(result.llm.estimatedCostUsd > 0, true);
  assert.deepEqual(result.llm.byTask.map((item) => item.task), [
    'article-analysis',
    'digest-generation',
  ]);
  assert.deepEqual(result.llm.byProvider.map((item) => item.provider), [
    'mock',
    'openai',
  ]);
});

function llmCall(overrides: {
  cacheHit: boolean;
  provider: 'ANTHROPIC' | 'MOCK' | 'OPENAI';
  task: string;
  totalTokens: number;
}) {
  return {
    cacheHit: overrides.cacheHit,
    completionTokens: Math.round(overrides.totalTokens * 0.25),
    createdAt: new Date('2026-05-30T00:00:00.000Z'),
    estimatedCostUsd: null,
    model: 'test-model',
    promptTokens: Math.round(overrides.totalTokens * 0.75),
    provider: overrides.provider,
    status: 'completed',
    task: overrides.task,
    totalTokens: overrides.totalTokens,
  };
}
