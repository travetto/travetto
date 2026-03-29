import type { ModelType, IndexConfig } from '@travetto/model';
import type { IntrinsicType, Any, DeepPartial } from '@travetto/runtime';

type TypeProjection<T, V> = {
  [P in keyof T]?:
  (T[P] extends (IntrinsicType | undefined) ? (V | undefined) :
    (T[P] extends Any[] ?
      (TypeProjection<T[P][number], V> | null | undefined)[] :
      TypeProjection<T[P], V>)
  );
};

export type KeyedIndexSelection<T> = TypeProjection<T, true>;
export type SortedIndexSelection<T> = TypeProjection<T, 1 | -1>;

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

export interface UniqueIndex<T extends ModelType, K extends KeyedIndexSelection<T>> extends IndexConfig<'indexed:unique'> {
  keys: K;
  unique: true;
}

export interface KeyedIndex<T extends ModelType, K extends KeyedIndexSelection<T>> extends IndexConfig<'indexed:keyed'> {
  keys: K;
}

export interface SortedIndex<T extends ModelType, S extends SortedIndexSelection<T>> extends IndexConfig<'indexed:sorted'> {
  sort: S;
  reversed: boolean;
}

export interface SortedKeyedIndex<
  T extends ModelType,
  K extends KeyedIndexSelection<T>,
  S extends SortedIndexSelection<T>
> extends IndexConfig<'indexed:sortedKeyed'> {
  keys: K;
  sort: S;
  reversed: boolean;
}

export type SingleItemIndex<
  T extends ModelType,
  K extends KeyedIndexSelection<T> = Any
> = UniqueIndex<T, K> | KeyedIndex<T, K> | SortedKeyedIndex<T, K, Any>;

export type MultipleItemIndex<
  T extends ModelType,
  K extends KeyedIndexSelection<T> = Any,
  S extends SortedIndexSelection<T> = Any
> = SortedIndex<T, S> | SortedKeyedIndex<T, K, S>;

export type AllIndexes<T extends ModelType> =
  SortedIndex<T, Any> | UniqueIndex<T, Any> | SortedKeyedIndex<T, Any, Any> | KeyedIndex<T, Any>;