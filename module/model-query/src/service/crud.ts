import { Class } from '@travetto/registry';
import { ModelCrudSupport, ModelType } from '@travetto/model';

import { ModelQuerySupport } from './query';
import { ModelQuery } from '../model/query';

/**
 * The contract for a model service with query support
 * @concrete ../internal/service/common:ModelQueryCrudSupportTarget
 */
export interface ModelQueryCrudSupport extends ModelCrudSupport, ModelQuerySupport {
  /**
   * Update/replace all with partial data, by query
   * @param cls The model class
   * @param query The query to search for
   * @param data The partial data
   */
  updateByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<number>;
  /**
   * Delete all by query
   * @param cls The model class
   * @param query Query to search for deletable elements
   */
  deleteByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>): Promise<number>;
}