import { ConsoleEvent } from '@travetto/base';

export const LogCommonⲐ = Symbol.for('@travetto/log:common');

/**
 * Logging event
 */
export interface LogEvent extends ConsoleEvent {
  /**
   * Log message
   */
  message?: string;
  /**
   * Log Message context
   */
  context?: Record<string, unknown>;
}

/**
 * Output appender for the logger
 * @concrete ./internal/types:LogAppenderTarget
 */
export interface LogAppender {
  append(ev: LogEvent, formatted: string): void;
}

/**
 * Output formatter
 * @concrete ./internal/types:LogFormatterTarget
 */
export interface LogFormatter {
  format(e: LogEvent): string;
}

/**
 * @concrete ./internal/types:LoggerTarget
 */
export interface Logger {
  onLog(ev: LogEvent): unknown;
}