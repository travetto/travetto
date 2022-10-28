// Manifest types
export * from '../support/bin/types';

// Log types
export type LogLevel = 'info' | 'warn' | 'debug' | 'error';

export type LineContext = { file: string, line: number };

export interface ConsoleListener {
  onLog<T extends LineContext>(context: LogLevel, ctx: T, args: unknown[]): void;
}