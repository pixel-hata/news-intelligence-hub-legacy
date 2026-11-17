import type { Request, Response } from 'express';

export const bullBoardQueueDisplayNames: Record<string, string> = {
  'article-processing': 'Обробка статей',
  'axis-regeneration': 'Перегенерація осей',
  'digest-generation': 'Генерація дайджестів',
  'feed-polling': 'Пулінг фідів',
};

export const bullBoardUkMessages = {
  ADD_JOB: {
    ADD: 'Додати',
    DUPLICATE: 'Дублювати',
    JOB_DATA: 'Дані завдання',
    JOB_NAME: 'Назва завдання',
    JOB_OPTIONS: 'Опції завдання',
    QUEUE_NAME: 'Назва черги',
    TITLE: 'Додати завдання',
    TITLE_duplicate: 'Дублювати завдання',
  },
  CLIPBOARD: {
    COPY_FAILED:
      'Не вдалося скопіювати в буфер. Браузер може не підтримувати цю функцію або сторінка відкривається не через HTTPS.',
  },
  CONCURRENCY: {
    CONCURRENCY: 'Паралельність',
    DESCRIPTION:
      'Максимальна кількість завдань, які всі workers обробляють паралельно. Значення 0 прибирає ліміт.',
    SAVE: 'Зберегти',
    TITLE: 'Глобальна паралельність',
  },
  CONFIRM: {
    CANCEL_BTN: 'Скасувати',
    CONFIRM_BTN: 'Підтвердити',
    DEFAULT_TITLE: 'Підтвердити дію?',
  },
  DASHBOARD: {
    EMPTY_STATE: 'Немає черг для показу.',
    EMPTY_STATE_FILTERED: 'Немає черг із завданнями у статусі {{status}}.',
    JOBS_COUNT: '{{count}} завдань',
    JOBS_COUNT_one: '{{count}} завдання',
    SORTING: {
      ACTIVE: 'Активні завдання',
      ALPHABETICAL: 'За алфавітом (А-Я)',
      COMPLETED: 'Завершені завдання',
      DELAYED: 'Відкладені завдання',
      FAILED: 'Помилки',
      TITLE: 'Сортувати за',
      WAITING: 'Очікують',
    },
  },
  JOB: {
    ACTIONS: {
      CLEAN: 'Очистити',
      CONFIRM: {
        CLEAN: 'Очистити це завдання?',
        PROMOTE: 'Перенести це завдання в активну чергу?',
        RETRY: 'Повторити це завдання?',
      },
      DUPLICATE: 'Дублювати',
      PROMOTE: 'Просунути',
      RETRY: 'Повторити',
      UPDATE_DATA: 'Оновити дані',
    },
    ADDED_AT: 'Додано',
    ATTEMPTS: 'спроба #{{attempts}}',
    DELAYED_FOR: 'відкладено на',
    DELAY_CHANGED: '*Delay змінено; новий час запуску поки невідомий',
    DURATION: {
      MILLI_SECS: '{{duration}} мс',
      SECS: '{{duration}} с',
    },
    FAILED_AT: 'Помилка',
    FINISHED_AT: 'Завершено',
    LOGS: {
      FILTER_PLACEHOLDER: 'Фільтри',
    },
    NA: 'Н/Д',
    NO_ERRORS: 'Помилок не записано',
    NO_LOGS: 'Логів немає',
    NO_PROGRESS: 'Даних прогресу немає',
    NOT_FOUND: 'Завдання не знайдено',
    PROCESSED_BY: 'оброблено {{processedBy}}',
    PROCESS_STARTED_AT: 'Обробку почато',
    REPEAT: 'повтор {{count}}',
    REPEAT_WITH_LIMIT: '$t(JOB.REPEAT) / {{limit}}',
    SHOW_DATA_BTN: 'Показати дані',
    SHOW_ERRORS_BTN: 'Показати помилки',
    SHOW_OPTIONS_BTN: 'Показати опції',
    SHOW_PROGRESS_BTN: 'Показати прогрес',
    STATUS: 'Статус: {{status}}',
    TABS: {
      DATA: 'Дані',
      DEFAULT: 'За замовчуванням',
      ERROR: 'Помилка',
      LOGS: 'Логи',
      OPTIONS: 'Опції',
      PROGRESS: 'Прогрес',
      TIMELINE: 'Таймлайн',
    },
    WILL_RUN_AT: 'Буде запущено',
  },
  LOADING: 'Завантаження...',
  MENU: {
    COLLAPSE_ALL: 'Згорнути всі групи',
    EXPAND_ALL: 'Розгорнути всі групи',
    OVERVIEW: 'Огляд',
    PAUSED: 'На паузі',
    QUEUES: 'ЧЕРГИ',
    SEARCH_INPUT_PLACEHOLDER: 'Фільтр черг',
  },
  MODAL: {
    CLOSE_BTN: 'Закрити',
  },
  QUEUE: {
    ACTIONS: {
      ADD_JOB: 'Додати завдання',
      CLEAN_ALL: 'Очистити всі',
      CONFIRM: {
        CLEAN_ALL: 'Очистити всі завдання у статусі {{status}}?',
        EMPTY_QUEUE: 'Очистити чергу?',
        OBLITERATE_QUEUE:
          'Повністю видалити цю чергу?\n\nЦе видалить чергу і всі її Redis keys.\nПеред цим черга має бути на паузі.',
        PAUSE_ALL: 'Поставити всі черги на паузу?',
        PAUSE_QUEUE: 'Поставити обробку черги на паузу?',
        PROMOTE_ALL: 'Перенести всі відкладені завдання в активну чергу?',
        RESUME_ALL: 'Відновити всі черги?',
        RESUME_QUEUE: 'Відновити обробку черги?',
        RETRY_ALL: 'Повторити всі завдання у статусі {{status}}?',
      },
      EMPTY: 'Очистити',
      MODAL_TITLE: '',
      OBLITERATE: 'Видалити повністю',
      PAUSE: 'Пауза',
      PAUSE_ALL: 'Пауза для всіх',
      PROMOTE_ALL: 'Просунути всі',
      RESUME: 'Відновити',
      RESUME_ALL: 'Відновити всі',
      RETRY_ALL: 'Повторити всі',
      SET_CONCURRENCY: 'Задати паралельність',
    },
    EMPTY_STATE: 'У цій черзі немає завдань у статусі {{status}}.',
    NOT_FOUND: 'Чергу не знайдено',
    STATUS: {
      ACTIVE: 'Активні',
      COMPLETED: 'Завершені',
      DELAYED: 'Відкладені',
      FAILED: 'Помилки',
      LATEST: 'Останні',
      PAUSED: 'На паузі',
      PRIORITIZED: 'Пріоритетні',
      WAITING: 'Очікують',
      'WAITING-CHILDREN': 'Очікують дочірні',
    },
  },
  REDIS: {
    BLOCKED_CLIENTS: 'Заблоковані клієнти',
    CONNECTED_CLIENTS: 'Підключені клієнти',
    ERROR: {
      MEMORY_USAGE: 'Не вдалося отримати статистику памʼяті',
    },
    FRAGMENTATION_RATIO: 'Коефіцієнт фрагментації',
    MEMORY_USAGE: 'Використання памʼяті',
    MODE: 'Режим',
    OS: 'ОС',
    PEEK_MEMORY: 'Пікове використання памʼяті',
    TITLE: 'Деталі Redis',
    UP_TIME: 'Час роботи',
    VERSION: 'Версія',
  },
  SETTINGS: {
    COLLAPSE_JOB: 'Згортати завдання',
    COLLAPSE_JOB_DATA: 'Згортати дані завдання',
    COLLAPSE_JOB_ERROR: 'Згортати помилки завдання',
    COLLAPSE_JOB_OPTIONS: 'Згортати опції завдання',
    COLLAPSE_JOB_PROGRESS: 'Згортати прогрес завдання',
    CONFIRM_JOB_ACTIONS: 'Підтверджувати дії із завданнями',
    CONFIRM_QUEUE_ACTIONS: 'Підтверджувати дії з чергами',
    DARK_MODE: 'Темна тема',
    DEFAULT_COLLAPSE_DEPTH: 'Глибина згортання JSON за замовчуванням (0-10)',
    DEFAULT_JOB_TAB: 'Вкладка завдання за замовчуванням',
    JOBS_PER_PAGE: 'Завдань на сторінку (1-50)',
    LANGUAGE: 'Мова',
    POLLING_INTERVAL: 'Інтервал оновлення',
    POLLING_OPTIONS: {
      MINS: '{{count}} хв',
      MINS_one: '{{count}} хв',
      OFF: 'Вимкнено',
      SECS: '{{count}} с',
    },
    SORT_QUEUES: 'Сортувати черги (А-Я, групи першими)',
    TITLE: 'Налаштування',
    USE_COLLAPSIBLE_JSON: 'Використовувати collapsible JSON',
  },
  UPDATE_JOB_DATA: {
    JOB_DATA: 'Дані завдання',
    TITLE: 'Оновити дані завдання',
    UPDATE: 'Оновити',
  },
};

