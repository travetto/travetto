import { Class } from '@travetto/registry';

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
  name?: string;

  /**
   * Fields and sort order
   */
  fields: Record<keyof T, -1 | 1>[];

  /**
   * Is the index unique?
   */
  unique?: boolean;
}