import { Class, hasFunction } from '@travetto/runtime';

import { ModelQueryCrudSupport } from '../types/crud';
import { ModelType, ModelCrudSupport, ModelRegistry } from '@travetto/model';

export class ModelQueryCrudUtil {
  /**
   * Type guard for determining if service supports query crud operations
   */
  static isSupported = hasFunction<ModelQueryCrudSupport>('deleteByQuery');

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