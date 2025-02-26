import { Class } from '@travetto/runtime';
import { ModelCrudSupport, ModelRegistry, ModelType } from '@travetto/model';

import { ModelQueryCrudSupport } from '../../service/crud.ts';

/**
 * Utils for query expiry support
 */
export class ModelQueryExpiryUtil {
  /**
   * Delete all expired
   */
  static async deleteExpired<T extends ModelType>(svc: ModelQueryCrudSupport & ModelCrudSupport, cls: Class<T>): Promise<number> {
    const expiry = await ModelRegistry.getExpiry(cls);
    const res = await svc.deleteByQuery<ModelType>(cls, {
      where: {
        [expiry]: {
          $lt: new Date()
        }
      }
    });
    return res ?? 0;
  }
}