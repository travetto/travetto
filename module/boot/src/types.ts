// Log types
export type LogLevel = 'info' | 'warn' | 'debug' | 'error';

export type LineContext = { file: string, line: number, category: string, scope?: string };

export interface ConsoleListener {
  setDebug?(val: string | boolean): void;
  onLog<T extends LineContext>(context: LogLevel, ctx: T, args: unknown[]): void;
}