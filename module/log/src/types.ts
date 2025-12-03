import { ConsoleEvent } from '@travetto/runtime';

export const LogCommonSymbol = Symbol.for('@travetto/log:common');

/**
 * Logging event
 * @concrete
 */
export interface LogEvent extends ConsoleEvent {
  /**
   * Log message
   */
  message?: string;
}

/**
 * Log event decorator
 * @concrete
 */
export interface LogDecorator {
  decorate(event: LogEvent): LogEvent;
}

/**
 * Output appender for the logger
 * @concrete
 */
export interface LogAppender {
  append(event: LogEvent, formatted: string): void;
}

/**
 * Output formatter
 * @concrete
 */
export interface LogFormatter {
  format(event: LogEvent): string;
}

/**
 * Basic logging contract
 * @concrete
 */
export interface Logger {
  log(event: LogEvent): unknown;
}