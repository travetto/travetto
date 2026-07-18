import { type ModelCrudSupport, type ModelType, NotFoundError, type OptionalId } from '@travetto/model';
import { type Class, castTo, hasFunction } from '@travetto/runtime';

import type { KeyedIndexSelection, SingleItemIndex, SortedIndexSelection } from './types/indexes.ts';
import type { ModelIndexedSupport } from './types/service.ts';

/**
 * Utils for working with indexed model services
 */
export class ModelIndexedUtil {
  /**
   * Type guard for determining if service supports indexed operation
   */
  static isSupported = hasFunction<ModelIndexedSupport>('getByIndex');

  /**
   * Naive upsert by index
   * @param service
   * @param cls
   * @param idx
   * @param body
   */
  static async naiveUpsert<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    service: ModelIndexedSupport & ModelCrudSupport,
    cls: Class<T>,
    idx: SingleItemIndex<T, K, S>,
    body: OptionalId<T>
  ): Promise<T> {
    try {
      return await this.naiveUpdate(service, cls, idx, body);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return await service.create(cls, body);
      } else {
        throw error;
      }
    }
  }

  /**
   * Naive update by index
   * @param service
   * @param cls
   * @param idx
   * @param body
   */
  static async naiveUpdate<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    service: ModelIndexedSupport & ModelCrudSupport,
    cls: Class<T>,
    idx: SingleItemIndex<T, K, S>,
    body: OptionalId<T>
  ): Promise<T> {
    const { id } = await service.getByIndex(cls, idx, castTo(body));
    body.id = id;
    return await service.update(cls, castTo(body));
  }

  /**
   * Build regex for suggesting
   */
  static getSuggestRegex(prefix?: string): RegExp {
    return prefix ? new RegExp(`^${prefix}`, 'i') : /./;
  }
}
