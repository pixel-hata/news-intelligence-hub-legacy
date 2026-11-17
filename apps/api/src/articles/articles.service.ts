import { Injectable, NotFoundException } from '@nestjs/common';
import { isLowSignalEntityName } from '@nih/shared';
import type {
  ArticleImportance,
  ArticleStatus,
  ArticleSummary,
  AxisLabelSummary,
  CategorySummary,
  EntitySummary,
} from '@nih/shared';

import { PrismaService } from '../database/prisma.service';
import type { ArticleListQueryDto } from './dto/article-list-query.dto';

const statusToDb = {
  discovered: 'DISCOVERED',
  failed: 'FAILED',
  filtered: 'FILTERED',
  processed: 'PROCESSED',
  processing: 'PROCESSING',
  queued: 'QUEUED',
} as const satisfies Record<ArticleStatus, string>;

const statusFromDb = {
  DISCOVERED: 'discovered',
  FAILED: 'failed',
  FILTERED: 'filtered',
  PROCESSED: 'processed',
  PROCESSING: 'processing',
  QUEUED: 'queued',
} as const;

const importanceToDb = {
  high: 'HIGH',
  junk: 'JUNK',
  normal: 'NORMAL',
} as const satisfies Record<ArticleImportance, string>;

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

interface ArticleSummaryRecord {
  axisLabels: {
    axisLabel: {
      description: string | null;
      id: string;
      name: string;
      sortOrder: number;
    };
  }[];
  categories: {
    category: {
      color: string;
      description: string | null;
      excludeKeywords: string[];
      id: string;
      includeKeywords: string[];
      name: string;
      ruleText: string | null;
    };
  }[];
  entities: {
    entity: {
      aliases: { alias: string }[];
      description: string | null;
      firstSeenAt: Date | null;
      id: string;
      lastSeenAt: Date | null;
      name: string;
      type: keyof typeof entityTypeFromDb;
    };
  }[];
  excerpt: string | null;
  feedId: string | null;
  id: string;
  importance: keyof typeof importanceFromDb | null;
  publishedAt: Date | null;
  similarCount: number;
  sourceUrl: string;
  status: keyof typeof statusFromDb;
  summary: string | null;
  title: string;
}

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    query: ArticleListQueryDto,
  ): Promise<{ articles: ArticleSummary[] }> {
    const search = query.q?.trim();
    const publishedAt = periodPublishedAtFilter(query.period);
    const articles = await this.prisma.article.findMany({
      include: this.includeSummaryRelations(),
      orderBy: [
        {
          publishedAt: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
      take: 100,
      where: {
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
                sourceUrl: {
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
        categories: query.categoryId
          ? {
              some: {
                categoryId: query.categoryId,
              },
            }
          : undefined,
        feedId: query.feedId,
        importance: query.importance
          ? importanceToDb[query.importance]
          : undefined,
        publishedAt,
        status: query.status ? statusToDb[query.status] : undefined,
        userId,
      },
    });

    return {
      articles: articles.map((article) => this.toSummary(article)),
    };
  }

  async get(
    userId: string,
    id: string,
  ): Promise<{
    article: ArticleSummary;
    similarArticles: ArticleSummary[];
  }> {
    const article = await this.findArticleById(userId, id);

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    const similarArticles = article.similarityGroupId
      ? await this.prisma.article.findMany({
          include: this.includeSummaryRelations(),
          orderBy: {
            publishedAt: 'desc',
          },
          where: {
            id: {
              not: article.id,
            },
            similarityGroupId: article.similarityGroupId,
            userId,
          },
        })
      : [];

    return {
      article: this.toSummary(article),
      similarArticles: similarArticles.map((similarArticle) =>
        this.toSummary(similarArticle),
      ),
    };
  }

  private findArticleById(userId: string, id: string) {
    return this.prisma.article.findFirst({
      include: this.includeSummaryRelations(),
      where: {
        id,
        userId,
      },
    });
  }

  private includeSummaryRelations() {
    return {
      axisLabels: {
        include: {
          axisLabel: true,
        },
      },
      categories: {
        include: {
          category: true,
        },
      },
      entities: {
        include: {
          entity: {
            include: {
              aliases: true,
            },
          },
        },
      },
    };
  }

  private toSummary(article: ArticleSummaryRecord): ArticleSummary {
    return {
      axisLabels: article.axisLabels.map((axisLabel) =>
        this.toAxisLabelSummary(axisLabel.axisLabel),
      ),
      categories: article.categories.map((category) =>
        this.toCategorySummary(category.category),
      ),
      entities: article.entities
        .filter((entity) => !isLowSignalEntityName(entity.entity.name))
        .map((entity) => this.toEntitySummary(entity.entity)),
      feedId: article.feedId ?? undefined,
      id: article.id,
      importance: article.importance
        ? importanceFromDb[article.importance]
        : undefined,
      publishedAt: article.publishedAt?.toISOString(),
      similarCount: article.similarCount,
      sourceUrl: article.sourceUrl,
      status: statusFromDb[article.status],
      summary: article.summary ?? article.excerpt ?? undefined,
      title: article.title,
    };
  }

  private toCategorySummary(category: {
    color: string;
    description: string | null;
    excludeKeywords: string[];
    id: string;
    includeKeywords: string[];
    name: string;
    ruleText: string | null;
  }): CategorySummary {
    return {
      color: category.color,
      description: category.description ?? undefined,
      excludeKeywords: category.excludeKeywords,
      id: category.id,
      includeKeywords: category.includeKeywords,
      name: category.name,
      ruleText: category.ruleText ?? undefined,
    };
  }

  private toAxisLabelSummary(label: {
    description: string | null;
    id: string;
    name: string;
    sortOrder: number;
  }): AxisLabelSummary {
    return {
      description: label.description ?? undefined,
      id: label.id,
      name: label.name,
      sortOrder: label.sortOrder,
    };
  }

  private toEntitySummary(entity: {
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

function periodPublishedAtFilter(
  period?: ArticleListQueryDto['period'],
): { gte: Date } | undefined {
  if (!period) {
    return undefined;
  }

  const days = {
    '24h': 1,
    '30d': 30,
    '7d': 7,
  }[period];

  return {
    gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
  };
}
