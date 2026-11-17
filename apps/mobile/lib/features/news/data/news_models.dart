class CategorySummary {
  const CategorySummary({
    required this.id,
    required this.name,
    required this.color,
    required this.includeKeywords,
    required this.excludeKeywords,
    this.description,
    this.ruleText,
  });

  final String id;
  final String name;
  final String color;
  final String? description;
  final String? ruleText;
  final List<String> includeKeywords;
  final List<String> excludeKeywords;

  factory CategorySummary.fromJson(Map<String, dynamic> json) =>
      CategorySummary(
        id: json['id']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        color: json['color']?.toString() ?? '#2563eb',
        description: json['description']?.toString(),
        ruleText: json['ruleText']?.toString(),
        includeKeywords: stringList(json['includeKeywords']),
        excludeKeywords: stringList(json['excludeKeywords']),
      );
}

class AxisLabelSummary {
  const AxisLabelSummary({
    required this.id,
    required this.name,
    required this.sortOrder,
    this.description,
  });

  final String id;
  final String name;
  final String? description;
  final int sortOrder;

  factory AxisLabelSummary.fromJson(Map<String, dynamic> json) =>
      AxisLabelSummary(
        id: json['id']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        description: json['description']?.toString(),
        sortOrder: intValue(json['sortOrder']) ?? 0,
      );
}

class CategorizationAxisSummary {
  const CategorizationAxisSummary({
    required this.id,
    required this.name,
    required this.prompt,
    required this.sortOrder,
    required this.isActive,
    required this.labels,
    this.description,
  });

  final String id;
  final String name;
  final String? description;
  final String prompt;
  final int sortOrder;
  final bool isActive;
  final List<AxisLabelSummary> labels;

  factory CategorizationAxisSummary.fromJson(Map<String, dynamic> json) =>
      CategorizationAxisSummary(
        id: json['id']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        description: json['description']?.toString(),
        prompt: json['prompt']?.toString() ?? '',
        sortOrder: intValue(json['sortOrder']) ?? 0,
        isActive: json['isActive'] != false,
        labels: objectList(
          json['labels'],
        ).map(AxisLabelSummary.fromJson).toList(growable: false),
      );
}

class FeedSummary {
  const FeedSummary({
    required this.id,
    required this.title,
    required this.url,
    required this.status,
    required this.pollingIntervalMinutes,
    this.lastPolledAt,
    this.lastError,
  });

  final String id;
  final String title;
  final String url;
  final String status;
  final int pollingIntervalMinutes;
  final String? lastPolledAt;
  final String? lastError;

  factory FeedSummary.fromJson(Map<String, dynamic> json) => FeedSummary(
    id: json['id']?.toString() ?? '',
    title: json['title']?.toString() ?? '',
    url: json['url']?.toString() ?? '',
    status: json['status']?.toString() ?? 'active',
    pollingIntervalMinutes: intValue(json['pollingIntervalMinutes']) ?? 0,
    lastPolledAt: json['lastPolledAt']?.toString(),
    lastError: json['lastError']?.toString(),
  );
}

class EntitySummary {
  const EntitySummary({
    required this.id,
    required this.name,
    required this.type,
    required this.aliases,
    this.description,
    this.firstSeen,
    this.lastSeen,
  });

  final String id;
  final String name;
  final String type;
  final List<String> aliases;
  final String? description;
  final int? firstSeen;
  final int? lastSeen;

  factory EntitySummary.fromJson(Map<String, dynamic> json) => EntitySummary(
    id: json['id']?.toString() ?? '',
    name: json['name']?.toString() ?? '',
    type: json['type']?.toString() ?? 'other',
    aliases: stringList(json['aliases']),
    description: json['description']?.toString(),
    firstSeen: intValue(json['firstSeen']),
    lastSeen: intValue(json['lastSeen']),
  );
}

class ArticleSummary {
  const ArticleSummary({
    required this.id,
    required this.title,
    required this.sourceUrl,
    required this.status,
    required this.categories,
    required this.axisLabels,
    required this.entities,
    required this.similarCount,
    this.feedId,
    this.importance,
    this.publishedAt,
    this.summary,
  });

