import assert from 'node:assert/strict';
import test from 'node:test';

import {
  discoverFeedUrlFromHtml,
  fallbackFeedUrls,
  feedFetchErrorMessage,
  normalizeFeedRequestUrl,
} from './feed-polling.worker';

test('normalizes feed URLs by removing tracking params and hash fragments', () => {
  assert.equal(
    normalizeFeedRequestUrl(
      'https://example.com/feed/?utm_source=chatgpt.com&keep=1#comments',
    ),
    'https://example.com/feed/?keep=1',
  );
});

test('suggests a WordPress category feed fallback for root slug feed URLs', () => {
  assert.deepEqual(
    fallbackFeedUrls('https://venturebeat.com/ai/feed/?utm_source=chatgpt.com'),
    ['https://venturebeat.com/category/ai/feed/'],
  );
});

test('discovers RSS/Atom feeds from HTML alternate links', () => {
  const discoveredUrl = discoverFeedUrlFromHtml(
    `
      <html>
        <head>
          <link rel="alternate" type="application/atom+xml" href="/atom.xml">
          <link rel="alternate" type="application/rss+xml" href="../feed/">
        </head>
      </html>
    `,
    'https://example.com/topic/ai/',
  );

  assert.equal(discoveredUrl, 'https://example.com/topic/feed/');
});

test('turns generic fetch failures into actionable feed errors', () => {
  const error = new Error('fetch failed', {
    cause: Object.assign(new Error('getaddrinfo ENOTFOUND feeds.example.com'), {
      code: 'ENOTFOUND',
    }),
  });

  assert.equal(
    feedFetchErrorMessage(error, 'https://feeds.example.com/rss', 15000),
    'Feed host cannot be resolved: feeds.example.com (ENOTFOUND)',
  );
});
