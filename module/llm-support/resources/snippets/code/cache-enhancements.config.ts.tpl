import { Config } from '@travetto/config';

@Config('cache')
export class CacheConfig {
  ttlMs = 30000;
}
