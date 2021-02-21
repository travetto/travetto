import { Class, ShutdownManager } from '@travetto/base';

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
  static getExpiryState<T extends ModelType>(cls: Class<T>, item: T) {
    const expKey = ModelRegistry.getExpiry(cls);
    const expiresAt = item[expKey as keyof T] ? item[expKey as keyof T] as unknown as Date : undefined;

    return {
      expiresAt,
      expired: expiresAt ? expiresAt.getTime() < Date.now() : undefined
    } as const;
  }

  /**
   * Delete all expired on a fixed interval, if supported and needed
   * @param svc
   */
  static registerCull(svc: ModelExpirySupport & { readonly config?: { cullRate?: number } }) {
    const expirable = ModelRegistry.getClasses().filter(cls => !!ModelRegistry.get(cls).expiresAt);
    if (svc.deleteExpired && expirable.length) {
      let running = false;
      const culler = async () => {
        const cullInterval = svc.config?.cullRate ?? 60 * 10 * 1000 /* 10 minutes */;
        while (running) {
          await new Promise(r => setTimeout(r, cullInterval));
          await Promise.all(expirable.map(cls => svc.deleteExpired?.(cls)));
        }
      };
      setTimeout(culler, 1000); // Wait a second to start culling
      ShutdownManager.onShutdown({
        close(cb) {
          running = false;
          cb?.();
        },
        name: 'expiry-culling'
      });
    }
  }
}