import type { Any, Class, DeepPartial, IntrinsicType } from '@travetto/runtime';

import type { ModelType, OptionalId } from '../types/model.ts';
import type { ModelBasicSupport } from './basic.ts';

type DeepPartialWithType<T, V> = {
  [P in keyof T]?: (T[P] extends (IntrinsicType | undefined) ? (V | undefined) :
    (T[P] extends Any[] ? (DeepPartialWithType<T[P][number], V> | null | undefined)[] : DeepPartialWithType<T[P], V>));
};

type ExactIndexBody<T, K> = {
  [P in keyof K]: (P extends keyof T ?
    (K[P] extends true | undefined ?
      T[P] : (T[P] extends Any[] | null | undefined ?
        T[P] : ExactIndexBody<T[P], NonNullable<K[P]>>))
    : never);
};

type IndexMergedBody<T, K> = {
  [P in keyof K]: (P extends keyof T ?
    (K[P] extends true | undefined ?
      T[P] : (T[P] extends Any[] | null | undefined ?
        T[P] : IndexMergedBody<T[P], NonNullable<K[P]>>)
    ) // Recurse for nested objects
    : never);
} &
  // 2. All other fields in T (not in K) become OPTIONAL
  DeepPartial<Omit<T, keyof K>>;

interface KeyedIndex<
  T extends ModelType,
  K extends DeepPartialWithType<T, true>,
  U extends boolean = false
> {
  cls: Class<T>;
  unique: U;
  keys: K;
}

interface SortedIndex<
  T extends ModelType,
  S extends DeepPartialWithType<T, true>
> {
  cls: Class<T>;
  unique: false;
  sort: S;
  reversed: boolean;
}

interface SortedKeyedIndex<
  T extends ModelType,
  K extends DeepPartialWithType<T, true>,
  S extends DeepPartialWithType<T, true>
> extends KeyedIndex<T, K>, SortedIndex<T, S> { }

export type ModelIndexedListPageOptions<O = string> = {
  limit: number;
  offset?: O;
};

export type ModelIndexListPageResult<T extends ModelType> = {
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
    K extends DeepPartialWithType<T, true>,
  >(cls: Class<T>, idx: KeyedIndex<T, K>, body: ExactIndexBody<T, K>): Promise<T>;

  /**
   * Delete entity by index as defined by fields of idx and the body fields
   * @param cls The type to search by
   * @param idx The index to search against
   * @param body The payload of fields needed to search
   */
  deleteByIndex<
    T extends ModelType,
    K extends DeepPartialWithType<T, true>,
  >(cls: Class<T>, idx: KeyedIndex<T, K>, body: ExactIndexBody<T, K>): Promise<void>;

  /**
   * Upsert by index, allowing the index to act as a primary key
   * @param cls The type to create for
   * @param idx The index to use
   * @param body The document to potentially store
   */
  upsertByIndex<
    T extends ModelType,
    K extends DeepPartialWithType<T, true>,
  >(
    cls: Class<T>,
    idx: KeyedIndex<T, K>,
    body: IndexMergedBody<T, K> & OptionalId<T>
  ): Promise<T>;

  /**
   * Update by index
   * @param cls The type to update for
   * @param idx The index to update by
   * @param body The document to update
   */
  updateByIndex<
    T extends ModelType,
    K extends DeepPartialWithType<T, true>
  >(cls: Class<T>, idx: KeyedIndex<T, K>, body: IndexMergedBody<T, K>): Promise<T>;

  /**
   * Update partial by index
   * @param cls The type to update for
   * @param idx The index to update by
   * @param body The partial document to update
   */
  updatePartialByIndex<
    T extends ModelType,
    K extends DeepPartialWithType<T, true>
  >(cls: Class<T>, idx: KeyedIndex<T, K>, body: IndexMergedBody<DeepPartial<T>, K>): Promise<T>;

  /**
   * List entity by ranged index as defined by fields of idx and the body fields
   * @param cls The type to search by
   * @param idx The index to search against
   * @param body The configuration for listing
   */
  listByKeyedIndex<
    T extends ModelType,
    K extends DeepPartialWithType<T, true>
  >(cls: Class<T>, idx: KeyedIndex<T, K>, body: ExactIndexBody<T, K>): AsyncIterable<T>;

  /**
   * List entity by ranged index as defined by fields of idx and the body fields
   * @param cls The type to search by
   * @param idx The index name to search against
   * @param options The configuration for listing
   */
  listBySortedIndex<
    T extends ModelType,
    S extends DeepPartialWithType<T, true>
  >(cls: Class<T>, idx: SortedIndex<T, S>, options: ModelIndexedListPageOptions): Promise<ModelIndexListPageResult<T>>;

  /**
   * List entity by ranged index as defined by fields of idx and the body fields
   * @param cls The type to search by
   * @param idx The index name to search against
   * @param options The configuration for listing
   */
  listBySortedKeyedIndex<
    T extends ModelType,
    K extends DeepPartialWithType<T, true>,
    S extends DeepPartialWithType<T, true>
  >(
    cls: Class<T>,
    idx: SortedKeyedIndex<T, K, S>,
    body: ExactIndexBody<T, K>,
    options: ModelIndexedListPageOptions
  ): Promise<ModelIndexListPageResult<T>>;
}