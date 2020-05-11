import { ConsolePayload } from '@travetto/base';

/**
 * Log levels, numerically
 */
export const LogLevels = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5
};

/**
 * Logging event
 */
export interface LogEvent extends ConsolePayload {
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
 * Output handler for the logger
 */
export interface OutputHandler {
  output(msg: string): void;
}

/**
 * Output formatter
 */
export interface Formatter {
  format(e: LogEvent): string;
}

/**
 * Log stream definition
 */
export type LogStream = {
  formatter: Formatter;
  stdout: OutputHandler;
  stderr: OutputHandler;
  key: string | symbol;
};