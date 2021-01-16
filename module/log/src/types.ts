import { LogLevel } from '@travetto/base';
import { MessageContext } from '@travetto/base/src/internal/global-types';

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
export interface LogEvent {
  /**
   * Log level
   */
  level: LogLevel;
  /**
   * Line number
   */
  line: number;
  /**
   * File
   */
  file: string;
  /**
   * Categorization of file into a readible name
   */
  category: string;
  /**
   * Log message
   */
  message: string;
  /**
   * Time of event, ISO 8601 timestamp
   */
  timestamp: string;
  /**
   * The scope of identifiers to the location of the log statement
   */
  scope?: string;
  /**
   * Log Message context
   */
  context?: MessageContext;
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