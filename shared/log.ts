import { redact } from './utils';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  time: number;
  level: LogLevel;
  scope: string;
  msg: string;
  data?: unknown;
}

const RING_CAPACITY = 200;
const ringBuffer: LogEntry[] = [];

function pushLog(entry: LogEntry): void {
  if (ringBuffer.length >= RING_CAPACITY) {
    ringBuffer.shift();
  }
  ringBuffer.push(entry);
}

export function getLogs(): LogEntry[] {
  return [...ringBuffer];
}

export function clearLogs(): void {
  ringBuffer.length = 0;
}

function write(level: LogLevel, scope: string, msg: string, data?: unknown): void {
  const sanitizedData = data !== undefined ? redact(data) : undefined;
  const entry: LogEntry = {
    time: Date.now(),
    level,
    scope,
    msg,
    data: sanitizedData,
  };
  pushLog(entry);

  const prefix = `[LexiFlow:${scope}] ${msg}`;
  if (level === 'error') {
    console.error(prefix, sanitizedData ?? '');
  } else if (level === 'warn') {
    console.warn(prefix, sanitizedData ?? '');
  } else if (level === 'info') {
    console.info(prefix, sanitizedData ?? '');
  } else {
    console.debug(prefix, sanitizedData ?? '');
  }
}

export const log = {
  debug: (scope: string, msg: string, data?: unknown) => write('debug', scope, msg, data),
  info: (scope: string, msg: string, data?: unknown) => write('info', scope, msg, data),
  warn: (scope: string, msg: string, data?: unknown) => write('warn', scope, msg, data),
  error: (scope: string, msg: string, data?: unknown) => write('error', scope, msg, data),
  getLogs,
  clearLogs,
};
