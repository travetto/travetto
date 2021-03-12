import { Class } from '@travetto/base';

import { ModelType } from '../types/model';
import { ModelCrudSupport } from './crud';

/**
 * Support for managing expiration of data
 *
 * @concrete ../internal/service/common:ModelExpirySupportTarget
 */
export interface ModelExpirySupport extends ModelCrudSupport {
  /**
   * Delete all expired by class
   *
   * @returns Returns the number of documents expired
   */
  deleteExpired<T extends ModelType>(cls: Class<T>): Promise<number>;
}