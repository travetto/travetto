import { ConsolePayload } from '@travetto/boot';

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

export interface LogEvent extends ConsolePayload {
  timestamp?: Date;
  prefix?: string;
  message?: string;
  args?: any[];
  meta?: any;
}

export interface OutputHandler {
  output(msg: string): void;
}

export interface Formatter {
  format(e: LogEvent): string;
}

export type LogStream = {
  formatter: Formatter;
  stdout: OutputHandler;
  stderr: OutputHandler;
  key: string | symbol;
};