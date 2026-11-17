import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import type { Edge, Node, NodeProps, Viewport } from 'reactflow';
import { ExternalLink, Filter, X } from 'lucide-react';
import { apiFetch } from '../api';
import { Input, SelectInput } from '../components/ui';
import { EntityDetailPanel } from '../feed/FeedView';
import { edgeTypeLabel, pluralUk } from '../labels';
import type {
  ArticlePeriodFilter,
  CategorySummary,
  EntityDetail,
  FlowEdgeData,
  FlowNodeData,
  GraphDisplayMode,
  GraphDisplayNode,
  GraphEdge,
  GraphNodeTypeFilter,
  NewsGraph,
} from '../types';
import { articlePeriodOptions } from '../types';
import { formatDate, formatMetadataValue, metadataString, relatedArticlesFromMetadata } from '../utils';
import {
  downloadGraph,
  filterGraph,
  graphDisplayModeFromZoom,
  graphDisplayModeLabel,
  graphLayoutSignature,
  getGraphTimeRange,
  nodeTypeLabel,
  toDisplayGraph,
  toFlowGraph,
} from './graph-utils';

const graphNodeTypes = {
  graphNode: GraphFlowNode,
};

function GraphFlowNode(props: NodeProps<FlowNodeData>) {
  const typeLabel = graphDisplayTypeLabel(props.data.graphNode);
  const typeClassName =
    props.data.graphNode.type === 'article'
      ? 'graph-node--article'
      : props.data.graphNode.type === 'entity'
        ? 'graph-node--entity'
        : 'graph-node--cluster';
  const nodeClassName = [
    'graph-node',
    typeClassName,
    props.selected ? 'graph-node--selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={nodeClassName}
      style={{ '--graph-node-color': props.data.accentColor } as CSSProperties}
      title={props.data.label}
    >
      <Handle className="graph-node-handle" position={Position.Top} type="target" />
      <div className="graph-node-type">{typeLabel}</div>
      <div className="graph-node-title">{props.data.label}</div>
      <div className="graph-node-subtitle">
        {props.data.subtitle} · {props.data.degree} {pluralUk(props.data.degree, 'звʼязок', 'звʼязки', 'звʼязків')}
      </div>
      <Handle className="graph-node-handle" position={Position.Bottom} type="source" />
    </div>
  );
}

function graphDisplayTypeLabel(node: GraphDisplayNode): string {
  if (node.type === 'cluster') {
    return node.clusterKind === 'article-category' ? 'тематичний кластер' : 'кластер сутностей';
  }

  return node.type === 'article' ? 'стаття' : 'сутність';
}

