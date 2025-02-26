import { Class } from '@travetto/runtime';

import { ModelType } from '../types/model.ts';
import { ModelCrudSupport } from './crud.ts';

/**
 * Support for managing expiration of data
 *
 * @concrete ../internal/service/common.ts#ModelExpirySupportTarget
 */
export interface ModelExpirySupport extends ModelCrudSupport {
  /**
   * Delete all expired by class
   *
   * @returns Returns the number of documents expired
   */
  deleteExpired<T extends ModelType>(cls: Class<T>): Promise<number>;
}