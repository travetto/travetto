import type { Any, Class, DeepPartial, IntrinsicType } from '@travetto/runtime';

import type { ModelType, OptionalId } from '../types/model.ts';
import type { ModelBasicSupport } from './basic.ts';

type TypeProjection<T, V> = {
  [P in keyof T]?:
  (T[P] extends (IntrinsicType | undefined) ? (V | undefined) :
    (T[P] extends Any[] ?
      (TypeProjection<T[P][number], V> | null | undefined)[] :
      TypeProjection<T[P], V>)
  );
};

export type KeyedIndexSelection<T> = TypeProjection<T, true>;
export type SortedIndexSelection<T> = TypeProjection<T, true | 1 | -1>;

export type KeyedIndexBody<T, K> = {
  [P in keyof K]: (P extends keyof T ?
    (K[P] extends true | undefined ? T[P] :
      (T[P] extends Any[] | null | undefined ? T[P] :
        KeyedIndexBody<T[P], NonNullable<K[P]>>))
    : never);
};

export type KeyedIndexWithPartialBody<T, K> = {
  [P in keyof K]: (P extends keyof T ?
    (K[P] extends true | undefined ? T[P] :
      (T[P] extends Any[] | null | undefined ? T[P] :
        // Recurse for nested objects
        KeyedIndexWithPartialBody<T[P], NonNullable<K[P]>>)
    )
    : never);
} &
  // 2. All other fields in T (not in K) become OPTIONAL
  DeepPartial<Omit<T, keyof K>>;

export interface KeyedIndex<T extends ModelType, K extends KeyedIndexSelection<T>> {
  cls: Class<T>;
  name: string;
  type: 'keyed';
  keys: K;
}

export interface UniqueIndex<T extends ModelType, K extends KeyedIndexSelection<T>> {
  cls: Class<T>;
  name: string;
  type: 'unique';
  keys: K;
  unique: true;
}

export interface SortedIndex<T extends ModelType, S extends SortedIndexSelection<T>> {
  cls: Class<T>;
  name: string;
  type: 'sorted';
  sort: S;
  reversed: boolean;
}

export interface SortedKeyedIndex<
  T extends ModelType,
  K extends KeyedIndexSelection<T>,
  S extends SortedIndexSelection<T>
> {
  cls: Class<T>;
  name: string;
  type: 'sortedKeyed';
  keys: K;
  sort: S;
  reversed: boolean;
}

export type AllIndexes<T extends ModelType> =
  KeyedIndex<T, Any> | SortedIndex<T, Any> | UniqueIndex<T, Any> | SortedKeyedIndex<T, Any, Any>;

export type ListPageOptions<O = string> = {
  limit: number;
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
  >(cls: Class<T>, idx: UniqueIndex<T, K>, body: KeyedIndexBody<T, K>): Promise<T>;

  /**
   * Delete entity by index as defined by fields of idx and the body fields
   * @param cls The type to search by
   * @param idx The index to search against
   * @param body The payload of fields needed to search
   */
  deleteByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
  >(cls: Class<T>, idx: UniqueIndex<T, K>, body: KeyedIndexBody<T, K>): Promise<void>;

  /**
   * Upsert by index, allowing the index to act as a primary key
   * @param cls The type to create for
   * @param idx The index to use
   * @param body The document to potentially store
   */
  upsertByIndex<T extends ModelType, K extends KeyedIndexSelection<T>>(
    cls: Class<T>,
    idx: UniqueIndex<T, K>,
    body: OptionalId<T>
  ): Promise<T>;

  /**
   * Update by index
   * @param cls The type to update for
   * @param idx The index to update by
   * @param body The document to update
   */
  updateByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>
  >(cls: Class<T>, idx: UniqueIndex<T, K>, body: T): Promise<T>;

  /**
   * Update partial by index
   * @param cls The type to update for
   * @param idx The index to update by
   * @param body The partial document to update
   */
  updatePartialByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>
  >(cls: Class<T>, idx: UniqueIndex<T, K>, body: KeyedIndexWithPartialBody<T, K>): Promise<T>;

  /**
   * List entity by ranged index as defined by fields of idx and the body fields
   * @param cls The type to search by
   * @param idx The index to search against
   * @param body The configuration for listing
   */
  listByKeyedIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>
  >(cls: Class<T>, idx: KeyedIndex<T, K>, body: KeyedIndexBody<T, K>): AsyncIterable<T>;

  /**
   * List entity by ranged index as defined by fields of idx
   * @param cls The type to search by
   * @param idx The index to search against
   * @param options The configuration for listing
   */
  listBySortedIndex<
    T extends ModelType,
    S extends SortedIndexSelection<T>
  >(cls: Class<T>, idx: SortedIndex<T, S>, options: ListPageOptions): Promise<ListPageResult<T>>;

  /**
   * List entity by ranged index as defined by fields of idx and the body fields
   * @param cls The type to search by
   * @param idx The index to search against
   * @param body The field to key by
   * @param options The configuration for listing
   */
  listBySortedKeyedIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(
    cls: Class<T>,
    idx: SortedKeyedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    options: ListPageOptions
  ): Promise<ListPageResult<T>>;
}