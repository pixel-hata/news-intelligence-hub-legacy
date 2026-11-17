import type { PrismaClient } from '@nih/database';
import assert from 'node:assert/strict';
import test from 'node:test';

import { updateExactDuplicateGroup } from './article-duplicates';

interface ArticleFindFirstInput {
  orderBy: {
    createdAt: 'asc';
  };
  where: {
    id: {
      not: string;
    };
    textContentHash: string;
    userId: string;
  };
}

interface ArticleUpdateInput {
  data: {
    similarityGroupId: string;
  };
  where: {
    id: string;
  };
}

interface ArticleCountInput {
  where: {
    similarityGroupId: string;
    userId: string;
  };
}

interface ArticleUpdateManyInput {
  data: {
    similarCount: number;
  };
  where: {
    similarityGroupId: string;
    userId: string;
  };
}

test('assigns exact duplicates to a user-scoped similarity group', async () => {
  const state: {
    countInput?: ArticleCountInput;
    findFirstInput?: ArticleFindFirstInput;
    updateManyInput?: ArticleUpdateManyInput;
  } = {};
  const updates: ArticleUpdateInput[] = [];
  const prisma = {
    article: {
      count: async (input: ArticleCountInput) => {
        state.countInput = input;
        return 3;
      },
      findFirst: async (input: ArticleFindFirstInput) => {
        state.findFirstInput = input;
        return {
          id: 'article-existing',
          similarityGroupId: null,
        };
      },
      update: async (input: ArticleUpdateInput) => {
        updates.push(input);
        return {};
      },
      updateMany: async (input: ArticleUpdateManyInput) => {
        state.updateManyInput = input;
        return {
          count: 3,
        };
      },
    },
  } as unknown as PrismaClient;

  const groupId = await updateExactDuplicateGroup(
    prisma,
    'article-current',
    'user-1',
    'hash-1',
  );

  assert.equal(groupId, 'article-existing');
  assert.deepEqual(state.findFirstInput?.where, {
    id: {
      not: 'article-current',
    },
    textContentHash: 'hash-1',
    userId: 'user-1',
  });
  assert.deepEqual(updates, [
    {
      data: {
        similarityGroupId: 'article-existing',
      },
      where: {
        id: 'article-existing',
      },
    },
    {
      data: {
        similarityGroupId: 'article-existing',
      },
      where: {
        id: 'article-current',
      },
    },
  ]);
  assert.deepEqual(state.countInput?.where, {
    similarityGroupId: 'article-existing',
    userId: 'user-1',
  });
  assert.deepEqual(state.updateManyInput, {
    data: {
      similarCount: 2,
    },
    where: {
      similarityGroupId: 'article-existing',
      userId: 'user-1',
    },
  });
});

test('skips duplicate grouping when content hash is unavailable', async () => {
  let lookupCount = 0;
  const prisma = {
    article: {
      findFirst: async () => {
        lookupCount += 1;
        return null;
      },
    },
  } as unknown as PrismaClient;

  const groupId = await updateExactDuplicateGroup(
    prisma,
    'article-current',
    'user-1',
    null,
  );

  assert.equal(groupId, null);
  assert.equal(lookupCount, 0);
});
