import { Class, hasFunction } from '@travetto/runtime';
import { ModelType, ModelCrudSupport, ModelRegistryIndex } from '@travetto/model';

import { ModelQueryCrudSupport } from '../types/crud.ts';

export class ModelQueryCrudUtil {
  /**
   * Type guard for determining if service supports query crud operations
   */
  static isSupported = hasFunction<ModelQueryCrudSupport>('deleteByQuery');

  /**
   * Delete all expired
   */
  static async deleteExpired<T extends ModelType>(svc: ModelQueryCrudSupport & ModelCrudSupport, cls: Class<T>): Promise<number> {
    const expiry = await ModelRegistryIndex.getExpiryFieldName(cls);
    const count = await svc.deleteByQuery<ModelType>(cls, {
      where: {
        [expiry]: {
          $lt: new Date()
        }
      }
    });
    return count ?? 0;
  }
}