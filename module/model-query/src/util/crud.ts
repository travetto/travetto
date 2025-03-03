import { Class, hasFunction } from '@travetto/runtime';
import { ModelType, ModelCrudSupport, ModelRegistry } from '@travetto/model';

import { ModelQueryCrudSupport } from '../types/crud';

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