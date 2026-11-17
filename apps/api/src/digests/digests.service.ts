import { BadRequestException, Injectable } from '@nestjs/common';
import type { DigestSummary } from '@nih/shared';
import { createHash } from 'node:crypto';

import { PrismaService } from '../database/prisma.service';
import { BackgroundJobsService } from '../queues/background-jobs.service';
import type { GenerateDigestDto } from './dto/generate-digest.dto';

@Injectable()
export class DigestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly backgroundJobs: BackgroundJobsService,
  ) {}

  async list(userId: string): Promise<{ digests: DigestSummary[] }> {
    const digests = await this.prisma.digest.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
      where: {
        userId,
      },
    });

    return {
      digests: digests.map((digest) => ({
        ...digestPayloadSummary(digest.payload),
        id: digest.id,
        periodEnd: digest.periodEnd.toISOString(),
        periodStart: digest.periodStart.toISOString(),
        scopeLabel: digest.scopeLabel ?? undefined,
        summary: digest.summary,
        title: digest.title,
      })),
    };
  }

  async generate(
    userId: string,
    dto: GenerateDigestDto,
  ): Promise<{
    articleCount: number;
    jobId?: string;
    periodEnd: string;
    periodStart: string;
    queued: true;
  }> {
    const { periodLabel, periodStart, periodEnd } = this.resolvePeriod(dto);
    const scope = await this.resolveScope(userId, dto);
    const articleCount = await this.prisma.article.count({
      where: {
        ...articleScopeWhere(scope),
        publishedAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        status: {
          in: ['PROCESSED', 'PROCESSING', 'QUEUED'],
        },
        userId,
      },
    });
    const { jobId } = await this.backgroundJobs.enqueueDigestGeneration({
      categoryIds: scope.categoryIds,
      entityIds: scope.entityIds,
      periodLabel,
      periodEnd: periodEnd.toISOString(),
      periodStart: periodStart.toISOString(),
      requestedBy: 'manual',
      scopeHash: scope.scopeHash,
      scopeLabel: scope.scopeLabel,
      userId,
    });

    return {
      articleCount,
      jobId,
      periodEnd: periodEnd.toISOString(),
      periodStart: periodStart.toISOString(),
      queued: true,
    };
  }

  private resolvePeriod(dto: GenerateDigestDto): {
    periodLabel: 'day' | 'week' | 'month' | 'custom';
    periodEnd: Date;
    periodStart: Date;
  } {
    const periodEnd = dto.periodEnd ? new Date(dto.periodEnd) : new Date();
    const daysFromPeriod = dto.period
      ? {
          day: 1,
          month: 30,
          week: 7,
        }[dto.period]
      : undefined;
    const periodStart = dto.periodStart
      ? new Date(dto.periodStart)
      : new Date(
          periodEnd.getTime() -
            (daysFromPeriod ?? dto.days ?? 7) * 24 * 60 * 60 * 1000,
        );

    if (periodStart >= periodEnd) {
      throw new BadRequestException('periodStart must be before periodEnd');
    }

    return {
      periodLabel: dto.period ?? (dto.periodStart || dto.periodEnd ? 'custom' : 'week'),
      periodEnd,
      periodStart,
    };
  }

  private async resolveScope(
    userId: string,
    dto: GenerateDigestDto,
  ): Promise<{
    categoryIds: string[];
    entityIds: string[];
    scopeHash: string;
    scopeLabel?: string;
  }> {
    const categoryIds = uniqueIds(dto.categoryIds);
    const entityIds = uniqueIds(dto.entityIds);

    const [categories, entities] = await Promise.all([
      categoryIds.length
        ? this.prisma.category.findMany({
            select: {
              id: true,
              name: true,
            },
            where: {
              id: {
                in: categoryIds,
              },
              userId,
            },
          })
        : Promise.resolve([]),
      entityIds.length
        ? this.prisma.entity.findMany({
            select: {
              id: true,
              name: true,
            },
            where: {
              id: {
                in: entityIds,
              },
              userId,
            },
          })
        : Promise.resolve([]),
    ]);

    if (categories.length !== categoryIds.length) {
      throw new BadRequestException('One or more categories are not available');
    }
    if (entities.length !== entityIds.length) {
      throw new BadRequestException('One or more entities are not available');
    }

    const scopeLabelParts = [
      ...categories.map((category) => `category:${category.name}`),
      ...entities.map((entity) => `entity:${entity.name}`),
    ];
    const scopeHash = createHash('sha256')
      .update(JSON.stringify({ categoryIds, entityIds }))
      .digest('hex')
      .slice(0, 24);

    return {
      categoryIds,
      entityIds,
      scopeHash,
      scopeLabel: scopeLabelParts.length
        ? scopeLabelParts.join(', ')
        : undefined,
    };
  }
}

function uniqueIds(values?: string[]): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function articleScopeWhere(scope: {
  categoryIds: string[];
  entityIds: string[];
}) {
  const categoryClause = scope.categoryIds.length
    ? {
        categories: {
          some: {
            categoryId: {
              in: scope.categoryIds,
            },
          },
        },
      }
    : undefined;
  const entityClause = scope.entityIds.length
    ? {
        entities: {
          some: {
            entityId: {
              in: scope.entityIds,
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

function digestPayloadSummary(payload: unknown): Partial<DigestSummary> {
  if (!isRecord(payload)) {
    return {};
  }

  return {
    articleCount: numberValue(payload.articleCount),
    keyArticles: arrayValue(payload.keyArticles)
      .filter(isRecord)
      .map((article) => ({
        id: stringValue(article.id),
        title: stringValue(article.title),
      }))
      .filter((article) => article.id && article.title),
    topCategories: countedItems(payload.topCategories),
    topEntities: countedItems(payload.topEntities),
  };
}

function countedItems(value: unknown): { count: number; name: string }[] {
  return arrayValue(value)
    .filter(isRecord)
    .map((item) => ({
      count: numberValue(item.count) ?? 0,
      name: stringValue(item.name),
    }))
    .filter((item) => item.name);
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
