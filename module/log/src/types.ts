import { ConsoleEvent } from '@travetto/base';
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
 */
export interface Appender {
  append(ev: LogEvent, formatted: string): void;
}

/**
 * Output formatter
 */
export interface Formatter {
  format(e: LogEvent): string;
}

/**
 * @concrete ./internal/types:LoggerTarget
 */
export interface Logger {
  onLog(ev: LogEvent): void;
}