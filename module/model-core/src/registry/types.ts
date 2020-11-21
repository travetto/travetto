import { Class } from '@travetto/registry';

type Primitive = number | boolean | string | Date;

type ValidFieldNames<T> = {
  [K in keyof T]:
  (T[K] extends (Primitive | undefined) ? K :
    (T[K] extends (Function | undefined) ? never :
      K))
}[keyof T];

type RetainFields<T> = Pick<T, ValidFieldNames<T>>;

type SortClauseRaw<T> = {
  [P in keyof T]?:
  T[P] extends object ? SortClauseRaw<RetainFields<T[P]>> : (1 | -1 | boolean);
};

/**
 * Model options
 */
export class ModelOptions<T> {
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
}

/**
 * Index options
 */
export interface IndexConfig<T> {

  /**
   * Index name
   */
  name: string;

  /**
   * Fields and sort order
   */
  fields: SortClauseRaw<T>[];

  /**
   * Is the index unique?
   */
  unique?: boolean;
}