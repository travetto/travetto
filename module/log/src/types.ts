import { LineContext, LogLevel } from '@travetto/base';

/**
 * Log levels, numerically
 */
export const LogLevels = {
  debug: 1,
  info: 2,
  warn: 3,
  error: 4
};

/**
 * Logging event
 */
export interface LogEvent extends LineContext {
  /**
   * Time of event, ISO 8601 timestamp
   */
  timestamp: string;
  /**
   * Log level
   */
  level: LogLevel;
  /**
   * Log message
   */
  message?: string;
  /**
   * Log Message context
   */
  context?: Record<string, unknown>;
  /**
   * Log arguments
   */
  args?: unknown[];
}

/**
 * Output appender for the logger
 */
export interface Appender {
  append(level: LogLevel, msg: string): void;
}

/**
 * Output formatter
 */
export interface Formatter {
  format(e: LogEvent): string;
}