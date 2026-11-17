import type { PrismaClient } from '@nih/database';
import type { ProcessArticleJobData } from '@nih/shared';
import type { Queue } from 'bullmq';
import assert from 'node:assert/strict';
import test from 'node:test';

import { saveDiscoveredArticles } from './article-discovery';

interface ArticleFindFirstInput {
  where: {
    normalizedUrl: string;
    userId: string;
  };
}

interface ArticleCreateInput {
  data: Record<string, unknown>;
}

interface QueueAddCall {
  data: ProcessArticleJobData;
  name: string;
  options: {
    jobId?: string;
  };
}

test('creates discovered articles and queues processing with stripped text hashes', async () => {
  const creates: ArticleCreateInput[] = [];
  const queueCalls: QueueAddCall[] = [];
  const prisma = {
    article: {
      create: async (input: ArticleCreateInput) => {
        creates.push(input);
        return {
          id: 'article-1',
        };
      },
      findFirst: async () => null,
    },
    feed: {
      findFirst: async () => ({ id: 'feed-1' }),
    },
  } as unknown as PrismaClient;
  const articleQueue = {
    add: async (
      name: string,
      data: ProcessArticleJobData,
      options: QueueAddCall['options'],
    ) => {
      queueCalls.push({
        data,
        name,
        options,
      });
      return {};
    },
  } as unknown as Queue<ProcessArticleJobData>;

  const count = await saveDiscoveredArticles(
    prisma,
    articleQueue,
    {
      id: 'feed-1',
      userId: 'user-1',
    },
    [
      {
        excerpt: 'Short excerpt',
        rawContent: '<p>Full <strong>article</strong> body</p>',
        title: 'Article title',
        url: ' https://example.com/news/1 ',
      },
    ],
  );

  assert.equal(count, 1);
  assert.equal(creates.length, 1);
  assert.equal(creates[0].data.feedId, 'feed-1');
  assert.equal(creates[0].data.userId, 'user-1');
  assert.equal(creates[0].data.normalizedUrl, 'https://example.com/news/1');
  assert.equal(creates[0].data.textContent, 'Full article body');
  assert.equal(typeof creates[0].data.textContentHash, 'string');
  assert.equal(typeof creates[0].data.urlHash, 'string');
  assert.deepEqual(queueCalls, [
    {
      data: {
        articleId: 'article-1',
        reason: 'feed_poll',
        userId: 'user-1',
      },
      name: 'process-article',
      options: {
        attempts: 3,
        backoff: {
          delay: 5000,
          type: 'exponential',
        },
        jobId: 'article-article-1',
        removeOnComplete: 500,
        removeOnFail: 1000,
      },
    },
  ]);
});

test('skips already discovered URLs only within the same user scope', async () => {
  const findFirstCalls: ArticleFindFirstInput[] = [];
  let createCalls = 0;
  const prisma = {
    article: {
      create: async () => {
        createCalls += 1;
        return {
          id: 'article-1',
        };
      },
      findFirst: async (input: ArticleFindFirstInput) => {
        findFirstCalls.push(input);
        return {
          id: 'existing-article',
        };
      },
    },
    feed: {
      findFirst: async () => ({ id: 'feed-1' }),
    },
  } as unknown as PrismaClient;
  const articleQueue = {
    add: async () => ({}),
  } as unknown as Queue<ProcessArticleJobData>;

  const count = await saveDiscoveredArticles(
    prisma,
    articleQueue,
    {
      id: 'feed-1',
      userId: 'user-1',
    },
    [
      {
        title: 'Duplicate article',
        url: 'https://example.com/news/duplicate',
      },
    ],
  );

  assert.equal(count, 0);
  assert.equal(createCalls, 0);
  assert.deepEqual(findFirstCalls[0].where, {
    normalizedUrl: 'https://example.com/news/duplicate',
    userId: 'user-1',
  });
});

test('skips discovery cleanly when a queued feed was deleted', async () => {
  const state = {
    articleCreateCalled: false,
    queued: false,
  };
  const prisma = {
    article: {
      create: async () => {
        state.articleCreateCalled = true;
        return { id: 'article-1' };
      },
      findFirst: async () => null,
    },
    feed: {
      findFirst: async () => null,
    },
  };
  const queue = {
    add: async () => {
      state.queued = true;
    },
  };

  const count = await saveDiscoveredArticles(
    prisma as never,
    queue as never,
    { id: 'deleted-feed', userId: 'user-1' },
    [
      {
        excerpt: 'Useful article',
        rawContent: 'Useful article body',
        title: 'Useful article',
        url: 'https://example.com/a',
      },
    ],
  );

  assert.equal(count, 0);
  assert.equal(state.articleCreateCalled, false);
  assert.equal(state.queued, false);
});

test('ignores unique conflicts from concurrent feed polling', async () => {
  let createCalls = 0;
  let queueCalls = 0;
  const prisma = {
    article: {
      create: async () => {
        createCalls += 1;
        const error = new Error('Unique constraint failed') as Error & {
          code: string;
        };
        error.code = 'P2002';
        throw error;
      },
      findFirst: async () => null,
    },
    feed: {
      findFirst: async () => ({ id: 'feed-1' }),
    },
  } as unknown as PrismaClient;
  const articleQueue = {
    add: async () => {
      queueCalls += 1;
      return {};
    },
  } as unknown as Queue<ProcessArticleJobData>;

  const count = await saveDiscoveredArticles(
    prisma,
    articleQueue,
    {
      id: 'feed-1',
      userId: 'user-1',
    },
    [
      {
        title: 'Race duplicate article',
        url: 'https://example.com/news/race',
      },
    ],
  );

  assert.equal(count, 0);
  assert.equal(createCalls, 1);
  assert.equal(queueCalls, 0);
});
