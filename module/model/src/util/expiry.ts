import { ShutdownManager, Class, TimeSpan, TimeUtil, Util, castTo, hasFunction } from '@travetto/runtime';

import { ModelRegistry } from '../registry/model.ts';
import { ModelExpirySupport } from '../types/expiry.ts';
import { ModelType } from '../types/model.ts';

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
    const expKey = ModelRegistry.getExpiry(cls);
    const expiresAt: Date = castTo(item[expKey]);

    return {
      expiresAt,
      expired: expiresAt ? expiresAt.getTime() < Date.now() : undefined
    };
  }

  /**
   * Delete all expired on a fixed interval, if supported and needed
   * @param svc
   */
  static registerCull(svc: ModelExpirySupport & { readonly config?: { cullRate?: number | TimeSpan } }): void {
    const cullable = ModelRegistry.getClasses().filter(cls => !!ModelRegistry.get(cls).expiresAt);
    if (svc.deleteExpired && cullable.length) {
      const running = new AbortController();
      const cullInterval = TimeUtil.asMillis(svc.config?.cullRate ?? '10m');

      ShutdownManager.onGracefulShutdown(async () => running.abort());

      (async (): Promise<void> => {
        await Util.nonBlockingTimeout(1000);
        while (!running.signal.aborted) {
          await Util.nonBlockingTimeout(cullInterval);
          await Promise.all(cullable.map(cls => svc.deleteExpired(cls)));
        }
      })();
    }
  }
}