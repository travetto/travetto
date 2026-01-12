import { ShutdownManager, type Class, type TimeSpan, TimeUtil, Util, castTo, hasFunction } from '@travetto/runtime';

import type { ModelExpirySupport } from '../types/expiry.ts';
import type { ModelType } from '../types/model.ts';
import { ModelRegistryIndex } from '../registry/registry-index.ts';

/**
 * Utils for model expiry
 */
export class ModelExpiryUtil {

  /**
   * Type guard for determining if model supports expiry
   */
  static isSupported = hasFunction<ModelExpirySupport>('deleteExpired');

  /**
   * Get expiry info for a given item
   */
  static getExpiryState<T extends ModelType>(cls: Class<T>, item: T): { expiresAt?: Date, expired?: boolean } {
    const expKey = ModelRegistryIndex.getExpiryFieldName(cls);
    const expiresAt: Date = castTo(item[expKey]);

    return {
      expiresAt,
      expired: expiresAt ? expiresAt.getTime() < Date.now() : undefined
    };
  }

  /**
   * Delete all expired on a fixed interval, if supported and needed
   * @param service
   */
  static registerCull(service: ModelExpirySupport & { readonly config?: { cullRate?: number | TimeSpan } }): void {
    const cullable = ModelRegistryIndex.getClasses().filter(cls => !!ModelRegistryIndex.getConfig(cls).expiresAt);
    if (service.deleteExpired && cullable.length) {
      const cullInterval = TimeUtil.asMillis(service.config?.cullRate ?? '10m');

      (async (): Promise<void> => {
        await Util.nonBlockingTimeout(1000);
        while (!ShutdownManager.signal.aborted) {
          await Util.nonBlockingTimeout(cullInterval);
          await Promise.all(cullable.map(cls => service.deleteExpired(cls)));
        }
      })();
    }
  }
}