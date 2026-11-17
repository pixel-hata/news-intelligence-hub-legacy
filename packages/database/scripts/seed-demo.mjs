import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const demoEmail = process.env.DEMO_USER_EMAIL || 'demo@example.com';
const demoPassword = 'demo-password';
const demoPasswordHash =
  '$2b$10$yn1gCoFTUrWMzgY0skgtr.c2MbHaLZ554xIu2gS0esnsLEwOjT88q';

const categories = [
  {
    color: '#2563eb',
    description: 'Models, chips, cloud platforms, tooling, and deployment.',
    excludeKeywords: [],
    includeKeywords: ['model', 'chip', 'cloud', 'inference', 'infrastructure', 'deployment', 'tooling'],
    name: 'AI Infrastructure',
    ruleText: 'Match infrastructure, deployment, inference, chips, cloud, and model tooling.',
  },
  {
    color: '#059669',
    description: 'New products, releases, integrations, and public betas.',
    excludeKeywords: [],
    includeKeywords: ['launch', 'release', 'integration', 'beta', 'feature', 'rollout', 'introduced', 'announced'],
    name: 'Product Launches',
    ruleText: 'Match product launches, releases, integrations, public betas, and feature rollouts.',
  },
  {
    color: '#c2410c',
    description: 'Funding, revenue, pricing, adoption, and competitive moves.',
    excludeKeywords: [],
    includeKeywords: ['funding', 'revenue', 'pricing', 'adoption', 'market', 'competitive', 'customers'],
    name: 'Market Signals',
    ruleText: 'Match market signals, customer adoption, funding, revenue, pricing, and competitive moves.',
  },
  {
    color: '#7c3aed',
    description: 'Regulation, safety, security, governance, and legal risk.',
    excludeKeywords: [],
    includeKeywords: ['regulation', 'governance', 'security', 'safety', 'compliance', 'legal', 'risk', 'policy'],
    name: 'Policy and Risk',
    ruleText: 'Match regulation, governance, compliance, legal risk, security, safety, and policy.',
  },
];

const axes = [
  {
    description: 'How much the article can affect product, market, or strategy.',
    labels: ['low', 'medium', 'high', 'critical'],
    name: 'Business Impact',
    prompt:
      'Classify business impact as low, medium, high, or critical for a technology decision maker.',
    sortOrder: 10,
  },
  {
    description: 'How quickly a reader should react to this information.',
    labels: ['background', 'monitor', 'act this week', 'urgent'],
    name: 'Time Sensitivity',
    prompt:
      'Classify time sensitivity as background, monitor, act this week, or urgent.',
    sortOrder: 20,
  },
  {
    description: 'Whether the article repeats known context or adds new facts.',
    labels: ['repeated', 'incremental', 'notable', 'breakthrough'],
    name: 'Novelty',
    prompt:
      'Classify novelty as repeated, incremental, notable, or breakthrough.',
    sortOrder: 30,
  },
  {
    description: 'How reliable the article appears based on source and evidence.',
    labels: ['low', 'medium', 'high', 'verified'],
    name: 'Confidence',
    prompt:
      'Classify confidence as low, medium, high, or verified. Flag rumors carefully.',
    sortOrder: 40,
  },
];

const feeds = [
  {
    title: 'OpenAI News',
    url: 'https://openai.com/news/rss.xml',
  },
  {
    title: 'MIT Technology Review AI',
    url: 'https://www.technologyreview.com/feed/',
  },
  {
    title: 'The Verge AI',
    url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
  },
];

