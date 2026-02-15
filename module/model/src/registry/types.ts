import type { Class, Primitive, ValidFields } from '@travetto/runtime';

import type { ModelType } from '../types/model.ts';

type RetainPrimitiveFields<T> = Pick<T, ValidFields<T, Primitive | Date>>;

export type SortClauseRaw<T> = {
  [P in keyof T]?:
  T[P] extends object ? SortClauseRaw<RetainPrimitiveFields<T[P]>> : 1 | -1;
};

type IndexClauseRaw<T> = {
  [P in keyof T]?:
  T[P] extends object ? IndexClauseRaw<RetainPrimitiveFields<T[P]>> : 1 | -1 | true;
};

export type DataHandler<T = unknown> = (inst: T) => (Promise<T | void> | T | void);

export type PrePersistScope = 'full' | 'partial' | 'all';

/**
 * Model config
 */
export class ModelConfig<T extends ModelType = ModelType> {
  /**
   * Class for model
   */
  class: Class<T>;
  /**
   * Store name
   */
  store: string;
  /**
   * Indices
   */
  indices?: IndexConfig<T>[];
  /**
   * Vendor specific extras
   */
  extra?: object;
  /**
   * Expiry field
   */
  expiresAt?: string;
  /**
   * Allows auto creation of a model storage backing at runtime
   */
  autoCreate?: 'production' | 'development' | 'off';
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
  fields: IndexClauseRaw<RetainPrimitiveFields<T>>[];
  /**
   * Type
   */
  type: IndexType;
};

export type IndexField<T extends ModelType> = IndexClauseRaw<RetainPrimitiveFields<T>>;