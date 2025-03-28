import type { Class, Primitive } from '@travetto/runtime';

import { ModelType } from '../types/model.ts';

type ValidFieldNames<T> = {
  [K in keyof T]:
  (T[K] extends (Primitive | undefined) ? K :
    (T[K] extends (Function | undefined) ? never :
      K))
}[keyof T];

type RetainFields<T> = Pick<T, ValidFieldNames<T>>;

export type SortClauseRaw<T> = {
  [P in keyof T]?:
  T[P] extends object ? SortClauseRaw<RetainFields<T[P]>> : 1 | -1;
};

type IndexClauseRaw<T> = {
  [P in keyof T]?:
  T[P] extends object ? IndexClauseRaw<RetainFields<T[P]>> : 1 | -1 | true;
};

export type DataHandler<T = unknown> = (inst: T) => (Promise<T | void> | T | void);

export type PrePersistScope = 'full' | 'partial' | 'all';

/**
 * Model options
 */
export class ModelOptions<T extends ModelType = ModelType> {
  /**
   * Class for model
   */
  class: Class<T>;
  /**
   * Store name
   */
  store?: string;
  /**
   * If a sub type
   */
  subType?: boolean;
  /**
   * Is a base type?
   */
  baseType?: boolean;
  /**
   * Indices
   */
  indices?: IndexConfig<T>[];
  /**
   * Vendor specific extras
   */
  extra?: object;
  /**
   * Does the model support expiry
   */
  expiresAt: string;
  /**
   * Auto create in development mode
   */
  autoCreate: boolean;
  /**
   * Pre-persist handlers
   */
  prePersist?: { scope: PrePersistScope, handler: DataHandler<unknown> }[];
  /**
   * Post-load handlers
   */
  postLoad?: DataHandler<unknown>[];
}

/**
 * Supported index types
 */
export type IndexType = 'unique' | 'unsorted' | 'sorted';

/**
 * Index options
 */
export type IndexConfig<T extends ModelType> = {
  /**
   * Index name
   */
  name: string;
  /**
   * Fields and sort order
   */
  fields: IndexClauseRaw<RetainFields<T>>[];
  /**
   * Type
   */
  type: IndexType;
};

export type IndexField<T extends ModelType> = IndexClauseRaw<RetainFields<T>>;