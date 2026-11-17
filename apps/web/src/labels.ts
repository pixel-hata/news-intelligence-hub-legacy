import type { ArticleImportance, ArticleStatus, FeedStatus, GraphEdge } from './types';

export function articleImportanceLabel(value: ArticleImportance | null | undefined): string {
  if (value === 'high') {
    return 'важлива';
  }
  if (value === 'normal') {
    return 'нормальна';
  }
  if (value === 'junk') {
    return 'сміття';
  }
  return 'без оцінки';
}

export function articleStatusLabel(value: ArticleStatus | string | null | undefined): string {
  switch (value) {
    case 'discovered':
      return 'знайдено';
    case 'filtered':
      return 'відфільтровано';
    case 'queued':
      return 'у черзі';
    case 'processing':
      return 'обробляється';
    case 'processed':
      return 'оброблено';
    case 'failed':
      return 'помилка';
    default:
      return value ? String(value) : 'невідомо';
  }
}

export function feedStatusLabel(value: FeedStatus): string {
  if (value === 'active') {
    return 'активний';
  }
  if (value === 'paused') {
    return 'на паузі';
  }
  return 'помилка';
}

export function jobStatusLabel(value: string | null | undefined): string {
  switch (value) {
    case 'active':
      return 'виконується';
    case 'completed':
      return 'завершено';
    case 'failed':
      return 'помилка';
    case 'queued':
    case 'waiting':
      return 'у черзі';
    case 'idle':
      return 'очікування';
    default:
      return value ? String(value) : 'очікування';
  }
}

export function entityTypeLabel(value: string | null | undefined): string {
  switch ((value ?? '').toLowerCase()) {
    case 'person':
      return 'персона';
    case 'company':
      return 'компанія';
    case 'product':
      return 'продукт';
    case 'technology':
      return 'технологія';
    case 'location':
      return 'локація';
    case 'other':
      return 'інше';
    default:
      return value ? String(value) : 'сутність';
  }
}

export function edgeTypeLabel(value: GraphEdge['type'] | string): string {
  if (value === 'mentions') {
    return 'стаття згадує сутність';
  }
  if (value === 'co_mention') {
    return 'спільна згадка сутностей';
  }
  if (value === 'similar') {
    return 'схожі статті';
  }
  return String(value);
}

export function pluralUk(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return few;
  }
  return many;
}
