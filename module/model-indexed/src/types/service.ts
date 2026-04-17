import type { ModelType, ModelBasicSupport, OptionalId, ModelListOptions } from '@travetto/model';
import type { Class } from '@travetto/runtime';

import type {
  KeyedIndexSelection, KeyedIndexBody, SortedIndexSelection, SortedIndex,
  SingleItemIndex, FullKeyedIndexBody, FullKeyedIndexWithPartialBody,
  SortedIndexSelectionType
} from './indexes.ts';
import type { ModelIndexedSearchOptions, ModelPageOptions, ModelPageResult } from './list.ts';

/**
 * Support for simple indexed activity
 *
 * @concrete
 */
export interface ModelIndexedSupport extends ModelBasicSupport {
  /**
   * Get entity by index as defined by fields of idx and the body fields
   * @param cls The type to search by
   * @param idx The index to search against
   * @param body The payload of fields needed to search
   */
  getByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(cls: Class<T>, idx: SingleItemIndex<T, K, S>, body: FullKeyedIndexBody<T, K, S>): Promise<T>;

  /**
   * Delete entity by index as defined by fields of idx and the body fields
   * @param cls The type to search by
   * @param idx The index to search against
   * @param body The payload of fields needed to search
   */
  deleteByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(cls: Class<T>, idx: SingleItemIndex<T, K, S>, body: FullKeyedIndexBody<T, K, S>): Promise<void>;

  /**
   * Upsert by index, allowing the index to act as a primary key
   * @param cls The type to create for
   * @param idx The index to use
   * @param body The document to potentially store
   */
  upsertByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(cls: Class<T>, idx: SingleItemIndex<T, K, S>, body: OptionalId<T>): Promise<T>;

  /**
   * Update by index
   * @param cls The type to update for
   * @param idx The index to update by
   * @param body The document to update
   */
  updateByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(cls: Class<T>, idx: SingleItemIndex<T, K, S>, body: T): Promise<T>;

  /**
   * Update partial by index
   * @param cls The type to update for
   * @param idx The index to update by
   * @param body The partial document to update
   */
  updatePartialByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(cls: Class<T>, idx: SingleItemIndex<T, K, S>, body: FullKeyedIndexWithPartialBody<T, K, S>): Promise<T>;

  /**
   * Page through entities by ranged index as defined by fields of idx
   *
   * Note: Limit is generally honored, but can vary depending on the underlying storage implementation.
   *
   * @param cls The type to search by
   * @param idx The index to search against
   * @param body The payload of fields needed to search
   * @param options The configuration for pagination
   */
  pageByIndex<
    T extends ModelType,
    S extends SortedIndexSelection<T>,
    K extends KeyedIndexSelection<T>,
  >(cls: Class<T>, idx: SortedIndex<T, K, S>, body: KeyedIndexBody<T, K>, options?: ModelPageOptions): Promise<ModelPageResult<T>>;

  /**
   * List all entities by ranged index as defined by fields of idx
   *
   * Note: Limit is generally honored, but can vary depending on the underlying storage implementation.
   * Batch size hint can be used to optimize batch size, but is not guaranteed.
   *
   * @param cls The type to search by
   * @param idx The index to search against
   * @param body The payload of fields needed to search
   */
  listByIndex<
    T extends ModelType,
    S extends SortedIndexSelection<T>,
    K extends KeyedIndexSelection<T>,
  >(cls: Class<T>, idx: SortedIndex<T, K, S>, body: KeyedIndexBody<T, K>, options?: ModelListOptions): AsyncIterable<T[]>;

  /**
   * Suggest entities by ranged index as defined by fields of idx and a prefix
   *
   * Note: Limit is generally honored, but can vary depending on the underlying storage implementation.
   *
   * @param cls The type to search by
   * @param idx The index to search against
   * @param body The payload of fields needed to search
   * @param prefix The prefix to use for suggesting entities
   * @param options The configuration for pagination
   */
  suggestByIndex<
    T extends ModelType,
    S extends SortedIndexSelection<T>,
    K extends KeyedIndexSelection<T>,
    B extends SortedIndexSelectionType<T, S> & string
  >(cls: Class<T>, idx: SortedIndex<T, K, S>, body: KeyedIndexBody<T, K>, prefix: B, options?: ModelIndexedSearchOptions): Promise<T[]>;
}