const articleSeeds = [
  {
    axisLabels: {
      'Business Impact': 'high',
      Confidence: 'high',
      Novelty: 'notable',
      'Time Sensitivity': 'act this week',
    },
    categories: ['Product Launches', 'AI Infrastructure'],
    daysAgo: 1,
    entities: ['OpenAI', 'Enterprise AI', 'Agentic Workflows'],
    feedTitle: 'OpenAI News',
    importance: 'HIGH',
    key: 'openai-agent-controls',
    summary:
      'OpenAI expanded enterprise controls for agent workflows, putting governance, tool access, and auditability at the center of deployment decisions.',
    title: 'OpenAI expands enterprise controls for agent workflows',
  },
  {
    axisLabels: {
      'Business Impact': 'medium',
      Confidence: 'high',
      Novelty: 'incremental',
      'Time Sensitivity': 'monitor',
    },
    categories: ['Policy and Risk', 'Product Launches'],
    daysAgo: 2,
    entities: ['Anthropic', 'Claude', 'AI Governance'],
    feedTitle: 'MIT Technology Review AI',
    importance: 'NORMAL',
    key: 'anthropic-governance-tools',
    summary:
      'Anthropic introduced governance features for Claude deployments, giving teams more structure around policy enforcement and model behavior review.',
    title: 'Anthropic adds governance tooling for Claude deployments',
  },
  {
    axisLabels: {
      'Business Impact': 'high',
      Confidence: 'medium',
      Novelty: 'notable',
      'Time Sensitivity': 'act this week',
    },
    categories: ['AI Infrastructure', 'Market Signals'],
    daysAgo: 3,
    entities: ['NVIDIA', 'Inference Infrastructure', 'Enterprise AI'],
    feedTitle: 'The Verge AI',
    importance: 'HIGH',
    key: 'nvidia-inference-platform',
    summary:
      'NVIDIA updated its inference platform messaging toward smaller software teams, signaling pressure to make production AI deployments cheaper and easier to operate.',
    title: 'NVIDIA targets smaller teams with updated inference platform',
  },
  {
    axisLabels: {
      'Business Impact': 'medium',
      Confidence: 'verified',
      Novelty: 'incremental',
      'Time Sensitivity': 'monitor',
    },
    categories: ['Policy and Risk'],
    daysAgo: 4,
    entities: ['European Union', 'AI Governance', 'EU AI Act'],
    feedTitle: 'MIT Technology Review AI',
    importance: 'NORMAL',
    key: 'eu-ai-guidance',
    summary:
      'European regulators clarified AI deployment expectations, making documentation, risk review, and operational monitoring more important for product teams.',
    title: 'EU regulators clarify deployment guidance for AI systems',
  },
  {
    axisLabels: {
      'Business Impact': 'high',
      Confidence: 'medium',
      Novelty: 'incremental',
      'Time Sensitivity': 'act this week',
    },
    categories: ['Product Launches', 'Policy and Risk'],
    daysAgo: 1,
    entities: ['OpenAI', 'Agentic Workflows', 'AI Governance'],
    feedTitle: 'The Verge AI',
    importance: 'HIGH',
    key: 'openai-agent-controls-followup',
    similarTo: 'openai-agent-controls',
    summary:
      'A follow-up report focused on how enterprise customers are testing OpenAI agent controls before allowing broader internal tool access.',
    title: 'Enterprise customers test OpenAI agent controls before rollout',
  },
  {
    axisLabels: {},
    categories: [],
    daysAgo: 1,
    entities: [],
    feedTitle: 'The Verge AI',
    filteredReason: 'below_minimum_text_length',
    importance: 'JUNK',
    key: 'filtered-short-seo-item',
    status: 'FILTERED',
    summary:
      'This deterministic demo item is intentionally filtered before any LLM call.',
    title: 'Thin promo item filtered before LLM processing',
  },
];

const entitySeeds = {
  'Agentic Workflows': {
    aliases: ['AI agents'],
    description: 'Autonomous or semi-autonomous workflows that use tools and models.',
    type: 'TOPIC',
  },
  'AI Governance': {
    aliases: ['AI policy controls'],
    description: 'Processes and controls for responsible AI deployment.',
    type: 'TOPIC',
  },
  Anthropic: {
    aliases: ['Anthropic AI'],
    description: 'AI company behind Claude.',
    type: 'COMPANY',
  },
  Claude: {
    aliases: ['Claude AI'],
    description: 'Anthropic model family.',
    type: 'PRODUCT',
  },
  'Enterprise AI': {
    aliases: ['AI for business'],
    description: 'AI deployments inside commercial organizations.',
    type: 'TOPIC',
  },
  'EU AI Act': {
    aliases: ['European AI Act'],
    description: 'European regulatory framework for AI systems.',
    type: 'TOPIC',
  },
  'European Union': {
    aliases: ['EU'],
    description: 'Regional policy body shaping AI regulation.',
    type: 'LOCATION',
  },
  'Inference Infrastructure': {
    aliases: ['AI inference'],
    description: 'Runtime infrastructure used to serve AI model outputs.',
    type: 'TECHNOLOGY',
  },
  NVIDIA: {
    aliases: ['Nvidia'],
    description: 'AI chip and infrastructure company.',
    type: 'COMPANY',
  },
  OpenAI: {
    aliases: ['OpenAI, Inc.'],
    description: 'AI research and product company.',
    type: 'COMPANY',
  },
};

