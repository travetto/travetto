import { Class, ShutdownManager } from '@travetto/base';

import { ModelRegistry } from '../../registry/model';
import { ExpiryState, ModelExpirySupport } from '../../service/expiry';
import { ModelType } from '../../types/model';

/**
 * Utils for model expiry
 */
export class ModelExpiryUtil {

  /**
   * Get expiry for a given item
   */
  static getExpiryForItem<T extends ModelType>(cls: Class<T>, item: T) {
    const now = new Date(Date.now() - 1);
    const { expiresAt, issuedAt } = ModelRegistry.getExpiry(cls);
    const exp = item[expiresAt as keyof T] ? item[expiresAt as keyof T] as unknown as Date : now;
    const iss = item[issuedAt as keyof T] ? item[issuedAt as keyof T] as unknown as Date : now;

    return {
      issuedAt: iss,
      expiresAt: exp,
      maxAge: issuedAt ? exp.getTime() - iss.getTime() : undefined,
      expired: exp.getTime() < Date.now()
    } as ExpiryState;
  }

  /**
   * Delete all expired on a fixed interval, if supported and needed
   * @param svc
   */
  static registerCull(svc: ModelExpirySupport & { readonly config?: { cullRate?: number } }) {
    const expirable = ModelRegistry.getClasses().filter(cls => !!ModelRegistry.get(cls).expiry);
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