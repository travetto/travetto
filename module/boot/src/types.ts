// Log types
export type LogLevel = 'info' | 'warn' | 'debug' | 'error';

export type LineContext = { file: string, line: number, category: string };

export interface ConsoleListener {
  onLog<T extends LineContext>(context: LogLevel, ctx: T, args: unknown[]): void;
}