import { Injectable } from '@nestjs/common';
import {
  defaultLlmCostRates,
  estimateLlmCostUsd,
  parseLlmCostRate,
} from '@nih/shared';
import type { LlmProvider, LlmTelemetrySummary } from '@nih/shared';

import { PrismaService } from '../database/prisma.service';

type ProviderKey = 'ANTHROPIC' | 'MOCK' | 'OPENAI';

const providerFromDb = {
  ANTHROPIC: 'anthropic',
  MOCK: 'mock',
  OPENAI: 'openai',
} as const satisfies Record<ProviderKey, LlmProvider>;

@Injectable()
export class TelemetryService {
  constructor(private readonly prisma: PrismaService) {}

  async llm(userId: string): Promise<{ llm: LlmTelemetrySummary }> {
    const calls = await this.prisma.llmCall.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        cacheHit: true,
        createdAt: true,
        completionTokens: true,
        estimatedCostUsd: true,
        model: true,
        provider: true,
        promptTokens: true,
        status: true,
        task: true,
        totalTokens: true,
      },
      where: {
        userId,
      },
    });

    return {
      llm: {
        byProvider: summarizeByProvider(calls),
        byTask: summarizeByTask(calls),
        cacheHits: calls.filter((call) => call.cacheHit).length,
        estimatedCostUsd: sumCost(calls),
        recentCalls: calls.slice(0, 10).map((call) => ({
          cacheHit: call.cacheHit,
          createdAt: call.createdAt.toISOString(),
          estimatedCostUsd: callCostUsd(call),
          model: call.model,
          provider: providerFromDb[call.provider],
          status: call.status,
          task: call.task,
          totalTokens: call.totalTokens,
        })),
        totalCalls: calls.length,
        totalTokens: calls.reduce((sum, call) => sum + call.totalTokens, 0),
      },
    };
  }
}

function summarizeByProvider(
  calls: {
    estimatedCostUsd: unknown;
    completionTokens: number;
    provider: ProviderKey;
    promptTokens: number;
    totalTokens: number;
  }[],
): LlmTelemetrySummary['byProvider'] {
  const summaries = new Map<LlmProvider, {
    callCount: number;
    estimatedCostUsd: number;
    provider: LlmProvider;
    totalTokens: number;
  }>();

  for (const call of calls) {
    const provider = providerFromDb[call.provider];
    const current = summaries.get(provider) ?? {
      callCount: 0,
      estimatedCostUsd: 0,
      provider,
      totalTokens: 0,
    };
    current.callCount += 1;
    current.estimatedCostUsd += callCostUsd(call);
    current.totalTokens += call.totalTokens;
    summaries.set(provider, current);
  }

  return [...summaries.values()]
    .map((summary) => ({
      ...summary,
      estimatedCostUsd: roundUsd(summary.estimatedCostUsd),
    }))
    .sort((left, right) => right.totalTokens - left.totalTokens);
}

function summarizeByTask(
  calls: {
    estimatedCostUsd: unknown;
    completionTokens: number;
    promptTokens: number;
    task: string;
    totalTokens: number;
  }[],
): LlmTelemetrySummary['byTask'] {
  const summaries = new Map<string, {
    callCount: number;
    estimatedCostUsd: number;
    task: string;
    totalTokens: number;
  }>();

  for (const call of calls) {
    const current = summaries.get(call.task) ?? {
      callCount: 0,
      estimatedCostUsd: 0,
      task: call.task,
      totalTokens: 0,
    };
    current.callCount += 1;
    current.estimatedCostUsd += callCostUsd(call);
    current.totalTokens += call.totalTokens;
    summaries.set(call.task, current);
  }

  return [...summaries.values()]
    .map((summary) => ({
      ...summary,
      estimatedCostUsd: roundUsd(summary.estimatedCostUsd),
    }))
    .sort((left, right) => right.totalTokens - left.totalTokens);
}

function sumCost(
  calls: {
    completionTokens: number;
    estimatedCostUsd: unknown;
    promptTokens: number;
  }[],
): number {
  return roundUsd(calls.reduce((sum, call) => sum + callCostUsd(call), 0));
}

function callCostUsd(call: {
  completionTokens: number;
  estimatedCostUsd: unknown;
  promptTokens: number;
}): number {
  const storedCost = Number(call.estimatedCostUsd ?? 0);
  if (storedCost > 0) {
    return storedCost;
  }

  return estimateLlmCostUsd(
    {
      completionTokens: call.completionTokens,
      promptTokens: call.promptTokens,
    },
    llmCostRatesFromEnv(),
  );
}

function llmCostRatesFromEnv() {
  return {
    completionUsdPerMillionTokens: parseLlmCostRate(
      process.env.LLM_COMPLETION_COST_USD_PER_1M_TOKENS,
      defaultLlmCostRates.completionUsdPerMillionTokens,
    ),
    promptUsdPerMillionTokens: parseLlmCostRate(
      process.env.LLM_PROMPT_COST_USD_PER_1M_TOKENS,
      defaultLlmCostRates.promptUsdPerMillionTokens,
    ),
  };
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
