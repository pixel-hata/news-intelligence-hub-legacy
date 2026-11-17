import { Check, Plus, RefreshCw, X } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { Input } from '../components/ui';
import { jobStatusLabel, pluralUk } from '../labels';
import type {
  AppData,
  CategorizationAxisSummary,
  CategoryDraft,
  CategorySummary,
  RegenerationRequest,
  RegenerationStatusSummary,
} from '../types';
import {
  axisDraft,
  categoryDraft,
  formatDateTime,
  parseCsv,
  shortJobReference,
  startedAtFromJobId,
} from '../utils';

export function SettingsView(props: {
  data: AppData;
  onMessage: (message: string) => void;
  token: string;
  onReload: () => void;
}) {
  const [axisDrafts, setAxisDrafts] = useState<Record<string, { labels: string; name: string }>>({});
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, CategoryDraft>>({});
  const [categoryName, setCategoryName] = useState('AI-інфраструктура');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [categoryRuleText, setCategoryRuleText] = useState('Зараховувати статті, коли є ключові слова включення і немає ключових слів виключення.');
  const [categoryIncludeKeywords, setCategoryIncludeKeywords] = useState('infrastructure, inference, cloud');
  const [categoryExcludeKeywords, setCategoryExcludeKeywords] = useState('');
  const [axisName, setAxisName] = useState('Бізнес-вплив');
  const [regenerationRequest, setRegenerationRequest] = useState<RegenerationRequest | null>(null);
  const [regenerationStatus, setRegenerationStatus] = useState<RegenerationStatusSummary | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function refreshRegenerationStatus() {
      try {
        const response = await apiFetch<RegenerationStatusSummary>('/axes/regeneration-status', {
          token: props.token,
        });
        if (isMounted) {
          setRegenerationStatus(response);
        }
      } catch (error) {
        if (isMounted) {
          props.onMessage(error instanceof Error ? error.message : 'Не вдалося завантажити статус перегенерації');
        }
      }
    }

    void refreshRegenerationStatus();
    const intervalId = window.setInterval(() => void refreshRegenerationStatus(), 5000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [props.token]);

  async function addCategory(event: FormEvent) {
    event.preventDefault();
    try {
      await apiFetch('/categories', {
        body: JSON.stringify({
          color: '#2563eb',
          description: categoryDescription.trim() || undefined,
          excludeKeywords: parseCsv(categoryExcludeKeywords),
          includeKeywords: parseCsv(categoryIncludeKeywords),
          name: categoryName,
          ruleText: categoryRuleText.trim() || undefined,
        }),
        method: 'POST',
        token: props.token,
      });
      props.onReload();
      props.onMessage('');
    } catch (error) {
      props.onMessage(error instanceof Error ? error.message : 'Не вдалося додати категорію');
    }
  }

  async function addAxis(event: FormEvent) {
    event.preventDefault();
    try {
      await apiFetch('/axes', {
        body: JSON.stringify({
          labels: [{ name: 'low' }, { name: 'medium' }, { name: 'high' }],
          name: axisName,
          prompt: `Класифікуй статтю за віссю ${axisName}.`,
        }),
        method: 'POST',
        token: props.token,
      });
      props.onReload();
      props.onMessage('');
    } catch (error) {
      props.onMessage(error instanceof Error ? error.message : 'Не вдалося додати вісь');
    }
  }

  async function saveCategory(category: CategorySummary) {
    const draft = categoryDraft(category, categoryDrafts);
    if (!draft.name.trim()) {
      return;
    }
    try {
      await apiFetch(`/categories/${category.id}`, {
        body: JSON.stringify({
          description: draft.description.trim() || undefined,
          excludeKeywords: parseCsv(draft.excludeKeywords),
          includeKeywords: parseCsv(draft.includeKeywords),
          name: draft.name.trim(),
          ruleText: draft.ruleText.trim() || undefined,
        }),
        method: 'PATCH',
        token: props.token,
      });
      props.onReload();
      props.onMessage('');
    } catch (error) {
      props.onMessage(error instanceof Error ? error.message : 'Не вдалося зберегти категорію');
    }
  }

  async function removeCategory(category: CategorySummary) {
    if (!window.confirm(`Видалити категорію "${category.name}"?`)) {
      return;
    }
    try {
      await apiFetch(`/categories/${category.id}`, {
        method: 'DELETE',
        token: props.token,
      });
      props.onReload();
      props.onMessage('');
    } catch (error) {
      props.onMessage(error instanceof Error ? error.message : 'Не вдалося видалити категорію');
    }
  }

  async function saveAxis(axis: CategorizationAxisSummary) {
    const draft = axisDraft(axis, axisDrafts);
    const labels = draft.labels
      .split(',')
      .map((label) => label.trim())
      .filter(Boolean)
      .map((name, index) => ({
        name,
        sortOrder: (index + 1) * 10,
      }));
    if (!draft.name.trim() || labels.length === 0) {
      return;
    }
    try {
      await apiFetch(`/axes/${axis.id}`, {
        body: JSON.stringify({
          labels,
          name: draft.name.trim(),
        }),
        method: 'PATCH',
        token: props.token,
      });
      props.onReload();
      props.onMessage('');
    } catch (error) {
      props.onMessage(error instanceof Error ? error.message : 'Не вдалося зберегти вісь');
    }
  }

  async function toggleAxis(axis: CategorizationAxisSummary) {
    try {
      await apiFetch(`/axes/${axis.id}`, {
        body: JSON.stringify({ isActive: !axis.isActive }),
        method: 'PATCH',
        token: props.token,
      });
      props.onReload();
      props.onMessage('');
    } catch (error) {
      props.onMessage(error instanceof Error ? error.message : 'Не вдалося оновити вісь');
    }
  }

  async function removeAxis(axis: CategorizationAxisSummary) {
    if (!window.confirm(`Видалити вісь "${axis.name}"?`)) {
      return;
    }
    try {
      await apiFetch(`/axes/${axis.id}`, {
        method: 'DELETE',
        token: props.token,
      });
      props.onReload();
      props.onMessage('');
    } catch (error) {
      props.onMessage(error instanceof Error ? error.message : 'Не вдалося видалити вісь');
    }
  }

  async function regenerateAxes() {
    try {
      const response = await apiFetch<RegenerationRequest>('/axes/regenerate', {
        method: 'POST',
        token: props.token,
      });
      setRegenerationRequest(response);
      props.onMessage(`Перегенерацію поставлено в чергу для ${response.articleCount} ${pluralUk(response.articleCount, 'обробленої статті', 'оброблених статей', 'оброблених статей')}.`);
      const status = await apiFetch<RegenerationStatusSummary>('/axes/regeneration-status', {
        token: props.token,
      });
      setRegenerationStatus(status);
      props.onReload();
    } catch (error) {
      props.onMessage(error instanceof Error ? error.message : 'Не вдалося запустити перегенерацію');
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded border border-line bg-white p-4">
        <h2 className="text-lg font-semibold">Категорії</h2>
        <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={addCategory}>
          <Input label="Назва" onChange={setCategoryName} value={categoryName} />
          <Input label="Опис" onChange={setCategoryDescription} value={categoryDescription} />
          <Input label="Ключові слова включення" onChange={setCategoryIncludeKeywords} value={categoryIncludeKeywords} />
          <Input label="Ключові слова виключення" onChange={setCategoryExcludeKeywords} value={categoryExcludeKeywords} />
          <label className="grid gap-1 text-sm md:col-span-2">
            <span className="font-medium">Правило</span>
            <textarea
              className="min-h-20 rounded border border-line px-3 py-2 outline-none focus:border-slate-500"
              onChange={(event) => setCategoryRuleText(event.target.value)}
              value={categoryRuleText}
            />
          </label>
          <button className="primary-button self-end md:col-span-2" type="submit">
            <Plus size={16} />
            Додати категорію
          </button>
        </form>
        <div className="mt-3 grid gap-3">
          {props.data.categories.map((category) => {
            const draft = categoryDraft(category, categoryDrafts);

            return (
            <div className="grid gap-2 rounded border border-line bg-white px-3 py-2" key={category.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="status-pill">{category.includeKeywords.length} включити / {category.excludeKeywords.length} виключити</span>
                <div className="flex items-center gap-2">
                  <button
                    className="icon-button"
                    onClick={() => void saveCategory(category)}
                    title="Зберегти категорію"
                    type="button"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => void removeCategory(category)}
                    title="Видалити категорію"
                    type="button"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <input
                className="rounded border border-line px-3 py-2 text-sm outline-none focus:border-slate-500"
                onChange={(event) =>
                  setCategoryDrafts((drafts) => ({
                    ...drafts,
                    [category.id]: {
                      ...categoryDraft(category, drafts),
                      name: event.target.value,
                    },
                  }))
                }
                value={draft.name}
              />
              <input
                className="rounded border border-line px-3 py-2 text-sm outline-none focus:border-slate-500"
                onChange={(event) =>
                  setCategoryDrafts((drafts) => ({
                    ...drafts,
                    [category.id]: {
                      ...categoryDraft(category, drafts),
                      description: event.target.value,
                    },
                  }))
                }
                placeholder="Опис"
                value={draft.description}
              />
              <input
                className="rounded border border-line px-3 py-2 text-sm outline-none focus:border-slate-500"
                onChange={(event) =>
                  setCategoryDrafts((drafts) => ({
                    ...drafts,
                    [category.id]: {
                      ...categoryDraft(category, drafts),
                      includeKeywords: event.target.value,
                    },
                  }))
                }
                placeholder="Ключові слова включення"
                value={draft.includeKeywords}
              />
              <input
                className="rounded border border-line px-3 py-2 text-sm outline-none focus:border-slate-500"
                onChange={(event) =>
                  setCategoryDrafts((drafts) => ({
                    ...drafts,
                    [category.id]: {
                      ...categoryDraft(category, drafts),
                      excludeKeywords: event.target.value,
                    },
                  }))
                }
                placeholder="Ключові слова виключення"
                value={draft.excludeKeywords}
              />
              <textarea
                className="min-h-20 rounded border border-line px-3 py-2 text-sm outline-none focus:border-slate-500"
                onChange={(event) =>
                  setCategoryDrafts((drafts) => ({
                    ...drafts,
                    [category.id]: {
                      ...categoryDraft(category, drafts),
                      ruleText: event.target.value,
                    },
                  }))
                }
                placeholder="Правило"
                value={draft.ruleText}
              />
            </div>
            );
          })}
        </div>
      </section>

      <section className="rounded border border-line bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Осі категоризації</h2>
          <button className="secondary-button" onClick={() => void regenerateAxes()} type="button">
            <RefreshCw size={16} />
            Перегенерувати
          </button>
        </div>
        <form className="mt-3 flex gap-2" onSubmit={addAxis}>
          <Input label="Назва" onChange={setAxisName} value={axisName} />
          <button className="primary-button self-end" type="submit"><Plus size={16} /></button>
        </form>
        <RegenerationStatusPanel
          request={regenerationRequest}
          status={regenerationStatus}
        />
        <div className="mt-3 grid gap-2">
          {props.data.axes.map((axis) => {
            const draft = axisDraft(axis, axisDrafts);

            return (
            <div className="grid gap-2 rounded border border-line bg-white px-3 py-2" key={axis.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="status-pill">{axis.isActive ? 'активна' : 'неактивна'}</span>
                <div className="flex items-center gap-2">
                  <button
                    className="secondary-button"
                    onClick={() => void toggleAxis(axis)}
                    type="button"
                  >
                    {axis.isActive ? 'Вимкнути' : 'Увімкнути'}
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => void saveAxis(axis)}
                    title="Зберегти вісь"
                    type="button"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => void removeAxis(axis)}
                    title="Видалити вісь"
                    type="button"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <input
                className="rounded border border-line px-3 py-2 text-sm outline-none focus:border-slate-500"
                onChange={(event) =>
                  setAxisDrafts((drafts) => ({
                    ...drafts,
                    [axis.id]: {
                      ...axisDraft(axis, drafts),
                      name: event.target.value,
                    },
                  }))
                }
                value={draft.name}
              />
              <input
                className="rounded border border-line px-3 py-2 text-sm outline-none focus:border-slate-500"
                onChange={(event) =>
                  setAxisDrafts((drafts) => ({
                    ...drafts,
                    [axis.id]: {
                      ...axisDraft(axis, drafts),
                      labels: event.target.value,
                    },
                  }))
                }
                value={draft.labels}
              />
            </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function RegenerationStatusPanel(props: {
  request: RegenerationRequest | null;
  status: RegenerationStatusSummary | null;
}) {
  const progress = props.status?.articleProgress;
  const latestJob = props.status?.latestJob;
  const llmCost = props.status?.llmCost;
  const processedCount = progress?.processed ?? 0;
  const filteredCount = progress?.filtered ?? 0;
  const readyCount = processedCount + filteredCount;
  const activeCount = (progress?.queued ?? 0) + (progress?.processing ?? 0);
  const pendingCount = progress?.discovered ?? 0;
  const totalCount = progress?.total ?? 0;
  const requestJobId = props.request?.jobId ?? latestJob?.jobId;
  const requestArticleCount = props.request?.articleCount ?? progress?.total;
  const requestStartedAt =
    latestJob?.startedAt ?? startedAtFromJobId(requestJobId);
  const requestReference = shortJobReference(requestJobId);

  return (
    <div className="mt-3 grid gap-3 rounded border border-line bg-slate-50 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">Статус перегенерації</span>
        <span className="status-pill">{jobStatusLabel(latestJob?.status ?? (props.request?.queued ? 'queued' : 'idle'))}</span>
      </div>
      {requestArticleCount || requestReference ? (
        <div className="grid gap-1 text-xs text-slate-500">
          {requestArticleCount ? (
            <p>Останній запуск: {requestArticleCount} {pluralUk(requestArticleCount, 'стаття', 'статті', 'статей')}</p>
          ) : null}
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {requestStartedAt ? <span>Старт: {formatDateTime(requestStartedAt)}</span> : null}
            {requestReference ? <span>Референс {requestReference}</span> : null}
          </div>
        </div>
      ) : null}
      {latestJob?.error ? <p className="text-xs text-red-700">{latestJob.error}</p> : null}
      {filteredCount > 0 ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {filteredCount} {pluralUk(filteredCount, 'статтю', 'статті', 'статей')} відсічено pre-filter/dedup без LLM-виклику.
          Це не помилка; LLM-виклики нижчі за загальну кількість статей.
        </p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-4">
        <MiniMetric
          label="Готово"
          note={`${processedCount} LLM / ${filteredCount} pre-filter`}
          value={`${readyCount}/${totalCount}`}
        />
        <MiniMetric label="В обробці" value={String(activeCount)} />
        <MiniMetric label="Очікують" value={String(pendingCount)} />
        <MiniMetric label="Помилки" value={String(progress?.failed ?? 0)} />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <MiniMetric label="LLM-виклики" value={String(llmCost?.callCount ?? 0)} />
        <MiniMetric label="Токени" value={String(llmCost?.totalTokens ?? 0)} />
        <MiniMetric label="Вартість USD" value={(llmCost?.estimatedCostUsd ?? 0).toFixed(6)} />
      </div>
    </div>
  );
}

function MiniMetric(props: { label: string; note?: string; value: string }) {
  return (
    <div className="rounded border border-line bg-white p-2">
      <p className="text-xs uppercase tracking-wide text-slate-500">{props.label}</p>
      <p className="mt-1 font-semibold">{props.value}</p>
      {props.note ? <p className="mt-1 text-xs text-slate-500">{props.note}</p> : null}
    </div>
  );
}
