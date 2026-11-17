const lowSignalEntityNames = new Set([
  'a',
  'about',
  'above',
  'after',
  'again',
  'against',
  'all',
  'also',
  'although',
  'and',
  'another',
  'any',
  'around',
  'as',
  'at',
  'back',
  'before',
  'below',
  'between',
  'but',
  'by',
  'can',
  'could',
  'did',
  'do',
  'does',
  'during',
  'everyone',
  'for',
  'four',
  'friday',
  'from',
  'had',
  'has',
  'have',
  'here',
  'how',
  'if',
  'image',
  'in',
  'into',
  'is',
  'it',
  'its',
  'last',
  'later',
  'like',
  'many',
  'may',
  'monday',
  'more',
  'most',
  'new',
  'now',
  'of',
  'on',
  'one',
  'or',
  'other',
  'photo',
  'read',
  'saturday',
  'science',
  'search',
  'share',
  'should',
  'startup rock',
  'sunday',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'thursday',
  'to',
  'today',
  'tuesday',
  'unlike',
  'was',
  'we',
  'wednesday',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'with',
  'would',
  'you',
  'your',
]);

const lowSignalStarts = new Set([
  'a',
  'an',
  'cloud',
  'it',
  'operationally',
  'the',
  'this',
]);

const highSignalSingleNames = new Set([
  'adobe',
  'ai',
  'amazon',
  'anthropic',
  'apple',
  'aws',
  'azure',
  'bitcoin',
  'chatgpt',
  'claude',
  'copilot',
  'deepmind',
  'deepseek',
  'eu',
  'gemini',
  'github',
  'gitlab',
  'google',
  'gpt',
  'intel',
  'ios',
  'mit',
  'mistral',
  'microsoft',
  'nvidia',
  'openai',
  'perplexity',
  'reuters',
  'sec',
  'uk',
  'us',
  'xai',
]);

export function isLowSignalEntityName(name: string): boolean {
  const normalized = normalizeEntitySignalName(name);
  if (!normalized) {
    return true;
  }

  const words = normalized.split(' ');
  if (lowSignalStarts.has(words[0])) {
    return true;
  }

  if (lowSignalEntityNames.has(normalized)) {
    return true;
  }

  return words.every((word) => lowSignalEntityNames.has(word));
}

export function isLikelyNamedEntityName(name: string): boolean {
  if (isLowSignalEntityName(name)) {
    return false;
  }

  const normalized = normalizeEntitySignalName(name);
  const words = normalized.split(' ');

  if (words.length > 1) {
    return true;
  }

  if (highSignalSingleNames.has(normalized)) {
    return true;
  }

  return isUppercaseAcronym(name) || hasInternalCapital(name);
}

export function cleanEntityCandidateName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);

  while (words.length > 0 && lowSignalEntityNames.has(normalizeEntitySignalName(words[0]))) {
    words.shift();
  }

  while (
    words.length > 0 &&
    lowSignalEntityNames.has(normalizeEntitySignalName(words[words.length - 1]))
  ) {
    words.pop();
  }

  return words.join(' ');
}

export function normalizeEntitySignalName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}&.-]+/gu, ' ')
    .trim();
}

function isUppercaseAcronym(name: string): boolean {
  const compact = name.replace(/[^A-Za-z0-9]/g, '');
  return compact.length >= 2 && compact === compact.toUpperCase();
}

function hasInternalCapital(name: string): boolean {
  const compact = name.replace(/[^A-Za-z]/g, '');
  return /[a-z][A-Z]/.test(compact);
}
