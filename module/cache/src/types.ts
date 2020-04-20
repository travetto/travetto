type OrProm<T> = Promise<T> | T;

export interface CoreCacheConfig {
  params?: (...params: any[]) => any[];
  key?: (...params: any[]) => string;
  keySpace?: string;
}

export interface CacheConfig extends CoreCacheConfig {
  maxAge?: number;
  serialize?: (output: any) => string;
  reinstate?: (input: any) => any;
  extendOnAccess?: boolean;
}

export interface CacheEntry {
  key: string;
  maxAge?: number;
  expiresAt?: number;
  stream?: boolean;
  issuedAt: number;
  data: any;
  extendOnAccess?: boolean;
}

export interface CacheStoreType<T extends CacheEntry = CacheEntry> {
  get(key: string): OrProm<T | undefined>;
  has(key: string): OrProm<boolean>;
  set(key: string, entry: T): OrProm<CacheEntry>;

  isExpired(key: string): OrProm<boolean>;
  touch(key: string, expiresAt: number): OrProm<boolean>;
  delete(key: string): OrProm<boolean>;
  keys(): OrProm<Iterable<string>>;
  clear?(): OrProm<void> | void;
  postConstruct?(): OrProm<void>;
  computeKey(params: any): OrProm<string>;

  getAndCheckAge(config: CacheConfig, key: string): OrProm<any>;
  setWithAge(config: CacheConfig, entry: Partial<T> & { data: any, key: string }): OrProm<CacheEntry>;
  getOptional(config: CacheConfig, key: string): OrProm<CacheEntry | undefined>;
}

export type ValidCacheFields<T> = {
  [K in keyof T]:
  (T[K] extends CacheStoreType ? K : never)
}[keyof T];
