export interface ArticlePreFilterInput {
  sourceUrl: string;
  textContent?: string | null;
  title: string;
}

export interface ArticlePreFilterConfig {
  maxTextChars: number;
  minTextChars: number;
  seoPhraseThreshold: number;
}

export interface ArticlePreFilterResult {
  accepted: boolean;
  reason?: string;
}

const seoJunkPhrases = [
  'casino bonus',
  'coupon code',
  'discount code',
  'guest post',
  'sponsored post',
  'write for us',
];

export function getArticlePreFilterConfig(): ArticlePreFilterConfig {
  return {
    maxTextChars: Number(process.env.ARTICLE_MAX_TEXT_CHARS || 50000),
    minTextChars: Number(process.env.ARTICLE_MIN_TEXT_CHARS || 500),
    seoPhraseThreshold: Number(process.env.ARTICLE_SEO_PHRASE_THRESHOLD || 2),
  };
}

export function preFilterArticle(
  input: ArticlePreFilterInput,
  config: ArticlePreFilterConfig,
): ArticlePreFilterResult {
  const text = normalizeText(`${input.title}\n${input.textContent ?? ''}`);

  if (!text) {
    return {
      accepted: false,
      reason: 'empty_text',
    };
  }

  if (text.length < config.minTextChars) {
    return {
      accepted: false,
      reason: 'text_too_short',
    };
  }

  if (text.length > config.maxTextChars) {
    return {
      accepted: false,
      reason: 'text_too_long',
    };
  }

  if (countSeoPhrases(text, input.sourceUrl) >= config.seoPhraseThreshold) {
    return {
      accepted: false,
      reason: 'seo_junk',
    };
  }

  return {
    accepted: true,
  };
}

function countSeoPhrases(text: string, sourceUrl: string): number {
  const haystack = `${text} ${sourceUrl}`.toLowerCase();
  return seoJunkPhrases.filter((phrase) => haystack.includes(phrase)).length;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
