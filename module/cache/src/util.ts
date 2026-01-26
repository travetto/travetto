import { CodecUtil } from '@travetto/runtime';

import type { CoreCacheConfig } from './types.ts';

/**
 * Standard cache utilities
 */
export class CacheUtil {

  /**
   * Generate key given config, cache source and input params
   */
  static generateKey(config: CoreCacheConfig, params: unknown[]): string {
    const input = config.params?.(params) ?? params;
    const keyParams = config.key?.(...input) ?? input;
    const key = `${config.keySpace!}_${CodecUtil.toBase64JSON(keyParams)}`;
    return CodecUtil.hash(key, { length: 32 });
  }
}