// Log types
export type LogLevel = 'info' | 'warn' | 'debug' | 'error';

export type LineContext = { source: string, line: number, module: string, modulePath: string, scope?: string };

export interface ConsoleListener {
  setDebug?(val: string | boolean): void;
  onLog<T extends LineContext>(context: LogLevel, ctx: T, args: unknown[]): void;
}