  final String id;
  final String? feedId;
  final String title;
  final String sourceUrl;
  final String? publishedAt;
  final String? summary;
  final String status;
  final String? importance;
  final List<CategorySummary> categories;
  final List<AxisLabelSummary> axisLabels;
  final List<EntitySummary> entities;
  final int similarCount;

  factory ArticleSummary.fromJson(Map<String, dynamic> json) => ArticleSummary(
    id: json['id']?.toString() ?? '',
    feedId: json['feedId']?.toString(),
    title: json['title']?.toString() ?? '',
    sourceUrl: json['sourceUrl']?.toString() ?? '',
    publishedAt: json['publishedAt']?.toString(),
    summary: json['summary']?.toString(),
    status: json['status']?.toString() ?? 'discovered',
    importance: json['importance']?.toString(),
    categories: objectList(
      json['categories'],
    ).map(CategorySummary.fromJson).toList(growable: false),
    axisLabels: objectList(
      json['axisLabels'],
    ).map(AxisLabelSummary.fromJson).toList(growable: false),
    entities: objectList(
      json['entities'],
    ).map(EntitySummary.fromJson).toList(growable: false),
    similarCount: intValue(json['similarCount']) ?? 0,
  );
}

class ArticleDetail {
  const ArticleDetail({required this.article, required this.similarArticles});

  final ArticleSummary article;
  final List<ArticleSummary> similarArticles;

  factory ArticleDetail.fromJson(Map<String, dynamic> json) => ArticleDetail(
    article: ArticleSummary.fromJson(
      (json['article'] as Map?)?.cast<String, dynamic>() ??
          const <String, dynamic>{},
    ),
    similarArticles: objectList(
      json['similarArticles'],
    ).map(ArticleSummary.fromJson).toList(growable: false),
  );
}

class MentioningArticle {
  const MentioningArticle({
    required this.id,
    required this.title,
    required this.sourceUrl,
    this.publishedAt,
  });

  final String id;
  final String title;
  final String sourceUrl;
  final String? publishedAt;

  factory MentioningArticle.fromJson(Map<String, dynamic> json) =>
      MentioningArticle(
        id: json['id']?.toString() ?? '',
        title: json['title']?.toString() ?? '',
        sourceUrl: json['sourceUrl']?.toString() ?? '',
        publishedAt: json['publishedAt']?.toString(),
      );
}

class RelatedEntitySummary {
  const RelatedEntitySummary({required this.entity, required this.count});

  final EntitySummary entity;
  final int count;

  factory RelatedEntitySummary.fromJson(Map<String, dynamic> json) =>
      RelatedEntitySummary(
        entity: EntitySummary.fromJson(
          (json['entity'] as Map?)?.cast<String, dynamic>() ??
              const <String, dynamic>{},
        ),
        count: intValue(json['count']) ?? 0,
      );
}

class EntityActivityPoint {
  const EntityActivityPoint({required this.date, required this.count});

  final String date;
  final int count;

  factory EntityActivityPoint.fromJson(Map<String, dynamic> json) =>
      EntityActivityPoint(
        date: json['date']?.toString() ?? '',
        count: intValue(json['count']) ?? 0,
      );
}

class EntityDetail {
  const EntityDetail({
    required this.entity,
    required this.mentioningArticles,
    required this.relatedEntities,
    required this.activity,
  });

  final EntitySummary entity;
  final List<MentioningArticle> mentioningArticles;
  final List<RelatedEntitySummary> relatedEntities;
  final List<EntityActivityPoint> activity;

  factory EntityDetail.fromJson(Map<String, dynamic> json) => EntityDetail(
    entity: EntitySummary.fromJson(
      (json['entity'] as Map?)?.cast<String, dynamic>() ??
          const <String, dynamic>{},
    ),
    mentioningArticles: objectList(
      json['mentioningArticles'],
    ).map(MentioningArticle.fromJson).toList(growable: false),
    relatedEntities: objectList(
      json['relatedEntities'],
    ).map(RelatedEntitySummary.fromJson).toList(growable: false),
    activity: objectList(
      json['activity'],
    ).map(EntityActivityPoint.fromJson).toList(growable: false),
  );
}