export function GraphView(props: {
  categories: CategorySummary[];
  graph: NewsGraph;
  onMessage: (message: string) => void;
  token: string;
}) {
  const [categoryId, setCategoryId] = useState('');
  const [entityDetail, setEntityDetail] = useState<EntityDetail | null>(null);
  const [graphZoom, setGraphZoom] = useState(0.4);
  const [nodeType, setNodeType] = useState<GraphNodeTypeFilter>('all');
  const [periodFilter, setPeriodFilter] = useState<ArticlePeriodFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedEdgeId, setSelectedEdgeId] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [timelinePercent, setTimelinePercent] = useState(100);
  const graphTimeRange = useMemo(() => getGraphTimeRange(props.graph), [props.graph]);
  const timelineCutoff = useMemo(
    () => graphTimeRange
      ? Math.round(
          graphTimeRange.min +
            ((graphTimeRange.max - graphTimeRange.min) * timelinePercent) / 100,
        )
      : undefined,
    [graphTimeRange, timelinePercent],
  );
  const filteredGraph = useMemo(
    () => filterGraph(props.graph, categoryId, nodeType, periodFilter, search, timelineCutoff),
    [categoryId, nodeType, periodFilter, props.graph, search, timelineCutoff],
  );
  const graphDisplayMode = useMemo(
    () => graphDisplayModeFromZoom(graphZoom, filteredGraph.nodes.length),
    [filteredGraph.nodes.length, graphZoom],
  );
  const displayGraph = useMemo(
    () => toDisplayGraph(filteredGraph, graphDisplayMode),
    [filteredGraph, graphDisplayMode],
  );
  const { edges, nodes } = useMemo(
    () => toFlowGraph(displayGraph, graphDisplayMode),
    [displayGraph, graphDisplayMode],
  );
  const graphLayoutKey = useMemo(
    () => graphLayoutSignature(displayGraph, graphDisplayMode),
    [displayGraph, graphDisplayMode],
  );
  const selectedEdge = displayGraph.edges.find((edge) => edge.id === selectedEdgeId);
  const selectedNode = displayGraph.nodes.find((node) => node.id === selectedNodeId);

  useEffect(() => {
    let cancelled = false;
    setEntityDetail(null);

    if (selectedNode?.type !== 'entity' || selectedNode.memberIds) {
      return () => {
        cancelled = true;
      };
    }

    void apiFetch<EntityDetail>(`/entities/${selectedNode.id}`, {
      token: props.token,
    })
      .then((detail) => {
        if (!cancelled) {
          setEntityDetail(detail);
          props.onMessage('');
        }
      })
      .catch((error) => {
        if (!cancelled) {
          props.onMessage(error instanceof Error ? error.message : 'Не вдалося завантажити сутність');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [props.onMessage, props.token, selectedNode?.id, selectedNode?.type]);

  return (
    <div className="grid gap-3">
      <div className="toolbar">
        <Input label="Пошук" onChange={setSearch} value={search} />
        <label className="grid flex-1 gap-1 text-sm">
          <span className="font-medium">Категорія</span>
          <select
            className="rounded border border-line px-3 py-2 outline-none focus:border-slate-500"
            onChange={(event) => setCategoryId(event.target.value)}
            value={categoryId}
          >
            <option value="">Усі категорії</option>
            {props.categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <SelectInput
          label="Часове вікно"
          onChange={(value) => setPeriodFilter(value as ArticlePeriodFilter)}
          options={articlePeriodOptions}
          value={periodFilter}
        />
        <label className="grid min-w-48 flex-1 gap-1 text-sm">
          <span className="font-medium">Таймлайн</span>
          <input
            className="h-10"
            disabled={!graphTimeRange}
            max={100}
            min={0}
            onChange={(event) => setTimelinePercent(Number(event.target.value))}
            type="range"
            value={timelinePercent}
          />
          <span className="text-xs text-slate-500">
            {timelineCutoff ? formatDate(new Date(timelineCutoff * 1000).toISOString()) : 'Немає дат'}
          </span>
        </label>
        <div className="grid gap-1 self-end text-sm">
          <span className="font-medium">Тип нод</span>
          <div className="flex flex-wrap gap-2">
            {(['all', 'article', 'entity'] as const).map((type) => (
            <button
              className={nodeType === type ? 'primary-button' : 'secondary-button'}
              key={type}
              onClick={() => setNodeType(type)}
              type="button"
            >
              <Filter size={16} />
              {nodeTypeLabel(type)}
            </button>
          ))}
            <button
              className="secondary-button"
              onClick={() => downloadGraph(displayGraph)}
              type="button"
            >
              <ExternalLink size={16} />
              Експорт
            </button>
          </div>
        </div>
      </div>
      <ReactFlowProvider>
        <GraphCanvas
          edges={edges}
          displayMode={graphDisplayMode}
          layoutKey={graphLayoutKey}
          nodes={nodes}
          onClearSelection={() => {
            setSelectedEdgeId('');
            setSelectedNodeId('');
          }}
          onEdgeSelect={(edgeId) => {
            setSelectedEdgeId(edgeId);
            setSelectedNodeId('');
          }}
          onNodeSelect={(nodeId) => {
            setSelectedNodeId(nodeId);
            setSelectedEdgeId('');
          }}
          onZoomChange={setGraphZoom}
          sourceEdgeCount={filteredGraph.edges.length}
          sourceNodeCount={filteredGraph.nodes.length}
        />
      </ReactFlowProvider>
      {entityDetail ? (
        <EntityDetailPanel detail={entityDetail} onClose={() => setSelectedNodeId('')} />
      ) : selectedNode ? (
        <GraphNodeDetailPanel node={selectedNode} onClose={() => setSelectedNodeId('')} />
      ) : null}
      {selectedEdge ? (
        <GraphEdgeDetailPanel
          edge={selectedEdge}
          nodes={displayGraph.nodes}
          onClose={() => setSelectedEdgeId('')}
        />
      ) : null}
    </div>
  );
}

function GraphCanvas(props: {
  displayMode: GraphDisplayMode;
  edges: Edge<FlowEdgeData>[];
  layoutKey: string;
  nodes: Node<FlowNodeData>[];
  onClearSelection: () => void;
  onEdgeSelect: (edgeId: string) => void;
  onNodeSelect: (nodeId: string) => void;
  onZoomChange: (zoom: number) => void;
  sourceEdgeCount: number;
  sourceNodeCount: number;
}) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (props.nodes.length === 0) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void fitView({ duration: 260, padding: 0.08 });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [fitView, props.layoutKey, props.nodes.length]);

  return (
    <div className="relative h-[74vh] min-h-[560px] overflow-hidden rounded border border-slate-700 bg-slate-950">
      <ReactFlow
        defaultEdgeOptions={{
          interactionWidth: 14,
        }}
        edges={props.edges}
        elevateEdgesOnSelect
        fitView
        maxZoom={1.75}
        minZoom={0.18}
        nodeOrigin={[0.5, 0.5]}
        nodeTypes={graphNodeTypes}
        nodes={props.nodes}
        nodesDraggable={false}
        onEdgeClick={(_, edge) => props.onEdgeSelect(edge.id)}
        onError={handleReactFlowError}
        onMoveEnd={(_, viewport: Viewport) => props.onZoomChange(viewport.zoom)}
        onNodeClick={(_, node) => props.onNodeSelect(node.id)}
        onPaneClick={props.onClearSelection}
        onlyRenderVisibleElements
      >
        <Background color="#334155" gap={30} size={1} />
        <Controls />
        <MiniMap
          maskColor="rgb(248 250 252 / 0.72)"
          nodeColor={(node) =>
            node.data?.graphNode?.type === 'article'
              ? node.data.accentColor
              : node.data?.graphNode?.type === 'cluster'
                ? '#334155'
                : '#0f766e'
          }
          nodeStrokeWidth={2}
          pannable
          zoomable
        />
      </ReactFlow>
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2 rounded border border-line bg-white/90 px-3 py-2 text-xs text-slate-600 shadow-sm">
        <span className="font-semibold text-ink">{props.nodes.length} {pluralUk(props.nodes.length, 'нода', 'ноди', 'нод')}</span>
        <span>{props.edges.length} {pluralUk(props.edges.length, 'звʼязок', 'звʼязки', 'звʼязків')}</span>
        <span>{graphDisplayModeLabel(props.displayMode)}</span>
        {props.sourceNodeCount !== props.nodes.length ? (
          <span>{props.sourceNodeCount} сирих нод</span>
        ) : null}
        {props.sourceEdgeCount !== props.edges.length ? (
          <span>{props.sourceEdgeCount} сирих звʼязків</span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-blue-600" /> Статті
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-700" /> Сутності
        </span>
      </div>
      {props.nodes.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-white/80 px-4 text-center text-sm text-slate-500">
          За поточними фільтрами немає даних графа.
        </div>
      ) : null}
    </div>
  );
}

function handleReactFlowError(code: string, message: string): void {
  if (code !== '002') {
    console.warn(`[React Flow ${code}]: ${message}`);
  }
}

function GraphNodeDetailPanel(props: { node: GraphDisplayNode; onClose: () => void }) {
  const metadataEntries = Object.entries(props.node.metadata ?? {}).filter(
    ([, value]) => value !== undefined && value !== null,
  );

  return (
    <section className="rounded border border-line bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {graphDisplayTypeLabel(props.node)}
          </p>
          <h2 className="text-lg font-semibold">{props.node.label}</h2>
        </div>
        <button className="icon-button" onClick={props.onClose} title="Закрити" type="button">
          <X size={16} />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {metadataEntries.length > 0 ? (
          metadataEntries.map(([key, value]) => (
            <span className="chip muted" key={key}>
              {key}: {formatMetadataValue(value)}
            </span>
          ))
        ) : (
          <span className="text-sm text-slate-500">Метаданих немає</span>
        )}
      </div>
    </section>
  );
}

function GraphEdgeDetailPanel(props: {
  edge: GraphEdge;
  nodes: GraphDisplayNode[];
  onClose: () => void;
}) {
  const sourceNode = props.nodes.find((node) => node.id === props.edge.source);
  const targetNode = props.nodes.find((node) => node.id === props.edge.target);
  const sourceLabel = metadataString(props.edge.metadata?.sourceLabel) ?? sourceNode?.label ?? props.edge.source;
  const targetLabel = metadataString(props.edge.metadata?.targetLabel) ?? targetNode?.label ?? props.edge.target;
  const relation = metadataString(props.edge.metadata?.relation) ?? edgeTypeLabel(props.edge.type);
  const relatedArticles = relatedArticlesFromMetadata(props.edge.metadata?.relatedArticles);
  const metadataEntries = Object.entries(props.edge.metadata ?? {}).filter(
    ([key, value]) =>
      !['relatedArticles', 'relation', 'sourceLabel', 'targetLabel'].includes(key) &&
      value !== undefined &&
      value !== null,
  );

  return (
    <section className="rounded border border-line bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{edgeTypeLabel(props.edge.type)}</p>
          <h2 className="text-lg font-semibold">{sourceLabel} → {targetLabel}</h2>
          <p className="mt-1 text-sm text-slate-600">{relation}</p>
        </div>
        <button className="icon-button" onClick={props.onClose} title="Закрити" type="button">
          <X size={16} />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="chip">вага: {props.edge.weight}</span>
        {metadataEntries.map(([key, value]) => (
          <span className="chip muted" key={key}>
            {key}: {formatMetadataValue(value)}
          </span>
        ))}
      </div>
      <div className="mt-4 grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Повʼязані статті</h3>
          <span className="status-pill">{relatedArticles.length}</span>
        </div>
        {relatedArticles.length > 0 ? (
          relatedArticles.map((article) => (
            <div className="row-item" key={article.id}>
              <span className="font-medium">{article.title}</span>
              <span className="text-xs text-slate-500">
                {article.publishedAt ? formatDate(article.publishedAt) : 'без дати'}
              </span>
            </div>
          ))
        ) : (
          <p className="rounded border border-line bg-slate-50 px-3 py-2 text-sm text-slate-500">
            До цього звʼязку не привʼязано статей.
          </p>
        )}
      </div>
    </section>
  );
}
