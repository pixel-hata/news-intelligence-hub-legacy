import type { PrismaClient } from '@nih/database';
import {
  defaultLlmCostRates,
  estimateLlmCostUsd,
  parseLlmCostRate,
  queueNames,
} from '@nih/shared';
import type { ProcessArticleJobData } from '@nih/shared';
import type { Job } from 'bullmq';
import { Worker } from 'bullmq';
import type IORedis from 'ioredis';
import { createHash } from 'node:crypto';

import { buildArticleAnalysisCacheKey } from '../llm/cache-key';
import { validateArticleAnalysisResult } from '../llm/schema';
import type {
  ArticleAnalysisInput,
  ArticleAnalysisResult,
  LlmAdapter,
  LlmUsage,
} from '../llm/types';
import { logError, logInfo } from '../observability/logger';
import {
  getArticlePreFilterConfig,
  preFilterArticle,
} from './article-pre-filter';
import { updateExactDuplicateGroup } from './article-duplicates';

type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$extends' | '$on' | '$transaction' | '$use'
>;

interface PrismaKnownError {
  code?: string;
}

interface ArticleProcessingWorkerDeps {
  connection: IORedis;
  llmAdapter: LlmAdapter;
  prisma: PrismaClient;
}

const importanceToDb = {
  high: 'HIGH',
  junk: 'JUNK',
  normal: 'NORMAL',
} as const;

const entityTypeToDb = {
  company: 'COMPANY',
  location: 'LOCATION',
  other: 'OTHER',
  person: 'PERSON',
  product: 'PRODUCT',
  technology: 'TECHNOLOGY',
  topic: 'TOPIC',
} as const;

const providerToDb = {
  anthropic: 'ANTHROPIC',
  mock: 'MOCK',
  openai: 'OPENAI',
} as const;

type DbEntityType = (typeof entityTypeToDb)[keyof typeof entityTypeToDb];

export function createArticleProcessingWorker(
  deps: ArticleProcessingWorkerDeps,
): Worker<ProcessArticleJobData> {
  const concurrency = Math.min(
    Number(process.env.ARTICLE_PROCESSING_CONCURRENCY || 3),
    Number(process.env.LLM_CONCURRENCY || 2),
  );

  return new Worker<ProcessArticleJobData>(
    queueNames.articleProcessing,
    async (job) => processArticle(job, deps),
    {
      concurrency,
      connection: deps.connection,
    },
  );
}

