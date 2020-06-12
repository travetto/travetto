import { Class, METADATA } from './types';

/**
 * Metadata utils
 */
export class Metadata {
  /**
   * Read the metadata information for a class
   * @private
   */
  static read(el: Class<any>, key?: keyof Function[typeof METADATA]) {
    const res = el && '__id' in el ? el[METADATA] : undefined;
    if (res && key) {
      return res[key];
    }
    return res;
  }
}