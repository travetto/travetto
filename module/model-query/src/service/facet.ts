import { Class } from '@travetto/base';
import { ModelType } from '@travetto/model';

import { ModelQuery } from '../model/query';
import { ModelQuerySupport } from './query';
import { ValidStringFields } from '../model/where-clause';

/**
 * The contract for a model service with faceting support
 * @concrete ../internal/service/common:ModelQueryFacetSupportTarget
 */
export interface ModelQueryFacetSupport extends ModelQuerySupport {
  /**
   * Facet a given class on a specific field, limited by an optional query
   * @param cls The model class to facet on
   * @param field The field to facet on
   * @param query Additional query filtering
   */
  facet<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, query?: ModelQuery<T>): Promise<{ key: string, count: number }[]>;
}