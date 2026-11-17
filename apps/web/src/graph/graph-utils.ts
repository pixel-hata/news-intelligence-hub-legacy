import type { Edge, Node } from 'reactflow';
import { isLowSignalEntityName } from '@nih/shared';
import { entityTypeLabel } from '../labels';
import type {
  ArticlePeriodFilter,
  FlowEdgeData,
  FlowNodeData,
  GraphDisplayGraph,
  GraphDisplayMode,
  GraphDisplayNode,
  GraphEdge,
  GraphNode,
  GraphNodeTypeFilter,
  NewsGraph,
} from '../types';
import {
  formatMetadataValue,
  getArticlePeriodStart,
  metadataString,
  relatedArticlesFromMetadata,
} from '../utils';

export function filterGraph(
  graph: NewsGraph,
  categoryId: string,
  nodeType: 'all' | 'article' | 'entity',
  period: ArticlePeriodFilter,
  search: string,
  timelineCutoff?: number,
): NewsGraph {
  const allowedIds = new Set(graph.nodes.map((node) => node.id));

  if (categoryId) {
    const categoryArticleIds = new Set(
      graph.nodes
        .filter((node) => {
          const categoryIds = node.metadata?.categoryIds;
          return (
            node.type === 'article' &&
            Array.isArray(categoryIds) &&
            categoryIds.includes(categoryId)
          );
        })
        .map((node) => node.id),
    );

    intersectSets(allowedIds, connectedSubgraphIds(graph, categoryArticleIds));
  }

  const periodStart = getArticlePeriodStart(period);
  if (periodStart !== null || timelineCutoff !== undefined) {
    const periodStartSeconds =
      periodStart === null ? undefined : Math.floor(periodStart / 1000);
    const periodArticleIds = new Set(
      graph.nodes
        .filter((node) => {
          if (node.type !== 'article') {
            return false;
          }
          const ts = Number(node.metadata?.ts);
          if (!Number.isFinite(ts)) {
            return false;
          }
          if (periodStartSeconds !== undefined && ts < periodStartSeconds) {
            return false;
          }
          return timelineCutoff === undefined || ts <= timelineCutoff;
        })
        .map((node) => node.id),
    );
    intersectSets(allowedIds, connectedSubgraphIds(graph, periodArticleIds));
  }

  const normalizedSearch = search.trim().toLowerCase();
  if (normalizedSearch) {
    const matchedIds = new Set(
      graph.nodes
        .filter((node) => graphNodeMatchesSearch(node, normalizedSearch))
        .map((node) => node.id),
    );
    const searchSubgraphIds = new Set(matchedIds);
    for (const edge of graph.edges) {
      if (matchedIds.has(edge.source)) {
        searchSubgraphIds.add(edge.target);
      }
      if (matchedIds.has(edge.target)) {
        searchSubgraphIds.add(edge.source);
      }
    }
    intersectSets(allowedIds, searchSubgraphIds);
  }

  if (nodeType !== 'all') {
    for (const node of graph.nodes) {
      if (node.type !== nodeType) {
        allowedIds.delete(node.id);
      }
    }
  }

  const edges = graph.edges.filter((edge) => {
    if (!allowedIds.has(edge.source) || !allowedIds.has(edge.target)) {
      return false;
    }
    if (nodeType === 'article') {
      return edge.type === 'similar';
    }
    if (nodeType === 'entity') {
      return edge.type === 'co_mention';
    }
    return true;
  });

  return {
    edges,
    nodes: graph.nodes.filter((node) => allowedIds.has(node.id)),
  };
}

export function nodeTypeLabel(type: GraphNodeTypeFilter): string {
  if (type === 'article') {
    return 'Статті';
  }
  if (type === 'entity') {
    return 'Сутності';
  }
  return 'Усі ноди';
}

function connectedSubgraphIds(graph: NewsGraph, articleIds: Set<string>): Set<string> {
  const ids = new Set(articleIds);

  for (const edge of graph.edges) {
    if (edge.type !== 'mentions') {
      continue;
    }
    if (articleIds.has(edge.source)) {
      ids.add(edge.target);
    }
    if (articleIds.has(edge.target)) {
      ids.add(edge.source);
    }
  }

  return ids;
}

function intersectSets(target: Set<string>, allowed: Set<string>): void {
  for (const id of target) {
    if (!allowed.has(id)) {
      target.delete(id);
    }
  }
}

