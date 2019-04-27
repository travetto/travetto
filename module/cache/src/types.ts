import { Class } from '@travetto/registry';

export interface CacheEntry<V> {
  value: V;
  time: number;
  ttl?: number;
}

export type OptProm<K> = K | Promise<K>;

export interface CacheStore<V> {
  size: OptProm<number>;
  name: string;
  init?(): OptProm<void>;
  get(key: string): OptProm<CacheEntry<V>> | undefined;
  has(key: string): OptProm<boolean>;
  delete(key: string): OptProm<boolean>;
  set(key: string, v: CacheEntry<V>): OptProm<any>;
  clear(): OptProm<void>;
  trim(size: number): OptProm<void>;
  forEach(fn: (v: CacheEntry<V>, k: string) => void, self?: any): OptProm<void>;
}

export interface CacheConfig<V> {
  max: number;
  ttl: number;
  name?: string;
  type: Class<CacheStore<V>>;
  dispose?(value: V, key: string): OptProm<void>;
}