import { PrismaClient } from '@nih/database';
import { queueNames } from '@nih/shared';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

import { createArticleProcessingWorker } from './articles/article-processing.worker';
import { createDigestGenerationWorker } from './digests/digest-generation.worker';
import { createLlmAdapter } from './llm/adapter-factory';
import { createFeedPollingWorker } from './polling/feed-polling.worker';
import { logInfo } from './observability/logger';
import { createAxisRegenerationWorker } from './regeneration/axis-regeneration.worker';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});
const prisma = new PrismaClient();
const articleQueue = new Queue(queueNames.articleProcessing, {
  connection,
});
const feedQueue = new Queue(queueNames.feedPolling, {
  connection,
});
const axisRegenerationQueue = new Queue(queueNames.axisRegeneration, {
  connection,
});
const digestGenerationQueue = new Queue(queueNames.digestGeneration, {
  connection,
});

async function bootstrap(): Promise<void> {
  await prisma.$connect();
  const llmAdapter = createLlmAdapter();

  const feedWorker = createFeedPollingWorker({
    articleQueue,
    connection,
    feedQueue,
    prisma,
  });
  const articleWorker = createArticleProcessingWorker({
    connection,
    llmAdapter,
    prisma,
  });
  const axisRegenerationWorker = createAxisRegenerationWorker({
    articleQueue,
    connection,
    prisma,
  });
  const digestGenerationWorker = createDigestGenerationWorker({
    connection,
    llmAdapter,
    prisma,
  });

  await feedQueue.add(
    'poll-active-feeds',
    {
      requestedBy: 'schedule',
    },
    {
      jobId: 'feed-polling-schedule',
      repeat: {
        pattern: process.env.FEED_POLL_CRON || '*/30 * * * *',
      },
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  );

  logInfo('worker.booted', {
    articleProcessingConcurrency:
      process.env.ARTICLE_PROCESSING_CONCURRENCY || '3',
    feedPollingConcurrency: process.env.FEED_POLL_CONCURRENCY || '3',
    llmModel: llmAdapter.model,
    llmProvider: llmAdapter.provider,
    redisConfigured: Boolean(redisUrl),
  });

  const shutdown = async () => {
    logInfo('worker.shutdown.started', {});
    await articleWorker.close();
    await axisRegenerationWorker.close();
    await digestGenerationWorker.close();
    await feedWorker.close();
    await articleQueue.close();
    await axisRegenerationQueue.close();
    await digestGenerationQueue.close();
    await feedQueue.close();
    await prisma.$disconnect();
    await connection.quit();
    logInfo('worker.shutdown.completed', {});
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void bootstrap();