function graphNodeMatchesSearch(node: GraphNode, search: string): boolean {
  const metadata = Object.values(node.metadata ?? {})
    .map((value) => formatMetadataValue(value))
    .join(' ');
  return `${node.label} ${node.type} ${metadata}`.toLowerCase().includes(search);
}

export function graphLayoutSignature(
  graph: GraphDisplayGraph,
  mode: GraphDisplayMode,
): string {
  return [
    mode,
    graph.nodes.length,
    graph.edges.length,
    graph.nodes.map((node) => node.id).join('|'),
  ].join('::');
}

export function graphDisplayModeFromZoom(
  zoom: number,
  nodeCount: number,
): GraphDisplayMode {
  if (zoom >= 1 || nodeCount <= 90) {
    return 'detail';
  }

  if (zoom >= 0.52) {
    return 'clusters';
  }

  return 'overview';
}

export function graphDisplayModeLabel(mode: GraphDisplayMode): string {
  if (mode === 'detail') {
    return 'детально';
  }
  if (mode === 'clusters') {
    return 'кластери';
  }
  return 'огляд';
}

export function toDisplayGraph(
  graph: NewsGraph,
  mode: GraphDisplayMode,
): GraphDisplayGraph {
  const cleanedGraph = removeLowSignalGraphNodes(graph);
  if (mode === 'detail') {
    return pruneDetailGraph(cleanedGraph);
  }

  return aggregateGraph(cleanedGraph, mode);
}

function removeLowSignalGraphNodes(graph: NewsGraph): GraphDisplayGraph {
  const allowedIds = new Set(
    graph.nodes
      .filter((node) => node.type !== 'entity' || !isLowSignalEntityName(node.label))
      .map((node) => node.id),
  );

  return {
    edges: graph.edges.filter(
      (edge) => allowedIds.has(edge.source) && allowedIds.has(edge.target),
    ),
    nodes: graph.nodes
      .filter((node) => allowedIds.has(node.id))
      .map((node) => ({ ...node })),
  };
}

function pruneDetailGraph(graph: GraphDisplayGraph): GraphDisplayGraph {
  const maxNodes = 240;
  if (graph.nodes.length <= maxNodes) {
    return {
      edges: limitDetailEdges(graph.edges),
      nodes: graph.nodes,
    };
  }

  const degrees = graphDegreeMap(graph.edges);
  const articles = graph.nodes.filter((node) => node.type === 'article');
  const entities = graph.nodes
    .filter((node) => node.type === 'entity')
    .sort(
      (left, right) =>
        (degrees.get(right.id) ?? 0) - (degrees.get(left.id) ?? 0) ||
        left.label.localeCompare(right.label),
    );
  const maxEntities = Math.max(80, maxNodes - articles.length);
  const allowedIds = new Set([
    ...articles.map((node) => node.id),
    ...entities.slice(0, maxEntities).map((node) => node.id),
  ]);
  const edges = graph.edges.filter(
    (edge) => allowedIds.has(edge.source) && allowedIds.has(edge.target),
  );

  return {
    edges: limitDetailEdges(edges),
    nodes: graph.nodes.filter((node) => allowedIds.has(node.id)),
  };
}

function limitDetailEdges(edges: GraphEdge[]): GraphEdge[] {
  const byWeight = (left: GraphEdge, right: GraphEdge) =>
    right.weight - left.weight || left.id.localeCompare(right.id);

  return [
    ...edges.filter((edge) => edge.type === 'mentions').sort(byWeight).slice(0, 450),
    ...edges.filter((edge) => edge.type === 'co_mention').sort(byWeight).slice(0, 280),
    ...edges.filter((edge) => edge.type === 'similar').sort(byWeight).slice(0, 160),
  ];
}

function aggregateGraph(
  graph: GraphDisplayGraph,
  mode: Exclude<GraphDisplayMode, 'detail'>,
): GraphDisplayGraph {
  const sourceDegrees = graphDegreeMap(graph.edges);
  const visibleEntityIds =
    mode === 'clusters' ? topEntityIds(graph, sourceDegrees, 52) : new Set<string>();
  const displayNodes = new Map<string, GraphDisplayNode>();
  const sourceToDisplayId = new Map<string, string>();

  for (const node of graph.nodes) {
    if (node.type === 'article') {
      const cluster = articleCategoryClusterNode(node);
      appendClusterMember(displayNodes, cluster, node.id);
      sourceToDisplayId.set(node.id, cluster.id);
      continue;
    }

    if (mode === 'clusters' && visibleEntityIds.has(node.id)) {
      displayNodes.set(node.id, node);
      sourceToDisplayId.set(node.id, node.id);
      continue;
    }

    const cluster = entityTypeClusterNode(node);
    appendClusterMember(displayNodes, cluster, node.id);
    sourceToDisplayId.set(node.id, cluster.id);
  }

  return {
    edges: aggregateEdges(graph.edges, sourceToDisplayId, displayNodes),
    nodes: [...displayNodes.values()],
  };
}

