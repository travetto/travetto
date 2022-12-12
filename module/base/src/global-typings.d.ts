import './types'; // Needed (can be any import)

declare global {
  interface ObjectConstructor {
    keys<T = unknown, K extends keyof T = keyof T>(o: T): K[];
    fromEntries<K extends string | symbol, V>(items: ([K, V] | readonly [K, V])[]): Record<K, V>;
    entries<K extends Record<symbol | string, unknown>>(record: K): [keyof K, K[keyof K]][];
  }
}