import { XMLParser } from 'fast-xml-parser';

export interface ParsedFeedItem {
  title: string;
  url: string;
  author?: string;
  publishedAt?: Date;
  excerpt?: string;
  rawContent?: string;
}

interface ParsedDocument {
  rss?: {
    channel?: {
      item?: unknown;
    };
  };
  feed?: {
    entry?: unknown;
  };
}

const parser = new XMLParser({
  attributeNamePrefix: '',
  ignoreAttributes: false,
  trimValues: true,
});

export function parseFeedXml(xml: string, feedUrl: string): ParsedFeedItem[] {
  const document = parser.parse(xml) as ParsedDocument;
  const rssItems = asArray(document.rss?.channel?.item);
  const atomItems = asArray(document.feed?.entry);
  const isFeedDocument = Boolean(document.rss?.channel || document.feed);

  if (!isFeedDocument) {
    throw new Error('Feed is not valid RSS/Atom XML');
  }

  const items = rssItems.length > 0 ? rssItems : atomItems;

  if (items.length === 0) {
    throw new Error('Feed does not contain RSS/Atom entries');
  }

  return items
    .map((item) => parseItem(item, feedUrl))
    .filter((item): item is ParsedFeedItem => Boolean(item));
}

function parseItem(item: unknown, feedUrl: string): ParsedFeedItem | null {
  if (!isRecord(item)) {
    return null;
  }

  const title = textValue(item.title) || 'Untitled article';
  const url = extractLink(item, feedUrl);

  if (!url) {
    return null;
  }

  const rawContent =
    textValue(item['content:encoded']) ||
    textValue(item.content) ||
    textValue(item.summary) ||
    textValue(item.description);

  return {
    author: textValue(item.author) || textValue(item['dc:creator']),
    excerpt: stripHtml(rawContent ?? '').slice(0, 500) || undefined,
    publishedAt: parseDate(
      textValue(item.pubDate) ||
        textValue(item.published) ||
        textValue(item.updated) ||
        textValue(item['dc:date']),
    ),
    rawContent,
    title: stripHtml(title),
    url,
  };
}

function extractLink(
  item: Record<string, unknown>,
  feedUrl: string,
): string | null {
  const link = item.link;

  if (typeof link === 'string') {
    return normalizeUrl(link, feedUrl);
  }

  if (Array.isArray(link)) {
    const alternate = link.find(
      (entry) =>
        isRecord(entry) &&
        (!entry.rel || entry.rel === 'alternate') &&
        typeof entry.href === 'string',
    );
    if (isRecord(alternate) && typeof alternate.href === 'string') {
      return normalizeUrl(alternate.href, feedUrl);
    }
  }

  if (isRecord(link) && typeof link.href === 'string') {
    return normalizeUrl(link.href, feedUrl);
  }

  return null;
}

function normalizeUrl(url: string, baseUrl: string): string | null {
  try {
    return new URL(url.trim(), baseUrl).toString();
  } catch {
    return null;
  }
}

function parseDate(value?: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return undefined;
  }

  return new Date(timestamp);
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function textValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value.trim() || undefined;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (isRecord(value)) {
    if (typeof value['#text'] === 'string') {
      return value['#text'].trim() || undefined;
    }

    if (typeof value.text === 'string') {
      return value.text.trim() || undefined;
    }

    if (typeof value.name === 'string') {
      return value.name.trim() || undefined;
    }
  }

  return undefined;
}

function asArray(value: unknown): unknown[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