function appendClusterMember(
  nodes: Map<string, GraphDisplayNode>,
  cluster: GraphDisplayNode,
  memberId: string,
): void {
  const current = nodes.get(cluster.id);
  if (!current) {
    nodes.set(cluster.id, {
      ...cluster,
      memberIds: [memberId],
      metadata: {
        ...cluster.metadata,
        members: 1,
      },
    });
    return;
  }

  const memberIds = [...(current.memberIds ?? []), memberId];
  nodes.set(cluster.id, {
    ...current,
    memberIds,
    metadata: {
      ...current.metadata,
      members: memberIds.length,
    },
  });
}

function aggregateEdges(
  edges: GraphEdge[],
  sourceToDisplayId: Map<string, string>,
  nodes: Map<string, GraphDisplayNode>,
): GraphEdge[] {
  const aggregated = new Map<string, GraphEdge>();

  for (const edge of edges) {
    const source = sourceToDisplayId.get(edge.source);
    const target = sourceToDisplayId.get(edge.target);
    if (!source || !target || source === target) {
      continue;
    }

    const [normalizedSource, normalizedTarget] =
      edge.type === 'co_mention' && source > target
        ? [target, source]
        : [source, target];
    const key = `${edge.type}:${normalizedSource}:${normalizedTarget}`;
    const current = aggregated.get(key);
    const relatedArticles = [
      ...relatedArticlesFromMetadata(current?.metadata?.relatedArticles),
      ...relatedArticlesFromMetadata(edge.metadata?.relatedArticles),
    ].slice(0, 8);

    aggregated.set(key, {
      id: key,
      metadata: {
        relation: aggregateEdgeRelation(edge.type),
        relatedArticles,
        sourceLabel: nodes.get(normalizedSource)?.label,
        targetLabel: nodes.get(normalizedTarget)?.label,
      },
      source: normalizedSource,
      target: normalizedTarget,
      type: edge.type,
      weight: (current?.weight ?? 0) + Math.max(1, edge.weight),
    });
  }

  return [...aggregated.values()];
}

function aggregateEdgeRelation(type: GraphEdge['type']): string {
  if (type === 'co_mention') {
    return 'Агреговані спільні згадки між видимими групами';
  }
  if (type === 'similar') {
    return 'Агреговані звʼязки схожих статей між тематичними групами';
  }
  return 'Агреговані згадки сутностей у статтях';
}

function articleCategoryClusterNode(node: GraphDisplayNode): GraphDisplayNode {
  const categoryIds = arrayMetadata(node.metadata?.categoryIds);
  const categoryNames = arrayMetadata(node.metadata?.categoryNames);
  const id = `cluster:category:${categoryIds[0] ?? categoryNames[0] ?? 'uncategorized'}`;
  const label = categoryNames[0] ?? 'Без категорії';

  return {
    clusterKind: 'article-category',
    id,
    label,
    metadata: {
      categoryColor: primaryCategoryColor(node),
      categoryIds,
      categoryNames,
    },
    type: 'cluster',
  };
}

function entityTypeClusterNode(node: GraphDisplayNode): GraphDisplayNode {
  const entityType = graphNodeSubtitle(node).toLowerCase();
  const label = entityTypeLabel(entityType || 'other');

  return {
    clusterKind: 'entity-type',
    id: `cluster:entity-type:${entityType || 'other'}`,
    label,
    metadata: {
      entityType,
    },
    type: 'cluster',
  };
}

function topEntityIds(
  graph: GraphDisplayGraph,
  degrees: Map<string, number>,
  limit: number,
): Set<string> {
  return new Set(
    graph.nodes
      .filter((node) => node.type === 'entity')
      .sort(
        (left, right) =>
          (degrees.get(right.id) ?? 0) - (degrees.get(left.id) ?? 0) ||
          left.label.localeCompare(right.label),
      )
      .slice(0, limit)
      .map((node) => node.id),
  );
}

