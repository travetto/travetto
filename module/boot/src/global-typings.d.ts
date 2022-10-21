import type { LogLevel } from './console';

declare global {
  interface Error {
    toJSON(sub?: unknown): unknown;
    resolveStack?(text?: string): string;
  }
  interface Map<K, V> { toJSON(): unknown }
  interface Set<T> { toJSON(): unknown }
  interface ObjectConstructor {
    keys<T = unknown, K extends keyof T = keyof T>(o: T): K[];
    fromEntries<K extends string | symbol, V>(items: [K, V][]): Record<K, V>;
    entries<K extends Record<symbol | string, unknown>>(record: K): [keyof K, K[keyof K]][];
  }
  interface Object {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    __proto__: unknown;
  }

  var ᚕ: {
    // Global file loaded
    self: string | undefined;
    // Log replacement
    log(level: LogLevel | 'log', ctx: { file: string, line: number }, ...args: unknown[]): void;
    // Simple wrapper for creating source
    src(file: string): string;
    // Main handler
    main<T>(target: (...args: unknown[]) => T, args?: string[], respond?: boolean): Promise<T>;
  };

  // Parallel to __filename, but cleansed
  var __source: string;
}