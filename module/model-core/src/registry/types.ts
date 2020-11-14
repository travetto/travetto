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
   * Vendor specific extras
   */
  extra?: object;
}