export function toFlowGraph(
  graph: GraphDisplayGraph,
  mode: GraphDisplayMode,
): { edges: Edge<FlowEdgeData>[]; nodes: Node<FlowNodeData>[] } {
  const degrees = graphDegreeMap(graph.edges);
  const positions = layoutDisplayGraphNodes(graph.nodes, degrees, mode);
  const showEdgeLabels = mode === 'detail' && graph.edges.length <= 120;
  const nodes: Node<FlowNodeData>[] = graph.nodes.map((node) =>
    graphFlowNode(node, degrees, positions),
  );
  const animatedEdgeIds = animatedGraphEdgeIds(graph.edges, mode);
  const edges: Edge<FlowEdgeData>[] = graph.edges.map((edge) => ({
    animated: animatedEdgeIds.has(edge.id),
    data: { graphEdge: edge },
    id: edge.id,
    label: showEdgeLabels ? graphEdgeLabel(edge) : undefined,
    labelBgPadding: [6, 4],
    labelBgStyle: {
      fill: '#0f172a',
      fillOpacity: 0.84,
    },
    labelStyle: {
      fill: '#e2e8f0',
      fontSize: 11,
      fontWeight: 700,
    },
    source: edge.source,
    style: {
      opacity: mode === 'overview' ? 0.48 : 0.62,
      stroke: graphEdgeColor(edge),
      strokeWidth: graphEdgeWidth(edge),
    },
    target: edge.target,
    type: 'default',
  }));

  return { edges, nodes };
}

function graphFlowNode(
  node: GraphDisplayNode,
  degrees: Map<string, number>,
  positions: Map<string, { x: number; y: number }>,
): Node<FlowNodeData> {
  const degree = degrees.get(node.id) ?? 0;
  const position = positions.get(node.id) ?? { x: 0, y: 0 };

  return {
    data: {
      accentColor: graphNodeAccentColor(node),
      degree,
      graphNode: node,
      label: node.label,
      subtitle: graphNodeSubtitle(node),
    },
    id: node.id,
    position,
    type: 'graphNode',
  };
}

function layoutDisplayGraphNodes(
  nodes: GraphDisplayNode[],
  degrees: Map<string, number>,
  mode: GraphDisplayMode,
): Map<string, { x: number; y: number }> {
  if (mode === 'overview') {
    return layoutGraphNodes(nodes, degrees, {
      centerX: 0,
      centerY: 0,
      radiusOffset: 170,
      radiusStep: 110,
      yScale: 0.76,
    });
  }

  if (mode === 'clusters') {
    const topicClusters = nodes.filter((node) => node.clusterKind === 'article-category');
    const entityClusters = nodes.filter((node) => node.clusterKind === 'entity-type');
    const entities = nodes.filter((node) => node.type === 'entity');
    return new Map([
      ...layoutGraphNodes(topicClusters, degrees, {
        centerX: 0,
        centerY: 0,
        radiusOffset: 120,
        radiusStep: 112,
        yScale: 0.74,
      }),
      ...layoutGraphNodes(entityClusters, degrees, {
        centerX: 60,
        centerY: 40,
        radiusOffset: 460,
        radiusStep: 95,
        yScale: 0.76,
      }),
      ...layoutGraphNodes(entities, degrees, {
        centerX: 80,
        centerY: -20,
        radiusOffset: 720,
        radiusStep: 70,
        yScale: 0.8,
      }),
    ]);
  }

  const articles = nodes.filter((node) => node.type === 'article');
  const entities = nodes.filter((node) => node.type === 'entity');
  return new Map([
    ...layoutGraphNodes(articles, degrees, {
      centerX: 0,
      centerY: 0,
      radiusOffset: 120,
      radiusStep: 108,
      yScale: 0.74,
    }),
    ...layoutGraphNodes(entities, degrees, {
      centerX: articles.length > 0 ? 140 : 0,
      centerY: articles.length > 0 ? 40 : 0,
      radiusOffset: articles.length > 0 ? 680 : 120,
      radiusStep: 82,
      yScale: 0.78,
    }),
  ]);
}

function layoutGraphNodes(
  nodes: GraphDisplayNode[],
  degrees: Map<string, number>,
  options: {
    centerX: number;
    centerY: number;
    radiusOffset: number;
    radiusStep: number;
    yScale: number;
  },
): Map<string, { x: number; y: number }> {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const sortedNodes = [...nodes].sort(
    (left, right) =>
      (degrees.get(right.id) ?? 0) - (degrees.get(left.id) ?? 0) ||
      left.label.localeCompare(right.label),
  );

  return new Map(
    sortedNodes.map((node, index) => {
      if (index === 0) {
        return [node.id, { x: options.centerX, y: options.centerY }];
      }

      const radius = options.radiusOffset + options.radiusStep * Math.sqrt(index);
      const angle = index * goldenAngle;
      return [
        node.id,
        {
          x: Math.round(options.centerX + Math.cos(angle) * radius),
          y: Math.round(options.centerY + Math.sin(angle) * radius * options.yScale),
        },
      ];
    }),
  );
}