class GraphNodeSummary {
  const GraphNodeSummary({
    required this.id,
    required this.type,
    required this.label,
  });

  final String id;
  final String type;
  final String label;

  factory GraphNodeSummary.fromJson(Map<String, dynamic> json) =>
      GraphNodeSummary(
        id: json['id']?.toString() ?? '',
        type: json['type']?.toString() ?? '',
        label: json['label']?.toString() ?? '',
      );
}

class GraphEdgeSummary {
  const GraphEdgeSummary({
    required this.id,
    required this.source,
    required this.target,
    required this.type,
    required this.weight,
  });

  final String id;
  final String source;
  final String target;
  final String type;
  final int weight;

  factory GraphEdgeSummary.fromJson(Map<String, dynamic> json) =>
      GraphEdgeSummary(
        id: json['id']?.toString() ?? '',
        source: json['source']?.toString() ?? '',
        target: json['target']?.toString() ?? '',
        type: json['type']?.toString() ?? '',
        weight: intValue(json['weight']) ?? 1,
      );
}

class NewsGraph {
  const NewsGraph({required this.nodes, required this.edges});

  final List<GraphNodeSummary> nodes;
  final List<GraphEdgeSummary> edges;

  factory NewsGraph.fromJson(Map<String, dynamic> json) => NewsGraph(
    nodes: objectList(
      json['nodes'],
    ).map(GraphNodeSummary.fromJson).toList(growable: false),
    edges: objectList(
      json['edges'],
    ).map(GraphEdgeSummary.fromJson).toList(growable: false),
  );
}

class DigestSummary {
  const DigestSummary({
    required this.id,
    required this.title,
    required this.summary,
    required this.periodStart,
    required this.periodEnd,
    required this.topEntities,
    required this.topCategories,
    required this.keyArticles,
    this.articleCount,
    this.scopeLabel,
  });

  final String id;
  final String title;
  final String summary;
  final String periodStart;
  final String periodEnd;
  final int? articleCount;
  final String? scopeLabel;
  final List<CountedItem> topEntities;
  final List<CountedItem> topCategories;
  final List<KeyArticleSummary> keyArticles;

  factory DigestSummary.fromJson(Map<String, dynamic> json) => DigestSummary(
    id: json['id']?.toString() ?? '',
    title: json['title']?.toString() ?? '',
    summary: json['summary']?.toString() ?? '',
    periodStart: json['periodStart']?.toString() ?? '',
    periodEnd: json['periodEnd']?.toString() ?? '',
    articleCount: intValue(json['articleCount']),
    scopeLabel: json['scopeLabel']?.toString(),
    topEntities: objectList(
      json['topEntities'],
    ).map(CountedItem.fromJson).toList(growable: false),
    topCategories: objectList(
      json['topCategories'],
    ).map(CountedItem.fromJson).toList(growable: false),
    keyArticles: objectList(
      json['keyArticles'],
    ).map(KeyArticleSummary.fromJson).toList(growable: false),
  );
}

class CountedItem {
  const CountedItem({required this.name, required this.count});

  final String name;
  final int count;

  factory CountedItem.fromJson(Map<String, dynamic> json) => CountedItem(
    name: json['name']?.toString() ?? '',
    count: intValue(json['count']) ?? 0,
  );
}

class KeyArticleSummary {
  const KeyArticleSummary({required this.id, required this.title});

  final String id;
  final String title;

  factory KeyArticleSummary.fromJson(Map<String, dynamic> json) =>
      KeyArticleSummary(
        id: json['id']?.toString() ?? '',
        title: json['title']?.toString() ?? '',
      );
}

class LlmTelemetrySummary {
  const LlmTelemetrySummary({
    required this.totalCalls,
    required this.totalTokens,
    required this.cacheHits,
    required this.estimatedCostUsd,
    required this.byProvider,
    required this.byTask,
    required this.recentCalls,
  });