async function main() {
  const now = new Date();
  const user = await prisma.user.upsert({
    create: {
      displayName: 'Demo Analyst',
      email: demoEmail,
      emailConfirmedAt: now,
      passwordHash: demoPasswordHash,
    },
    update: {
      displayName: 'Demo Analyst',
      emailConfirmedAt: now,
      passwordHash: demoPasswordHash,
    },
    where: {
      email: demoEmail,
    },
  });

  const categoryByName = await seedCategories(user.id);
  const labelByAxisAndName = await seedAxes(user.id);
  const feedByTitle = await seedFeeds(user.id);
  const entityByName = await seedEntities(user.id, now);
  const articleByKey = await seedArticles({
    categoryByName,
    entityByName,
    feedByTitle,
    labelByAxisAndName,
    now,
    userId: user.id,
  });

  await seedTelemetry(user.id, articleByKey);
  await seedDigest(user.id, articleByKey, now);

  console.log(
    JSON.stringify(
      {
        articles: Object.keys(articleByKey).length,
        email: demoEmail,
        password: demoPassword,
        status: 'seeded',
      },
      null,
      2,
    ),
  );
}

async function seedCategories(userId) {
  const result = new Map();

  for (const category of categories) {
    const saved = await prisma.category.upsert({
      create: {
        ...category,
        userId,
      },
      update: category,
      where: {
        userId_name: {
          name: category.name,
          userId,
        },
      },
    });
    result.set(saved.name, saved);
  }

  return result;
}

async function seedAxes(userId) {
  const result = new Map();

  for (const axisSeed of axes) {
    const axis = await prisma.categorizationAxis.upsert({
      create: {
        description: axisSeed.description,
        isActive: true,
        name: axisSeed.name,
        prompt: axisSeed.prompt,
        sortOrder: axisSeed.sortOrder,
        userId,
      },
      update: {
        description: axisSeed.description,
        isActive: true,
        prompt: axisSeed.prompt,
        sortOrder: axisSeed.sortOrder,
      },
      where: {
        userId_name: {
          name: axisSeed.name,
          userId,
        },
      },
    });

    for (const [index, labelName] of axisSeed.labels.entries()) {
      const label = await prisma.axisLabel.upsert({
        create: {
          axisId: axis.id,
          name: labelName,
          sortOrder: (index + 1) * 10,
        },
        update: {
          sortOrder: (index + 1) * 10,
        },
        where: {
          axisId_name: {
            axisId: axis.id,
            name: labelName,
          },
        },
      });
      result.set(`${axis.name}:${label.name}`, label);
    }
  }

  return result;
}

async function seedFeeds(userId) {
  const result = new Map();

  for (const feed of feeds) {
    const saved = await prisma.feed.upsert({
      create: {
        ...feed,
        lastPolledAt: new Date(),
        status: 'ACTIVE',
        userId,
      },
      update: {
        lastError: null,
        status: 'ACTIVE',
        title: feed.title,
      },
      where: {
        userId_url: {
          url: feed.url,
          userId,
        },
      },
    });
    result.set(saved.title, saved);
  }

  return result;
}