function graphDegreeMap(edges: GraphEdge[]): Map<string, number> {
  const degrees = new Map<string, number>();

  for (const edge of edges) {
    const weight = Math.max(1, Number(edge.weight) || 1);
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + weight);
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + weight);
  }

  return degrees;
}

function graphNodeSubtitle(node: GraphDisplayNode): string {
  if (node.type === 'cluster') {
    const members = Number(node.metadata?.members ?? node.memberIds?.length ?? 0);
    return `${members} ${node.clusterKind === 'article-category' ? 'статей' : 'сутностей'}`;
  }

  if (node.type === 'article') {
    const categoryNames = node.metadata?.categoryNames;
    if (Array.isArray(categoryNames) && typeof categoryNames[0] === 'string') {
      return categoryNames[0];
    }
    return 'стаття';
  }

  return (
    metadataString(node.metadata?.entityType) ??
    metadataString(node.metadata?.type) ??
    'сутність'
  );
}

function graphNodeAccentColor(node: GraphDisplayNode): string {
  if (node.type === 'cluster') {
    if (node.clusterKind === 'article-category') {
      const categoryColor = metadataString(node.metadata?.categoryColor);
      return categoryColor ?? '#2563eb';
    }
    return '#94a3b8';
  }

  if (node.type === 'article') {
    return primaryCategoryColor(node);
  }

  const entityType = (
    metadataString(node.metadata?.entityType) ??
    metadataString(node.metadata?.type) ??
    ''
  ).toLowerCase();

  if (entityType.includes('person')) {
    return '#7c3aed';
  }
  if (entityType.includes('company')) {
    return '#2563eb';
  }
  if (entityType.includes('technology') || entityType.includes('product')) {
    return '#0f766e';
  }
  if (entityType.includes('location')) {
    return '#b45309';
  }
  return '#059669';
}

function graphEdgeColor(edge: GraphEdge): string {
  if (edge.type === 'co_mention') {
    return '#0f766e';
  }
  if (edge.type === 'similar') {
    return '#7c3aed';
  }
  return '#2563eb';
}

function graphEdgeWidth(edge: GraphEdge): number {
  return Math.min(5, 1.4 + Math.sqrt(Math.max(edge.weight, 1)) * 0.55);
}

function graphEdgeLabel(edge: GraphEdge): string | undefined {
  if (edge.type === 'co_mention') {
    return edge.weight > 1 ? `спільних згадок: ${edge.weight}` : undefined;
  }
  if (edge.type === 'similar') {
    return 'схожі';
  }
  return undefined;
}

export function getGraphTimeRange(graph: NewsGraph): { max: number; min: number } | null {
  const timestamps = graph.nodes
    .filter((node) => node.type === 'article')
    .map((node) => Number(node.metadata?.ts))
    .filter(Number.isFinite);

  if (timestamps.length === 0) {
    return null;
  }

  return {
    max: Math.max(...timestamps),
    min: Math.min(...timestamps),
  };
}

function primaryCategoryColor(node: GraphDisplayNode): string {
  const categoryColors = node.metadata?.categoryColors;
  return Array.isArray(categoryColors) && typeof categoryColors[0] === 'string'
    ? categoryColors[0]
    : '#2563eb';
}

function edgeHasTimeline(edge: GraphEdge): boolean {
  return Number.isFinite(Number(edge.metadata?.directionTs));
}

function animatedGraphEdgeIds(
  edges: GraphEdge[],
  mode: GraphDisplayMode,
): Set<string> {
  const candidates = edges.filter(edgeHasTimeline);
  if (candidates.length === 0) {
    return new Set();
  }

  const budget = mode === 'detail' ? 320 : mode === 'clusters' ? 180 : 90;
  return new Set(
    candidates
      .sort(
        (left, right) =>
          Math.max(right.weight, 1) - Math.max(left.weight, 1) ||
          Number(right.metadata?.directionTs ?? 0) - Number(left.metadata?.directionTs ?? 0),
      )
      .slice(0, budget)
      .map((edge) => edge.id),
  );
}

function arrayMetadata(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function downloadGraph(graph: GraphDisplayGraph): void {
  const blob = new Blob([JSON.stringify(graph, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `news-graph-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
