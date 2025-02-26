import { BinaryUtil, Util } from '@travetto/runtime';

import { CoreCacheConfig } from './types.ts';

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
    const key = `${config.keySpace!}_${Util.encodeSafeJSON(keyParams)}`;
    return BinaryUtil.hash(key, 32);
  }
}