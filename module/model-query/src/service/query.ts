import { Class } from '@travetto/registry';
import { ModelType } from '@travetto/model';

import { ModelQuery, PageableModelQuery } from '../model/query';

/**
 * The contract for a model service with query support
 * @concrete ../internal/service/common:ModelQuerySupportTarget
 */
export interface ModelQuerySupport {
  /**
   * Executes a query against the model space
   * @param cls The model class
   * @param query The query to execute
   */
  query<T extends ModelType>(cls: Class<T>, query: PageableModelQuery<T>): Promise<T[]>;
  /**
   * Find one by query, fail if not found
   * @param cls The model class
   * @param query The query to search for
   * @param failOnMany Should the query fail on more than one result found
   */
  queryOne<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, failOnMany?: boolean): Promise<T>;
  /**
   * Find the count of matching documents by query.
   * @param cls The model class
   * @param query The query to count for
   */
  queryCount<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>): Promise<number>;
}