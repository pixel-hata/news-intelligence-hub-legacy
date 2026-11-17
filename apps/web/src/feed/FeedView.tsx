import { Activity, ExternalLink, Play, Plus, X } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../api';
import { Input, SelectInput } from '../components/ui';
import {
  articleImportanceLabel,
  articleStatusLabel,
  entityTypeLabel,
  feedStatusLabel,
  pluralUk,
} from '../labels';
import type {
  AppData,
  ArticleDetail,
  ArticleImportance,
  ArticlePeriodFilter,
  ArticleStatus,
  EntityDetail,
  FeedStatus,
  FeedSummary,
} from '../types';
import { articleImportanceOptions, articlePeriodOptions, articleStatusOptions } from '../types';
import { filterArticles, formatDate, formatDateTime } from '../utils';

export function FeedView(props: {
  data: AppData;
  onMessage: (message: string) => void;
  token: string;
  onReload: () => void;
}) {
  const [articleDetail, setArticleDetail] = useState<ArticleDetail | null>(null);
  const [articleDetailLoading, setArticleDetailLoading] = useState(false);
  const articleDetailRef = useRef<HTMLDivElement | null>(null);
  const [articleSearch, setArticleSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [feedFilter, setFeedFilter] = useState('');
  const [feedUrl, setFeedUrl] = useState('https://news.mit.edu/rss/topic/artificial-intelligence2');
  const [feedTitle, setFeedTitle] = useState('MIT AI News');
  const [entityDetail, setEntityDetail] = useState<EntityDetail | null>(null);
  const [importanceFilter, setImportanceFilter] = useState<ArticleImportance | ''>('');
  const [periodFilter, setPeriodFilter] = useState<ArticlePeriodFilter>('all');
  const [statusFilter, setStatusFilter] = useState<ArticleStatus | ''>('');

  const filteredArticles = useMemo(
    () =>
      filterArticles(props.data.articles, {
        categoryId: categoryFilter,
        feedId: feedFilter,
        importance: importanceFilter,
        period: periodFilter,
        search: articleSearch,
        status: statusFilter,
      }),
    [
      articleSearch,
      categoryFilter,
      feedFilter,
      importanceFilter,
      periodFilter,
      props.data.articles,
      statusFilter,
    ],
  );

  const hasActiveArticleFilters =
    categoryFilter ||
    feedFilter ||
    importanceFilter ||
    periodFilter !== 'all' ||
    articleSearch ||
    statusFilter;

  useEffect(() => {
    if (!articleDetail) {
      return;
    }

    window.requestAnimationFrame(() => {
      articleDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      articleDetailRef.current?.focus({ preventScroll: true });
    });
  }, [articleDetail]);

  async function addFeed(event: FormEvent) {
    event.preventDefault();
    try {
      await apiFetch('/feeds', {
        body: JSON.stringify({ title: feedTitle, url: feedUrl }),
        method: 'POST',
        token: props.token,
      });
      props.onReload();
      window.setTimeout(props.onReload, 1500);
      props.onMessage('Фід додано. Перше опитування поставлено в чергу; оновіть дані, якщо статус ще очікує.');
    } catch (error) {
      props.onMessage(error instanceof Error ? error.message : 'Не вдалося додати фід');
    }
  }

  async function updateFeedStatus(feed: FeedSummary) {
    const status: FeedStatus = feed.status === 'paused' ? 'active' : 'paused';
    try {
      await apiFetch(`/feeds/${feed.id}`, {
        body: JSON.stringify({ status }),
        method: 'PATCH',
        token: props.token,
      });
      props.onReload();
      props.onMessage('');
    } catch (error) {
      props.onMessage(error instanceof Error ? error.message : 'Не вдалося оновити фід');
    }
  }

  async function removeFeed(feed: FeedSummary) {
    if (!window.confirm(`Видалити фід "${feed.title}"?`)) {
      return;
    }
    try {
      await apiFetch(`/feeds/${feed.id}`, {
        method: 'DELETE',
        token: props.token,
      });
      props.onReload();
      props.onMessage('');
    } catch (error) {
      props.onMessage(error instanceof Error ? error.message : 'Не вдалося видалити фід');
    }
  }

  async function pollFeed(feed: FeedSummary) {
    try {
      await apiFetch(`/feeds/${feed.id}/poll`, {
        method: 'POST',
        token: props.token,
      });
      props.onReload();
      props.onMessage('');
    } catch (error) {
      props.onMessage(error instanceof Error ? error.message : 'Не вдалося запустити опитування фіда');
    }
  }

  async function openEntity(entityId: string) {
    try {
      const response = await apiFetch<EntityDetail>(`/entities/${entityId}`, {
        token: props.token,
      });
      setEntityDetail(response);
    } catch (error) {
      props.onMessage(error instanceof Error ? error.message : 'Не вдалося завантажити сутність');
    }
  }

  async function openArticle(articleId: string) {
    setArticleDetailLoading(true);
    setArticleDetail(null);
    setEntityDetail(null);
    try {
      const response = await apiFetch<ArticleDetail>(`/articles/${articleId}`, {
        token: props.token,
      });
      setArticleDetail(response);
      props.onMessage('');
    } catch (error) {
      props.onMessage(error instanceof Error ? error.message : 'Не вдалося завантажити статтю');
    } finally {
      setArticleDetailLoading(false);
    }
  }

  function clearArticleFilters() {
    setCategoryFilter('');
    setFeedFilter('');
    setImportanceFilter('');
    setPeriodFilter('all');
    setArticleSearch('');
    setStatusFilter('');
  }

  return (
    <div className="grid gap-4">
      <form className="toolbar" onSubmit={addFeed}>
        <Input label="Назва фіда" onChange={setFeedTitle} value={feedTitle} />
        <Input label="RSS/Atom URL" onChange={setFeedUrl} value={feedUrl} />
        <button className="primary-button self-end" type="submit">
          <Plus size={16} />
          Додати
        </button>
      </form>

      <div className="grid gap-2">
        {props.data.feeds.map((feed) => (
          <div className="row-item" key={feed.id}>
            <div>
              <p className="font-medium">{feed.title}</p>
              <p className="truncate text-xs text-slate-500">{feed.url}</p>
              {feed.lastError ? (
                <p className="mt-1 text-xs text-red-700">{feed.lastError}</p>
              ) : null}
              {feed.lastPolledAt ? (
                <p className="mt-1 text-xs text-slate-500">
                  Останнє опитування: {formatDateTime(feed.lastPolledAt)}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <span className="status-pill">{feedStatusLabel(feed.status)}</span>
              <button
                className="secondary-button"
                onClick={() => void updateFeedStatus(feed)}
                type="button"
              >
                {feed.status === 'paused' ? 'Відновити' : 'Пауза'}
              </button>
              <button
                className="icon-button"
                onClick={() => void pollFeed(feed)}
                title="Опитати фід"
                type="button"
              >
                <Play size={16} />
              </button>
              <button
                className="icon-button"
                onClick={() => void removeFeed(feed)}
                title="Видалити фід"
                type="button"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="filter-toolbar">
        <Input label="Пошук" onChange={setArticleSearch} value={articleSearch} />
        <SelectInput
          label="Категорія"
          onChange={setCategoryFilter}
          options={[
            { label: 'Усі категорії', value: '' },
            ...props.data.categories.map((category) => ({
              label: category.name,
              value: category.id,
            })),
          ]}
          value={categoryFilter}
        />
        <SelectInput
          label="Фід"
          onChange={setFeedFilter}
          options={[
            { label: 'Усі фіди', value: '' },
            ...props.data.feeds.map((feed) => ({
              label: feed.title,
              value: feed.id,
            })),
          ]}
          value={feedFilter}
        />
        <SelectInput
          label="Важливість"
          onChange={(value) => setImportanceFilter(value as ArticleImportance | '')}
          options={[
            { label: 'Будь-яка важливість', value: '' },
            ...articleImportanceOptions.map((importance) => ({
              label: articleImportanceLabel(importance),
              value: importance,
            })),
          ]}
          value={importanceFilter}
        />
        <SelectInput
          label="Стан обробки"
          onChange={(value) => setStatusFilter(value as ArticleStatus | '')}
          options={[
            { label: 'Будь-який стан', value: '' },
            ...articleStatusOptions.map((status) => ({
              label: articleStatusLabel(status),
              value: status,
            })),
          ]}
          value={statusFilter}
        />
        <SelectInput
          label="Період"
          onChange={(value) => setPeriodFilter(value as ArticlePeriodFilter)}
          options={articlePeriodOptions}
          value={periodFilter}
        />
        <button
          className="secondary-button self-end"
          disabled={!hasActiveArticleFilters}
          onClick={clearArticleFilters}
          type="button"
        >
          <X size={16} />
          Скинути
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <span>
          {filteredArticles.length} / {props.data.articles.length} {pluralUk(props.data.articles.length, 'стаття', 'статті', 'статей')}
        </span>
      </div>

      {articleDetailLoading ? (
        <section className="rounded border border-line bg-white p-4 text-sm text-slate-600">
          Завантаження деталей статті...
        </section>
      ) : null}

      {articleDetail ? (
        <div className="scroll-mt-4 outline-none" ref={articleDetailRef} tabIndex={-1}>
          <ArticleDetailPanel
            detail={articleDetail}
            feeds={props.data.feeds}
            onClose={() => setArticleDetail(null)}
            onOpenArticle={(articleId) => void openArticle(articleId)}
            onOpenEntity={(entityId) => void openEntity(entityId)}
          />
        </div>
      ) : null}

      <div className="grid gap-3">
        {filteredArticles.map((article) => (
          <article className="rounded border border-line bg-white p-4" key={article.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                className="max-w-3xl text-left text-lg font-semibold underline-offset-4 hover:underline"
                onClick={() => void openArticle(article.id)}
                type="button"
              >
                {article.title}
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <span className="status-pill">{article.importance ? articleImportanceLabel(article.importance) : articleStatusLabel(article.status)}</span>
                <span className="status-pill">
                  {article.publishedAt ? formatDate(article.publishedAt) : 'без дати'}
                </span>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-600">{article.summary ?? 'Самарі ще немає.'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {article.categories.map((category) => (
                <span className="chip" key={category.id}>{category.name}</span>
              ))}
              {article.entities.map((entity) => (
                <button
                  className="chip muted"
                  key={entity.id}
                  onClick={() => void openEntity(entity.id)}
                  type="button"
                >
                  {entity.name}
                </button>
              ))}
              {article.similarCount > 0 ? <span className="chip">схожих: {article.similarCount}</span> : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="secondary-button"
                onClick={() => void openArticle(article.id)}
                type="button"
              >
                <Activity size={16} />
                Деталі
              </button>
              <a className="secondary-button" href={article.sourceUrl} rel="noreferrer" target="_blank">
                <ExternalLink size={16} />
                Джерело
              </a>
            </div>
          </article>
        ))}
      </div>

      {entityDetail ? (
        <EntityDetailPanel detail={entityDetail} onClose={() => setEntityDetail(null)} />
      ) : null}
    </div>
  );
}

function ArticleDetailPanel(props: {
  detail: ArticleDetail;
  feeds: FeedSummary[];
  onClose: () => void;
  onOpenArticle: (articleId: string) => void;
  onOpenEntity: (entityId: string) => void;
}) {
  const { article, similarArticles } = props.detail;
  const feed = props.feeds.find((candidate) => candidate.id === article.feedId);

  return (
    <section className="rounded border border-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {feed?.title ?? 'Відʼєднана стаття'} · {articleStatusLabel(article.status)}
          </p>
          <h2 className="mt-1 text-xl font-semibold">{article.title}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {article.publishedAt ? formatDate(article.publishedAt) : 'без дати'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a className="secondary-button" href={article.sourceUrl} rel="noreferrer" target="_blank">
            <ExternalLink size={16} />
            Джерело
          </a>
          <button className="icon-button" onClick={props.onClose} title="Закрити" type="button">
            <X size={16} />
          </button>
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-600">{article.summary ?? 'Самарі ще немає.'}</p>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Категорії</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {article.categories.length > 0 ? (
              article.categories.map((category) => (
                <span className="chip" key={category.id}>{category.name}</span>
              ))
            ) : (
              <span className="text-sm text-slate-500">немає</span>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Осі</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {article.axisLabels.length > 0 ? (
              article.axisLabels.map((label) => (
                <span className="chip muted" key={label.id}>{label.name}</span>
              ))
            ) : (
              <span className="text-sm text-slate-500">немає</span>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Сутності</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {article.entities.length > 0 ? (
              article.entities.map((entity) => (
                <button
                  className="chip muted"
                  key={entity.id}
                  onClick={() => props.onOpenEntity(entity.id)}
                  type="button"
                >
                  {entity.name} · {entityTypeLabel(entity.type)}
                </button>
              ))
            ) : (
              <span className="text-sm text-slate-500">немає</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Схожі статті</h3>
          <span className="status-pill">{similarArticles.length}</span>
        </div>
        {similarArticles.length > 0 ? (
          similarArticles.map((similarArticle) => (
            <div className="row-item" key={similarArticle.id}>
              <button
                className="min-w-0 text-left font-medium underline-offset-4 hover:underline"
                onClick={() => props.onOpenArticle(similarArticle.id)}
                type="button"
              >
                {similarArticle.title}
              </button>
              <a className="text-xs font-medium text-slate-600 underline" href={similarArticle.sourceUrl} rel="noreferrer" target="_blank">
                джерело
              </a>
            </div>
          ))
        ) : (
          <p className="rounded border border-line bg-slate-50 px-3 py-2 text-sm text-slate-500">
            У цій групі немає схожих статей.
          </p>
        )}
      </div>
    </section>
  );
}

export function EntityDetailPanel(props: { detail: EntityDetail; onClose: () => void }) {
  const { activity, entity, mentioningArticles, relatedEntities } = props.detail;

  return (
    <section className="rounded border border-line bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{entityTypeLabel(entity.type)}</p>
          <h2 className="text-lg font-semibold">{entity.name}</h2>
        </div>
        <button className="icon-button" onClick={props.onClose} title="Закрити" type="button">
          <X size={16} />
        </button>
      </div>
      {entity.description ? <p className="mt-2 text-sm text-slate-600">{entity.description}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {entity.aliases.map((alias) => (
          <span className="chip muted" key={alias}>{alias}</span>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="grid gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Статті зі згадками</h3>
          {mentioningArticles.map((article) => (
            <a className="row-item" href={article.sourceUrl} key={article.id} rel="noreferrer" target="_blank">
              <span className="font-medium">{article.title}</span>
              <span className="text-xs text-slate-500">
                {article.publishedAt ? formatDate(article.publishedAt) : 'без дати'}
              </span>
            </a>
          ))}
        </div>
        <div className="grid gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Повʼязані сутності</h3>
          {relatedEntities.length > 0 ? (
            relatedEntities.map((item) => (
              <div className="row-item" key={item.entity.id}>
                <span className="font-medium">{item.entity.name}</span>
                <span className="status-pill">{item.count}</span>
              </div>
            ))
          ) : (
            <p className="rounded border border-line bg-slate-50 px-3 py-2 text-sm text-slate-500">немає</p>
          )}
        </div>
        <div className="grid gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Активність згадок</h3>
          {activity.length > 0 ? (
            activity.map((item) => (
              <div className="row-item" key={item.date}>
                <span className="font-medium">{item.date}</span>
                <span className="status-pill">{item.count}</span>
              </div>
            ))
          ) : (
            <p className="rounded border border-line bg-slate-50 px-3 py-2 text-sm text-slate-500">немає</p>
          )}
        </div>
      </div>
    </section>
  );
}
