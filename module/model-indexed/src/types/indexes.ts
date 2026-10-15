import type { IndexConfig, ModelType } from '@travetto/model';
import type { Any, DeepPartial, IntrinsicType } from '@travetto/runtime';

type SortScalar = string | number | Date;

type TypeProjection<T, V, B = IntrinsicType> = {
  [P in keyof T]?: T[P] extends B | undefined
    ? V | undefined
    : T[P] extends Any[]
      ? (TypeProjection<T[P][number], V, B> | null | undefined)[]
      : T[P] extends object
        ? object extends T[P]
          ? never
          : TypeProjection<T[P], V, B>
        : V | undefined;
};

export type SortedIndexSelectionType<T, S> = object extends T
  ? never
  : object extends S
    ? never
    : T extends SortScalar
      ? T
      : T extends Any[]
        ? SortedIndexSelectionType<T[number], S>
        : S extends object
          ? T extends object
            ? { [K in keyof S]: K extends keyof T ? SortedIndexSelectionType<T[K], S[K]> : never }[keyof S]
            : never
          : never;

export type KeyedIndexSelection<T extends ModelType> = TypeProjection<T, true>;
export type SortedIndexSelection<T extends ModelType> = TypeProjection<T, 1 | -1>;

export type KeyedIndexBody<T, K = Any> = {
  [P in keyof K]: P extends keyof T
    ? K[P] extends true | 1 | -1
      ? T[P]
      : T[P] extends Any[] | null | undefined
        ? T[P]
        : T[P] extends object
          ? object extends T[P]
            ? never
            : KeyedIndexBody<T[P], NonNullable<K[P]>>
          : T[P]
    : never;
};

type Merge<A, B> = {
  [K in keyof A | keyof B]: K extends keyof A & keyof B ? A[K] | B[K] : K extends keyof B ? B[K] : K extends keyof A ? A[K] : never;
};

export type KeyedIndexWithPartialBody<T, K> = {
  [P in keyof K]: P extends keyof T
    ? K[P] extends true | 1 | -1
      ? T[P]
      : T[P] extends Any[] | null | undefined
        ? T[P]
        : T[P] extends object
          ? object extends T[P]
            ? never
            : KeyedIndexWithPartialBody<T[P], NonNullable<K[P]>>
          : T[P]
    : never;
} & DeepPartial<Omit<T, keyof K>>;

export type FullKeyedIndexBody<T, K, S> = KeyedIndexBody<T, Merge<K, S>> & { id?: string };
export type FullKeyedIndexWithPartialBody<T, K, S> = KeyedIndexWithPartialBody<T, Merge<K, S>> & { id?: string };

export type TemplateValue = 1 | -1 | true;
export type TemplatePart<T extends TemplateValue = TemplateValue> = { path: string[]; value: T; part: 'key' | 'sort' };

export interface KeyedIndex<
  T extends ModelType,
  K extends KeyedIndexSelection<T> = Any,
  S extends SortedIndexSelection<T> = Any
> extends IndexConfig<'indexed:keyed'> {
  key: K;
  sort: S;
  unique: boolean;
  keyTemplate: TemplatePart<true>[];
  sortTemplate: TemplatePart<1 | -1>[];
}

export interface SortedIndex<
  T extends ModelType,
  K extends KeyedIndexSelection<T> = Any,
  S extends SortedIndexSelection<T> = Any
> extends IndexConfig<'indexed:sorted'> {
  key: K;
  sort: S;
  keyTemplate: TemplatePart<true>[];
  sortTemplate: TemplatePart<1 | -1>[];
}

export type SingleItemIndex<T extends ModelType, K extends KeyedIndexSelection<T> = Any, S extends SortedIndexSelection<T> = Any> =
  | KeyedIndex<T, K, S>
  | SortedIndex<T, K, S>;

export type AllIndexes<T extends ModelType, K extends KeyedIndexSelection<T> = Any, S extends SortedIndexSelection<T> = Any> =
  | KeyedIndex<T, K, S>
  | SortedIndex<T, K, S>;
