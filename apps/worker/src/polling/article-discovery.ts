import type { PrismaClient } from '@nih/database';
import type { ProcessArticleJobData } from '@nih/shared';
import type { Queue } from 'bullmq';
import { createHash } from 'node:crypto';

import type { ParsedFeedItem } from './feed-parser';

export interface DiscoveredFeedRecord {
  id: string;
  userId: string;
}

interface PrismaUniqueError {
  code?: string;
}

export async function saveDiscoveredArticles(
  prisma: PrismaClient,
  articleQueue: Queue<ProcessArticleJobData>,
  feed: DiscoveredFeedRecord,
  items: ParsedFeedItem[],
): Promise<number> {
  let created = 0;

  for (const item of items) {
    const liveFeed = await prisma.feed.findFirst({
      select: {
        id: true,
      },
      where: {
        id: feed.id,
        userId: feed.userId,
      },
    });

    if (!liveFeed) {
      return created;
    }

    const normalizedUrl = normalizeUrl(item.url);
    const existing = await prisma.article.findFirst({
      where: {
        normalizedUrl,
        userId: feed.userId,
      },
    });

    if (existing) {
      continue;
    }

    const textContent = stripHtml(item.rawContent ?? item.excerpt ?? '');
    const article = await createArticleIfMissing(prisma, {
      author: item.author,
      excerpt: item.excerpt,
      feedId: feed.id,
      normalizedUrl,
      publishedAt: item.publishedAt,
      rawContent: item.rawContent,
      sourceUrl: item.url,
      status: 'DISCOVERED',
      textContent: textContent || null,
      textContentHash: textContent ? hash(textContent) : null,
      title: item.title,
      urlHash: hash(normalizedUrl),
      userId: feed.userId,
    });
    if (!article) {
      continue;
    }
    await articleQueue.add(
      'process-article',
      {
        articleId: article.id,
        reason: 'feed_poll',
        userId: feed.userId,
      },
      {
        attempts: 3,
        backoff: {
          delay: 5000,
          type: 'exponential',
        },
        jobId: `article-${article.id}`,
        removeOnComplete: 500,
        removeOnFail: 1000,
      },
    );
    created += 1;
  }

  return created;
}

async function createArticleIfMissing(
  prisma: PrismaClient,
  data: Parameters<PrismaClient['article']['create']>[0]['data'],
): Promise<{ id: string } | null> {
  try {
    return await prisma.article.create({
      data,
    });
  } catch (error) {
    if (isUniqueError(error)) {
      return null;
    }
    throw error;
  }
}

function normalizeUrl(url: string): string {
  return new URL(url.trim()).toString();
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isUniqueError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as PrismaUniqueError).code === 'P2002'
  );
}
