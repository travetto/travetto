export const LogLevels = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5
}

export type LogLevel = keyof (typeof LogLevels);

export type LogListener = (e: LogEvent) => any;

export interface LogContext {
  file?: string;
  line?: number;
  timestamp: number;
  level: LogLevel;
  category?: string;
}

export interface LogEvent extends LogContext {
  message?: string;
  args?: any[];
  meta?: any;
}