async function seedEntities(userId, now) {
  const result = new Map();

  for (const [name, entity] of Object.entries(entitySeeds)) {
    const normalizedName = normalize(name);
    const saved = await prisma.entity.upsert({
      create: {
        confidence: 0.9,
        description: entity.description,
        firstSeenAt: now,
        lastSeenAt: now,
        name,
        normalizedName,
        type: entity.type,
        userId,
      },
      update: {
        description: entity.description,
        lastSeenAt: now,
      },
      where: {
        userId_type_normalizedName: {
          normalizedName,
          type: entity.type,
          userId,
        },
      },
    });

    await prisma.entityAlias.createMany({
      data: entity.aliases.map((alias) => ({
        alias,
        entityId: saved.id,
        normalizedAlias: normalize(alias),
      })),
      skipDuplicates: true,
    });
    result.set(name, saved);
  }

  return result;
}

async function seedArticles(input) {
  const result = {};

  for (const articleSeed of articleSeeds) {
    const publishedAt = daysBefore(input.now, articleSeed.daysAgo);
    const normalizedUrl = `https://example.com/news/${articleSeed.key}`;
    const textContent = buildArticleText(articleSeed);
    const feed = input.feedByTitle.get(articleSeed.feedTitle);

    const article = await prisma.article.upsert({
      create: {
        excerpt: articleSeed.summary,
        feedId: feed?.id,
        filteredReason: articleSeed.filteredReason ?? null,
        importance: articleSeed.importance,
        language: 'en',
        normalizedUrl,
        processedAt: input.now,
        publishedAt,
        rawContent: textContent,
        similarCount: 0,
        sourceUrl: normalizedUrl,
        status: articleSeed.status ?? 'PROCESSED',
        summary: articleSeed.summary,
        textContent,
        textContentHash: hash(textContent),
        title: articleSeed.title,
        urlHash: hash(normalizedUrl),
        userId: input.userId,
      },
      update: {
        excerpt: articleSeed.summary,
        feedId: feed?.id,
        filteredReason: articleSeed.filteredReason ?? null,
        importance: articleSeed.importance,
        processedAt: input.now,
        publishedAt,
        rawContent: textContent,
        status: articleSeed.status ?? 'PROCESSED',
        summary: articleSeed.summary,
        textContent,
        textContentHash: hash(textContent),
        title: articleSeed.title,
      },
      where: {
        userId_normalizedUrl: {
          normalizedUrl,
          userId: input.userId,
        },
      },
    });

    await replaceArticleCategories(article.id, articleSeed.categories, input.categoryByName);
    await replaceArticleAxisLabels(
      article.id,
      articleSeed.axisLabels,
      input.labelByAxisAndName,
    );
    await replaceArticleEntities(article.id, articleSeed.entities, input.entityByName);

    result[articleSeed.key] = article;
  }

  for (const articleSeed of articleSeeds.filter((seed) => seed.similarTo)) {
    const article = result[articleSeed.key];
    const parent = result[articleSeed.similarTo];
    await prisma.article.updateMany({
      data: {
        similarCount: 1,
        similarityGroupId: parent.id,
      },
      where: {
        id: {
          in: [article.id, parent.id],
        },
      },
    });
  }

  return result;
}

async function replaceArticleCategories(articleId, categoryNames, categoryByName) {
  await prisma.articleCategory.deleteMany({
    where: {
      articleId,
    },
  });
  await prisma.articleCategory.createMany({
    data: categoryNames.map((name) => ({
      articleId,
      categoryId: categoryByName.get(name).id,
      confidence: 0.9,
    })),
    skipDuplicates: true,
  });
}

async function replaceArticleAxisLabels(articleId, labelsByAxis, labelByAxisAndName) {
  await prisma.articleAxisLabel.deleteMany({
    where: {
      articleId,
    },
  });
  await prisma.articleAxisLabel.createMany({
    data: Object.entries(labelsByAxis).map(([axisName, labelName]) => ({
      articleId,
      axisLabelId: labelByAxisAndName.get(`${axisName}:${labelName}`).id,
      confidence: 0.9,
    })),
    skipDuplicates: true,
  });
}

async function replaceArticleEntities(articleId, entityNames, entityByName) {
  await prisma.articleEntity.deleteMany({
    where: {
      articleId,
    },
  });

  await prisma.articleEntity.createMany({
    data: entityNames.map((name) => ({
      articleId,
      entityId: entityByName.get(name).id,
      evidence: { source: 'demo-seed' },
      mentions: 2,
      relevance: 0.9,
    })),
    skipDuplicates: true,
  });
}

