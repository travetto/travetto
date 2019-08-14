import { AppError } from '@travetto/base';

export interface CoreCacheConfig {
  params?: (...params: any[]) => any[];
  key?: (...params: any[]) => string;
  keySpace?: string;
}

export interface CacheConfig extends CoreCacheConfig {
  maxAge?: number;
  transform?: (output: any) => any;
  extendOnAccess?: boolean;
}

export class CacheError extends AppError { }
