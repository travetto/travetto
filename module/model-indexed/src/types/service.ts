import type { ModelType, ModelBasicSupport, OptionalId } from '@travetto/model';
import type { Any, Class, DeepPartial } from '@travetto/runtime';
import type {
  KeyedIndexSelection, KeyedIndexBody, KeyedIndexWithPartialBody,
  SortedIndexSelection, SortedIndex,
  SingleItemIndex,
  SingleItemIndexBody,
  SingleItemPartialIndexBody
} from './indexes.ts';

export type ListPageOptions<O = string> = {
  limit?: number;
  offset?: O;
};

export type ListPageResult<T extends ModelType> = {
  items: T[];
  nextOffset?: string;
};

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
  >(cls: Class<T>, idx: SingleItemIndex<T, K, S>, body: SingleItemIndexBody<T, K, S>): Promise<T>;

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
  >(cls: Class<T>, idx: SingleItemIndex<T, K, S>, body: SingleItemIndexBody<T, K, S>): Promise<void>;

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
  >(cls: Class<T>, idx: SingleItemIndex<T, K, S>, body: SingleItemPartialIndexBody<T, K, S>): Promise<T>;

  /**
   * List entity by ranged index as defined by fields of idx
   * @param cls The type to search by
   * @param idx The index to search against
   * @param body The payload of fields needed to search
   * @param options The configuration for listing
   */
  listByIndex<
    T extends ModelType,
    S extends SortedIndexSelection<T>,
    K extends KeyedIndexSelection<T>
  >(cls: Class<T>, idx: SortedIndex<T, K, S>, body: KeyedIndexBody<T, K>, options?: ListPageOptions): Promise<ListPageResult<T>>;
}