async function seedTelemetry(userId, articleByKey) {
  await prisma.llmCall.deleteMany({
    where: {
      model: 'mock-local-analysis',
      task: 'article-analysis',
      userId,
    },
  });

  for (const article of Object.values(articleByKey).filter(
    (article) => article.status === 'PROCESSED',
  )) {
    await prisma.llmCall.create({
      data: {
        articleId: article.id,
        cacheHit: false,
        completionTokens: 180,
        durationMs: 240,
        estimatedCostUsd: estimateDemoLlmCostUsd({
          completionTokens: 180,
          promptTokens: 860,
        }),
        model: 'mock-local-analysis',
        promptTokens: 860,
        provider: 'MOCK',
        status: 'completed',
        task: 'article-analysis',
        totalTokens: 1040,
        userId,
      },
    });

    await prisma.llmCacheEntry.upsert({
      create: {
        cacheKey: `demo:${article.id}`,
        inputHash: article.textContentHash || hash(article.title),
        model: 'mock-local-analysis',
        outputJson: {
          source: 'demo-seed',
          summary: article.summary,
        },
        provider: 'MOCK',
        task: 'article-analysis',
        userId,
      },
      update: {
        outputJson: {
          source: 'demo-seed',
          summary: article.summary,
        },
      },
      where: {
        userId_cacheKey: {
          cacheKey: `demo:${article.id}`,
          userId,
        },
      },
    });
  }
}

async function seedDigest(userId, articleByKey, now) {
  const periodStart = daysBefore(now, 7);
  const periodEnd = now;
  const processedArticles = Object.values(articleByKey).filter(
    (article) => article.status === 'PROCESSED',
  );
  const articleIds = processedArticles.map((article) => article.id);

  await prisma.digest.deleteMany({
    where: {
      title: 'Demo weekly intelligence digest',
      userId,
    },
  });
  await prisma.digest.create({
    data: {
      payload: {
        articleCount: articleIds.length,
        articleIds,
        focus: [
          'agent controls',
          'AI governance',
          'inference infrastructure',
        ],
        keyArticles: processedArticles.slice(0, 5).map((article) => ({
          id: article.id,
          title: article.title,
        })),
        periodLabel: 'week',
        source: 'demo-seed',
      },
      periodEnd,
      periodStart,
      scopeHash: 'all',
      scopeLabel: null,
      summary:
        'Five processed demo articles show active movement around enterprise agent controls, governance tooling, infrastructure cost pressure, and regulatory readiness.',
      title: 'Demo weekly intelligence digest',
      userId,
    },
  });
}

function buildArticleText(articleSeed) {
  return [
    articleSeed.title,
    articleSeed.summary,
    'The story is included as deterministic demo data so reviewers can inspect article cards, entity extraction, categories, axis labels, duplicate grouping, graph edges, and LLM telemetry without external credentials.',
    'Operationally, the item is written like a short news analysis rather than a stub. It names the actors, states the business implication, and leaves enough body text for the deterministic pre-filter to accept it before the mock LLM provider runs.',
    'The expected workflow is that the article remains processable during axis regeneration, digest generation, and queue monitoring checks. This keeps the demo stable while still exercising the same worker path used by live RSS articles.',
  ].join('\n\n');
}

function daysBefore(date, days) {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function estimateDemoLlmCostUsd(usage) {
  const promptUsdPerMillionTokens = numberFromEnv(
    'LLM_PROMPT_COST_USD_PER_1M_TOKENS',
    0.15,
  );
  const completionUsdPerMillionTokens = numberFromEnv(
    'LLM_COMPLETION_COST_USD_PER_1M_TOKENS',
    0.6,
  );
  const cost =
    (usage.promptTokens / 1_000_000) * promptUsdPerMillionTokens +
    (usage.completionTokens / 1_000_000) * completionUsdPerMillionTokens;

  return Math.round(cost * 1_000_000) / 1_000_000;
}

function numberFromEnv(key, fallback) {
  const value = process.env[key];
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalize(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

await main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
