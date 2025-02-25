import { Class } from '@travetto/runtime';
import { ModelCrudSupport, ModelType } from '@travetto/model';

import { ModelQuerySupport } from './query.ts';
import { ModelQuery } from '../model/query.ts';

/**
 * The contract for a model service with query support
 * @concrete ../internal/service/common.ts#ModelQueryCrudSupportTarget
 */
export interface ModelQueryCrudSupport extends ModelCrudSupport, ModelQuerySupport {
  /**
   * A standard update operation, but ensures the data matches the query before the update is finalized
   * @param cls The model class
   * @param data The data
   * @param query The additional query to validate
  */
  updateByQuery<T extends ModelType>(cls: Class<T>, data: T, query: ModelQuery<T>): Promise<T>;
  /**
   * Update all with partial data, by query
   * @param cls The model class
   * @param query The query to search for
   * @param data The partial data
   */
  updatePartialByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<number>;
  /**
   * Delete all by query
   * @param cls The model class
   * @param query Query to search for deletable elements
   */
  deleteByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>): Promise<number>;
}