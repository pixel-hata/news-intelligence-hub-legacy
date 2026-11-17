import type { PrismaClient } from '@nih/database';
import { queueNames } from '@nih/shared';
import type {
  PollActiveFeedsJobData,
  PollFeedJobData,
  ProcessArticleJobData,
} from '@nih/shared';
import type { Job, Queue } from 'bullmq';
import { Worker } from 'bullmq';
import type IORedis from 'ioredis';

import { logError, logInfo } from '../observability/logger';
import { saveDiscoveredArticles } from './article-discovery';
import type { ParsedFeedItem } from './feed-parser';
import { parseFeedXml } from './feed-parser';

type FeedPollingJobData = PollFeedJobData | PollActiveFeedsJobData;

interface FeedPollingWorkerDeps {
  articleQueue: Queue<ProcessArticleJobData>;
  connection: IORedis;
  feedQueue: Queue<FeedPollingJobData>;
  prisma: PrismaClient;
}

interface FeedRecord {
  id: string;
  userId: string;
  url: string;
  status: 'ACTIVE' | 'PAUSED' | 'ERROR';
  etag: string | null;
  lastModified: string | null;
}

interface FeedFetchResult {
  etag?: string;
  feedUrl: string;
  items: ParsedFeedItem[];
  lastModified?: string;
}

export function createFeedPollingWorker(
  deps: FeedPollingWorkerDeps,
): Worker<FeedPollingJobData> {
  const concurrency = Number(process.env.FEED_POLL_CONCURRENCY || 3);

  return new Worker<FeedPollingJobData>(
    queueNames.feedPolling,
    async (job) => handleJob(job, deps),
    {
      concurrency,
      connection: deps.connection,
    },
  );
}

async function handleJob(
  job: Job<FeedPollingJobData>,
  deps: FeedPollingWorkerDeps,
): Promise<void> {
  if (job.name === 'poll-active-feeds') {
    await pollActiveFeeds(job as Job<PollActiveFeedsJobData>, deps);
    return;
  }

  if (job.name === 'poll-feed') {
    await pollFeed(job as Job<PollFeedJobData>, deps);
    return;
  }

  logInfo('feed_polling.unknown_job_skipped', {
    jobId: job.id,
    jobName: job.name,
  });
}

async function pollActiveFeeds(
  job: Job<PollActiveFeedsJobData>,
  deps: FeedPollingWorkerDeps,
): Promise<void> {
  const now = new Date();
  const feeds = await deps.prisma.feed.findMany({
    where: {
      status: 'ACTIVE',
    },
  });

  const dueFeeds = feeds.filter((feed) => {
    if (!feed.lastPolledAt) {
      return true;
    }

    const nextPollAt = new Date(
      feed.lastPolledAt.getTime() + feed.pollingIntervalMinutes * 60 * 1000,
    );
    return nextPollAt <= now;
  });

  await Promise.all(
    dueFeeds.map((feed) =>
      deps.feedQueue.add(
        'poll-feed',
        {
          feedId: feed.id,
          requestedBy: job.data.requestedBy,
          userId: feed.userId,
        },
        {
          attempts: 3,
          backoff: {
            delay: 5000,
            type: 'exponential',
          },
          jobId: `feed-${feed.id}-${now.getTime()}`,
          removeOnComplete: 200,
          removeOnFail: 500,
        },
      ),
    ),
  );

  logInfo('feed_polling.active_feeds_enqueued', {
    dueFeedCount: dueFeeds.length,
    jobId: job.id,
    totalActiveFeedCount: feeds.length,
  });
}

