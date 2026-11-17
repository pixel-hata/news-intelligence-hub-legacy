import type { PrismaClient } from '@nih/database';
import { queueNames } from '@nih/shared';
import type {
  AxisRegenerationJobData,
  ProcessArticleJobData,
} from '@nih/shared';
import type { Job, Queue} from 'bullmq';
import { Worker } from 'bullmq';
import type IORedis from 'ioredis';

import { logError, logInfo } from '../observability/logger';

interface AxisRegenerationWorkerDeps {
  articleQueue: Queue<ProcessArticleJobData>;
  connection: IORedis;
  prisma: PrismaClient;
}

export function createAxisRegenerationWorker(
  deps: AxisRegenerationWorkerDeps,
): Worker<AxisRegenerationJobData> {
  return new Worker<AxisRegenerationJobData>(
    queueNames.axisRegeneration,
    async (job) => regenerateAxes(job, deps),
    {
      concurrency: Number(process.env.AXIS_REGENERATION_CONCURRENCY || 1),
      connection: deps.connection,
    },
  );
}

async function regenerateAxes(
  job: Job<AxisRegenerationJobData>,
  deps: AxisRegenerationWorkerDeps,
): Promise<void> {
  const startedAt = new Date();
  const jobLog = await deps.prisma.queueJobLog.create({
    data: {
      jobId: job.id,
      jobName: job.name,
      payload: toJsonInput(job.data),
      queueName: queueNames.axisRegeneration,
      startedAt,
      status: 'processing',
      userId: job.data.userId,
    },
  });

  try {
    const articles = await deps.prisma.article.findMany({
      select: {
        id: true,
      },
      where: {
        id: job.data.articleIds
          ? {
              in: job.data.articleIds,
            }
          : undefined,
        status: 'PROCESSED',
        userId: job.data.userId,
      },
    });

    if (articles.length === 0) {
      await finishJobLog(deps.prisma, jobLog.id, 'skipped');
      logInfo('axis_regeneration.skipped', {
        reason: 'no_processed_articles',
        userId: job.data.userId,
      });
      return;
    }

    const articleIds = articles.map((article) => article.id);
    await deps.prisma.articleAxisLabel.deleteMany({
      where: {
        articleId: {
          in: articleIds,
        },
      },
    });
    await deps.prisma.article.updateMany({
      data: {
        status: 'QUEUED',
      },
      where: {
        id: {
          in: articleIds,
        },
        userId: job.data.userId,
      },
    });

    await deps.articleQueue.addBulk(
      articles.map((article) => ({
        data: {
          articleId: article.id,
          reason: 'regeneration',
          userId: job.data.userId,
        },
        name: 'process-article',
        opts: {
          attempts: 2,
          backoff: {
            delay: 5000,
            type: 'exponential',
          },
          jobId: `regenerate-${article.id}-${Date.now()}`,
          removeOnComplete: 200,
          removeOnFail: 500,
        },
      })),
    );

    await finishJobLog(deps.prisma, jobLog.id, 'completed');
    logInfo('axis_regeneration.enqueued', {
      articleCount: articles.length,
      userId: job.data.userId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishJobLog(deps.prisma, jobLog.id, 'failed', message);
    logError('axis_regeneration.failed', {
      error: message,
      userId: job.data.userId,
    });
    throw error;
  }
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

function toJsonInput(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}
