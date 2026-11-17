import { Injectable } from '@nestjs/common';
import { isLowSignalEntityName } from '@nih/shared';
import type { GraphEdge, GraphNode, NewsGraph } from '@nih/shared';

import { PrismaService } from '../database/prisma.service';

const importanceFromDb = {
  HIGH: 'high',
  JUNK: 'junk',
  NORMAL: 'normal',
} as const;

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
export class GraphService {
  constructor(private readonly prisma: PrismaService) {}

  async getGraph(
    userId: string,
    filters: {
      categoryId?: string;
      fromTs?: number;
      query?: string;
      toTs?: number;
    },
  ): Promise<{ graph: NewsGraph }> {
    const search = filters.query?.trim();
    const publishedAt =
      filters.fromTs !== undefined || filters.toTs !== undefined
        ? {
            gte:
              filters.fromTs !== undefined
                ? new Date(filters.fromTs * 1000)
                : undefined,
            lte:
              filters.toTs !== undefined
                ? new Date(filters.toTs * 1000)
                : undefined,
          }
        : undefined;

    const articles = await this.prisma.article.findMany({
      include: {
        categories: {
          include: {
            category: {
              select: {
                color: true,
                id: true,
                name: true,
              },
            },
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
      take: 150,
      where: {
        categories: filters.categoryId
          ? {
              some: {
                categoryId: filters.categoryId,
              },
            }
          : undefined,
        OR: search
          ? [
              {
                title: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                summary: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                excerpt: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                textContent: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                entities: {
                  some: {
                    entity: {
                      OR: [
                        {
                          name: {
                            contains: search,
                            mode: 'insensitive',
                          },
                        },
                        {
                          aliases: {
                            some: {
                              alias: {
                                contains: search,
                                mode: 'insensitive',
                              },
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            ]
          : undefined,
        publishedAt,
        status: {
          in: ['PROCESSED', 'PROCESSING', 'QUEUED'],
        },
        userId,
      },
    });

    const nodes = new Map<string, GraphNode>();
    const edges = new Map<string, GraphEdge>();
    const coMentionWeights = new Map<string, number>();
    const coMentionArticles = new Map<
      string,
      { id: string; publishedAt?: string; title: string }[]
    >();

    for (const article of articles) {
      nodes.set(article.id, {
        id: article.id,
        label: article.title,
        metadata: {
          categoryIds: article.categories.map((category) => category.categoryId),
          categoryColors: article.categories.map((category) => category.category.color),
          categoryNames: article.categories.map((category) => category.category.name),
          importance: article.importance
            ? importanceFromDb[article.importance]
            : undefined,
          ts: article.publishedAt
            ? Math.floor(article.publishedAt.getTime() / 1000)
            : undefined,
        },
        type: 'article',
      });

      const articleEntities = article.entities
        .map((entity) => entity.entity)
        .filter((entity) => !isLowSignalEntityName(entity.name));

      for (const entity of articleEntities) {
        nodes.set(entity.id, {
          id: entity.id,
          label: entity.name,
          metadata: {
            entityType: entityTypeFromDb[entity.type],
          },
          type: 'entity',
        });
        edges.set(`mentions:${article.id}:${entity.id}`, {
          id: `mentions:${article.id}:${entity.id}`,
          metadata: {
            relation: 'Article mentions entity',
            relatedArticles: [
              {
                id: article.id,
                publishedAt: article.publishedAt?.toISOString(),
                title: article.title,
              },
            ],
            directionTs: article.publishedAt
              ? Math.floor(article.publishedAt.getTime() / 1000)
              : undefined,
            firstSeenTs: article.publishedAt
              ? Math.floor(article.publishedAt.getTime() / 1000)
              : undefined,
            lastSeenTs: article.publishedAt
              ? Math.floor(article.publishedAt.getTime() / 1000)
              : undefined,
            sourceLabel: article.title,
            targetLabel: entity.name,
          },
          source: article.id,
          target: entity.id,
          type: 'mentions',
          weight: 1,
        });
      }

      for (let i = 0; i < articleEntities.length; i += 1) {
        for (let j = i + 1; j < articleEntities.length; j += 1) {
          const [source, target] = [articleEntities[i].id, articleEntities[j].id]
            .sort();
          const key = `co_mention:${source}:${target}`;
          coMentionWeights.set(key, (coMentionWeights.get(key) ?? 0) + 1);
          coMentionArticles.set(key, [
            ...(coMentionArticles.get(key) ?? []),
            {
              id: article.id,
              publishedAt: article.publishedAt?.toISOString(),
              title: article.title,
            },
          ]);
        }
      }
    }

    for (const [id, weight] of coMentionWeights.entries()) {
      const [, source, target] = id.split(':');
      const sourceNode = nodes.get(source);
      const targetNode = nodes.get(target);
      edges.set(id, {
        id,
        metadata: {
          ...timelineMetadata(coMentionArticles.get(id) ?? []),
          relation: 'Entities are co-mentioned in the same articles',
          relatedArticles: coMentionArticles.get(id) ?? [],
          sourceLabel: sourceNode?.label,
          targetLabel: targetNode?.label,
        },
        source,
        target,
        type: 'co_mention',
        weight,
      });
    }

    addSimilarArticleEdges(articles, edges);

    return {
      graph: {
        edges: [...edges.values()],
        nodes: [...nodes.values()],
      },
    };
  }
}

function addSimilarArticleEdges(
  articles: {
    id: string;
    publishedAt: Date | null;
    title: string;
    similarityGroupId: string | null;
  }[],
  edges: Map<string, GraphEdge>,
): void {
  const groups = new Map<string, string[]>();

  for (const article of articles) {
    if (!article.similarityGroupId) {
      continue;
    }

    groups.set(article.similarityGroupId, [
      ...(groups.get(article.similarityGroupId) ?? []),
      article.id,
    ]);
  }

  for (const articleIds of groups.values()) {
    for (let i = 0; i < articleIds.length; i += 1) {
      for (let j = i + 1; j < articleIds.length; j += 1) {
        const pair = [articleIds[i], articleIds[j]]
          .map((id) => articles.find((article) => article.id === id))
          .filter((article): article is NonNullable<typeof article> =>
            Boolean(article),
          )
          .sort((left, right) => articleTimestamp(left) - articleTimestamp(right));
        if (pair.length < 2) {
          continue;
        }
        const [sourceArticle, targetArticle] = pair;
        const id = `similar:${sourceArticle.id}:${targetArticle.id}`;
        edges.set(id, {
          id,
          metadata: {
            directionTs: articleTimestamp(targetArticle),
            firstSeenTs: articleTimestamp(sourceArticle),
            lastSeenTs: articleTimestamp(targetArticle),
            relation: 'Articles are semantically similar or grouped as duplicates',
            score: 1,
            sourceLabel: sourceArticle.title,
            targetLabel: targetArticle.title,
          },
          source: sourceArticle.id,
          target: targetArticle.id,
          type: 'similar',
          weight: 1,
        });
      }
    }
  }
}

function timelineMetadata(
  articles: { publishedAt?: string }[],
): {
  directionTs?: number;
  firstSeenTs?: number;
  lastSeenTs?: number;
} {
  const timestamps = articles
    .map((article) => article.publishedAt ? Date.parse(article.publishedAt) : Number.NaN)
    .filter(Number.isFinite)
    .map((timestamp) => Math.floor(timestamp / 1000))
    .sort((left, right) => left - right);

  if (timestamps.length === 0) {
    return {};
  }

  return {
    directionTs: timestamps[timestamps.length - 1],
    firstSeenTs: timestamps[0],
    lastSeenTs: timestamps[timestamps.length - 1],
  };
}

function articleTimestamp(article: { publishedAt: Date | null }): number {
  return article.publishedAt
    ? Math.floor(article.publishedAt.getTime() / 1000)
    : 0;
}