async function pollFeed(
  job: Job<PollFeedJobData>,
  deps: FeedPollingWorkerDeps,
): Promise<void> {
  const startedAt = new Date();
  const jobLog = await deps.prisma.queueJobLog.create({
    data: {
      jobId: job.id,
      jobName: job.name,
      payload: toJsonInput(job.data),
      queueName: queueNames.feedPolling,
      startedAt,
      status: 'processing',
      userId: job.data.userId,
    },
  });

  try {
    const feed = await deps.prisma.feed.findFirst({
      where: {
        id: job.data.feedId,
        userId: job.data.userId,
      },
    });

    if (!feed || feed.status === 'PAUSED') {
      await finishJobLog(deps.prisma, jobLog.id, 'skipped');
      return;
    }

    const result = await fetchFeed(feed);
    const articlesCreated = await saveDiscoveredArticles(
      deps.prisma,
      deps.articleQueue,
      feed,
      result.items,
    );

    const nextFeedUrl =
      result.feedUrl !== feed.url
        ? await resolveCanonicalFeedUrl(deps.prisma, feed, result.feedUrl)
        : undefined;

    const feedUpdateData = {
      etag: result.etag ?? feed.etag,
      lastError: null,
      lastModified: result.lastModified ?? feed.lastModified,
      lastPolledAt: new Date(),
      status: 'ACTIVE' as const,
      ...(nextFeedUrl ? { url: nextFeedUrl } : {}),
    };

    try {
      await deps.prisma.feed.update({
        data: feedUpdateData,
        where: {
          id: feed.id,
        },
      });
    } catch (error) {
      if (!nextFeedUrl || !isFeedUrlUniqueConflict(error)) {
        throw error;
      }

      logInfo('feed_polling.canonical_url_race_skipped', {
        feedId: feed.id,
        feedUrl: nextFeedUrl,
      });

      await deps.prisma.feed.update({
        data: {
          ...feedUpdateData,
          url: undefined,
        },
        where: {
          id: feed.id,
        },
      });
    }

    await finishJobLog(deps.prisma, jobLog.id, 'completed');
    logInfo('feed_polling.feed_completed', {
      articlesCreated,
      feedId: feed.id,
      itemCount: result.items.length,
      jobId: job.id,
      userId: feed.userId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await deps.prisma.feed.updateMany({
      data: {
        lastError: message,
        lastPolledAt: new Date(),
        status: 'ERROR',
      },
      where: {
        id: job.data.feedId,
        userId: job.data.userId,
      },
    });
    await finishJobLog(deps.prisma, jobLog.id, 'failed', message);
    logError('feed_polling.feed_failed', {
      error: message,
      feedId: job.data.feedId,
      jobId: job.id,
      userId: job.data.userId,
    });
    throw error;
  }
}

async function fetchFeed(feed: FeedRecord): Promise<FeedFetchResult> {
  const timeoutMs = Number(process.env.FEED_FETCH_TIMEOUT_MS || 15000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchFeedUrl(
      feed,
      normalizeFeedRequestUrl(feed.url),
      controller.signal,
      timeoutMs,
      {
        allowDiscovery: true,
        allowFallbacks: true,
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFeedUrl(
  feed: FeedRecord,
  url: string,
  signal: AbortSignal,
  timeoutMs: number,
  options: {
    allowDiscovery: boolean;
    allowFallbacks: boolean;
  },
): Promise<FeedFetchResult> {
  const response = await fetchFeedResponse(feed, url, signal, timeoutMs);

  if (response.status === 304) {
    return {
      etag: response.headers.get('etag') ?? undefined,
      feedUrl: url,
      items: [],
      lastModified: response.headers.get('last-modified') ?? undefined,
    };
  }

  if (!response.ok) {
    if (options.allowFallbacks) {
      const fallback = await tryFallbackFeedUrls(
        feed,
        url,
        response,
        signal,
        timeoutMs,
      );

      if (fallback) {
        return fallback;
      }
    }

    throw new Error(feedHttpErrorMessage(response, url));
  }

  const contentType = response.headers.get('content-type') || '';
  const body = await response.text();

  if (looksLikeHtml(body, contentType)) {
    const discoveredUrl = options.allowDiscovery
      ? discoverFeedUrlFromHtml(body, response.url || url)
      : null;

    if (discoveredUrl) {
      logInfo('feed_polling.feed_url_discovered', {
        discoveredUrl,
        feedId: feed.id,
        originalUrl: url,
      });

      return fetchFeedUrl(feed, discoveredUrl, signal, timeoutMs, {
        allowDiscovery: false,
        allowFallbacks: false,
      });
    }

    throw new Error('URL returned HTML, not RSS/Atom XML');
  }

  if (!contentType.includes('xml') && !contentType.includes('rss')) {
    logInfo('feed_polling.unexpected_content_type', {
      contentType,
      feedId: feed.id,
    });
  }

  return {
    etag: response.headers.get('etag') ?? undefined,
    feedUrl: url,
    items: parseFeedXml(body, url).slice(
      0,
      Number(process.env.FEED_MAX_ITEMS_PER_RUN || 50),
    ),
    lastModified: response.headers.get('last-modified') ?? undefined,
  };
}

async function fetchFeedResponse(
  feed: FeedRecord,
  url: string,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<Response> {
  try {
    return await fetch(url, {
      headers: requestHeaders(feed),
      signal,
    });
  } catch (error) {
    throw new Error(feedFetchErrorMessage(error, url, timeoutMs));
  }
}

async function tryFallbackFeedUrls(
  feed: FeedRecord,
  url: string,
  response: Response,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<FeedFetchResult | null> {
  if (response.status !== 404) {
    return null;
  }

  for (const fallbackUrl of fallbackFeedUrls(url)) {
    try {
      const fallback = await fetchFeedUrl(feed, fallbackUrl, signal, timeoutMs, {
        allowDiscovery: true,
        allowFallbacks: false,
      });

      logInfo('feed_polling.feed_fallback_succeeded', {
        fallbackUrl,
        feedId: feed.id,
        originalUrl: url,
      });

      return fallback;
    } catch (error) {
      logInfo('feed_polling.feed_fallback_failed', {
        error: error instanceof Error ? error.message : String(error),
        fallbackUrl,
        feedId: feed.id,
        originalUrl: url,
      });
    }
  }

  return null;
}

function requestHeaders(feed: FeedRecord): HeadersInit {
  const headers: Record<string, string> = {
    accept:
      'application/atom+xml, application/rss+xml, application/rdf+xml, application/xml, text/xml, */*;q=0.8',
    'user-agent':
      process.env.FEED_FETCH_USER_AGENT ||
      'Mozilla/5.0 (compatible; UA-Skills-News-Intelligence-Hub/0.1; +https://ua-skills.local)',
  };

  if (feed.etag) {
    headers['if-none-match'] = feed.etag;
  }

  if (feed.lastModified) {
    headers['if-modified-since'] = feed.lastModified;
  }

  return headers;
}

async function resolveCanonicalFeedUrl(
  prisma: PrismaClient,
  feed: FeedRecord,
  feedUrl: string,
): Promise<string | undefined> {
  const existingFeed = await prisma.feed.findFirst({
    where: {
      id: {
        not: feed.id,
      },
      url: feedUrl,
      userId: feed.userId,
    },
  });

  if (existingFeed) {
    logInfo('feed_polling.canonical_url_conflict_skipped', {
      existingFeedId: existingFeed.id,
      feedId: feed.id,
      feedUrl,
    });
    return undefined;
  }

  return feedUrl;
}

export function normalizeFeedRequestUrl(url: string): string {
  try {
    const parsedUrl = new URL(url.trim());
    const trackingParams = Array.from(parsedUrl.searchParams.keys()).filter(
      (key) => isTrackingParam(key),
    );

    for (const key of trackingParams) {
      parsedUrl.searchParams.delete(key);
    }

    parsedUrl.hash = '';
    return parsedUrl.toString();
  } catch {
    return url.trim();
  }
}

export function fallbackFeedUrls(url: string): string[] {
  try {
    const parsedUrl = new URL(normalizeFeedRequestUrl(url));
    const segments = parsedUrl.pathname.split('/').filter(Boolean);
    const isRootSlugFeed =
      segments.length === 2 &&
      segments[1].toLowerCase() === 'feed' &&
      segments[0].toLowerCase() !== 'category';

    if (!isRootSlugFeed) {
      return [];
    }

    parsedUrl.pathname = `/category/${segments[0]}/feed/`;
    parsedUrl.search = '';
    return [parsedUrl.toString()];
  } catch {
    return [];
  }
}

export function discoverFeedUrlFromHtml(
  html: string,
  pageUrl: string,
): string | null {
  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
  const candidates = linkTags
    .map((tag) => {
      const href = extractHtmlAttribute(tag, 'href');
      const rel = extractHtmlAttribute(tag, 'rel')?.toLowerCase() ?? '';
      const type = extractHtmlAttribute(tag, 'type')?.toLowerCase() ?? '';

      if (!href) {
        return null;
      }

      const isFeedType =
        type.includes('rss') ||
        type.includes('atom') ||
        type.includes('rdf') ||
        type.includes('xml');
      const isLikelyFeedLink =
        rel.includes('alternate') &&
        (href.toLowerCase().includes('feed') ||
          href.toLowerCase().includes('rss') ||
          href.toLowerCase().includes('atom'));

      if (!isFeedType && !isLikelyFeedLink) {
        return null;
      }

      try {
        return {
          score: type.includes('rss')
            ? 3
            : type.includes('atom') || type.includes('rdf')
              ? 2
              : 1,
          url: new URL(href, pageUrl).toString(),
        };
      } catch {
        return null;
      }
    })
    .filter(
      (candidate): candidate is { score: number; url: string } =>
        candidate !== null,
    )
    .sort((left, right) => right.score - left.score);

  return candidates[0]?.url ?? null;
}

export function feedFetchErrorMessage(
  error: unknown,
  url: string,
  timeoutMs: number,
): string {
  if (error instanceof Error && error.name === 'AbortError') {
    return `Feed fetch timed out after ${timeoutMs}ms`;
  }

  const cause = error instanceof Error ? error.cause : undefined;
  const code =
    isRecord(cause) && typeof cause.code === 'string' ? cause.code : undefined;
  const causeMessage = cause instanceof Error ? cause.message : undefined;
  const message = error instanceof Error ? error.message : String(error);
  const host = hostnameFor(url);

  if (code === 'ENOTFOUND') {
    return `Feed host cannot be resolved: ${host} (${code})`;
  }

  if (code === 'ECONNREFUSED') {
    return `Feed connection refused by host: ${host} (${code})`;
  }

  if (code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT') {
    return `Feed connection timed out: ${host} (${code})`;
  }

  if (code?.includes('CERT') || code?.includes('TLS')) {
    return `Feed TLS/certificate error: ${causeMessage ?? message} (${code})`;
  }

  if (causeMessage && causeMessage !== message) {
    return `Feed fetch failed: ${causeMessage}${code ? ` (${code})` : ''}`;
  }

  return `Feed fetch failed: ${message}${code ? ` (${code})` : ''}`;
}

function feedHttpErrorMessage(response: Response, url: string): string {
  const statusText = response.statusText ? ` ${response.statusText}` : '';
  const finalUrl =
    response.url && response.url !== url ? ` (${response.url})` : '';

  return `Feed returned HTTP ${response.status}${statusText}${finalUrl}`;
}

function looksLikeHtml(body: string, contentType: string): boolean {
  const trimmedBody = body.trimStart().slice(0, 100).toLowerCase();
  return (
    contentType.toLowerCase().includes('text/html') ||
    trimmedBody.startsWith('<!doctype html') ||
    trimmedBody.startsWith('<html')
  );
}

function extractHtmlAttribute(tag: string, name: string): string | undefined {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i'),
  );

  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function isTrackingParam(key: string): boolean {
  const normalizedKey = key.toLowerCase();
  return (
    normalizedKey.startsWith('utm_') ||
    normalizedKey === 'fbclid' ||
    normalizedKey === 'gclid' ||
    normalizedKey === 'igshid' ||
    normalizedKey === 'mc_cid' ||
    normalizedKey === 'mc_eid'
  );
}

function hostnameFor(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFeedUrlUniqueConflict(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes('Unique constraint failed') &&
    error.message.includes('userId') &&
    error.message.includes('url')
  );
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
