import { ConsoleContext } from '@travetto/base';

/**
 * Log levels, numerically
 */
export const LogLevels = {
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5
};

/**
 * Logging event
 */
export interface LogEvent extends ConsoleContext {
  /**
   * Time of event
   */
  timestamp: number;
  /**
   * Log message
   */
  message?: string;
  /**
   * Log arguments
   */
  args?: any[];

}

/**
 * Output appender for the logger
 */
export interface Appender {
  append(msg: string): void;
}

/**
 * Output formatter
 */
export interface Formatter {
  format(e: LogEvent): string;
}