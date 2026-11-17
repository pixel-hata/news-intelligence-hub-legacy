import assert from 'node:assert/strict';
import test from 'node:test';

import { preFilterArticle } from './article-pre-filter';

const config = {
  maxTextChars: 1000,
  minTextChars: 80,
  seoPhraseThreshold: 2,
};

test('accepts a normal article before LLM processing', () => {
  const result = preFilterArticle(
    {
      sourceUrl: 'https://example.com/ai-infrastructure',
      textContent:
        'Cloud providers are updating inference capacity planning as enterprises move more workloads into production. The article has enough factual text to pass the cheap deterministic gate before LLM analysis.',
      title: 'AI infrastructure teams expand inference planning',
    },
    config,
  );

  assert.equal(result.accepted, true);
  assert.equal(result.reason, undefined);
});

test('rejects short content', () => {
  const result = preFilterArticle(
    {
      sourceUrl: 'https://example.com/tiny',
      textContent: 'Too short.',
      title: 'Brief',
    },
    config,
  );

  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'text_too_short');
});

test('rejects obvious SEO junk before LLM processing', () => {
  const result = preFilterArticle(
    {
      sourceUrl: 'https://example.com/coupon-code',
      textContent:
        'This sponsored post advertises a casino bonus and discount code. It is intentionally long enough to avoid the short-text branch and should be stopped by the SEO phrase gate.',
      title: 'Sponsored post for coupon code traffic',
    },
    config,
  );

  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'seo_junk');
});
