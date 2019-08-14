export type ValidCacheFields<T> = {
  [K in keyof T]:
  (T[K] extends CacheStore ? K : never)
}[keyof T];

export interface CacheEntry {
  maxAge?: number;
  expiresAt?: number;
  stream?: boolean;
  issuedAt: number;
  data: any;
  extendOnAccess?: boolean;
}

export abstract class CacheStore {

  computeKey(...args: any[]) {
    return JSON.stringify(args || []);
  }

  abstract get(key: string): Promise<CacheEntry | undefined> | CacheEntry | undefined;
  abstract has(key: string): Promise<boolean> | boolean;
  abstract set(key: string, value: CacheEntry): Promise<void> | void;
  abstract evict(key: string): Promise<boolean> | boolean;
  abstract touch(key: string): Promise<boolean> | boolean;
  reset?(): Promise<void> | void;
}