import type { Class } from '@travetto/runtime';

import type { ModelType } from '../types/model.ts';
import type { ModelCrudSupport } from './crud.ts';

/**
 * Support for managing expiration of data
 * @concrete
 */
export interface ModelExpirySupport extends ModelCrudSupport {
  /**
   * Delete all expired by class
   *
   * @returns Returns the number of documents expired
   */
  deleteExpired<T extends ModelType>(cls: Class<T>): Promise<number>;
}