import { NotFoundException } from '@nestjs/common';
import assert from 'node:assert/strict';
import test from 'node:test';

import type { PrismaService } from '../database/prisma.service';
import { ArticlesService } from './articles.service';
import type { ArticleListQueryDto } from './dto/article-list-query.dto';

interface ArticleFindManyInput {
  where: Record<string, unknown>;
}

interface ArticleFindFirstInput {
  where: {
    id: string;
    userId: string;
  };
}

test('lists articles through a user-scoped query with optional filters', async () => {
  const state: {
    findManyInput?: ArticleFindManyInput;
  } = {};
  const service = new ArticlesService({
    article: {
      findMany: async (input: ArticleFindManyInput) => {
        state.findManyInput = input;
        return [];
      },
    },
  } as unknown as PrismaService);

  await service.list('user-1', {
    categoryId: 'category-1',
    feedId: 'feed-1',
    importance: 'high',
    period: '7d',
    q: 'Anthropic',
    status: 'processed',
  } as ArticleListQueryDto);

  const searchClauses = state.findManyInput?.where.OR;

  assert.equal(state.findManyInput?.where.userId, 'user-1');
  assert.ok(Array.isArray(searchClauses));
  assert.deepEqual(searchClauses[0], {
    title: {
      contains: 'Anthropic',
      mode: 'insensitive',
    },
  });
  assert.ok(
    searchClauses.some((clause) =>
      JSON.stringify(clause) === JSON.stringify({
        textContent: {
          contains: 'Anthropic',
          mode: 'insensitive',
        },
      }),
    ),
  );
  assert.deepEqual(state.findManyInput?.where.categories, {
    some: {
      categoryId: 'category-1',
    },
  });
  assert.equal(state.findManyInput?.where.feedId, 'feed-1');
  assert.equal(state.findManyInput?.where.importance, 'HIGH');
  assert.ok(state.findManyInput?.where.publishedAt);
  assert.equal(state.findManyInput?.where.status, 'PROCESSED');
});

test('does not return an article by direct id when it belongs to another user', async () => {
  const state: {
    findFirstInput?: ArticleFindFirstInput;
  } = {};
  const service = new ArticlesService({
    article: {
      findFirst: async (input: ArticleFindFirstInput) => {
        state.findFirstInput = input;
        return null;
      },
    },
  } as unknown as PrismaService);

  await assert.rejects(
    () => service.get('user-2', 'article-owned-by-user-1'),
    NotFoundException,
  );
  assert.deepEqual(state.findFirstInput?.where, {
    id: 'article-owned-by-user-1',
    userId: 'user-2',
  });
});

test('loads similar articles only from the same user scope', async () => {
  const state: {
    findFirstInput?: ArticleFindFirstInput;
    findManyInput?: ArticleFindManyInput;
  } = {};
  const service = new ArticlesService({
    article: {
      findFirst: async (input: ArticleFindFirstInput) => {
        state.findFirstInput = input;
        return articleRecord({
          id: 'article-1',
          similarityGroupId: 'group-1',
        });
      },
      findMany: async (input: ArticleFindManyInput) => {
        state.findManyInput = input;
        return [
          articleRecord({
            id: 'article-2',
            title: 'Similar article',
          }),
        ];
      },
    },
  } as unknown as PrismaService);

  const result = await service.get('user-1', 'article-1');

  assert.equal(result.article.id, 'article-1');
  assert.equal(result.similarArticles[0].id, 'article-2');
  assert.deepEqual(state.findFirstInput?.where, {
    id: 'article-1',
    userId: 'user-1',
  });
  assert.deepEqual(state.findManyInput?.where, {
    id: {
      not: 'article-1',
    },
    similarityGroupId: 'group-1',
    userId: 'user-1',
  });
});

interface TestArticleRecord {
  axisLabels: [];
  categories: [];
  entities: [];
  excerpt: string | null;
  feedId: string | null;
  id: string;
  importance: 'NORMAL';
  publishedAt: Date | null;
  similarCount: number;
  similarityGroupId: string | null;
  sourceUrl: string;
  status: 'PROCESSED';
  summary: string | null;
  title: string;
}

function articleRecord(overrides: Partial<TestArticleRecord> = {}) {
  return {
    ...baseArticleRecord(),
    ...overrides,
  };
}

function baseArticleRecord(): TestArticleRecord {
  return {
    axisLabels: [],
    categories: [],
    entities: [],
    excerpt: null,
    feedId: 'feed-1',
    id: 'article-1',
    importance: 'NORMAL' as const,
    publishedAt: null,
    similarCount: 0,
    similarityGroupId: null,
    sourceUrl: 'https://example.com/article',
    status: 'PROCESSED' as const,
    summary: 'Article summary',
    title: 'Article title',
  };
}
