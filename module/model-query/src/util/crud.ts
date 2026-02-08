import { type Class, hasFunction } from '@travetto/runtime';
import { type ModelType, type ModelCrudSupport, ModelRegistryIndex } from '@travetto/model';

import type { ModelQueryCrudSupport } from '../types/crud.ts';

export class ModelQueryCrudUtil {
  /**
   * Type guard for determining if service supports query crud operations
   */
  static isSupported = hasFunction<ModelQueryCrudSupport>('deleteByQuery');

  /**
   * Delete all expired
   */
  static async deleteExpired<T extends ModelType>(service: ModelQueryCrudSupport & ModelCrudSupport, cls: Class<T>): Promise<number> {
    const expiry = ModelRegistryIndex.getExpiryFieldName(cls);
    const count = await service.deleteByQuery<ModelType>(cls, {
      where: {
        [expiry]: {
          $lt: new Date()
        }
      }
    });
    return count ?? 0;
  }
}