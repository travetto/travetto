import { hasFunction } from '@travetto/runtime';

import { ModelQueryFacetSupport } from '../types/facet';

export class ModelQueryFacetUtil {
  /**
   * Type guard for determining if service supports query facet operations
   */
  static isSupported = hasFunction<ModelQueryFacetSupport>('facet');
}