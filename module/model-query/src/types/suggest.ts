import type { Class } from '@travetto/runtime';
import type { ModelType } from '@travetto/model';

import type { PageableModelQuery } from '../model/query.ts';
import type { ModelQuerySupport } from './query.ts';
import type { ValidStringFields } from '../model/where-clause.ts';

/**
 * The contract for a model service with suggesting support
 * @concrete
 */
export interface ModelQuerySuggestSupport extends ModelQuerySupport {
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
}