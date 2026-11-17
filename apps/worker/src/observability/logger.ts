type LogFields = Record<string, unknown>;
type LogLevel = 'error' | 'info';

function write(level: LogLevel, event: string, fields: LogFields) {
  const payload = {
    ...fields,
    event,
    level,
    timestamp: new Date().toISOString(),
  };
  const line = JSON.stringify(payload);

  if (level === 'error') {
    console.error(line);
    return;
  }

  console.info(line);
}

export function logInfo(event: string, fields: LogFields): void {
  write('info', event, fields);
}

export function logError(event: string, fields: LogFields): void {
  write('error', event, fields);
}
