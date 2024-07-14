import { ShutdownManager, Class, TimeSpan, TimeUtil, Util } from '@travetto/base';

import { ModelRegistry } from '../../registry/model';
import { ModelExpirySupport } from '../../service/expiry';
import { ModelType } from '../../types/model';
import { NotFoundError } from '../../error/not-found';

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
      const running = new AbortController();
      const cullInterval = TimeUtil.asMillis(svc.config?.cullRate ?? '10m');

      ShutdownManager.onGracefulShutdown(async () => running.abort(), this);

      (async (): Promise<void> => {
        await Util.nonBlockingTimeout(1000);
        while (!running.signal.aborted) {
          await Util.nonBlockingTimeout(cullInterval);
          await Promise.all(cullable.map(cls => svc.deleteExpired(cls)));
        }
      })();
    }
  }

  /**
   * Simple cull operation for a given model type
   * @param svc
   */
  static async naiveDeleteExpired<T extends ModelType>(svc: ModelExpirySupport, cls: Class<T>, suppressErrors = false): Promise<number> {
    const deleting = [];
    for await (const el of svc.list(cls)) {
      if (this.getExpiryState(cls, el).expired) {
        deleting.push(svc.delete(cls, el.id).catch(err => {
          if (!suppressErrors && !(err instanceof NotFoundError)) {
            throw err;
          }
        }));
      }
    }
    return (await Promise.all(deleting)).length;
  }
}