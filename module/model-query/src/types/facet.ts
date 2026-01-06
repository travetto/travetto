import type { Class } from '@travetto/runtime';
import type { ModelType } from '@travetto/model';

import type { ModelQuery } from '../model/query.ts';
import type { ModelQuerySupport } from './query.ts';
import type { ValidStringFields } from '../model/where-clause.ts';

export type ModelQueryFacet = { key: string, count: number };

/**
 * The contract for a model service with faceting support
 * @concrete
 */
export interface ModelQueryFacetSupport extends ModelQuerySupport {
  /**
   * Facet a given class on a specific field, limited by an optional query
   * @param cls The model class to facet on
   * @param field The field to facet on
   * @param query Additional query filtering
   */
  facet<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, query?: ModelQuery<T>): Promise<ModelQueryFacet[]>;
}