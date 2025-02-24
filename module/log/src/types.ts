import { ConsoleEvent } from '@travetto/runtime';

export const LogCommonSymbol = Symbol.for('@travetto/log:common');

/**
 * Logging event
 */
export interface LogEvent extends ConsoleEvent {
  /**
   * Log message
   */
  message?: string;
}

/**
 * @concrete ./internal/types.ts#LogDecoratorTarget
 */
export interface LogDecorator {
  decorate(ev: LogEvent): LogEvent;
}

/**
 * Output appender for the logger
 * @concrete ./internal/types.ts#LogAppenderTarget
 */
export interface LogAppender {
  append(ev: LogEvent, formatted: string): void;
}

/**
 * Output formatter
 * @concrete ./internal/types.ts#LogFormatterTarget
 */
export interface LogFormatter {
  format(e: LogEvent): string;
}

/**
 * @concrete ./internal/types.ts#LoggerTarget
 */
export interface Logger {
  log(ev: LogEvent): unknown;
}