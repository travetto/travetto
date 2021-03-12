import { Class } from '@travetto/base';
import { Primitive } from '@travetto/base/src/internal/global-types';

import { ModelType } from '../types/model';

type ValidFieldNames<T> = {
  [K in keyof T]:
  (T[K] extends (Primitive | undefined) ? K :
    (T[K] extends (Function | undefined) ? never :
      K))
}[keyof T];

type RetainFields<T> = Pick<T, ValidFieldNames<T>>;

export type SortClauseRaw<T> = {
  [P in keyof T]?:
  T[P] extends object ? SortClauseRaw<RetainFields<T[P]>> : (1 | -1 | boolean);
};

type SortClause<T> = SortClauseRaw<RetainFields<T>>;

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
   * If a sub type, identifier type
   */
  subType?: string;
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
}

/**
 * Index options
 */
export interface IndexConfig<T extends ModelType> {
  /**
   * Index name
   */
  name: string;
  /**
   * Fields and sort order
   */
  fields: SortClause<T>[];
  /**
   * Is the index unique?
   */
  unique?: boolean;
}