export function sendBullBoardUkrainianLocale(
  _request: Request,
  response: Response,
): void {
  response.json(bullBoardUkMessages);
}

export function injectBullBoardUkrainianHtml(
  _request: Request,
  response: Response,
  next: () => void,
): void {
  const originalSend = response.send.bind(response);
  response.send = ((body?: unknown) => {
    if (typeof body === 'string' && body.includes('__UI_CONFIG__')) {
      return originalSend(localizeBullBoardHtml(body));
    }
    return originalSend(body);
  }) as Response['send'];

  next();
}

function localizeBullBoardHtml(html: string): string {
  return html
    .replace('<html lang="en" dir="ltr">', '<html lang="uk" dir="ltr">')
    .replace('Loading', 'Завантаження')
    .replace('</body>', `${queueNameTranslationScript()}</body>`);
}

function queueNameTranslationScript(): string {
  const queueNamesJson = JSON.stringify(bullBoardQueueDisplayNames);

  return `<script>
(() => {
  const queueNames = ${queueNamesJson};
  const fallbackText = {
    'Bull Dashboard': 'Панель черг',
    'ACTIVE': 'АКТИВНІ',
    'WAITING': 'ОЧІКУЮТЬ',
    'WAITING CHILDREN': 'ОЧІКУЮТЬ ДОЧІРНІ',
    'PRIORITIZED': 'ПРІОРИТЕТНІ',
    'COMPLETED': 'ЗАВЕРШЕНІ',
    'FAILED': 'ПОМИЛКИ',
    'DELAYED': 'ВІДКЛАДЕНІ',
    'PAUSED': 'НА ПАУЗІ',
    'QUEUES': 'ЧЕРГИ',
    'Filter queues': 'Фільтр черг',
  };

  function pluralJobs(count) {
    const value = Number(count);
    if (!Number.isFinite(value)) return 'завдань';
    const mod10 = value % 10;
    const mod100 = value % 100;
    if (mod10 === 1 && mod100 !== 11) return 'завдання';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'завдання';
    return 'завдань';
  }

  function translateText(text) {
    const trimmed = text.trim();
    if (!trimmed) return text;
    let translated = queueNames[trimmed] || fallbackText[trimmed];
    const jobsMatch = trimmed.match(/^(\\d+)\\s+Jobs?$/);
    if (!translated && jobsMatch) {
      translated = jobsMatch[1] + ' ' + pluralJobs(jobsMatch[1]);
    }
    if (!translated) return text;
    return text.replace(trimmed, translated);
  }

  function translateAttributes(element) {
    for (const attribute of ['placeholder', 'title', 'aria-label']) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const translated = translateText(value);
      if (translated !== value) element.setAttribute(attribute, translated);
    }
  }

  function translate(root) {
    document.documentElement.lang = 'uk';
    document.title = 'Панель черг';
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const translated = translateText(node.nodeValue || '');
      if (translated !== node.nodeValue) node.nodeValue = translated;
      node = walker.nextNode();
    }
    root.querySelectorAll('input, button, a, [title], [aria-label]').forEach(translateAttributes);
  }

  let scheduled = false;
  function scheduleTranslate() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      translate(document.body);
    });
  }

  document.addEventListener('DOMContentLoaded', scheduleTranslate);
  new MutationObserver(scheduleTranslate).observe(document.body, {
    childList: true,
    subtree: true,
  });
  scheduleTranslate();
})();
</script>`;
}
