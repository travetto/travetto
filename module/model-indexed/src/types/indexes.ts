import type { ModelType, IndexConfig } from '@travetto/model';
import { type IntrinsicType, type Any, type DeepPartial, RuntimeError, type Class } from '@travetto/runtime';

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
    (K[P] extends true | 1 | -1 ? T[P] :
      (T[P] extends Any[] | null | undefined ? T[P] :
        KeyedIndexBody<T[P], NonNullable<K[P]>>))
    : never);
};

type Merge<A, B> = {
  [K in keyof A | keyof B]:
  K extends keyof A & keyof B
  ? A[K] | B[K]
  : K extends keyof B
  ? B[K]
  : K extends keyof A
  ? A[K]
  : never;
};

export type KeyedIndexWithPartialBody<T, K> = {
  [P in keyof K]: (P extends keyof T ?
    (K[P] extends true | 1 | -1 ? T[P] :
      (T[P] extends Any[] | null | undefined ? T[P] :
        // Recurse for nested objects
        KeyedIndexWithPartialBody<T[P], NonNullable<K[P]>>)
    )
    : never);
} &
  // 2. All other fields in T (not in K) become OPTIONAL
  DeepPartial<Omit<T, keyof K>>;


export type FullKeyedIndexBody<T, K, S> = KeyedIndexBody<T, Merge<K, S>>;
export type FullKeyedIndexWithPartialBody<T, K, S> = KeyedIndexWithPartialBody<T, Merge<K, S>>;

export interface KeyedIndex<
  T extends ModelType,
  K extends KeyedIndexSelection<T>,
  S extends SortedIndexSelection<T>
> extends IndexConfig<'indexed:keyed'> {
  keys: K;
  sort: S;
  unique: boolean;
}

export interface SortedIndex<
  T extends ModelType,
  K extends KeyedIndexSelection<T>,
  S extends SortedIndexSelection<T>
> extends IndexConfig<'indexed:sorted'> {
  keys: K;
  sort: S;
}

export type SingleItemIndex<
  T extends ModelType,
  K extends KeyedIndexSelection<T> = Any,
  S extends SortedIndexSelection<T> = Any
> = KeyedIndex<T, K, S> | SortedIndex<T, K, S>;

export type AllIndexes<
  T extends ModelType,
  K extends KeyedIndexSelection<T> = Any,
  S extends SortedIndexSelection<T> = Any
> = KeyedIndex<T, K, S> | SortedIndex<T, K, S>;

export class MissingIndexedFieldError<T extends ModelType> extends RuntimeError {
  constructor(cls: Class<T>, idx: AllIndexes<T>, fieldPath: string) {
    super(`Missing field value for index ${idx.name} on ${cls.name} at path ${fieldPath}`, {
      details: { cls: cls.name, index: idx.name, fieldPath }
    });
  }
}