import { Injectable, NotFoundException } from '@nestjs/common';
import { isLowSignalEntityName } from '@nih/shared';
import type { EntitySummary } from '@nih/shared';

import { PrismaService } from '../database/prisma.service';

const entityTypeFromDb = {
  COMPANY: 'company',
  LOCATION: 'location',
  OTHER: 'other',
  PERSON: 'person',
  PRODUCT: 'product',
  TECHNOLOGY: 'technology',
  TOPIC: 'topic',
} as const;

@Injectable()
export class EntitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    query?: string,
  ): Promise<{ entities: EntitySummary[] }> {
    const normalizedQuery = query?.trim();
    const entities = await this.prisma.entity.findMany({
      include: {
        aliases: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 100,
      where: {
        name: normalizedQuery
          ? {
              contains: normalizedQuery,
              mode: 'insensitive',
            }
          : undefined,
        userId,
      },
    });

    return {
      entities: entities
        .filter((entity) => !isLowSignalEntityName(entity.name))
        .map((entity) => this.toSummary(entity)),
    };
  }

  async get(userId: string, id: string) {
    const entity = await this.prisma.entity.findFirst({
      include: {
        aliases: true,
        articles: {
          include: {
            article: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 50,
        },
      },
      where: {
        id,
        userId,
      },
    });

    if (!entity) {
      throw new NotFoundException('Entity not found');
    }

    const articleIds = entity.articles.map((article) => article.articleId);
    const coMentions = articleIds.length
      ? await this.prisma.articleEntity.findMany({
          include: {
            entity: {
              include: {
                aliases: true,
              },
            },
          },
          where: {
            articleId: {
              in: articleIds,
            },
            entityId: {
              not: entity.id,
            },
          },
        })
      : [];

    return {
      activity: buildActivity(entity.articles),
      entity: {
        ...this.toSummary(entity),
        mentionArticleIds: entity.articles.map((article) => article.articleId),
      },
      mentioningArticles: entity.articles.map((article) => ({
        id: article.article.id,
        publishedAt: article.article.publishedAt?.toISOString(),
        sourceUrl: article.article.sourceUrl,
        title: article.article.title,
      })),
      relatedEntities: buildRelatedEntities(
        coMentions
          .filter((mention) => !isLowSignalEntityName(mention.entity.name))
          .map((mention) => ({
            entity: this.toSummary(mention.entity),
            entityId: mention.entityId,
          })),
      ),
    };
  }

  private toSummary(entity: {
    aliases: { alias: string }[];
    description: string | null;
    firstSeenAt: Date | null;
    id: string;
    lastSeenAt: Date | null;
    name: string;
    type: keyof typeof entityTypeFromDb;
  }): EntitySummary {
    return {
      aliases: entity.aliases.map((alias) => alias.alias),
      description: entity.description ?? undefined,
      firstSeen: entity.firstSeenAt
        ? Math.floor(entity.firstSeenAt.getTime() / 1000)
        : undefined,
      id: entity.id,
      lastSeen: entity.lastSeenAt
        ? Math.floor(entity.lastSeenAt.getTime() / 1000)
        : undefined,
      name: entity.name,
      type: entityTypeFromDb[entity.type],
    };
  }
}

function buildRelatedEntities(
  mentions: {
    entity: EntitySummary;
    entityId: string;
  }[],
): { count: number; entity: EntitySummary }[] {
  const counts = new Map<string, { count: number; entity: EntitySummary }>();

  for (const mention of mentions) {
    const current = counts.get(mention.entityId);
    counts.set(mention.entityId, {
      count: (current?.count ?? 0) + 1,
      entity: current?.entity ?? mention.entity,
    });
  }

  return [...counts.values()]
    .sort((left, right) => right.count - left.count || left.entity.name.localeCompare(right.entity.name))
    .slice(0, 20);
}

function buildActivity(
  articles: {
    article: {
      publishedAt: Date | null;
    };
  }[],
): { count: number; date: string }[] {
  const counts = new Map<string, number>();

  for (const article of articles) {
    const date = article.article.publishedAt?.toISOString().slice(0, 10);
    if (!date) {
      continue;
    }
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([date, count]) => ({ count, date }))
    .sort((left, right) => left.date.localeCompare(right.date));
}
