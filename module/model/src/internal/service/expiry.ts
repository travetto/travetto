import { Class, ShutdownManager, Util, TimeSpan } from '@travetto/base';

import { ModelRegistry } from '../../registry/model';
import { ModelExpirySupport } from '../../service/expiry';
import { ModelType } from '../../types/model';

/**
 * Utils for model expiry
 */
export class ModelExpiryUtil {

  /**
   * Get expiry info for a given item
   */
  static getExpiryState<T extends ModelType>(cls: Class<T>, item: T): { expiresAt?: Date, expired?: boolean } {
    const expKey = ModelRegistry.getExpiry(cls);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const keyAsT = expKey as keyof T;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const expiresAt = item[keyAsT] ? item[keyAsT] as unknown as Date : undefined;

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
      let running = true;
      const cullInterval = Util.timeToMs(svc.config?.cullRate ?? '10m');

      ShutdownManager.onShutdown({
        close(cb) {
          running = false;
          cb?.();
        },
        name: 'expiry-culling'
      });
      (async (): Promise<void> => {
        await Util.wait('1s');  // Wait a second to start culling
        while (running) {
          await Util.wait(cullInterval);
          await Promise.all(cullable.map(cls => svc.deleteExpired(cls)));
        }
      })();
    }
  }
}