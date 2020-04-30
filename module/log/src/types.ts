import { ConsolePayload } from '@travetto/base';

// TODO: Document
export const LogLevels = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5
};

export type LogListener = (e: LogEvent) => void;

export type LogLevel = ConsolePayload['level'];

// TODO: Document
export interface LogEvent extends ConsolePayload {
  timestamp: number;
  prefix?: string;
  message?: string;
  args?: any[];
  meta?: any;
}

// TODO: Document
export interface OutputHandler {
  output(msg: string): void;
}

// TODO: Document
export interface Formatter {
  format(e: LogEvent): string;
}

// TODO: Document
export type LogStream = {
  formatter: Formatter;
  stdout: OutputHandler;
  stderr: OutputHandler;
  key: string | symbol;
};