import assert from 'node:assert/strict';
import test from 'node:test';

import { parseFeedXml } from './feed-parser';

test('parses RSS items with normalized links, dates, authors, and clean excerpts', () => {
  const items = parseFeedXml(
    `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <channel>
        <item>
          <title><![CDATA[<b>AI</b> launch]]></title>
          <link>/posts/ai-launch</link>
          <pubDate>Tue, 26 May 2026 10:00:00 GMT</pubDate>
          <dc:creator>Reporter One</dc:creator>
          <description><![CDATA[<p>Short <strong>summary</strong></p>]]></description>
          <content:encoded><![CDATA[<article>Full <em>article</em> body</article>]]></content:encoded>
        </item>
        <item>
          <title>Missing link is skipped</title>
        </item>
      </channel>
    </rss>`,
    'https://example.com/news/rss.xml',
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'AI launch');
  assert.equal(items[0].url, 'https://example.com/posts/ai-launch');
  assert.equal(items[0].author, 'Reporter One');
  assert.equal(items[0].excerpt, 'Full article body');
  assert.equal(items[0].publishedAt?.toISOString(), '2026-05-26T10:00:00.000Z');
});

test('parses Atom entries and prefers alternate links', () => {
  const items = parseFeedXml(
    `<?xml version="1.0" encoding="UTF-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <title>Atom item</title>
        <link rel="self" href="/feeds/item.xml" />
        <link rel="alternate" href="../articles/atom-item" />
        <author><name>Ada Writer</name></author>
        <updated>2026-05-26T12:30:00Z</updated>
        <summary type="html"><![CDATA[<p>Atom <strong>summary</strong></p>]]></summary>
      </entry>
    </feed>`,
    'https://example.com/news/feed.xml',
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Atom item');
  assert.equal(items[0].url, 'https://example.com/articles/atom-item');
  assert.equal(items[0].author, 'Ada Writer');
  assert.equal(items[0].excerpt, 'Atom summary');
  assert.equal(items[0].publishedAt?.toISOString(), '2026-05-26T12:30:00.000Z');
});