  final int totalCalls;
  final int totalTokens;
  final int cacheHits;
  final double estimatedCostUsd;
  final List<LlmProviderSummary> byProvider;
  final List<LlmTaskSummary> byTask;
  final List<LlmRecentCallSummary> recentCalls;

  factory LlmTelemetrySummary.fromJson(Map<String, dynamic> json) =>
      LlmTelemetrySummary(
        totalCalls: intValue(json['totalCalls']) ?? 0,
        totalTokens: intValue(json['totalTokens']) ?? 0,
        cacheHits: intValue(json['cacheHits']) ?? 0,
        estimatedCostUsd: doubleValue(json['estimatedCostUsd']) ?? 0,
        byProvider: objectList(
          json['byProvider'],
        ).map(LlmProviderSummary.fromJson).toList(growable: false),
        byTask: objectList(
          json['byTask'],
        ).map(LlmTaskSummary.fromJson).toList(growable: false),
        recentCalls: objectList(
          json['recentCalls'],
        ).map(LlmRecentCallSummary.fromJson).toList(growable: false),
      );
}

class LlmProviderSummary {
  const LlmProviderSummary({
    required this.provider,
    required this.callCount,
    required this.totalTokens,
    required this.estimatedCostUsd,
  });

  final String provider;
  final int callCount;
  final int totalTokens;
  final double estimatedCostUsd;

  factory LlmProviderSummary.fromJson(Map<String, dynamic> json) =>
      LlmProviderSummary(
        provider: json['provider']?.toString() ?? '',
        callCount: intValue(json['callCount']) ?? 0,
        totalTokens: intValue(json['totalTokens']) ?? 0,
        estimatedCostUsd: doubleValue(json['estimatedCostUsd']) ?? 0,
      );
}

class LlmTaskSummary {
  const LlmTaskSummary({
    required this.task,
    required this.callCount,
    required this.totalTokens,
    required this.estimatedCostUsd,
  });

  final String task;
  final int callCount;
  final int totalTokens;
  final double estimatedCostUsd;

  factory LlmTaskSummary.fromJson(Map<String, dynamic> json) => LlmTaskSummary(
    task: json['task']?.toString() ?? '',
    callCount: intValue(json['callCount']) ?? 0,
    totalTokens: intValue(json['totalTokens']) ?? 0,
    estimatedCostUsd: doubleValue(json['estimatedCostUsd']) ?? 0,
  );
}

class LlmRecentCallSummary {
  const LlmRecentCallSummary({
    required this.task,
    required this.provider,
    required this.model,
    required this.status,
    required this.totalTokens,
    required this.estimatedCostUsd,
    required this.cacheHit,
    this.createdAt,
  });

  final String task;
  final String provider;
  final String model;
  final String status;
  final int totalTokens;
  final double estimatedCostUsd;
  final bool cacheHit;
  final String? createdAt;

  factory LlmRecentCallSummary.fromJson(Map<String, dynamic> json) =>
      LlmRecentCallSummary(
        task: json['task']?.toString() ?? '',
        provider: json['provider']?.toString() ?? '',
        model: json['model']?.toString() ?? '',
        status: json['status']?.toString() ?? '',
        totalTokens: intValue(json['totalTokens']) ?? 0,
        estimatedCostUsd: doubleValue(json['estimatedCostUsd']) ?? 0,
        cacheHit: json['cacheHit'] == true,
        createdAt: json['createdAt']?.toString(),
      );
}

List<Map<String, dynamic>> objectList(Object? value) {
  if (value is! List) {
    return const [];
  }

  return value
      .whereType<Map>()
      .map((item) => item.cast<String, dynamic>())
      .toList(growable: false);
}

List<String> stringList(Object? value) {
  if (value is! List) {
    return const [];
  }

  return value.map((item) => item.toString()).toList(growable: false);
}

int? intValue(Object? value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  if (value is String) {
    return int.tryParse(value);
  }
  return null;
}

double? doubleValue(Object? value) {
  if (value is double) {
    return value;
  }
  if (value is int) {
    return value.toDouble();
  }
  if (value is num) {
    return value.toDouble();
  }
  if (value is String) {
    return double.tryParse(value);
  }
  return null;
}
