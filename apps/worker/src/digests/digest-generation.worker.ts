import type { PrismaClient } from '@nih/database';
import {
  defaultLlmCostRates,
  estimateLlmCostUsd,
  isLowSignalEntityName,
  parseLlmCostRate,
  queueNames,
} from '@nih/shared';
import type { DigestGenerationJobData } from '@nih/shared';
import type { Job } from 'bullmq';
import { Worker } from 'bullmq';
import type IORedis from 'ioredis';

import type { LlmAdapter, LlmUsage } from '../llm/types';
import { logError, logInfo } from '../observability/logger';

interface DigestGenerationWorkerDeps {
  connection: IORedis;
  llmAdapter: LlmAdapter;
  prisma: PrismaClient;
}

const importanceFromDb = {
  HIGH: 'high',
  JUNK: 'junk',
  NORMAL: 'normal',
} as const;

const providerToDb = {
  anthropic: 'ANTHROPIC',
  mock: 'MOCK',
  openai: 'OPENAI',
} as const;

export function createDigestGenerationWorker(
  deps: DigestGenerationWorkerDeps,
): Worker<DigestGenerationJobData> {
  return new Worker<DigestGenerationJobData>(
    queueNames.digestGeneration,
    async (job) => generateDigest(job, deps),
    {
      concurrency: Number(process.env.DIGEST_GENERATION_CONCURRENCY || 1),
      connection: deps.connection,
    },
  );
}

async function generateDigest(
  job: Job<DigestGenerationJobData>,
  deps: DigestGenerationWorkerDeps,
): Promise<void> {
  const startedAt = new Date();
  const jobLog = await deps.prisma.queueJobLog.create({
    data: {
      jobId: job.id,
      jobName: job.name,
      payload: toJsonInput(job.data),
      queueName: queueNames.digestGeneration,
      startedAt,
      status: 'processing',
      userId: job.data.userId,
    },
  });

  try {
    const periodStart = new Date(job.data.periodStart);
    const periodEnd = new Date(job.data.periodEnd);
    const categoryIds = uniqueIds(job.data.categoryIds);
    const entityIds = uniqueIds(job.data.entityIds);
    const articles = await deps.prisma.article.findMany({
      include: {
        categories: {
          include: {
            category: true,
          },
        },
        entities: {
          include: {
            entity: true,
          },
        },
      },
      orderBy: {
        publishedAt: 'desc',
      },
      where: {
        ...digestScopeWhere(categoryIds, entityIds),
        publishedAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        status: {
          in: ['PROCESSED', 'PROCESSING', 'QUEUED'],
        },
        userId: job.data.userId,
      },
    });

    const topCategories = countByName(
      articles.flatMap((article) =>
        article.categories.map((category) => category.category.name),
      ),
    );
    const topEntities = countByName(
      articles.flatMap((article) =>
        article.entities
          .map((entity) => entity.entity.name)
          .filter((name) => !isLowSignalEntityName(name)),
      ),
    );
    const highImportanceCount = articles.filter(
      (article) => article.importance === 'HIGH',
    ).length;
    const digestSummary = await deps.llmAdapter.summarizeDigest({
      articleCount: articles.length,
      highImportanceCount,
      keyArticles: articles.slice(0, 5).map((article) => ({
        importance: article.importance
          ? importanceFromDb[article.importance]
          : null,
        summary: article.summary,
        title: article.title,
      })),
      periodLabel: job.data.periodLabel,
      scopeLabel: job.data.scopeLabel,
      topCategories,
      topEntities,
    });

    await recordLlmCall(deps.prisma, {
      cacheHit: false,
      durationMs: digestSummary.durationMs,
      model: digestSummary.model,
      provider: providerToDb[digestSummary.provider],
      status: 'completed',
      task: 'digest-generation',
      usage: digestSummary.usage,
      userId: job.data.userId,
    });

    await deps.prisma.digest.deleteMany({
      where: {
        periodEnd,
        periodStart,
        scopeHash: job.data.scopeHash,
        userId: job.data.userId,
      },
    });
    await deps.prisma.digest.create({
      data: {
        payload: toJsonInput({
          articleCount: articles.length,
          articleIds: articles.map((article) => article.id),
          categoryIds,
          highImportanceCount,
          entityIds,
          keyArticles: articles.slice(0, 5).map((article) => ({
            id: article.id,
            importance: article.importance,
            publishedAt: article.publishedAt?.toISOString(),
            summary: article.summary,
            title: article.title,
          })),
          periodLabel: job.data.periodLabel,
          scopeHash: job.data.scopeHash,
          scopeLabel: job.data.scopeLabel,
          topCategories,
          topEntities,
        }),
        periodEnd,
        periodStart,
        scopeHash: job.data.scopeHash,
        scopeLabel: job.data.scopeLabel,
        summary: digestSummary.result.summary,
        title: `${titlePrefix(job.data.periodLabel)} ${formatDate(periodStart)} - ${formatDate(periodEnd)}`,
        userId: job.data.userId,
      },
    });

    await finishJobLog(deps.prisma, jobLog.id, 'completed');
    logInfo('digest_generation.completed', {
      articleCount: articles.length,
      userId: job.data.userId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishJobLog(deps.prisma, jobLog.id, 'failed', message);
    logError('digest_generation.failed', {
      error: message,
      userId: job.data.userId,
    });
    throw error;
  }
}

interface CountedItem {
  count: number;
  name: string;
}

function countByName(names: string[]): CountedItem[] {
  const counts = new Map<string, number>();

  for (const name of names) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, count]) => ({
      count,
      name,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 10);
}

async function finishJobLog(
  prisma: PrismaClient,
  id: string,
  status: string,
  error?: string,
): Promise<void> {
  await prisma.queueJobLog.update({
    data: {
      error,
      finishedAt: new Date(),
      status,
    },
    where: {
      id,
    },
  });
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function titlePrefix(periodLabel: string): string {
  if (periodLabel === 'day') {
    return 'Daily digest';
  }
  if (periodLabel === 'month') {
    return 'Monthly digest';
  }
  if (periodLabel === 'custom') {
    return 'Custom digest';
  }

  return 'Weekly digest';
}

async function recordLlmCall(
  prisma: PrismaClient,
  input: {
    cacheHit: boolean;
    durationMs: number;
    model: string;
    provider: 'ANTHROPIC' | 'MOCK' | 'OPENAI';
    status: string;
    task: string;
    usage: LlmUsage;
    userId: string;
  },
): Promise<void> {
  await prisma.llmCall.create({
    data: {
      cacheHit: input.cacheHit,
      completionTokens: input.usage.completionTokens,
      durationMs: input.durationMs,
      estimatedCostUsd: estimateLlmCostUsd(input.usage, llmCostRatesFromEnv()),
      model: input.model,
      promptTokens: input.usage.promptTokens,
      provider: input.provider,
      status: input.status,
      task: input.task,
      totalTokens: input.usage.totalTokens,
      userId: input.userId,
    },
  });
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

function uniqueIds(values?: string[]): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function digestScopeWhere(categoryIds: string[], entityIds: string[]) {
  const categoryClause = categoryIds.length
    ? {
        categories: {
          some: {
            categoryId: {
              in: categoryIds,
            },
          },
        },
      }
    : undefined;
  const entityClause = entityIds.length
    ? {
        entities: {
          some: {
            entityId: {
              in: entityIds,
            },
          },
        },
      }
    : undefined;

  if (categoryClause && entityClause) {
    return {
      OR: [categoryClause, entityClause],
    };
  }

  return {
    ...categoryClause,
    ...entityClause,
  };
}

function toJsonInput(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}
