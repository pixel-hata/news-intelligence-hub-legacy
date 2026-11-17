import assert from 'node:assert/strict';
import test from 'node:test';

import type { PrismaService } from '../database/prisma.service';
import { GraphService } from './graph.service';

interface ArticleFindManyInput {
  where: {
    categories?: unknown;
    OR?: unknown;
    publishedAt?: {
      gte?: Date;
      lte?: Date;
    };
    status: {
      in: string[];
    };
    userId: string;
  };
}

test('builds graph query with category, search, and time-window filters', async () => {
  const state: {
    findManyInput?: ArticleFindManyInput;
  } = {};
  const service = new GraphService({
    article: {
      findMany: async (input: ArticleFindManyInput) => {
        state.findManyInput = input;
        return [];
      },
    },
  } as unknown as PrismaService);

  await service.getGraph('user-1', {
    categoryId: 'category-1',
    fromTs: 1_700_000_000,
    query: 'OpenAI',
    toTs: 1_700_086_400,
  });

  assert.equal(state.findManyInput?.where.userId, 'user-1');
  assert.deepEqual(state.findManyInput?.where.status, {
    in: ['PROCESSED', 'PROCESSING', 'QUEUED'],
  });
  assert.deepEqual(state.findManyInput?.where.categories, {
    some: {
      categoryId: 'category-1',
    },
  });
  assert.deepEqual(state.findManyInput?.where.publishedAt, {
    gte: new Date(1_700_000_000 * 1000),
    lte: new Date(1_700_086_400 * 1000),
  });
  assert.ok(Array.isArray(state.findManyInput?.where.OR));
});
