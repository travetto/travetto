import type { ModelType, IndexConfig } from '@travetto/model';
import { type IntrinsicType, type Any, type DeepPartial } from '@travetto/runtime';

type TypeProjection<T, V, B = IntrinsicType> = {
  [P in keyof T]?:
  (T[P] extends (B | undefined) ? (V | undefined) :
    (T[P] extends Any[] ?
      (TypeProjection<T[P][number], V, B> | null | undefined)[] :
      TypeProjection<T[P], V, B>)
  );
};

export type KeyedIndexSelection<T extends ModelType> = TypeProjection<T, true>;
export type SortedIndexSelection<T extends ModelType> = TypeProjection<T, 1 | -1>;

export type KeyedIndexBody<T, K> = {
  [P in keyof K]: (P extends keyof T ?
    (K[P] extends true | 1 | -1 ? T[P] :
      (T[P] extends Any[] | null | undefined ? T[P] :
        KeyedIndexBody<T[P], NonNullable<K[P]>>))
    : never);
};

type Merge<A, B> = {
  [K in keyof A | keyof B]: (K extends keyof A & keyof B ?
    A[K] | B[K] : (K extends keyof B ?
      B[K] : (K extends keyof A ?
        A[K] : never
      )
    )
  );
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


export type FullKeyedIndexBody<T, K, S> = KeyedIndexBody<Omit<T, 'id'>, Merge<K, S>> & { id?: string };
export type FullKeyedIndexWithPartialBody<T, K, S> = KeyedIndexWithPartialBody<Omit<T, 'id'>, Merge<K, S>> & { id?: string };

export type TemplateValue = 1 | -1 | true;
export type TemplatePart<T extends TemplateValue = TemplateValue> = { path: string[], value: T, part: 'key' | 'sort' };

export interface KeyedIndex<
  T extends ModelType,
  K extends KeyedIndexSelection<T>,
  S extends SortedIndexSelection<T>
> extends IndexConfig<'indexed:keyed'> {
  key: K;
  sort: S;
  unique: boolean;
  keyTemplate: TemplatePart<true>[];
  sortTemplate: TemplatePart<1 | -1>[];
}

export interface SortedIndex<
  T extends ModelType,
  K extends KeyedIndexSelection<T>,
  S extends SortedIndexSelection<T>
> extends IndexConfig<'indexed:sorted'> {
  key: K;
  sort: S;
  keyTemplate: TemplatePart<true>[];
  sortTemplate: TemplatePart<1 | -1>[];
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