async function processArticle(
  job: Job<ProcessArticleJobData>,
  deps: ArticleProcessingWorkerDeps,
): Promise<void> {
  const startedAt = new Date();
  const jobLog = await deps.prisma.queueJobLog.create({
    data: {
      jobId: job.id,
      jobName: job.name,
      payload: toJsonInput(job.data),
      queueName: queueNames.articleProcessing,
      startedAt,
      status: 'processing',
      userId: job.data.userId,
    },
  });

  try {
    const article = await deps.prisma.article.findFirst({
      where: {
        id: job.data.articleId,
        userId: job.data.userId,
      },
    });

    if (!article) {
      await finishJobLog(deps.prisma, jobLog.id, 'skipped');
      return;
    }

    await deps.prisma.article.update({
      data: {
        status: 'PROCESSING',
      },
      where: {
        id: article.id,
      },
    });

    const filter = preFilterArticle(
      {
        sourceUrl: article.sourceUrl,
        textContent: article.textContent,
        title: article.title,
      },
      getArticlePreFilterConfig(),
    );

    if (!filter.accepted) {
      await deps.prisma.article.update({
        data: {
          filteredReason: filter.reason,
          importance: 'JUNK',
          processedAt: new Date(),
          status: 'FILTERED',
        },
        where: {
          id: article.id,
        },
      });
      await finishJobLog(deps.prisma, jobLog.id, 'filtered');
      logInfo('article_processing.article_filtered', {
        articleId: article.id,
        reason: filter.reason,
        userId: article.userId,
      });
      return;
    }

    const duplicateGroupId = await updateExactDuplicateGroup(
      deps.prisma,
      article.id,
      article.userId,
      article.textContentHash,
    );
    const analysisInput = await buildAnalysisInput(deps.prisma, {
      articleId: article.id,
      sourceUrl: article.sourceUrl,
      text: article.textContent ?? '',
      title: article.title,
      userId: article.userId,
    });
    const cacheKey = buildArticleAnalysisCacheKey(
      deps.llmAdapter,
      analysisInput,
      article.textContentHash,
    );
    const analysis = await analyzeWithCache(deps, {
      articleId: article.id,
      cacheKey,
      input: analysisInput,
      inputHash: article.textContentHash ?? hash(article.textContent ?? ''),
      userId: article.userId,
    });

    await applyAnalysis(deps.prisma, {
      analysis: {
        ...analysis.result,
        categoryIds: applyCategoryRules(
          analysisInput,
          analysis.result.categoryIds,
        ),
      },
      articleId: article.id,
      cacheKey,
      publishedAt: article.publishedAt,
      userId: article.userId,
    });

    await finishJobLog(deps.prisma, jobLog.id, 'completed');
    logInfo('article_processing.article_processed', {
      articleId: article.id,
      cacheHit: analysis.cacheHit,
      duplicateGroupId,
      userId: article.userId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await deps.prisma.article.updateMany({
      data: {
        failedReason: message,
        status: 'FAILED',
      },
      where: {
        id: job.data.articleId,
        userId: job.data.userId,
      },
    });
    await finishJobLog(deps.prisma, jobLog.id, 'failed', message);
    logError('article_processing.article_failed', {
      articleId: job.data.articleId,
      error: message,
      userId: job.data.userId,
    });
    throw error;
  }
}

async function buildAnalysisInput(
  prisma: PrismaClient,
  article: {
    articleId: string;
    sourceUrl: string;
    text: string;
    title: string;
    userId: string;
  },
): Promise<ArticleAnalysisInput> {
  const [categories, axes] = await Promise.all([
    prisma.category.findMany({
      orderBy: {
        name: 'asc',
      },
      where: {
        userId: article.userId,
      },
    }),
    prisma.categorizationAxis.findMany({
      include: {
        labels: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
      where: {
        isActive: true,
        userId: article.userId,
      },
    }),
  ]);

  return {
    articleId: article.articleId,
    axes: axes.map((axis) => ({
      description: axis.description,
      id: axis.id,
      labels: axis.labels.map((label) => ({
        description: label.description,
        id: label.id,
        name: label.name,
      })),
      name: axis.name,
      prompt: axis.prompt,
    })),
    categories: categories.map((category) => ({
      description: category.description,
      excludeKeywords: category.excludeKeywords,
      id: category.id,
      includeKeywords: category.includeKeywords,
      name: category.name,
      ruleText: category.ruleText,
    })),
    sourceUrl: article.sourceUrl,
    text: article.text.slice(0, Number(process.env.ARTICLE_MAX_TEXT_CHARS || 50000)),
    title: article.title,
  };
}

export function applyCategoryRules(
  input: ArticleAnalysisInput,
  categoryIds: string[],
): string[] {
  const text = `${input.title}\n${input.text}\n${input.sourceUrl}`.toLowerCase();
  const allowedIds = new Set(categoryIds);

  for (const category of input.categories) {
    const excluded = category.excludeKeywords.some((keyword) =>
      keyword.trim()
        ? text.includes(keyword.trim().toLowerCase())
        : false,
    );

    if (excluded) {
      allowedIds.delete(category.id);
      continue;
    }

    const included = category.includeKeywords.some((keyword) =>
      keyword.trim()
        ? text.includes(keyword.trim().toLowerCase())
        : false,
    );

    if (included) {
      allowedIds.add(category.id);
    }
  }

  return [...allowedIds];
}

async function analyzeWithCache(
  deps: ArticleProcessingWorkerDeps,
  input: {
    articleId: string;
    cacheKey: string;
    input: ArticleAnalysisInput;
    inputHash: string;
    userId: string;
  },
): Promise<{
  cacheHit: boolean;
  result: ArticleAnalysisResult;
}> {
  const cached = await deps.prisma.llmCacheEntry.findFirst({
    where: {
      cacheKey: input.cacheKey,
      userId: input.userId,
    },
  });

  if (cached) {
    const result = validateArticleAnalysisResult(cached.outputJson, input.input);
    await recordLlmCall(deps.prisma, {
      articleId: input.articleId,
      cacheHit: true,
      durationMs: 0,
      model: cached.model,
      provider: cached.provider,
      status: 'cached',
      task: 'article-analysis',
      usage: emptyUsage(),
      userId: input.userId,
    });
    return {
      cacheHit: true,
      result,
    };
  }

  const response = await deps.llmAdapter.analyzeArticle(input.input);
  await deps.prisma.llmCacheEntry.createMany({
    data: [
      {
        cacheKey: input.cacheKey,
        inputHash: input.inputHash,
        model: response.model,
        outputJson: toJsonInput(response.result),
        provider: providerToDb[response.provider],
        task: 'article-analysis',
        userId: input.userId,
      },
    ],
    skipDuplicates: true,
  });
  await recordLlmCall(deps.prisma, {
    articleId: input.articleId,
    cacheHit: false,
    durationMs: response.durationMs,
    model: response.model,
    provider: providerToDb[response.provider],
    status: 'completed',
    task: 'article-analysis',
    usage: response.usage,
    userId: input.userId,
  });

  return {
    cacheHit: false,
    result: response.result,
  };
}

async function applyAnalysis(
  prisma: PrismaClient,
  input: {
    analysis: ArticleAnalysisResult;
    articleId: string;
    cacheKey: string;
    publishedAt: Date | null;
    userId: string;
  },
): Promise<void> {
  try {
    await writeAnalysis(prisma, input);
  } catch (error) {
    if (!isForeignKeyError(error)) {
      throw error;
    }
    await writeAnalysis(prisma, input);
  }
}

async function writeAnalysis(
  prisma: PrismaClient,
  input: {
    analysis: ArticleAnalysisResult;
    articleId: string;
    cacheKey: string;
    publishedAt: Date | null;
    userId: string;
  },
): Promise<void> {
  const seenAt = input.publishedAt ?? new Date();

  await prisma.$transaction(async (tx) => {
    await tx.articleCategory.deleteMany({
      where: {
        articleId: input.articleId,
      },
    });
    await tx.articleAxisLabel.deleteMany({
      where: {
        articleId: input.articleId,
      },
    });

    const [validCategoryIds, validAxisLabelIds] = await Promise.all([
      resolveValidCategoryIds(tx, input.userId, input.analysis.categoryIds),
      resolveValidAxisLabelIds(tx, input.userId, input.analysis.axisLabelIds),
    ]);

    if (validCategoryIds.length > 0) {
      await tx.articleCategory.createMany({
        data: validCategoryIds.map((categoryId) => ({
          articleId: input.articleId,
          categoryId,
        })),
        skipDuplicates: true,
      });
    }

    if (validAxisLabelIds.length > 0) {
      await tx.articleAxisLabel.createMany({
        data: validAxisLabelIds.map((axisLabelId) => ({
          articleId: input.articleId,
          axisLabelId,
        })),
        skipDuplicates: true,
      });
    }

    for (const entity of input.analysis.entities) {
      const normalizedName = normalizeEntityName(entity.name);
      if (!normalizedName) {
        continue;
      }
      const normalizedAliases = entity.aliases.map(normalizeEntityName).filter(Boolean);
      let storedEntity = await tx.entity.findFirst({
        orderBy: {
          updatedAt: 'desc',
        },
        where: entityLookupWhere(input.userId, normalizedName, normalizedAliases),
      });

      if (!storedEntity) {
        await tx.entity.createMany({
          data: [
            {
              confidence: entity.confidence,
              description: entity.description,
              firstSeenAt: seenAt,
              lastSeenAt: seenAt,
              name: entity.name,
              normalizedName,
              type: entityTypeToDb[entity.type],
              userId: input.userId,
            },
          ],
          skipDuplicates: true,
        });
        storedEntity = await tx.entity.findFirstOrThrow({
          where: entityLookupWhere(input.userId, normalizedName, normalizedAliases),
        });
      }

      await tx.entity.update({
        data: {
          confidence: Math.max(storedEntity.confidence ?? 0, entity.confidence),
          description: storedEntity.description ?? entity.description,
          firstSeenAt:
            storedEntity.firstSeenAt && storedEntity.firstSeenAt < seenAt
              ? storedEntity.firstSeenAt
              : seenAt,
          lastSeenAt:
            storedEntity.lastSeenAt && storedEntity.lastSeenAt > seenAt
              ? storedEntity.lastSeenAt
              : seenAt,
          type: entityTypeForUpdate(storedEntity.type, entity.type),
        },
        where: {
          id: storedEntity.id,
        },
      });

      const aliases = entity.aliases
        .filter((alias) => normalizeEntityName(alias) !== normalizedName)
        .map((alias) => ({
          alias,
          entityId: storedEntity.id,
          normalizedAlias: normalizeEntityName(alias),
        }))
        .filter((alias) => alias.normalizedAlias);

      if (aliases.length > 0) {
        await tx.entityAlias.createMany({
          data: aliases,
          skipDuplicates: true,
        });
      }

      await tx.articleEntity.upsert({
        create: {
          articleId: input.articleId,
          entityId: storedEntity.id,
          mentions: entity.mentions,
          relevance: entity.confidence,
        },
        update: {
          mentions: entity.mentions,
          relevance: entity.confidence,
        },
        where: {
          articleId_entityId: {
            articleId: input.articleId,
            entityId: storedEntity.id,
          },
        },
      });
    }

    await tx.article.update({
      data: {
        filteredReason: null,
        importance: importanceToDb[input.analysis.importance],
        llmCacheKey: input.cacheKey,
        processedAt: new Date(),
        summary: input.analysis.summary,
        status: 'PROCESSED',
      },
      where: {
        id: input.articleId,
      },
    });
  });
}

function isForeignKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as PrismaKnownError).code === 'P2003'
  );
}

