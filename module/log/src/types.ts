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
  decorate(ev: LogEvent): LogEvent;
}

/**
 * Output appender for the logger
 * @concrete
 */
export interface LogAppender {
  append(ev: LogEvent, formatted: string): void;
}

/**
 * Output formatter
 * @concrete
 */
export interface LogFormatter {
  format(e: LogEvent): string;
}

/**
 * Basic logging contract
 * @concrete
 */
export interface Logger {
  log(ev: LogEvent): unknown;
}