import { Class } from '@travetto/base';
import { ModelType } from '@travetto/model';

import { ModelQuery, PageableModelQuery } from '../model/query';
import { ModelQuerySupport } from './query';
import { ValidStringFields } from '../model/where-clause';

/**
 * The contract for a model service with faceting support
 * @concrete ../internal/service/common:ModelQueryFacetSupportTarget
 */
export interface ModelQueryFacetSupport extends ModelQuerySupport {
  /**
   * Suggest instances for a given cls and a given field (allows for duplicates with as long as they have different ids)
   *
   * @param cls The model class to suggest on
   * @param field The field to suggest on
   * @param prefix The search prefix for the given field
   * @param query A query to filter the search on, in addition to the prefix
   */
  suggest<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<T[]>;
  /**
   * Suggest distinct values for a given cls and a given field
   *
   * @param cls The model class to suggest on
   * @param field The field to suggest on
   * @param prefix The search prefix for the given field
   * @param query A query to filter the search on, in addition to the prefix
   */
  suggestValues<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<string[]>;
  /**
   * Facet a given class on a specific field, limited by an optional query
   * @param cls The model class to facet on
   * @param field The field to facet on
   * @param query Additional query filtering
   */
  facet<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, query?: ModelQuery<T>): Promise<{ key: string, count: number }[]>;
}