import { Class } from '@travetto/base';
import { ModelCrudSupport } from '@travetto/model';
import { ModelRegistry } from '@travetto/model/src/registry/model';
import { ModelType } from '@travetto/model/src/types/model';
import { ModelQueryCrudSupport } from '../../service/crud';

/**
 * Utils for query expiry support
 */
export class ModelQueryExpiryUtil {
  /**
   * Delete all expired
   */
  static async deleteExpired<T extends ModelType>(svc: ModelQueryCrudSupport & ModelCrudSupport, cls: Class<T>) {
    const expiry = await ModelRegistry.getExpiry(cls);
    const res = await svc.deleteByQuery<ModelType>(cls, {
      where: {
        [expiry.expiresAt]: {
          $lt: new Date()
        }
      }
    });
    return res ?? 0;
  }
}