async function resolveValidCategoryIds(
  tx: PrismaTransactionClient,
  userId: string,
  categoryIds: string[],
): Promise<string[]> {
  const ids = uniqueValues(categoryIds);
  if (ids.length === 0) {
    return [];
  }

  const categories = await tx.category.findMany({
    select: {
      id: true,
    },
    where: {
      id: {
        in: ids,
      },
      userId,
    },
  });

  return categories.map((category) => category.id);
}

async function resolveValidAxisLabelIds(
  tx: PrismaTransactionClient,
  userId: string,
  axisLabelIds: string[],
): Promise<string[]> {
  const ids = uniqueValues(axisLabelIds);
  if (ids.length === 0) {
    return [];
  }

  const axisLabels = await tx.axisLabel.findMany({
    select: {
      id: true,
    },
    where: {
      axis: {
        userId,
      },
      id: {
        in: ids,
      },
    },
  });

  return axisLabels.map((axisLabel) => axisLabel.id);
}

export function entityLookupWhere(
  userId: string,
  normalizedName: string,
  normalizedAliases: string[],
) {
  const aliasLookup =
    normalizedAliases.length > 0
      ? [
          {
            aliases: {
              some: {
                normalizedAlias: {
                  in: normalizedAliases,
                },
              },
            },
          },
        ]
      : [];

  return {
    OR: [
      {
        normalizedName,
      },
      ...aliasLookup,
    ],
    userId,
  };
}

function entityTypeForUpdate(
  storedType: DbEntityType,
  extractedType: ArticleAnalysisResult['entities'][number]['type'],
): DbEntityType {
  if (storedType === 'OTHER' && extractedType !== 'other') {
    return entityTypeToDb[extractedType];
  }

  return storedType;
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

async function recordLlmCall(
  prisma: PrismaClient,
  input: {
    articleId: string;
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
      articleId: input.articleId,
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

function emptyUsage(): LlmUsage {
  return {
    completionTokens: 0,
    promptTokens: 0,
    totalTokens: 0,
  };
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

function normalizeEntityName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function toJsonInput(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}
