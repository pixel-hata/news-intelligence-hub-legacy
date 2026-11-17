import { RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { apiFetch } from '../api';
import { MiniMetric, SelectInput } from '../components/ui';
import { pluralUk } from '../labels';
import type { AppData, ArticlePeriodFilter, DigestPeriod } from '../types';
import { articlePeriodOptions } from '../types';
import { filterArticles, topCounts } from '../utils';

export function DigestView(props: { data: AppData; token: string; onReload: () => void }) {
  return (
    <div className="grid gap-4">
      <DigestPanel data={props.data} onReload={props.onReload} token={props.token} />
    </div>
  );
}

function DigestPanel(props: { data: AppData; token: string; onReload: () => void }) {
  const [digestCategoryId, setDigestCategoryId] = useState('');
  const [digestEntityId, setDigestEntityId] = useState('');
  const [digestPeriod, setDigestPeriod] = useState<DigestPeriod>('week');

  async function generateDigest() {
    await apiFetch('/digests/generate', {
      body: JSON.stringify({
        categoryIds: digestCategoryId ? [digestCategoryId] : [],
        entityIds: digestEntityId ? [digestEntityId] : [],
        period: digestPeriod,
      }),
      method: 'POST',
      token: props.token,
    });
    props.onReload();
    window.setTimeout(props.onReload, 1500);
  }

  return (
    <section className="rounded border border-line bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Дайджести</h2>
      </div>
      <div className="mt-3 grid items-end gap-3 md:grid-cols-4">
        <SelectInput
          label="Період"
          onChange={(value) => setDigestPeriod(value as DigestPeriod)}
          options={[
            { label: 'День', value: 'day' },
            { label: 'Тиждень', value: 'week' },
            { label: 'Місяць', value: 'month' },
          ]}
          value={digestPeriod}
        />
        <SelectInput
          label="Категорії"
          onChange={setDigestCategoryId}
          options={[
            { label: 'Усі категорії', value: '' },
            ...props.data.categories.map((category) => ({
              label: category.name,
              value: category.id,
            })),
          ]}
          value={digestCategoryId}
        />
        <SelectInput
          label="Сутності"
          onChange={setDigestEntityId}
          options={[
            { label: 'Усі сутності', value: '' },
            ...props.data.entities.map((entity) => ({
              label: `${entity.name} · ${entity.type}`,
              value: entity.id,
            })),
          ]}
          value={digestEntityId}
        />
        <button className="secondary-button" onClick={() => void generateDigest()} type="button">
          <RefreshCw size={16} />
          Згенерувати
        </button>
      </div>
      <div className="mt-3 grid gap-2">
        {props.data.digests.map((digest) => (
          <div className="rounded border border-line bg-white px-3 py-2" key={digest.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{digest.title}</p>
                <p className="text-sm text-slate-600">{digest.summary}</p>
                {digest.scopeLabel ? <p className="mt-1 text-xs text-slate-500">{digest.scopeLabel}</p> : null}
              </div>
              <span className="text-xs text-slate-500">
                {new Date(digest.periodEnd).toLocaleDateString()}
              </span>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <MiniDigestList
                items={(digest.topCategories ?? []).map((item) => `${item.name} (${item.count})`)}
                title="Топ категорій"
              />
              <MiniDigestList
                items={(digest.topEntities ?? []).map((item) => `${item.name} (${item.count})`)}
                title="Топ сутностей"
              />
              <MiniDigestList
                items={(digest.keyArticles ?? []).map((article) => article.title)}
                title="Ключові статті"
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TelemetryView(props: { data: AppData; token: string; onReload: () => void }) {
  const [digestCategoryId, setDigestCategoryId] = useState('');
  const [digestEntityId, setDigestEntityId] = useState('');
  const [digestPeriod, setDigestPeriod] = useState<DigestPeriod>('week');
  const [dashboardPeriod, setDashboardPeriod] = useState<ArticlePeriodFilter>('7d');
  const llmTelemetry = props.data.llmTelemetry;
  const dashboardArticles = useMemo(
    () => filterArticles(props.data.articles, {
      categoryId: '',
      feedId: '',
      importance: '',
      period: dashboardPeriod,
      search: '',
      status: '',
    }),
    [dashboardPeriod, props.data.articles],
  );
  const topCategories = useMemo(
    () => topCounts(dashboardArticles.flatMap((article) => article.categories.map((category) => category.name))),
    [dashboardArticles],
  );
  const topEntities = useMemo(
    () => topCounts(dashboardArticles.flatMap((article) => article.entities.map((entity) => entity.name))),
    [dashboardArticles],
  );

  async function generateDigest() {
    await apiFetch('/digests/generate', {
      body: JSON.stringify({
        categoryIds: digestCategoryId ? [digestCategoryId] : [],
        entityIds: digestEntityId ? [digestEntityId] : [],
        period: digestPeriod,
      }),
      method: 'POST',
      token: props.token,
    });
    props.onReload();
    window.setTimeout(props.onReload, 1500);
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Фіди" value={props.data.feeds.length} />
        <Metric label="Статті" value={props.data.articles.length} />
        <Metric label="Сутності" value={props.data.entities.length} />
        <Metric label="Ребра графа" value={props.data.graph.edges.length} />
      </div>

      <section className="rounded border border-line bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">LLM-телеметрія</h2>
          <button className="secondary-button" onClick={() => props.onReload()} type="button">
            <RefreshCw size={16} />
            Оновити
          </button>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <MiniMetric label="Виклики" value={String(llmTelemetry.totalCalls)} />
          <MiniMetric label="Токени" value={String(llmTelemetry.totalTokens)} />
          <MiniMetric label="Кеш-хіти" value={String(llmTelemetry.cacheHits)} />
          <MiniMetric label="Оцінка USD" value={formatUsd(llmTelemetry.estimatedCostUsd)} />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Вартість оцінюється за налаштованими тарифами токенів. Виклики mock-провайдера не оплачуються.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <LlmTelemetryList
            items={llmTelemetry.byProvider.map((item) => ({
              detail: `${item.callCount} ${pluralUk(item.callCount, 'виклик', 'виклики', 'викликів')} · ${formatUsd(item.estimatedCostUsd)} USD оц.`,
              label: item.provider,
              value: item.totalTokens,
            }))}
            title="За провайдером"
          />
          <LlmTelemetryList
            items={llmTelemetry.byTask.map((item) => ({
              detail: `${item.callCount} ${pluralUk(item.callCount, 'виклик', 'виклики', 'викликів')} · ${formatUsd(item.estimatedCostUsd)} USD оц.`,
              label: item.task,
              value: item.totalTokens,
            }))}
            title="За задачею"
          />
          <LlmTelemetryList
            items={llmTelemetry.recentCalls.map((item) => ({
              detail: `${item.provider} · ${item.model} · ${item.status}${item.cacheHit ? ' · кеш' : ''} · ${formatUsd(item.estimatedCostUsd)} USD оц.`,
              label: item.task,
              value: item.totalTokens,
            }))}
            title="Останні виклики"
          />
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold">Огляд періоду</h2>
          <SelectInput
            label="Вікно"
            onChange={(value) => setDashboardPeriod(value as ArticlePeriodFilter)}
            options={articlePeriodOptions}
            value={dashboardPeriod}
          />
        </div>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <TopList title="Топ категорій" items={topCategories} />
          <TopList title="Топ сутностей" items={topEntities} />
        </div>
      </section>

      <section className="rounded border border-line bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Дайджести</h2>
        </div>
        <div className="mt-3 grid items-end gap-3 md:grid-cols-4">
          <SelectInput
            label="Період"
            onChange={(value) => setDigestPeriod(value as DigestPeriod)}
            options={[
              { label: 'День', value: 'day' },
              { label: 'Тиждень', value: 'week' },
              { label: 'Місяць', value: 'month' },
            ]}
            value={digestPeriod}
          />
          <SelectInput
            label="Категорії"
            onChange={setDigestCategoryId}
            options={[
              { label: 'Усі категорії', value: '' },
              ...props.data.categories.map((category) => ({
                label: category.name,
                value: category.id,
              })),
            ]}
            value={digestCategoryId}
          />
          <SelectInput
            label="Сутності"
            onChange={setDigestEntityId}
            options={[
              { label: 'Усі сутності', value: '' },
              ...props.data.entities.map((entity) => ({
                label: `${entity.name} · ${entity.type}`,
                value: entity.id,
              })),
            ]}
            value={digestEntityId}
          />
          <button className="secondary-button" onClick={() => void generateDigest()} type="button">
            <RefreshCw size={16} />
            Згенерувати
          </button>
        </div>
        <div className="mt-3 grid gap-2">
          {props.data.digests.map((digest) => (
            <div className="rounded border border-line bg-white px-3 py-2" key={digest.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                <p className="font-medium">{digest.title}</p>
                <p className="text-sm text-slate-600">{digest.summary}</p>
                  {digest.scopeLabel ? <p className="mt-1 text-xs text-slate-500">{digest.scopeLabel}</p> : null}
                </div>
                <span className="text-xs text-slate-500">
                  {new Date(digest.periodEnd).toLocaleDateString()}
                </span>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <MiniDigestList
                  items={(digest.topCategories ?? []).map((item) => `${item.name} (${item.count})`)}
                  title="Топ категорій"
                />
                <MiniDigestList
                  items={(digest.topEntities ?? []).map((item) => `${item.name} (${item.count})`)}
                  title="Топ сутностей"
                />
                <MiniDigestList
                  items={(digest.keyArticles ?? []).map((article) => article.title)}
                  title="Ключові статті"
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function LlmTelemetryList(props: {
  items: {
    detail: string;
    label: string;
    value: number;
  }[];
  title: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{props.title}</p>
      <div className="mt-2 grid gap-2">
        {props.items.length > 0 ? (
          props.items.slice(0, 6).map((item, index) => (
            <div className="row-item" key={`${item.label}-${item.detail}-${index}`}>
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="text-xs text-slate-500">{item.detail}</p>
              </div>
              <span className="status-pill">{item.value} токенів</span>
            </div>
          ))
        ) : (
          <p className="rounded border border-line bg-slate-50 px-3 py-2 text-sm text-slate-500">
            Викликів ще немає.
          </p>
        )}
      </div>
    </div>
  );
}

function formatUsd(value: number): string {
  return value > 0 && value < 0.000001 ? '<0.000001' : value.toFixed(6);
}

function MiniDigestList(props: { items: string[]; title: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{props.title}</p>
      <div className="mt-2 grid gap-1">
        {props.items.length > 0 ? (
          props.items.slice(0, 5).map((item) => (
            <span className="chip muted" key={item}>{item}</span>
          ))
        ) : (
          <span className="text-sm text-slate-500">немає</span>
        )}
      </div>
    </div>
  );
}

function Metric(props: { label: string; value: number }) {
  return (
    <div className="rounded border border-line bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{props.label}</p>
      <p className="mt-2 text-3xl font-semibold">{props.value}</p>
    </div>
  );
}

function TopList(props: { items: { label: string; value: number }[]; title: string }) {
  return (
    <div className="rounded border border-line bg-white p-4">
      <h2 className="text-lg font-semibold">{props.title}</h2>
      <div className="mt-3 grid gap-2">
        {props.items.length > 0 ? (
          props.items.map((item) => (
            <div className="row-item" key={item.label}>
              <span className="font-medium">{item.label}</span>
              <span className="status-pill">{item.value}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">Даних ще немає.</p>
        )}
      </div>
    </div>
  );
}
