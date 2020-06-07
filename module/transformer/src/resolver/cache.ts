import * as ts from 'typescript';
import { AnyType } from './types';

/**
 * Cache for handling recursive checks
 */
export class VisitCache {
  storage = new Map<ts.Type, AnyType>();

  /**
   * Get cache entry with default
   * @param tsType
   * @param type
   */
  getOrSet(tsType: ts.Type, type?: AnyType): AnyType | undefined {
    // Check for recursion
    switch (type?.key) {
      case 'shape':
      case 'external': {
        if (this.storage.has(tsType)) {
          const target = this.storage.get(tsType)!;
          if (target.key !== 'pointer') {
            return { key: 'pointer', target };
          } else {
            return target;
          }
        } else {
          this.storage.set(tsType, type);
        }
      }
    }

    return type;
  }
}
