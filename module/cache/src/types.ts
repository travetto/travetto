import { AppError } from '@travetto/base';

export interface CoreCacheConfig {
  params?: (...params: any[]) => any[];
  key?: (...params: any[]) => string;
  keySpace?: string;
}

export interface CacheConfig extends CoreCacheConfig {
  maxAge?: number;
  serialize?: (output: any) => string;
  deserialize?: (input: string) => any;
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

export class CacheError extends AppError { }
